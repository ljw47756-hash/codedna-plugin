import { basename } from "node:path";
import { JsonStore, nowIso, sanitizeFilename, timestampedName } from "./jsonStore.js";
import type { ProjectProfile } from "../types/projectProfile.js";
import type {
  LayeredMemoryFile,
  LayeredMemoryRecord,
  LayeredMemorySnapshot,
  MemoryProposal,
  MemoryScope
} from "../types/layeredMemory.js";

export const MEMORY_SCHEMA_VERSION = 2;

export interface CodeDnaMemory {
  schema_version: number;
  ui_style_preferences: string[];
  code_preferences: string[];
  common_tech_stack: string[];
  rejected_behaviors: string[];
  successful_task_templates: Array<Record<string, unknown>>;
  common_project_rules: string[];
  common_codex_prompt_templates: string[];
  updated_at: string;
}

export interface MemorySnapshot {
  memory: CodeDnaMemory;
  successful_patterns: Array<Record<string, unknown>>;
  rejected_patterns: Array<Record<string, unknown>>;
  task_history: Array<Record<string, unknown>>;
  layered_memory: LayeredMemorySnapshot;
  memory_root: string;
}

export const defaultMemory: CodeDnaMemory = {
  schema_version: MEMORY_SCHEMA_VERSION,
  ui_style_preferences: ["dark", "minimal", "technical"],
  code_preferences: [
    "keep changes scoped",
    "preserve unrelated files",
    "prefer clear module boundaries",
    "run verification before claiming completion"
  ],
  common_tech_stack: ["Codex", "MCP", "TypeScript", "Markdown", "JSON"],
  rejected_behaviors: [
    "incomplete mock implementations",
    "unrelated refactors",
    "desktop-app scaffolding when a Codex plugin is requested",
    "single-file monoliths"
  ],
  successful_task_templates: [],
  common_project_rules: [
    "Use CodeDNA pairing before large Codex edits.",
    "Generate a Codex Task Pack before implementation.",
    "Review Codex output against constraints before accepting changes."
  ],
  common_codex_prompt_templates: [],
  updated_at: nowIso()
};

export class MemoryStore {
  readonly store: JsonStore;

  constructor(dataRoot: string) {
    this.store = new JsonStore(dataRoot);
  }

  async ensureLayout(): Promise<void> {
    await this.store.ensureDir(".");
    await this.store.ensureDir("memory/project_profiles");
    await this.store.ensureDir("memory/task_history");
    await this.store.ensureDir("memory/successful_patterns");
    await this.store.ensureDir("memory/rejected_patterns");
    await this.store.ensureDir("memory/successful-patterns");
    await this.store.ensureDir("memory/rejected-patterns");
    await this.store.ensureDir("memory/user");
    await this.store.ensureDir("memory/projects");
    await this.store.ensureDir("memory/sessions");
    await this.store.ensureDir("memory/proposals");
    await this.store.ensureDir("tasks");
    await this.store.ensureDir("reviews");
    await this.store.ensureDir("test-plans");
    const memory = await this.loadMemory();
    await this.store.writeJson("memory/user_preferences.json", memory);
    const userFile = await this.loadLayeredMemoryFile("user");
    await this.store.writeJson("memory/user/preferences.json", userFile);
  }

  async loadMemory(): Promise<CodeDnaMemory> {
    const saved = await this.store.readJson<Partial<CodeDnaMemory>>("memory/user_preferences.json", {});
    return this.migrateMemory(saved);
  }

  migrateMemory(saved: Partial<CodeDnaMemory>): CodeDnaMemory {
    return {
      ...defaultMemory,
      ...saved,
      schema_version: MEMORY_SCHEMA_VERSION,
      ui_style_preferences: mergeStrings(defaultMemory.ui_style_preferences, saved.ui_style_preferences),
      code_preferences: mergeStrings(defaultMemory.code_preferences, saved.code_preferences),
      common_tech_stack: mergeStrings(defaultMemory.common_tech_stack, saved.common_tech_stack),
      rejected_behaviors: mergeStrings(defaultMemory.rejected_behaviors, saved.rejected_behaviors),
      successful_task_templates: saved.successful_task_templates ?? defaultMemory.successful_task_templates,
      common_project_rules: mergeStrings(defaultMemory.common_project_rules, saved.common_project_rules),
      common_codex_prompt_templates: mergeStrings(defaultMemory.common_codex_prompt_templates, saved.common_codex_prompt_templates),
      updated_at: saved.updated_at ?? nowIso()
    };
  }

  async loadSnapshot(): Promise<MemorySnapshot> {
    return {
      memory: await this.loadMemory(),
      successful_patterns: await this.readRecordDirectory("memory/successful_patterns"),
      rejected_patterns: await this.readRecordDirectory("memory/rejected_patterns"),
      task_history: await this.readRecordDirectory("memory/task_history"),
      layered_memory: await this.loadLayeredSnapshot(),
      memory_root: this.store.path("memory")
    };
  }

