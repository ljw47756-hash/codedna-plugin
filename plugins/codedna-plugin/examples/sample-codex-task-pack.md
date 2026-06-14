# Codex Task Pack

## Execution Gate

- Pairing score: 86
- Execution level: cautious
- Ready for Codex: yes
- Gate note: Generate the task pack with assumptions and risk notes attached.

## Task Goal

Add a login page to the current project with a dark, minimal style, email login, and verification-code login.

## Original User Request

Add a login page to the current project. Use a dark, minimal style. Support email login and verification-code login. Do not modify unrelated files.

## Recommended Files Or Areas

- src/pages/
- src/components/
- src/routes/

## Forbidden Scope

- Do not modify unrelated files.
- Do not touch secrets, environment files, or local machine configuration.
- Do not change generated lockfiles unless required by the task.

## Execution Steps

1. Read the target files and identify existing patterns before editing.
2. Focus initial edits on the route and reusable UI components.
3. Implement the smallest coherent login-page change.
4. Add or update tests around changed behavior.
5. Run verification and summarize exact results.

## Required Completion Summary Format

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
