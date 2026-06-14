import type { CodeDnaMemory, MemoryStore } from "../storage/memoryStore.js";
import type { LayeredMemoryRecord } from "../types/layeredMemory.js";

export interface UpdateMemoryInput {
  memory_patch?: Partial<CodeDnaMemory>;
  event?: Record<string, unknown>;
  successful_pattern?: Record<string, unknown>;
  rejected_pattern?: Record<string, unknown>;
  layered_memory?: Partial<LayeredMemoryRecord>;
}

export interface UpdateMemoryOutput {
  memory: CodeDnaMemory;
  layered_memory_path?: string;
}

export async function updateMemory(input: UpdateMemoryInput, memoryStore: MemoryStore): Promise<UpdateMemoryOutput> {
  const memory = await memoryStore.updateMemory(
    input.memory_patch ?? {},
    input.event,
    input.successful_pattern,
    input.rejected_pattern
  );
  let layeredMemoryPath: string | undefined;
  if (input.layered_memory?.content) {
    const saved = await memoryStore.saveLayeredMemory({
      memory_id: String(input.layered_memory.memory_id ?? ""),
      memory_scope: input.layered_memory.memory_scope ?? "session",
      content: String(input.layered_memory.content),
      source_text: String(input.layered_memory.source_text ?? ""),
      reason: String(input.layered_memory.reason ?? "Stored through codedna_update_memory."),
      confidence: typeof input.layered_memory.confidence === "number" ? input.layered_memory.confidence : 0.5,
      requires_confirmation: Boolean(input.layered_memory.requires_confirmation),
      confirmed: Boolean(input.layered_memory.confirmed),
      project_id: input.layered_memory.project_id,
      task_id: input.layered_memory.task_id,
      created_at: String(input.layered_memory.created_at ?? new Date().toISOString()),
      updated_at: String(input.layered_memory.updated_at ?? new Date().toISOString()),
      schema_version: Number(input.layered_memory.schema_version ?? 2)
    });
    layeredMemoryPath = saved.memory_path;
  }
  return { memory, layered_memory_path: layeredMemoryPath };
}
