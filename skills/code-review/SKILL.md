---
name: code-review
description: Use after Codex produces a diff, log, summary, or implementation result that should be reviewed against CodeDNA.
---

# Code Review

## skill_name

code-review


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
Use when the user asks to review Codex output, check a diff, inspect logs, verify whether a task was completed, or decide if another repair prompt is needed.

## when_not_to_use

Do not use for initial task planning unless there is already Codex output to review. Use `codedna-orchestrator` for pre-implementation planning.

## input_expected

- `requirement_strand`
- `analysis_strand`
- `codex_output`, `diff_text`, or `changed_files`
- Optional `project_profile`
- Optional `pairing_result` and `guardrails`

## output_expected

Diff Review JSON, Review Report Markdown, guardrail validation, outcome score, and a focused repair task when the result is not ready.

## workflow_steps

1. Gather Codex summary, diff, logs, changed files, and verification evidence.
2. If a diff or changed-file list exists, call `codedna_review_diff`.
3. If guardrails exist, call `codedna_validate_changes`.
4. If only a narrative result exists, call `codedna_review_output`.
5. Lead with findings when issues exist.
6. If the verdict is not `pass`, call `codedna_generate_repair_task`.
7. If the result is ready, call `codedna_score_outcome` to produce final acceptance guidance.
8. If a stable lesson appears, call `codedna_propose_memory_update` instead of writing user memory directly.

## mcp_tools_to_call

- `codedna_review_diff`
- `codedna_validate_changes`
- `codedna_review_output`
- `codedna_generate_repair_task`
- `codedna_score_outcome`
- `codedna_propose_memory_update`
- `codedna_confirm_memory_update` when the user confirms a proposed memory.

## rules

- Check requirement match, constraint violations, unrelated file changes, architecture risks, security risks, performance risks, and test gaps.
- Treat constraint violations and security issues as blockers.
- If a forbidden file is touched, verdict must be `needs_fix` or `blocked`.
- If a secret, API key, token, password, or dangerous command is detected, verdict must be `blocked`.
- Mark large unrequested refactors and unrelated changes explicitly.
- Require verification evidence before accepting completion.
- Do not praise before findings.
- Do not save long-term user memory without explicit user instruction or confirmation.

## failure_handling

- If no Codex output is provided, ask for the summary, diff, log, or changed files.
- If project profile is unavailable, review scope conservatively and mark uncertainty.
- If review fails, generate a repair task that fixes only the listed issues.
- If review cannot identify a cause, ask for exact failing command, diff, changed files, and logs.

## example_user_request

"Review this Codex output and tell me if it is safe to accept."

## example_output_shape

```json
{
  "final_verdict": "needs_fix",
  "forbidden_files_touched": [],
  "required_fixes": ["Add verification evidence."],
  "next_codex_repair_prompt": "Please repair..."
}
```
