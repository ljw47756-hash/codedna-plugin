import { nowIso } from "../storage/jsonStore.js";
import type { MemoryStore } from "../storage/memoryStore.js";
import type { LayeredMemoryRecord, MemoryScope } from "../types/layeredMemory.js";

export interface ConfirmMemoryUpdateInput {
  proposal_id: string;
  confirmed: boolean;
  edited_memory_text?: string;
  target_scope?: MemoryScope;
}

export interface ConfirmMemoryUpdateOutput {
  confirmed: boolean;
  memory_scope: MemoryScope;
  memory_path?: string;
  saved_memory?: LayeredMemoryRecord;
  timestamp: string;
}

export async function confirmMemoryUpdate(
  input: ConfirmMemoryUpdateInput,
  memoryStore: MemoryStore
): Promise<ConfirmMemoryUpdateOutput> {
  if (!input.proposal_id) {
    throw new Error("codedna_confirm_memory_update requires proposal_id.");
  }
  const proposal = await memoryStore.loadMemoryProposal(input.proposal_id);
  const scope = input.target_scope ?? proposal.memory_scope;
  const timestamp = nowIso();

  if (!input.confirmed) {
    return {
      confirmed: false,
      memory_scope: scope,
      timestamp
    };
  }

  const record: LayeredMemoryRecord = {
    ...proposal.proposed_memory,
    memory_scope: scope,
    content: String(input.edited_memory_text || proposal.proposed_memory.content).trim(),
    confirmed: true,
    requires_confirmation: scope === "user" ? proposal.requires_confirmation : proposal.proposed_memory.requires_confirmation,
    updated_at: timestamp,
    schema_version: 2
  };
  if (scope === "user") {
    record.confirmed = true;
  }
  const saved = await memoryStore.saveLayeredMemory(record);
  return {
    confirmed: true,
    memory_scope: scope,
    memory_path: saved.memory_path,
    saved_memory: saved.saved_memory,
    timestamp
  };
}