  async updateMemory(
    patch: Partial<CodeDnaMemory>,
    event?: Record<string, unknown>,
    successfulPattern?: Record<string, unknown>,
    rejectedPattern?: Record<string, unknown>
  ): Promise<CodeDnaMemory> {
    const current = await this.loadMemory();
    const merged: CodeDnaMemory = {
      ...current,
      ...patch,
      schema_version: MEMORY_SCHEMA_VERSION,
      ui_style_preferences: mergeStrings(current.ui_style_preferences, patch.ui_style_preferences),
      code_preferences: mergeStrings(current.code_preferences, patch.code_preferences),
      common_tech_stack: mergeStrings(current.common_tech_stack, patch.common_tech_stack),
      rejected_behaviors: mergeStrings(current.rejected_behaviors, patch.rejected_behaviors),
      common_project_rules: mergeStrings(current.common_project_rules, patch.common_project_rules),
      common_codex_prompt_templates: mergeStrings(current.common_codex_prompt_templates, patch.common_codex_prompt_templates),
      successful_task_templates: [...current.successful_task_templates, ...(patch.successful_task_templates ?? [])],
      updated_at: nowIso()
    };
    await this.store.writeJson("memory/user_preferences.json", merged);
    if (event) {
      await this.writeTimestampedRecord("memory/task_history", "task-event", event);
    }
    if (successfulPattern) {
      await this.writeTimestampedRecord("memory/successful_patterns", recordName(successfulPattern, "successful-pattern"), successfulPattern);
    }
    if (rejectedPattern) {
      await this.writeTimestampedRecord("memory/rejected_patterns", recordName(rejectedPattern, "rejected-pattern"), rejectedPattern);
    }
    return merged;
  }

  async relatedRules(requestText: string): Promise<string[]> {
    const memory = await this.loadMemory();
    const lowered = requestText.toLowerCase();
    const rules = [
      ...memory.common_project_rules,
      ...memory.rejected_behaviors.map((item) => `Avoid: ${item}`)
    ];
    if (/(ui|interface|page|screen|style|visual|layout)/i.test(lowered)) {
      rules.push(`Preferred UI style: ${memory.ui_style_preferences.join(", ")}`);
    }
    return Array.from(new Set(rules.filter(Boolean)));
  }

  async saveProjectProfile(profile: ProjectProfile): Promise<string> {
    return this.store.writeJson(`memory/project_profiles/${sanitizeFilename(profile.project_name)}_project_profile.json`, profile);
  }

  async saveMemoryProposal(proposal: MemoryProposal): Promise<string> {
    return this.store.writeJson(`memory/proposals/${sanitizeFilename(proposal.proposal_id, "memory-proposal")}.json`, proposal);
  }

  async loadMemoryProposal(proposalId: string): Promise<MemoryProposal> {
    const proposal = await this.store.readJson<MemoryProposal | null>(
      `memory/proposals/${sanitizeFilename(proposalId, "memory-proposal")}.json`,
      null
    );
    if (!proposal) {
      throw new Error(`Memory proposal not found: ${proposalId}`);
    }
    return proposal;
  }

  async saveLayeredMemory(record: LayeredMemoryRecord): Promise<{ memory_path: string; saved_memory: LayeredMemoryRecord }> {
    const normalized = this.normalizeLayeredRecord(record);
    const relativePath = this.layeredMemoryPath(normalized);
    const file = await this.loadLayeredMemoryFile(normalized.memory_scope, normalized.project_id, normalized.task_id);
    const next: LayeredMemoryFile = {
      ...file,
      project_id: normalized.project_id ?? file.project_id,
      task_id: normalized.task_id ?? file.task_id,
      memories: upsertMemoryRecord(file.memories, normalized),
      updated_at: nowIso()
    };
    const memoryPath = await this.store.writeJson(relativePath, next);
    return { memory_path: memoryPath, saved_memory: normalized };
  }

  async loadLayeredSnapshot(): Promise<LayeredMemorySnapshot> {
    const user = await this.loadLayeredMemoryFile("user");
    const projects = await this.loadLayeredCollection("memory/projects", "project");
    const sessions = await this.loadLayeredCollection("memory/sessions", "session");
    const proposalFiles = await this.store.listJson("memory/proposals");
    const proposals: MemoryProposal[] = [];
    for (const file of proposalFiles) {
      proposals.push(await this.store.readJson<MemoryProposal>(`memory/proposals/${basename(file)}`, {} as MemoryProposal));
    }
    return {
      user,
      projects,
      sessions,
      proposals: proposals.filter((proposal) => Boolean(proposal.proposal_id))
    };
  }

  async saveArtifact(relativePath: string, data: unknown): Promise<string> {
    return this.store.writeJson(relativePath, data);
  }

  async saveMarkdown(relativePath: string, content: string): Promise<string> {
    return this.store.writeText(relativePath, content);
  }

  projectId(projectPath?: string): string {
    if (!projectPath) {
      return "global-project";
    }
    const normalized = projectPath.replace(/\\/g, "/").replace(/[/:]+/g, "-");
    return sanitizeFilename(normalized, "project");
  }

  taskId(taskId?: string): string {
    return sanitizeFilename(taskId || "current-task", "current-task");
  }

