# Codex Task Pack

Task ID: codedna-task-20260616T020236Z-Add-a-login-page-for-the-existing-app-with-a-dark-minimal-visual-style

## Execution Gate

- Pairing Score: 99
- Execution Level: full
- Ready for Codex: yes
- Gate note: Generate and execute the task pack normally.


## CodeDNA Core Chain

```text
用户需求链
    <-> 配对审查
反向解析链
    ↓
Codex 任务包
    ↓
代码执行
    ↓
反向审查
    ↓
记忆进化
```

- Requirement Strand: User Requirement Strand
- Pairing Review: Bidirectional Pairing Review
- Analysis Strand: Reverse Analysis Strand
- Execution Layer: Codex Task Pack
- Feedback Layer: Reverse Review
- Evolution Layer: Memory Evolution
- Gate Status: ready

## Score Evidence

- Base double-strand pairing score: 92.
- Activated 10 CodeDNA effect rule(s) as auxiliary weights; score adjustment: +7.
- Recalled 4 success pattern(s), 4 failure pattern(s), and 4 public reference pattern(s).
- Final score after bounded DNA evidence adjustment: 99.

## Activated CodeDNA Effects

- **review-diff-and-repair** -> Acceptance <-> Test (weight 15.74): Review output against requirements, constraints, risk, tests, and generate a narrow repair task when needed. Guardrail: Repair prompts must be constrained to the unmet requirement and avoid unrelated refactors.
- **planning-and-mode-boundaries** -> Goal <-> Task (weight 15.16): Detect task intent, stop conditions, correction directives, and continuation gates before execution. Guardrail: Do not execute implementation when the request is plan-only, review-only, phased, or correction-first.
- **project-context-and-diagnostics** -> Feature <-> Module (weight 14.34): Scan framework, entrypoints, dependency files, tests, generated folders, no-touch zones, and risk signals. Guardrail: Project context should inform task packs and reviews without turning CodeDNA into an editor layer.
- **task-decomposition-not-runtime-agents** -> Feature <-> Module (weight 13.64): Split work into modules, risks, tests, affected files, and steps without adding a multi-agent runtime. Guardrail: Do not create runtime agents; preserve the decomposition effect inside CodeDNA analysis and task packs.
- **guardrails-and-risk-control** -> Constraint <-> Risk (weight 14.17): Turn safety and permission concepts into scoped forbidden actions, sensitive paths, and review warnings. Guardrail: Block or warn on unrelated edits, secrets, destructive commands, unsafe file paths, and extra features.
- **task-lifecycle-and-case-records** -> Memory <-> Reuse (weight 13.87): Record task phases, generated artifacts, review result, repair link, and outcome score for future recall. Guardrail: Store auditable case metadata instead of creating a separate task runner or autonomous runtime.
- **documentation-and-operational-clarity** -> Acceptance <-> Test (weight 12.94): Document install, usage, suitable tasks, troubleshooting, and outcome summaries without exposing private internals. Guardrail: Public docs must describe user value and safe usage, not detailed proprietary implementation recipes.
- **git-and-pr-awareness** -> Constraint <-> Risk (weight 11.89): Surface branch, dirty tree, release, PR summary, and review cautions as contextual warnings. Guardrail: Do not automate GitHub actions from core CodeDNA; report context and let the user decide.
- **clear-user-feedback** -> Preference <-> Pattern (weight 11.66): Explain what happened, why it matters, what is blocked, and the next safe action in concise Markdown/JSON. Guardrail: Every blocked, cautious, or failed result needs a concrete next step and recovery prompt.
- **plugin-installation-diagnostics** -> Constraint <-> Risk (weight 11.77): Check manifest, marketplace path, bundled dist, skills, version cache, and install instructions. Guardrail: Do not claim install readiness unless plugin manifest, marketplace entry, MCP entrypoint, and dist are present.

## Relevant Success Patterns

- **retained-success-0006-58d28699fc** (success-pattern, score 16.15): Successful path: Detect task intent, stop conditions, correction directives, and continuation gates before execution. Guardrail: Do not execute implementation when the request is plan-only, review-only, phased, or correction-first.
- **retained-success-0016-9df9e4cbc6** (success-pattern, score 14.5): Successful path: Review output against requirements, constraints, risk, tests, and generate a narrow repair task when needed. Guardrail: Repair prompts must be constrained to the unmet requirement and avoid unrelated refactors.
- **retained-success-0001-f87bce4f2e** (success-pattern, score 14.4): Successful path: Split work into modules, risks, tests, affected files, and steps without adding a multi-agent runtime. Guardrail: Do not create runtime agents; preserve the decomposition effect inside CodeDNA analysis and task packs.
- **retained-success-0011-9fc1d341b6** (success-pattern, score 13.65): Successful path: Scan framework, entrypoints, dependency files, tests, generated folders, no-touch zones, and risk signals. Guardrail: Project context should inform task packs and reviews without turning CodeDNA into an editor layer.

