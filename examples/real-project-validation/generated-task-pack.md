# Codex Task Pack

Task ID: codedna-task-20260614T063004Z-Add-a-login-page-for-the-existing-app-with-a-dark-minimal-visual-style

## Execution Gate

- Pairing Score: 92
- Execution Level: full
- Ready for Codex: yes
- Gate note: Generate and execute the task pack normally.


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
    "a dark minimal visual style"
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
  "created_at": "2026-06-14T06:30:04.722Z"
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
    "Reflect these user preferences where relevant: a dark minimal visual style"
  ],
  "required_modules": [
    "Requirement handling",
    "Implementation planning",
    "Verification",
    "Completion summary",
    "UI component",
    "Style layer",
    "Authentication flow",
    "Form validation",
    "Security review",
    "Test planner",
    "Verification runner plan"
  ],
  "affected_files": [
    ".agents",
    ".codex-plugin",
    "assets",
    "data",
    "docs",
    "examples",
    "hooks",
    "mcp-server"
  ],
  "implementation_steps": [
    "Read the target files and identify existing patterns before editing.",
    "Focus initial edits on: .agents, .codex-plugin, assets, data, docs, examples, hooks, mcp-server",
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
    "mcp-server/package.json (node)"
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
    "The selected project root is <plugin-root>."
  ],
  "created_at": "2026-06-14T06:30:04.726Z"
}
```

## Project Profile Summary

- Project path: C:\path\to\codedna-plugin
- Languages: TypeScript
- Frameworks: none detected
- Package manager: npm
- Entry points: none detected
- Component directories: none detected
- API directories: none detected
- Test directories: mcp-server/test

## Allowed Files

- .agents
- .codex-plugin
- assets
- data
- docs
- examples
- hooks
- mcp-server

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
- venv/

## Missing Information

- None

## Implementation Plan

1. Read the target files and identify existing patterns before editing.
2. Focus initial edits on: .agents, .codex-plugin, assets, data, docs, examples, hooks, mcp-server
3. Check constraints before editing: Do not modify unrelated files; Preserve the existing project structure
4. Implement the smallest coherent change that satisfies the feature request.
5. Update or add tests only around changed behavior.
6. Run verification and summarize exact results.

## Architecture Guidance

- Separate requirement interpretation, implementation planning, verification, and review output.
- Follow the existing project structure before adding new top-level directories.
- Prefer small modules with explicit inputs and outputs.
- Keep generated artifacts auditable as JSON or Markdown.
- Reflect these user preferences where relevant: a dark minimal visual style

## Risks

- Unrelated file changes would make the Codex result harder to review.
- Missing verification may hide regressions.
- Constraint must be guarded: Do not modify unrelated files
- Constraint must be guarded: Preserve the existing project structure

## Assumptions

- Codex will inspect files before editing them.
- The user wants scoped changes rather than broad refactors.
- The selected project root is C:\path\to\codedna-plugin.

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
- **Preference <-> Pattern** `matched` (0.96): a dark minimal visual style -> Reflect these user preferences where relevant: a dark minimal visual style
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
