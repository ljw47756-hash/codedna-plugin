---
name: memory-evolution
description: Use when CodeDNA should load or update local memory about user preferences, successful patterns, rejected patterns, or task history.
---

# Memory Evolution

## skill_name

memory-evolution

## when_to_use

Use when the user says "remember this", "do this next time", "I prefer", "never do that again", confirms a memory proposal, or when a completed task reveals a reusable successful or rejected pattern.

## when_not_to_use

Do not save one-off task details as permanent memory. Do not save secrets, credentials, private tokens, or sensitive content.

## input_expected

- Source text that may become session, project, or user memory.
- Optional `memory_patch`.
- Optional task-history `event`.
- Optional `successful_pattern`.
- Optional `rejected_pattern`.
- Optional proposal confirmation and edited memory text.

## output_expected

Layered memory output under `data/memory/user/`, `data/memory/projects/`, `data/memory/sessions/`, and `data/memory/proposals/`, plus legacy merged memory when `codedna_update_memory` is used.

## workflow_steps

1. Call `codedna_load_memory` before planning if memory may affect the task.
2. Classify the information as session memory, project memory, or user memory.
3. For current-task constraints, call `codedna_propose_memory_update` with `suggested_scope = session`.
4. For current-project rules, call `codedna_propose_memory_update` with `suggested_scope = project`.
5. For long-term user preferences, call `codedna_propose_memory_update` with `suggested_scope = user`.
6. If the user explicitly says "remember" or confirms a proposal, call `codedna_confirm_memory_update`.
7. Use `codedna_update_memory` for legacy memory patches, task history, successful patterns, and rejected patterns.
8. Confirm memory was appended or merged, not overwritten.

## mcp_tools_to_call

- `codedna_load_memory`
- `codedna_propose_memory_update`
- `codedna_confirm_memory_update`
- `codedna_update_memory`

## rules

- Save task-only details to session memory.
- Save current-project rules to project memory.
- Save long-term user preferences only when the user explicitly asks to remember them or confirms a proposal.
- When a preference sounds stable but is not explicit, generate a proposal and wait for confirmation.
- Do not upgrade project rules into global user memory.
- Keep rejected behaviors explicit so future Memory <-> Reuse pairing can use them.
- Do not overwrite old memory.
- Every update must include a timestamp through the MCP server storage layer.
- Do not store secrets, credentials, private tokens, or sensitive personal content.

## failure_handling

- If the memory update is ambiguous, propose session or project memory first and ask before user memory.
- If storage fails, report the path and error.
- If the user asks to save sensitive data, refuse to store it and summarize a safe alternative rule.

## example_user_request

"Remember that I prefer dark minimal UI and scoped diffs."

## example_output_shape

```json
{
  "proposal_id": "proposal-...",
  "memory_scope": "user",
  "requires_confirmation": false,
  "preview": "Scope: user. Memory: Prefer dark minimal UI and scoped diffs."
}
```
