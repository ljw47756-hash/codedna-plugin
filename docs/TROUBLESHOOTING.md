# CodeDNA Troubleshooting

## Codex CLI Returns Access Is Denied

Cause: PowerShell or `cmd` may resolve `codex` to a packaged WindowsApps executable that cannot be launched directly from the shell.

Fix:

- Use the Codex app manual plugin installation flow in `docs/INSTALL_WINDOWS.md`.
- Or install a supported standalone Codex CLI entry point if your Codex distribution provides one.

## MCP Server Does Not Start

Run:

```powershell
cd C:\path\to\codedna-plugin\mcp-server
npm ci
npm run build
npm start
```

If `node` is not found, install Node.js 20 or newer or use an absolute Node path in `.mcp.json`.

## Plugin Validator Fails On Hooks

Current validation rejects unsupported manifest fields such as `hooks`. CodeDNA keeps hook guidance in `hooks/` but does not register hooks in `plugin.json`.

## Pairing Score Is Below 70

CodeDNA intentionally blocks direct execution when information is missing. Review `missing_information` in the Pairing Result or Task Pack, answer the missing questions, then rerun the workflow.

## Review Report Says Blocked

`blocked` means high-risk output was detected, such as forbidden file edits, important file deletion, dangerous commands, plaintext API keys, or serious constraint violations. Use the generated repair prompt instead of accepting the result.

## Diff Review Says Blocked

Cause: `codedna_review_diff` found a hard blocker, such as a plaintext API key, token, password, dangerous command, important deletion, or high-risk forbidden file edit.

Fix:

- Run `codedna_generate_repair_task`.
- Restore forbidden files before other repair work.
- Remove secrets and replace them with environment-based configuration or documented sample values.
- Rerun `codedna_review_diff` after repair.

## Guardrails Validation Fails

Cause: Codex touched files outside `allowed_files`, touched `forbidden_files`, skipped required tests, or performed a broad unrequested refactor.

Fix:

- Use `repair_suggestion` from `codedna_validate_changes`.
- Keep the repair limited to listed violations.
- Do not broaden the diff without user confirmation.

## Project Genome Looks Wrong

Cause: The project changed after the last scan, or a manual `.codedna/project-genome.json` field needs to be preserved.

Fix:

- Rerun `codedna_build_project_genome`.
- Manual fields are preserved on refresh.
- Manual `forbidden_zones` are merged with detected forbidden zones.
- Delete only the generated genome file if you want a clean rebuild.

## Memory Proposal Is Waiting For Confirmation

Cause: Long-term user memory requires explicit remember language or confirmation.

Fix:

- For long-term user preferences, call `codedna_confirm_memory_update` after user confirmation.
- For current-task constraints, save session memory instead.
- For current-project rules, save project memory instead.
- Do not force user memory writes for one-off preferences.

## Memory File Looks Old

CodeDNA migrates memory files to the current schema when `MemoryStore.ensureLayout()` runs. Current schema version is stored in `memory/user_preferences.json` as `schema_version`.

New layered memory is stored in:

```text
data/memory/user/preferences.json
data/memory/projects/<project-id>/project-memory.json
data/memory/sessions/<task-id>/session-memory.json
data/memory/proposals/<proposal-id>.json
```
