---
name: requirement-capture
description: Use when transforming a natural-language coding request into a structured CodeDNA Requirement Strand.
---

# Requirement Capture

## skill_name

requirement-capture


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
Use when the user gives a feature request, bug request, refactor request, design preference, restriction, acceptance criterion, or project instruction that should become structured JSON before planning.

## when_not_to_use

Do not use for completed Codex output review, raw project scanning, or pure memory updates unless a fresh requirement also needs to be captured.

## input_expected

- `request`: exact user wording.
- Optional `project_profile` from `codedna_scan_project`.
- Optional `project_genome` from `codedna_build_project_genome`.
- Optional `memory_rules` from `codedna_load_memory`.

## output_expected

A Requirement Strand with `original_request`, `core_goal`, `features`, `constraints`, `preferences`, `acceptance_criteria`, `unknowns`, `priority`, and `user_memory_related_rules`.

## workflow_steps

1. Preserve the user request exactly.
2. Load memory rules when available.
3. Pass project profile when available.
4. If a project path is known but no profile exists, ask orchestrator to run `codedna_run_full_workflow` or `codedna_scan_project`.
5. If the request contains a preference, call `codedna_propose_memory_update` after parsing rather than writing long-term memory directly.
6. Call `codedna_parse_requirement`.
7. Review `unknowns`; if they are important, carry them into pairing and the task pack.

## mcp_tools_to_call

- `codedna_load_memory` when memory context is needed.
- `codedna_run_full_workflow` for complex requests that should proceed through the full workflow.
- `codedna_parse_requirement`.
- `codedna_propose_memory_update` when the request expresses a preference.

## rules

- Do not rewrite the user's scope.
- Extract "do not", "must not", "only", "preserve", and "avoid" as constraints.
- Extract style, tool, workflow, and coding preferences as preferences.
- If the request is vague, put missing details in `unknowns` instead of inventing them.
- Keep memory rules visible for Memory <-> Reuse pairing.
- Treat "do not modify unrelated files" and "only edit" as hard guardrail inputs.
- Do not convert one-off task preferences into long-term user memory without a proposal and confirmation.

## failure_handling

- If the request is empty, ask for the actual task.
- If the target project is unknown, keep a project-scan unknown and recommend project scan or full workflow.
- If acceptance criteria are absent, let the parser generate conservative defaults.

## example_user_request

"Fix the checkout error. Only edit files under src/checkout and add a regression test."

## example_output_shape

```json
{
  "requirement_strand": {
    "core_goal": "Fix the checkout error",
    "constraints": ["Only edit files under src/checkout"],
    "acceptance_criteria": ["Add a regression test"],
    "unknowns": []
  }
}
```