  private async writeTimestampedRecord(relativeDir: string, prefix: string, record: Record<string, unknown>): Promise<string> {
    const stamped = {
      ...record,
      schema_version: MEMORY_SCHEMA_VERSION,
      timestamp: nowIso()
    };
    return this.store.writeJson(`${relativeDir}/${timestampedName(prefix, ".json")}`, stamped);
  }

  private async readRecordDirectory(relativeDir: string): Promise<Array<Record<string, unknown>>> {
    const files = await this.store.listJson(relativeDir);
    const records: Array<Record<string, unknown>> = [];
    for (const file of files) {
      const relative = `${relativeDir}/${basename(file)}`;
      records.push(this.migrateRecord(await this.store.readJson<Record<string, unknown>>(relative, {})));
    }
    return records;
  }

  private migrateRecord(record: Record<string, unknown>): Record<string, unknown> {
    return {
      ...record,
      schema_version: MEMORY_SCHEMA_VERSION
    };
  }

  private async loadLayeredMemoryFile(scope: MemoryScope, projectId?: string, taskId?: string): Promise<LayeredMemoryFile> {
    const relativePath = this.layeredMemoryPath({
      memory_scope: scope,
      project_id: projectId,
      task_id: taskId
    });
    const fallback: LayeredMemoryFile = {
      schema_version: MEMORY_SCHEMA_VERSION,
      memory_scope: scope,
      project_id: projectId,
      task_id: taskId,
      memories: [],
      updated_at: nowIso()
    };
    const saved = await this.store.readJson<Partial<LayeredMemoryFile>>(relativePath, fallback);
    return {
      ...fallback,
      ...saved,
      schema_version: MEMORY_SCHEMA_VERSION,
      memory_scope: scope,
      project_id: saved.project_id ?? projectId,
      task_id: saved.task_id ?? taskId,
      memories: (saved.memories ?? []).map((record) => this.normalizeLayeredRecord(record)),
      updated_at: saved.updated_at ?? nowIso()
    };
  }

  private async loadLayeredCollection(relativeDir: string, scope: MemoryScope): Promise<Record<string, LayeredMemoryFile>> {
    const directories = await this.store.listDirectories(relativeDir);
    const result: Record<string, LayeredMemoryFile> = {};
    for (const id of directories) {
      const fileName = scope === "project" ? "project-memory.json" : "session-memory.json";
      result[id] = await this.store.readJson<LayeredMemoryFile>(`${relativeDir}/${id}/${fileName}`, {
        schema_version: MEMORY_SCHEMA_VERSION,
        memory_scope: scope,
        memories: [],
        updated_at: nowIso()
      });
    }
    return result;
  }

  private layeredMemoryPath(record: Pick<LayeredMemoryRecord, "memory_scope" | "project_id" | "task_id">): string {
    if (record.memory_scope === "user") {
      return "memory/user/preferences.json";
    }
    if (record.memory_scope === "project") {
      return `memory/projects/${sanitizeFilename(record.project_id || "global-project", "project")}/project-memory.json`;
    }
    return `memory/sessions/${sanitizeFilename(record.task_id || "current-task", "current-task")}/session-memory.json`;
  }

  private normalizeLayeredRecord(record: Partial<LayeredMemoryRecord>): LayeredMemoryRecord {
    const createdAt = record.created_at ?? nowIso();
    return {
      memory_id: sanitizeFilename(record.memory_id || timestampedName(String(record.memory_scope ?? "memory"), ""), "memory"),
      memory_scope: record.memory_scope ?? "session",
      content: String(record.content ?? "").trim(),
      source_text: String(record.source_text ?? "").trim(),
      reason: String(record.reason ?? "").trim(),
      confidence: typeof record.confidence === "number" && Number.isFinite(record.confidence) ? record.confidence : 0.5,
      requires_confirmation: Boolean(record.requires_confirmation),
      confirmed: Boolean(record.confirmed),
      project_id: record.project_id,
      task_id: record.task_id,
      created_at: createdAt,
      updated_at: nowIso(),
      schema_version: MEMORY_SCHEMA_VERSION
    };
  }
}

function mergeStrings(existing: string[] = [], incoming: string[] = []): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of [...existing, ...incoming]) {
    const value = String(item ?? "").trim();
    const key = value.toLowerCase();
    if (value && !seen.has(key)) {
      result.push(value);
      seen.add(key);
    }
  }
  return result;
}

function recordName(record: Record<string, unknown>, fallback: string): string {
  const raw = String(record.name ?? record.title ?? record.type ?? fallback);
  return sanitizeFilename(raw, fallback);
}

function upsertMemoryRecord(existing: LayeredMemoryRecord[], incoming: LayeredMemoryRecord): LayeredMemoryRecord[] {
  const index = existing.findIndex((record) => record.memory_id === incoming.memory_id);
  if (index < 0) {
    return [...existing, incoming];
  }
  const next = [...existing];
  next[index] = {
    ...next[index],
    ...incoming,
    updated_at: nowIso()
  };
  return next;
}
