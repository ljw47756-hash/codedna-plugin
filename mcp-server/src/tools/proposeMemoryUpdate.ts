import { nowIso, sanitizeFilename, timestampedName } from "../storage/jsonStore.js";
import type { MemoryStore } from "../storage/memoryStore.js";
import type { LayeredMemoryRecord, MemoryProposal, MemoryScope } from "../types/layeredMemory.js";

export interface ProposeMemoryUpdateInput {
  source_text: string;
  task_context?: Record<string, unknown>;
  project_path?: string;
  detected_preference?: string;
  suggested_scope?: MemoryScope;
  reason?: string;
  confidence?: number;
}

export interface ProposeMemoryUpdateOutput {
  proposal_id: string;
  memory_scope: MemoryScope;
  proposed_memory: LayeredMemoryRecord;
  source_text: string;
  reason: string;
  confidence: number;
  requires_confirmation: boolean;
  suggested_action: string;
  preview: string;
  artifact_path?: string;
}

export async function proposeMemoryUpdate(
  input: ProposeMemoryUpdateInput,
  memoryStore: MemoryStore
): Promise<ProposeMemoryUpdateOutput> {
  const sourceText = String(input.source_text ?? "").trim();
  if (!sourceText) {
    throw new Error("codedna_propose_memory_update requires source_text.");
  }
  const scope = inferScope(input);
  const confidence = clampConfidence(input.confidence);
  const explicit = explicitRemember(sourceText);
  const requiresConfirmation = scope === "user" ? !explicit : false;
  const reason = input.reason || defaultReason(scope, sourceText);
  const proposalId = `proposal-${timestampedName(scope, "").replace(/^-|-$/g, "")}`;
  const taskId = String(input.task_context?.task_id ?? input.task_context?.taskId ?? "current-task");
  const record: LayeredMemoryRecord = {
    memory_id: `memory-${sanitizeFilename(proposalId, "memory")}`,
    memory_scope: scope,
    content: String(input.detected_preference || sourceText).trim(),
    source_text: sourceText,
    reason,
    confidence,
    requires_confirmation: requiresConfirmation,
    confirmed: false,
    project_id: scope === "project" ? memoryStore.projectId(input.project_path) : input.project_path ? memoryStore.projectId(input.project_path) : undefined,
    task_id: scope === "session" ? memoryStore.taskId(taskId) : taskId ? memoryStore.taskId(taskId) : undefined,
    created_at: nowIso(),
    updated_at: nowIso(),
    schema_version: 2
  };
  const proposal: MemoryProposal = {
    proposal_id: proposalId,
    memory_scope: scope,
    proposed_memory: record,
    source_text: sourceText,
    reason,
    confidence,
    requires_confirmation: requiresConfirmation,
    suggested_action: suggestedAction(scope, requiresConfirmation),
    preview: preview(scope, record.content, reason, requiresConfirmation),
    created_at: nowIso(),
    schema_version: 2
  };
  const artifactPath = await memoryStore.saveMemoryProposal(proposal);
  return {
    proposal_id: proposal.proposal_id,
    memory_scope: proposal.memory_scope,
    proposed_memory: proposal.proposed_memory,
    source_text: proposal.source_text,
    reason: proposal.reason,
    confidence: proposal.confidence,
    requires_confirmation: proposal.requires_confirmation,
    suggested_action: proposal.suggested_action,
    preview: proposal.preview,
    artifact_path: artifactPath
  };
}

function inferScope(input: ProposeMemoryUpdateInput): MemoryScope {
  if (input.suggested_scope) {
    return input.suggested_scope;
  }
  const text = `${input.source_text} ${input.detected_preference ?? ""}`.toLowerCase();
  if (/this project|current project|project rule|package\.json|src\/|app\/|tailwind|dependency/i.test(text)) {
    return "project";
  }
  if (/remember|always|from now on|next time|never do that again|usually|prefer/i.test(text)) {
    return "user";
  }
  return "session";
}

function explicitRemember(text: string): boolean {
  return /remember|from now on|always|next time|never do that again/i.test(text);
}

function clampConfidence(value: unknown): number {
  const number = typeof value === "number" && Number.isFinite(value) ? value : 0.6;
  return Math.max(0, Math.min(1, Number(number.toFixed(2))));
}

function defaultReason(scope: MemoryScope, sourceText: string): string {
  if (scope === "session") {
    return "The source text appears to be a task-local constraint or context note.";
  }
  if (scope === "project") {
    return "The source text appears to describe a rule for the current project.";
  }
  return explicitRemember(sourceText)
    ? "The user explicitly asked CodeDNA to remember this preference."
    : "The source text appears to describe a possible long-term preference that needs confirmation.";
}

function suggestedAction(scope: MemoryScope, requiresConfirmation: boolean): string {
  if (scope === "user" && requiresConfirmation) {
    return "Ask the user to confirm before writing this to long-term user memory.";
  }
  if (scope === "user") {
    return "Write this to confirmed long-term user memory.";
  }
  return `Write this to ${scope} memory.`;
}

function preview(scope: MemoryScope, content: string, reason: string, requiresConfirmation: boolean): string {
  const confirmation = requiresConfirmation ? "Confirmation required before saving." : "No extra confirmation required for this scope.";
  return `Scope: ${scope}. Memory: ${content}. Reason: ${reason}. ${confirmation}`;
}