## Relevant Failure Patterns

- **retained-failure-0006-6887a40704** (failure-pattern, score 14.9): Failure path to prevent: ignore Requirement Strand mode detection and task pack gates and proceed without the matching CodeDNA gate. Guardrail: Do not execute implementation when the request is plan-only, review-only, phased, or correction-first.
- **retained-failure-0005-64430e16af** (failure-pattern, score 11.75): Failure path to prevent: ignore plugin install health and release checks and proceed without the matching CodeDNA gate. Guardrail: Do not claim install readiness unless plugin manifest, marketplace entry, MCP entrypoint, and dist are present.
- **retained-failure-0001-1d735fe0ae** (failure-pattern, score 11.55): Failure path to prevent: ignore Analysis Strand decomposition and proceed without the matching CodeDNA gate. Guardrail: Do not create runtime agents; preserve the decomposition effect inside CodeDNA analysis and task packs.
- **retained-failure-0016-18468df630** (failure-pattern, score 11.5): Failure path to prevent: ignore diff review, repair prompt, and outcome scoring and proceed without the matching CodeDNA gate. Guardrail: Repair prompts must be constrained to the unmet requirement and avoid unrelated refactors.

## Codex Assistance Handoff

- **Requirement Strand**: Clarify intent and preserve the original request verbatim. Prompt: Use the Requirement Strand to restate the goal, constraints, preferences, acceptance criteria, and unknowns before editing. Expected output: A concise confirmation of what will and will not be done.
- **Pairing Review**: Judge whether Requirement and Analysis are aligned enough for execution. Prompt: Use pairing_score, unmatched_pairs, missing_information, activated_effects, and case_recall to decide full, cautious, or blocked execution. Expected output: A go, cautious-go, or clarification decision with reasons.
- **Codex Task Pack**: Turn the paired DNA strands into a concrete implementation brief. Prompt: Follow the task pack exactly: scope, files, steps, risks, tests, and final response format. Expected output: A scoped implementation plan or edit set with verification evidence.
- **Reverse Review**: Inspect the result against the original request and guardrails. Prompt: Compare the diff or output against Requirement Strand, forbidden scope, risks, tests, and relevant failure patterns. Expected output: A pass, warning, needs-fix, or blocked verdict plus a repair prompt if needed.
- **Memory Evolution**: Propose learning without silently writing long-term memory. Prompt: Only propose memory updates from confirmed preferences, repeated successful patterns, or rejected patterns; wait for user confirmation. Expected output: A memory proposal or no-memory-needed decision.

## Original User Request

Add a login page for the existing app with a dark minimal visual style. Support email login and verification-code login. Do not modify unrelated files. Preserve the existing project structure. Run the available test or build command after completion and summarize the verification result.

## Requirement Strand Summary

```json
{
  "original_request": "Add a login page for the existing app with a dark minimal visual style. Support email login and verification-code login. Do not modify unrelated files. Preserve the existing project structure. Run the available test or build command after completion and summarize the verification result.",
  "core_goal": "Add a login page for the existing app with a dark minimal visual style",
  "features": [
    "Add a login page for the existing app with a dark minimal visual style",
    "Add a login page for the existing app",
    "a dark minimal visual style",
    "Support email login",
    "verification-code login",
    "Run the available test or build command after completion",
    "summarize the verification result"
  ],
  "constraints": [
    "Do not modify unrelated files",
    "Preserve the existing project structure"
  ],
  "preferences": [
    "a dark minimal visual style",
    "Task mode: implementation; prepare scoped changes and verification."
  ],
  "acceptance_criteria": [
    "verification-code login",
    "Run the available test or build command after completion",
    "summarize the verification result"
  ],
  "unknowns": [],
  "priority": "medium",
  "user_memory_related_rules": [
    "Use CodeDNA pairing before large Codex edits.",
    "Generate a Codex Task Pack before implementation.",
    "Review Codex output against constraints before accepting changes.",
    "Use MCP client smoke before publishing CodeDNA updates.",
    "Avoid: incomplete mock implementations",
    "Avoid: unrelated refactors",
    "Avoid: desktop-app scaffolding when a Codex plugin is requested",
    "Avoid: single-file monoliths",
    "Preferred UI style: dark, minimal, technical"
  ],
  "created_at": "2026-06-16T02:02:36.223Z"
}
```

## Analysis Strand Summary

