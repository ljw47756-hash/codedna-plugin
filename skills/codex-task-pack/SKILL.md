---
name: codex-task-pack
description: Use when producing a copy-ready Markdown task pack for Codex implementation.
---

# Codex Task Pack

## skill_name

codex-task-pack


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
Use after pairing review when the user needs a Codex-ready implementation brief, especially for complex coding work or when the user says "generate a task pack".

## when_not_to_use

Do not generate an execution brief for blocked tasks except as a clarification pack. Do not use before requirement capture, reverse analysis, and pairing are complete.

## input_expected

- `requirement_strand`
- `analysis_strand`
- `pairing_result`
- Optional `project_profile`
- Optional `project_genome`
- Optional `guardrails`

## output_expected

Markdown task pack, guardrails, required tests, and readiness JSON saved under `data/tasks/` and `data/guardrails/`.

## workflow_steps

1. Confirm pairing result exists.
2. If project context exists, build or refresh `codedna_build_project_genome`.
3. Call `codedna_generate_task_pack`.
4. If `pairing_score < 70`, present it as a blocked clarification pack and do not execute.
5. If ready, call `codedna_generate_guardrails`.
6. Use the Markdown and guardrails together as the Codex implementation contract.
7. After implementation, require a diff or changed-file summary for `codedna_review_diff`.

## mcp_tools_to_call

- `codedna_generate_task_pack`
- `codedna_build_project_genome`
- `codedna_generate_guardrails`
- `codedna_generate_test_plan`

## rules

- Include Task ID, Pairing Score, Execution Level, Original Request, Requirement Strand Summary, Analysis Strand Summary, Project Profile Summary, Allowed Files, Forbidden Files, Implementation Plan, Risks, Assumptions, Acceptance Criteria, Test Plan, Rollback Plan, Codex Self-check, and Required Final Response Format.
- Do not omit user constraints.
- Do not hide assumptions.
- A blocked task pack must say not to execute directly.
- A task pack is not executable until guardrails exist.
- UI-only and bug-fix task packs must forbid dependency, environment, and build-config edits unless explicitly requested.
- Include required final response format that gives changed files and verification evidence for diff review.

## failure_handling

- If required inputs are missing, return to the missing upstream skill.
- If saved artifact path is absent, tell the user the task pack was generated but not persisted.
- If project profile or genome is absent, mark file recommendations as provisional and recommend scanning before edits.

## example_user_request

"Generate the CodeDNA task pack for this feature before coding."

## example_output_shape

```json
{
  "codex_task_pack": {
    "task_id": "codedna-task-...",
    "readiness": {
      "pairing_score": 92,
      "execution_level": "full"
    }
  },
  "artifact_path": "data/tasks/<task-id>.codex_task.md"
  "guardrail_id": "guardrail-..."
}
```
