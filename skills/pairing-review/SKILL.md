---
name: pairing-review
description: Use when comparing Requirement and Analysis strands before deciding whether Codex may execute a task.
---

# Pairing Review

## skill_name

pairing-review


## CodeDNA Core Chain

Every CodeDNA skill belongs to this main chain:

```text
User Requirement Strand
    <-> Bidirectional Pairing Review
Reverse Analysis Strand
    -> Codex Task Pack
    -> Code Execution
    -> Reverse Review
    -> Memory Evolution
```

## Codex Assistance Rule

CodeDNA does not replace Codex. The MCP tools produce structured strands, scores, guardrails, task packs, reports, and memory proposals. After each CodeDNA stage, Codex must use its own reasoning, coding, inspection, and verification capabilities to continue the work safely.

## when_to_use
Use after both Requirement Strand and Analysis Strand exist. This skill decides whether the task is ready for Codex, cautious, or blocked.

## when_not_to_use

Do not use without both strands. Do not bypass it for multi-file work, architecture changes, bug repair, or requests with explicit constraints.

## input_expected

- `requirement_strand`
- `analysis_strand`

## output_expected

Pairing Result with `pairing_score`, `matched_pairs`, `unmatched_pairs`, `warnings`, `missing_information`, `ready_for_codex`, and `execution_level`.

## workflow_steps

1. Call `codedna_pair_strands`.
2. Review Goal <-> Task, Constraint <-> Risk, Preference <-> Pattern, Feature <-> Module, Acceptance <-> Test, and Memory <-> Reuse.
3. If score is below 70, stop and ask for missing information.
4. If score is 70-89, proceed only with caution notes.
5. If score is 90 or higher, allow full task pack execution.
6. Before any edit, call `codedna_generate_guardrails`.
7. After execution, use `codedna_review_diff` and `codedna_score_outcome` to confirm the result.

## mcp_tools_to_call

- `codedna_pair_strands`
- `codedna_generate_task_pack` only after pairing is complete.
- `codedna_generate_guardrails` before edits when pairing is ready.
- `codedna_review_diff` after edits.
- `codedna_score_outcome` before final acceptance.

## rules

- `pairing_score >= 90`: `ready_for_codex = true`, `execution_level = full`.
- `70 <= pairing_score < 90`: `ready_for_codex = true`, `execution_level = cautious`.
- `pairing_score < 70`: `ready_for_codex = false`, `execution_level = blocked`.
- Never implement a blocked task directly.
- Treat missing constraints or acceptance tests as high-risk.
- Cautious execution must include assumptions, risk notes, guardrails, and required tests.
- If high-risk files are involved, force cautious or blocked execution even when semantic pairing is strong.

## failure_handling

- If pairing output is blocked, convert `missing_information` into user questions.
- If all pairs are generic, ask for more project or acceptance detail.
- If score looks inconsistent with missing data, rerun requirement capture and analysis before coding.
- If the result later violates pairing assumptions, generate a repair task and do not broaden scope.

## example_user_request

"Can you check whether this task is ready for Codex?"

## example_output_shape

```json
{
  "pairing_result": {
    "pairing_score": 64,
    "ready_for_codex": false,
    "execution_level": "blocked",
    "missing_information": ["Preferred verification command is not specified."]
  }
}
```
