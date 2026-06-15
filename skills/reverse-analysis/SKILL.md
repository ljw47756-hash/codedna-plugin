---
name: reverse-analysis
description: Use when deriving a technical Analysis Strand from a Requirement Strand and optional project profile.
---

# Reverse Analysis

## skill_name

reverse-analysis


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
Use after `requirement-capture` when the user request needs technical decomposition into architecture, modules, affected files, risks, tests, rollback, and assumptions.

## when_not_to_use

Do not use before a Requirement Strand exists. Do not use as a substitute for reviewing actual Codex output.

## input_expected

- `requirement_strand`.
- Optional `project_profile`.
- Optional `project_genome`.

## output_expected

An Analysis Strand with `technical_goal`, `suggested_architecture`, `required_modules`, `affected_files`, `implementation_steps`, `risks`, `dependencies`, `test_plan`, `rollback_plan`, and `assumptions`.

## workflow_steps

1. Confirm the Requirement Strand has a clear `core_goal`.
2. Include project profile if available.
3. If a project path exists, build or refresh `codedna_build_project_genome`.
4. Call `codedna_reverse_analyze`.
5. Inspect risks and assumptions before pairing.
6. Use Project Genome safe edit zones and forbidden zones when preparing guardrails.
7. Pass the Analysis Strand to `pairing-review`.

## mcp_tools_to_call

- `codedna_reverse_analyze`
- `codedna_build_project_genome`
- `codedna_generate_guardrails` after pairing is ready.

## rules

- Convert goals into implementable technical tasks without broadening scope.
- Map constraints into explicit risks.
- Prefer existing project structure and detected entry points.
- When no project scan exists, state that file recommendations are provisional.
- Always include non-empty risks and assumptions.
- Treat Project Genome forbidden zones as hard risks.
- Do not recommend edits to package-manager, environment, or build-config files unless explicitly required.

## failure_handling

- If project profile is missing, generate a generic plan and recommend `codedna_scan_project` or `codedna_run_full_workflow`.
- If affected files are uncertain, keep them conservative.
- If dependencies are unknown, mark install/test commands as assumptions.

## example_user_request

"Refactor the API client into smaller modules without changing behavior."

## example_output_shape

```json
{
  "analysis_strand": {
    "technical_goal": "Refactor the API client while preserving behavior",
    "required_modules": ["API client module", "Regression tests"],
    "risks": ["Behavior drift during refactor"],
    "test_plan": ["Run existing API client tests"]
  }
}
```
