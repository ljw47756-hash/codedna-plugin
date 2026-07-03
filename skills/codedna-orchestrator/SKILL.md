---
name: codedna-orchestrator
description: "Use when CodeDNA is selected or when a coding request benefits from automatic CodeDNA routing before editing: requirement capture, reverse analysis, pairing, compact Codex brief, guardrails, review, and memory."
---

# CodeDNA Orchestrator

## skill_name

codedna-orchestrator


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

## Token Efficiency Rule

CodeDNA's primary job is to compile the user's natural-language request into a compact Codex Execution Brief: objective, intent type, workflow route, allowed scope, hard constraints, execution steps, verification, and review gate. Do not paste full strands, full task packs, case-library details, or long internal reasoning into chat unless the user explicitly asks for them.

## Automatic Routing Rule

When the user has enabled, selected, or at-mentioned CodeDNA, do not require a special phrase such as "use full workflow". Treat the user's normal request as the input and route it by complexity:

- `tiny` or `simple`: use the compact brief directly and avoid long artifacts unless persistence is useful.
- `normal`: run requirement capture, reverse analysis, pairing, and the compact brief.
- `complex`: add project scan or Project Genome, then produce guardrails before Codex edits.
- `high_risk`: add Project Genome and guardrails, proceed cautiously, and require post-diff review.
- `review_only`: review the supplied output, diff, logs, or summary; do not plan new implementation.
- `plan_only`: produce analysis and risk/verification guidance only; do not edit files.
- `blocked`: ask the missing clarification questions before Codex edits files.

Fixed trigger phrases remain useful for smoke tests and documentation, but they are not required for normal use.

## Progress Display Rule

Prefer staged MCP calls for normal work so Codex can show visible progress: scan, parse, analyze, pair, brief, guardrails, execute, review. Use `codedna_run_full_workflow` only for smoke tests, quick one-shot diagnostics, or when the user explicitly asks for a single full-workflow tool call. A long all-in-one MCP call can appear stuck on the first progress item even while it is running correctly.

## when_to_use
Use this skill when CodeDNA is the selected plugin and the user asks for a feature, bug fix, refactor, multi-file change, architecture change, test plan, review, or any request that would benefit from structured routing before implementation. Also use it when the user explicitly says CodeDNA, task pack, requirement strand, analysis strand, pairing, or plugin workflow.

## when_not_to_use

Do not use this skill for tiny factual questions, simple terminal lookups, or requests where the user only wants an explanation and no implementation planning. If the user asks only to review a completed Codex result, start with `code-review` instead.

## input_expected

- The user's original request.
- Optional target project path.
- Optional Codex output, diff, logs, or summary when reviewing completed work.
- Optional user preference or memory instruction.

## output_expected

- Pairing score and execution level.
- Saved task pack path when a task is ready or needs clarification.
- Saved review report path after Codex output review.
- Clear next action: execute, proceed cautiously, ask clarification, repair, or update memory.

## workflow_steps

1. If a project path is available, call `codedna_scan_project`; build or refresh `codedna_build_project_genome` for complex or high-risk tasks.
2. Call `codedna_parse_requirement` to preserve the original request and extract goals, constraints, preferences, acceptance criteria, and unknowns.
3. Call `codedna_reverse_analyze` to translate the request into Codex-ready technical tasks, affected files, risks, and verification.
4. Call `codedna_pair_strands` to decide whether execution is full, cautious, or blocked.
5. If `pairing_score` is below 70, stop and ask only the generated clarification questions.
6. Read the `workflow_route` from the compact Codex Execution Brief and choose the smallest sufficient next step.
7. If ready, call `codedna_generate_task_pack` when a saved artifact is useful, but use only its compact Codex Execution Brief as the implementation prompt by default.
8. Before editing complex or high-risk routes, call `codedna_generate_guardrails`; then Codex executes using the brief and guardrails, not the full internal workflow text.
9. After Codex produces a diff, call `codedna_review_diff`; use `codedna_review_output` only when no diff is available.
10. If review or validation fails, call `codedna_generate_repair_task` and use it as the next concise Codex prompt.
11. If the user expresses a preference, call `codedna_propose_memory_update`; write durable memory only after confirmation.

## mcp_tools_to_call

- `codedna_load_memory`
- `codedna_scan_project`
- `codedna_build_project_genome`
- `codedna_run_full_workflow` only for smoke tests, quick one-shot diagnostics, or explicit single-call workflow requests.
- `codedna_parse_requirement`
- `codedna_reverse_analyze`
- `codedna_pair_strands`
- `codedna_generate_task_pack`
- `codedna_generate_guardrails`
- `codedna_validate_changes`
- `codedna_review_diff`
- `codedna_review_output`
- `codedna_generate_repair_task`
- `codedna_propose_memory_update`
- `codedna_confirm_memory_update`
- `codedna_generate_test_plan`
- `codedna_score_outcome`
- `codedna_update_memory`

## rules

- For complex coding work, run the staged CodeDNA workflow before editing files.
- Convert user language into the compact Codex Execution Brief before asking Codex to implement.
- Do not paste full artifacts into chat when the brief is enough.
- Preserve the original user request verbatim inside the Requirement Strand.
- Treat constraints as hard gates, not suggestions.
- If `pairing_score < 70`, ask the user for missing information and do not implement.
- If the user says "just write the code", still generate the smallest task pack and risk summary first.
- Use `execution_level = cautious` as permission to proceed only with assumptions visible.
- Codex must obey guardrails before editing files.
- Codex must output changed files, verification evidence, and enough diff or summary data for `codedna_review_diff`.
- Prefer `codedna_review_diff` after code changes; use `codedna_review_output` only when a diff is unavailable.
- Do not write long-term user memory unless the user explicitly asks to remember it or confirms a proposal.
- Score the outcome with `codedna_score_outcome` when deciding whether to complete, repair, add tests, or ask the user.

## failure_handling

- If project scanning fails, continue with a generic analysis and mark file choices as assumptions.
- If MCP tools are unavailable, tell the user the CodeDNA MCP server is not loaded and provide the manual task-pack fallback.
- If pairing is blocked, surface `missing_information` as concise questions.
- If review finds issues, generate a focused repair task instead of reimplementing the entire feature.
- If a high-risk request touches environment, package-manager, or core configuration files, proceed only in cautious or blocked mode.

## example_user_request

"Add a login page, keep the existing style, do not touch unrelated files, and run tests."

## example_output_shape

```json
{
  "next_action": "generate_guardrails_then_execute_cautiously",
  "pairing_score": 86,
  "execution_level": "cautious",
  "task_pack_path": "data/tasks/<task-id>.codex_task.md",
  "guardrail_id": "guardrail-...",
  "notes": ["Proceed with listed assumptions and verification plan."]
}
```
