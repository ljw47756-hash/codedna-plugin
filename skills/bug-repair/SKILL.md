---
name: bug-repair
description: Use when a failed Codex result, failing test, or CodeDNA review report needs a constrained repair task.
---

# Bug Repair

## skill_name

bug-repair

## when_to_use

Use when Codex output failed tests, introduced a regression, violated constraints, or received a CodeDNA Review Report with `needs_fix`.

## when_not_to_use

Do not use for brand-new feature planning unless the feature is a repair of previous output. Do not broaden a repair into a refactor.

## input_expected

- Original requirement or Requirement Strand.
- Analysis Strand when available.
- Codex output, diff, changed files, error log, Diff Review, Guardrails Validation, or Review Report.

## output_expected

A narrow repair task pack that fixes only the reviewed failure without touching unrelated files.

## workflow_steps

1. If a diff or changed-file list exists, call `codedna_review_diff`.
2. If guardrails exist, call `codedna_validate_changes`.
3. If only output text exists, call `codedna_review_output`.
4. Call `codedna_generate_repair_task` for any `needs_fix` or `blocked` verdict.
5. Use the repair task Markdown as the next Codex instruction.
6. After repair, rerun diff review and score the outcome.
7. Propose reusable lessons with `codedna_propose_memory_update`; confirm before long-term user memory.

## mcp_tools_to_call

- `codedna_review_diff`
- `codedna_validate_changes`
- `codedna_review_output`
- `codedna_generate_repair_task`
- `codedna_score_outcome`
- `codedna_propose_memory_update`
- `codedna_confirm_memory_update`

## rules

- Repair only the failing behavior.
- Preserve passing work unless it directly causes the failure.
- Keep the original constraints active.
- Require verification after repair.
- If forbidden files were touched, require restoring them before other fixes.
- If plaintext secrets were introduced, remove them and use environment-based configuration or documented sample values.
- If tests are missing, prioritize tests or explicit verification evidence.

## failure_handling

- If the log is missing, ask for the exact failing command and output.
- If modified files are unknown, ask for the diff or changed-file list.
- If the cause is unclear, produce a diagnostic repair task instead of a risky fix prompt.

## example_user_request

"Codex changed too many files and tests failed. Generate the repair prompt."

## example_output_shape

```json
{
  "repair_task_id": "repair-...",
  "issues_to_fix": ["Restore forbidden file changes."],
  "repair_task_path": "data/tasks/<task-id>.repair_task.md"
}
```