```json
{
  "technical_goal": "Implement \"Add a login page for the existing app with a dark minimal visual style\" within TypeScript while keeping changes scoped, testable, and reviewable.",
  "suggested_architecture": [
    "Separate requirement interpretation, implementation planning, verification, and review output.",
    "Follow the existing project structure before adding new top-level directories.",
    "Prefer small modules with explicit inputs and outputs.",
    "Keep generated artifacts auditable as JSON or Markdown.",
    "Reflect these user preferences where relevant: a dark minimal visual style; Task mode: implementation; prepare scoped changes and verification."
  ],
  "required_modules": [
    "Requirement handling",
    "Implementation planning",
    "Verification",
    "Completion summary",
    "CLI command entrypoint",
    "Helper script module",
    "UI component",
    "Style layer",
    "Authentication flow",
    "Form validation",
    "Security review",
    "Test planner",
    "Verification runner plan",
    "Checklist coverage tracker",
    "Scope coverage verifier"
  ],
  "affected_files": [
    ".agents",
    ".codedna",
    ".codex-plugin",
    "assets",
    "case-library",
    "data",
    "docs",
    "examples"
  ],
  "implementation_steps": [
    "Read the target files and identify existing patterns before editing.",
    "Focus initial edits on: .agents, .codedna, .codex-plugin, assets, case-library, data, docs, examples",
    "Check constraints before editing: Do not modify unrelated files; Preserve the existing project structure",
    "Implement the smallest coherent change that satisfies the feature request.",
    "Update or add tests only around changed behavior.",
    "Run verification and summarize exact results."
  ],
  "risks": [
    "Unrelated file changes would make the Codex result harder to review.",
    "Missing verification may hide regressions.",
    "Constraint must be guarded: Do not modify unrelated files",
    "Constraint must be guarded: Preserve the existing project structure"
  ],
  "dependencies": [
    "mcp-server/package.json (node)",
    "plugins/codedna-plugin/mcp-server/package.json (node)"
  ],
  "test_plan": [
    "Run the existing automated tests when available.",
    "Perform focused manual checks for the requested behavior.",
    "Confirm every constraint and non-goal remains respected.",
    "Verify acceptance criterion: verification-code login",
    "Verify acceptance criterion: Run the available test or build command after completion",
    "Verify acceptance criterion: summarize the verification result"
  ],
  "rollback_plan": [
    "Keep a clear list of files changed by Codex.",
    "If behavior regresses, revert only the files touched for this task.",
    "Preserve generated task and review artifacts for audit history."
  ],
  "assumptions": [
    "Codex will inspect files before editing them.",
    "The user wants scoped changes rather than broad refactors.",
    "The selected project root is E:\\chat-codex\\CodeDNA\\codedna-plugin."
  ],
  "created_at": "2026-06-16T02:02:36.226Z"
}
```

## Project Profile Summary

- Project path: <PROJECT_ROOT>
- Languages: TypeScript
- Frameworks: none detected
- Package manager: npm
- Entry points: none detected
- Component directories: none detected
- API directories: none detected
- Test directories: mcp-server/test, plugins/codedna-plugin/mcp-server/test

## Allowed Files

- .agents
- .codedna
- .codex-plugin
- assets
- case-library
- data
- docs
- examples

## Forbidden Files

- Unrelated refactors
- Generated dependency lockfile changes unless required by the task
- Secrets, environment files, and local machine configuration
- Do not modify unrelated files
- Preserve the existing project structure
- .git/
- .venv/
- __pycache__/
- build/
- dist/
- mcp-server/package-lock.json
- node_modules/
- plugins/codedna-plugin/mcp-server/package-lock.json
- venv/

## Missing Information

- None

## Implementation Plan

1. Read the target files and identify existing patterns before editing.
2. Focus initial edits on: .agents, .codedna, .codex-plugin, assets, case-library, data, docs, examples
3. Check constraints before editing: Do not modify unrelated files; Preserve the existing project structure
4. Implement the smallest coherent change that satisfies the feature request.
5. Update or add tests only around changed behavior.
6. Run verification and summarize exact results.

## Architecture Guidance

- Separate requirement interpretation, implementation planning, verification, and review output.
- Follow the existing project structure before adding new top-level directories.
- Prefer small modules with explicit inputs and outputs.
- Keep generated artifacts auditable as JSON or Markdown.
- Reflect these user preferences where relevant: a dark minimal visual style; Task mode: implementation; prepare scoped changes and verification.

## Risks

- Unrelated file changes would make the Codex result harder to review.
- Missing verification may hide regressions.
- Constraint must be guarded: Do not modify unrelated files
- Constraint must be guarded: Preserve the existing project structure

## Assumptions

- Codex will inspect files before editing them.
- The user wants scoped changes rather than broad refactors.
- The selected project root is <PROJECT_ROOT>.

