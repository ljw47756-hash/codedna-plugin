import { nowIso } from "../storage/jsonStore.js";
export async function confirmMemoryUpdate(input, memoryStore) {
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
    const record = {
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
