import { basename } from "node:path";
import { JsonStore, nowIso, sanitizeFilename, timestampedName } from "./jsonStore.js";
export const MEMORY_SCHEMA_VERSION = 2;
export const defaultMemory = {
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
    store;
    constructor(dataRoot) {
        this.store = new JsonStore(dataRoot);
    }
    async ensureLayout() {
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
    async loadMemory() {
        const saved = await this.store.readJson("memory/user_preferences.json", {});
        return this.migrateMemory(saved);
    }
    migrateMemory(saved) {
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
    async loadSnapshot() {
        return {
            memory: await this.loadMemory(),
            successful_patterns: await this.readRecordDirectory("memory/successful_patterns"),
            rejected_patterns: await this.readRecordDirectory("memory/rejected_patterns"),
            task_history: await this.readRecordDirectory("memory/task_history"),
            layered_memory: await this.loadLayeredSnapshot(),
            memory_root: this.store.path("memory")
        };
    }
    async updateMemory(patch, event, successfulPattern, rejectedPattern) {
        const current = await this.loadMemory();
        const merged = {
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
    async relatedRules(requestText) {
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
    async saveProjectProfile(profile) {
        return this.store.writeJson(`memory/project_profiles/${sanitizeFilename(profile.project_name)}_project_profile.json`, profile);
    }
    async saveMemoryProposal(proposal) {
        return this.store.writeJson(`memory/proposals/${sanitizeFilename(proposal.proposal_id, "memory-proposal")}.json`, proposal);
    }
    async loadMemoryProposal(proposalId) {
        const proposal = await this.store.readJson(`memory/proposals/${sanitizeFilename(proposalId, "memory-proposal")}.json`, null);
        if (!proposal) {
            throw new Error(`Memory proposal not found: ${proposalId}`);
        }
        return proposal;
    }
    async saveLayeredMemory(record) {
        const normalized = this.normalizeLayeredRecord(record);
        const relativePath = this.layeredMemoryPath(normalized);
        const file = await this.loadLayeredMemoryFile(normalized.memory_scope, normalized.project_id, normalized.task_id);
        const next = {
            ...file,
            project_id: normalized.project_id ?? file.project_id,
            task_id: normalized.task_id ?? file.task_id,
            memories: upsertMemoryRecord(file.memories, normalized),
            updated_at: nowIso()
        };
        const memoryPath = await this.store.writeJson(relativePath, next);
        return { memory_path: memoryPath, saved_memory: normalized };
    }
    async loadLayeredSnapshot() {
        const user = await this.loadLayeredMemoryFile("user");
        const projects = await this.loadLayeredCollection("memory/projects", "project");
        const sessions = await this.loadLayeredCollection("memory/sessions", "session");
        const proposalFiles = await this.store.listJson("memory/proposals");
        const proposals = [];
        for (const file of proposalFiles) {
            proposals.push(await this.store.readJson(`memory/proposals/${basename(file)}`, {}));
        }
        return {
            user,
            projects,
            sessions,
            proposals: proposals.filter((proposal) => Boolean(proposal.proposal_id))
        };
    }
    async saveArtifact(relativePath, data) {
        return this.store.writeJson(relativePath, data);
    }
    async saveMarkdown(relativePath, content) {
        return this.store.writeText(relativePath, content);
    }
    projectId(projectPath) {
        if (!projectPath) {
            return "global-project";
        }
        const normalized = projectPath.replace(/\\/g, "/").replace(/[/:]+/g, "-");
        return sanitizeFilename(normalized, "project");
    }
    taskId(taskId) {
        return sanitizeFilename(taskId || "current-task", "current-task");
    }
    async writeTimestampedRecord(relativeDir, prefix, record) {
        const stamped = {
            ...record,
            schema_version: MEMORY_SCHEMA_VERSION,
            timestamp: nowIso()
        };
        return this.store.writeJson(`${relativeDir}/${timestampedName(prefix, ".json")}`, stamped);
    }
    async readRecordDirectory(relativeDir) {
        const files = await this.store.listJson(relativeDir);
        const records = [];
        for (const file of files) {
            const relative = `${relativeDir}/${basename(file)}`;
            records.push(this.migrateRecord(await this.store.readJson(relative, {})));
        }
        return records;
    }
    migrateRecord(record) {
        return {
            ...record,
            schema_version: MEMORY_SCHEMA_VERSION
        };
    }
    async loadLayeredMemoryFile(scope, projectId, taskId) {
        const relativePath = this.layeredMemoryPath({
            memory_scope: scope,
            project_id: projectId,
            task_id: taskId
        });
        const fallback = {
            schema_version: MEMORY_SCHEMA_VERSION,
            memory_scope: scope,
            project_id: projectId,
            task_id: taskId,
            memories: [],
            updated_at: nowIso()
        };
        const saved = await this.store.readJson(relativePath, fallback);
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
    async loadLayeredCollection(relativeDir, scope) {
        const directories = await this.store.listDirectories(relativeDir);
        const result = {};
        for (const id of directories) {
            const fileName = scope === "project" ? "project-memory.json" : "session-memory.json";
            result[id] = await this.store.readJson(`${relativeDir}/${id}/${fileName}`, {
                schema_version: MEMORY_SCHEMA_VERSION,
                memory_scope: scope,
                memories: [],
                updated_at: nowIso()
            });
        }
        return result;
    }
    layeredMemoryPath(record) {
        if (record.memory_scope === "user") {
            return "memory/user/preferences.json";
        }
        if (record.memory_scope === "project") {
            return `memory/projects/${sanitizeFilename(record.project_id || "global-project", "project")}/project-memory.json`;
        }
        return `memory/sessions/${sanitizeFilename(record.task_id || "current-task", "current-task")}/session-memory.json`;
    }
    normalizeLayeredRecord(record) {
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
function mergeStrings(existing = [], incoming = []) {
    const seen = new Set();
    const result = [];
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
function recordName(record, fallback) {
    const raw = String(record.name ?? record.title ?? record.type ?? fallback);
    return sanitizeFilename(raw, fallback);
}
function upsertMemoryRecord(existing, incoming) {
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