## Acceptance Criteria

- verification-code login
- Run the available test or build command after completion
- summarize the verification result

## Test Plan

- Run the existing automated tests when available.
- Perform focused manual checks for the requested behavior.
- Confirm every constraint and non-goal remains respected.
- Verify acceptance criterion: verification-code login
- Verify acceptance criterion: Run the available test or build command after completion
- Verify acceptance criterion: summarize the verification result

## Rollback Plan

- Keep a clear list of files changed by Codex.
- If behavior regresses, revert only the files touched for this task.
- Preserve generated task and review artifacts for audit history.

## Pairing Review

### Matched Pairs

- **Goal <-> Task** `matched` (0.96): Add a login page for the existing app with a dark minimal visual style -> Implement "Add a login page for the existing app with a dark minimal visual style" within TypeScript while keeping changes scoped, testable, and reviewable.
- **Constraint <-> Risk** `matched` (0.96): Do not modify unrelated files -> Constraint must be guarded: Do not modify unrelated files
- **Constraint <-> Risk** `matched` (0.96): Preserve the existing project structure -> Constraint must be guarded: Preserve the existing project structure
- **Preference <-> Pattern** `matched` (0.96): a dark minimal visual style -> Reflect these user preferences where relevant: a dark minimal visual style; Task mode: implementation; prepare scoped changes and verification.
- **Preference <-> Pattern** `matched` (0.96): Task mode: implementation; prepare scoped changes and verification. -> Reflect these user preferences where relevant: a dark minimal visual style; Task mode: implementation; prepare scoped changes and verification.
- **Feature <-> Module** `matched` (0.84): Add a login page for the existing app with a dark minimal visual style -> Authentication flow
- **Feature <-> Module** `matched` (0.84): Add a login page for the existing app -> Authentication flow
- **Feature <-> Module** `matched` (0.82): a dark minimal visual style -> Requirement handling
- **Feature <-> Module** `matched` (0.84): Support email login -> Authentication flow
- **Feature <-> Module** `matched` (0.86): verification-code login -> Verification
- **Feature <-> Module** `matched` (0.86): Run the available test or build command after completion -> Verification
- **Feature <-> Module** `matched` (0.86): summarize the verification result -> Verification
- **Acceptance <-> Test** `matched` (0.96): verification-code login -> Verify acceptance criterion: verification-code login
- **Acceptance <-> Test** `matched` (0.96): Run the available test or build command after completion -> Verify acceptance criterion: Run the available test or build command after completion
- **Acceptance <-> Test** `matched` (0.96): summarize the verification result -> Verify acceptance criterion: summarize the verification result
- **Memory <-> Reuse** `general` (0.62): Use CodeDNA pairing before large Codex edits. -> Codex will inspect files before editing them.
- **Memory <-> Reuse** `general` (0.62): Generate a Codex Task Pack before implementation. -> Codex will inspect files before editing them.
- **Memory <-> Reuse** `matched` (0.86): Review Codex output against constraints before accepting changes. -> Separate requirement interpretation, implementation planning, verification, and review output.
- **Memory <-> Reuse** `general` (0.62): Use MCP client smoke before publishing CodeDNA updates. -> Codex will inspect files before editing them.
- **Memory <-> Reuse** `matched` (0.86): Avoid: incomplete mock implementations -> Separate requirement interpretation, implementation planning, verification, and review output.
- **Memory <-> Reuse** `matched` (0.86): Avoid: unrelated refactors -> Separate requirement interpretation, implementation planning, verification, and review output.
- **Memory <-> Reuse** `matched` (0.86): Avoid: desktop-app scaffolding when a Codex plugin is requested -> Separate requirement interpretation, implementation planning, verification, and review output.
- **Memory <-> Reuse** `matched` (0.86): Avoid: single-file monoliths -> Separate requirement interpretation, implementation planning, verification, and review output.
- **Memory <-> Reuse** `matched` (0.82): Preferred UI style: dark, minimal, technical -> Separate requirement interpretation, implementation planning, verification, and review output.

### Unmatched Or Weak Pairs

- None

## Codex Self Check

- Confirm the final diff only touches files needed for this task.
- Confirm every user constraint is addressed explicitly.
- Confirm the output followed the CodeDNA chain: requirement strand, pairing review, reverse analysis, execution, reverse review, memory proposal when appropriate.
- Run verification commands or explain why they cannot be run.
- Summarize changed files, behavior, tests, and residual risks.
- Do not claim completion without evidence from inspection or verification.

## Required Final Response Format

```markdown
Summary:
- <what changed>

Verification:
- <command or manual check and result>

Files Changed:
- <path>: <reason>

Risks / Follow-ups:
- <remaining issue or 'None'>
```
