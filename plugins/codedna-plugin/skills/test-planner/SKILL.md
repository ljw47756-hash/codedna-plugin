---
name: test-planner
description: Use when turning CodeDNA acceptance criteria, risks, and project scan data into a focused verification plan.
---

# Test Planner

## skill_name

test-planner

## when_to_use

Use when the user asks how to test a CodeDNA task, when acceptance criteria need verification mapping, or when a task pack needs a stronger Test Plan.

## when_not_to_use

Do not use as a replacement for implementation or review. Do not invent exact commands when project scan data does not show them.

## input_expected

- Requirement Strand.
- Analysis Strand when available.
- Project Profile and Project Genome when available.
- Optional changed files and task type: `ui`, `api`, `bug_fix`, `refactor`, or `general`.

## output_expected

Structured test plan JSON and copy-ready Markdown saved under `data/test-plans/`, plus commands and acceptance checklist for the task pack.

## workflow_steps

1. Use `codedna_reverse_analyze` to produce or refresh baseline `test_plan`.
2. Call `codedna_generate_test_plan` with task type, changed files, Project Profile, and Project Genome.
3. Check acceptance criteria against manual steps, automated suggestions, edge cases, and failure cases.
4. Include missing-test warnings when no framework exists.
5. Put required commands and checklist into the task pack or repair task.

## mcp_tools_to_call

- `codedna_reverse_analyze`
- `codedna_generate_test_plan`
- `codedna_generate_task_pack`

## rules

- Link every test to an acceptance criterion or risk.
- Keep tests scoped to changed behavior.
- Include manual verification when no automated test framework is detected.
- Mark inferred commands as suggested unless they are explicit in project files.
- UI tasks must include visual, interaction, and responsive checks.
- API tasks must include success, failure, boundary, authentication, and exception cases.
- Bug fixes must include reproduction and fixed-state verification.
- Refactors must include regression scope.

## failure_handling

- If no project scan exists, recommend `codedna_scan_project` and `codedna_build_project_genome`.
- If no tests exist, provide manual checks plus a minimal test addition suggestion.
- If verification cannot run, require Codex to explain why.

## example_user_request

"Make sure the task pack includes a test plan for this bug fix."

## example_output_shape

```json
{
  "test_plan_id": "test-plan-...",
  "required_commands": ["npm test", "npm run build"],
  "missing_test_warning": ""
}
```
