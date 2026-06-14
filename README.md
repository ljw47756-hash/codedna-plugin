# CodeDNA Codex Plugin

CodeDNA is a Codex Plugin for preparing, executing, reviewing, and remembering coding work. It runs as a local plugin with discoverable skills and a TypeScript MCP server.

## Quick Install From GitHub

Add this repository as a plugin marketplace in Codex App:

```text
Source: https://github.com/ljw47756-hash/codedna-plugin.git
Git ref: main
Sparse path: leave blank
```

After installation, restart Codex App or start a new thread so the plugin skills and MCP server are loaded.

Confirm the installation in Codex App:

- Search `codedna` in the Skills view. You should see 9 CodeDNA skills.
- Open Settings -> MCP Servers. You should see `Codedna` enabled.
- The plugin may not appear as a top-level app-style plugin card. CodeDNA is a tools plugin made of skills plus an MCP server, not an external app connector.

## How To Invoke CodeDNA

CodeDNA can be triggered naturally by its skills when a task is complex, but explicit prompts are more reliable.

Use a short trigger for ordinary guarded coding work:

```text
Use CodeDNA for this task.
```

Use a stronger trigger when you want planning before edits:

```text
Use CodeDNA. First analyze, generate guardrails, then ask me before editing files.
```

Use the full workflow for architecture-sensitive or multi-file work:

```text
Use CodeDNA full workflow before editing.
```

Recommended first test prompt:

```text
Use CodeDNA full workflow for this project:
C:\path\to\your\project

Request:
Add a short README quick start section, but do not edit files yet. First generate Requirement Strand, Analysis Strand, Project Profile, Project Genome, Pairing Result, Guardrails, Test Plan, and Codex Task Pack.
```

Use CodeDNA for:

- Multi-file implementation tasks.
- Vague requests that need requirement capture.
- Refactors or architecture-sensitive changes.
- Tasks with strict file boundaries.
- Tasks that need guardrails before editing.
- Reviewing a Codex diff before accepting it.
- Repairing failed Codex output.
- Updating memory after explicit user confirmation.

You usually do not need CodeDNA for:

- Tiny copy edits.
- Simple explanations.
- One-line fixes with obvious scope.
- General questions that do not touch code.

## What Shows Up In Codex App

CodeDNA is a Codex Plugin, but it is not an app connector. In Codex App it is expected to appear as separate capabilities:

```text
Skills: CodeDNA workflow instructions
MCP: Codedna local tool server
Apps: none
Top-level plugin card: may not appear for local tools plugins
```

This is normal. The important checks are that CodeDNA skills are enabled and the `Codedna` MCP server is enabled.

## Sharing This Plugin

Send users this repository URL:

```text
https://github.com/ljw47756-hash/codedna-plugin.git
```

They should install it through Codex App with:

```text
Source: https://github.com/ljw47756-hash/codedna-plugin.git
Git ref: main
Sparse path: leave blank
```

Do not share a local cache directory such as:

```text
C:\Users\<name>\.codex\plugins\cache\...
```

That cache is machine-specific. The GitHub repository is the distribution source.

If the skills install but the MCP server does not start, verify that Node.js is installed and that the `Codedna` MCP server is enabled in Codex App settings. Advanced users can register the MCP server manually with an absolute Node path and the local `mcp-server\dist\server.js` path.

## Privacy And Data

CodeDNA does not call external AI APIs from its MCP server. It stores workflow artifacts locally so Codex can plan, review, repair, and remember coding work.

Local runtime files may include:

- Requirement and Analysis strands.
- Task packs.
- Review reports.
- Test plans.
- Project profiles and Project Genome data.
- Memory proposals and confirmed memory.

By default, plugin runtime data is written under the plugin `data/` directory. If `CODEDNA_DATA_DIR` is set in the MCP server environment, CodeDNA writes runtime files there instead.

Do not commit local runtime data, secrets, API keys, tokens, private project files, or personal memory exports.

## 1. What CodeDNA Is

CodeDNA helps Codex turn an ambiguous coding request into a structured local workflow:

1. Capture the user request as a Requirement Strand.
2. Reverse-analyze it into an Analysis Strand.
3. Pair both strands before implementation.
4. Build a Project Genome for the target repository.
5. Generate a Codex Task Pack and execution guardrails.
6. Review the final diff after implementation.
7. Generate a focused repair task when review fails.
8. Store session, project, and confirmed user memory with explicit scope.
9. Generate task-specific test plans and outcome scores.

## 2. What Problem It Solves

Codex can move quickly, but complex coding requests often fail when requirements, constraints, file scope, tests, and review criteria are not explicit. CodeDNA makes those pieces visible before edits start and checks the final output after Codex finishes.

Use it for:

- Multi-file feature work.
- Bug repair.
- Refactors.
- Architecture-sensitive changes.
- Strict file-scope requests.
- Requests with acceptance criteria or constraints.
- Reviewing Codex output before accepting it.

## 3. Plugin Structure

```text
C:\path\to\codedna-plugin
|-- .codex-plugin\plugin.json
|-- .mcp.json
|-- .agents\plugins\marketplace.json
|-- assets\icon.png
|-- examples\
|-- hooks\
|-- mcp-server\
|   |-- package.json
|   |-- tsconfig.json
|   |-- scripts\e2e.ts
|   |-- src\
|   `-- test\
|-- skills\
|   |-- codedna-orchestrator\SKILL.md
|   |-- requirement-capture\SKILL.md
|   |-- reverse-analysis\SKILL.md
|   |-- pairing-review\SKILL.md
|   |-- codex-task-pack\SKILL.md
|   |-- code-review\SKILL.md
|   |-- test-planner\SKILL.md
|   |-- bug-repair\SKILL.md
|   `-- memory-evolution\SKILL.md
|-- README.md
`-- LICENSE
```

## 4. Install Dependencies

Requirements:

- Node.js 20 or newer.
- npm.
- Codex with local plugin support.

Install MCP server dependencies:

```powershell
cd C:\path\to\codedna-plugin\mcp-server
npm ci
```

## 5. Build The MCP Server

```powershell
cd C:\path\to\codedna-plugin\mcp-server
npm run build
```

The plugin MCP config is:

```json
{
  "mcpServers": {
    "codedna": {
      "command": "node",
      "args": ["./mcp-server/dist/server.js"],
      "env": {
        "CODEDNA_DATA_DIR": "./data"
      }
    }
  }
}
```

Codex starts this command from the plugin root:

```text
C:\path\to\codedna-plugin
```

## 6. Start The MCP Server Locally

For a direct stdio server run:

```powershell
cd C:\path\to\codedna-plugin\mcp-server
npm run build
npm start
```

`npm start` waits for an MCP client on stdio. In normal plugin use, Codex starts the server through `.mcp.json`.

## 7. Install Into Codex Plugin

This repository includes a marketplace at:

```text
C:\path\to\codedna-plugin\.agents\plugins\marketplace.json
```

For GitHub installation in Codex App, add a plugin marketplace with:

```text
Source: https://github.com/ljw47756-hash/codedna-plugin.git
Git ref: main
Sparse path: leave blank
```

For local CLI installation, register the marketplace root:

```powershell
codex plugin marketplace add C:\path\to\codedna-plugin\.agents\plugins
```

Install CodeDNA from that marketplace:

```powershell
codex plugin add codedna-plugin@codedna-local
```

Start a new Codex thread after installing so Codex loads the plugin skills and MCP tools.

## 8. Test Through The Local Marketplace

The marketplace entry points to the standard plugin package path:

```json
{
  "name": "codedna-plugin",
  "source": {
    "source": "local",
    "path": "./plugins/codedna-plugin"
  },
  "policy": {
    "installation": "AVAILABLE",
    "authentication": "ON_INSTALL"
  },
  "category": "Productivity"
}
```

The repository keeps the plugin package at:

```text
C:\path\to\codedna-plugin\plugins\codedna-plugin
```

Confirm the plugin is loaded by opening a new Codex thread and asking:

```text
Use CodeDNA to prepare this coding task: add a login page and do not modify unrelated files.
```

A successful load should make CodeDNA skills available and expose MCP tools named `codedna_*`.

In Codex App, CodeDNA is expected to be visible under Skills and MCP Servers. It may not show as a clickable top-level app-style plugin in the composer menu because it does not provide an app connector.

### Install Screenshot Notes

Add release screenshots here before publishing outside local development:

- `assets/install-marketplace.png`: local marketplace added in Codex.
- `assets/plugin-enabled.png`: CodeDNA enabled in Codex.
- `assets/task-pack-result.png`: generated Task Pack visible in a Codex thread.
- `assets/review-report-result.png`: generated Review Report visible after Codex output review.

## 9. Trigger The CodeDNA Workflow

Use CodeDNA when a request is complex, constrained, multi-file, or needs review.

Example prompt:

```text
Use CodeDNA to generate a task pack for this request:
Add a login page with a dark minimal style. Support email login and verification-code login. Do not modify unrelated files. Run tests after completion.
```

Expected workflow for complex coding work:

1. `codedna_run_full_workflow`
2. `codedna_build_project_genome` when a project path is available.
3. `codedna_generate_guardrails`
4. Codex implements from the generated Markdown and guardrails.
5. Codex returns changed files, verification evidence, and a diff or summary.
6. `codedna_review_diff`
7. `codedna_validate_changes` when guardrails were generated.
8. `codedna_generate_repair_task` when review fails.
9. `codedna_generate_test_plan` or `codedna_score_outcome` when planning or acceptance needs more rigor.
10. `codedna_propose_memory_update` and `codedna_confirm_memory_update` when memory should be saved.

If the pairing score is below 70, CodeDNA should ask for missing information before implementation.

### Recommended First Use Flow

1. Install and enable CodeDNA.
2. Start a new Codex thread.
3. Ask CodeDNA to prepare a small constrained task.
4. Confirm that a Task Pack is generated under `data/tasks/`.
5. Ask Codex to implement from that Task Pack.
6. Paste Codex diff or changed-file summary into CodeDNA review.
7. Confirm that a Diff Review or Review Report is generated under `data/reviews/`.

### Phase 5 Deep Workflow

The fifth-stage workflow adds:

- One-command orchestration through `codedna_run_full_workflow`.
- Project Genome generation at `.codedna/project-genome.json`.
- Guardrails before Codex edits files.
- Diff Review after Codex changes files.
- Repair Chain generation when review fails.
- Layered memory with session, project, user, and proposal storage.
- Task-type test plans for UI, API, bug fix, refactor, and general work.
- Outcome scoring to decide complete, repair, add tests, or ask the user.

Typical use:

1. Plan the task with `codedna_run_full_workflow`.
2. Execute only after `codedna_generate_guardrails`.
3. Review the diff with `codedna_review_diff`.
4. Generate a repair task with `codedna_generate_repair_task` if needed.
5. Propose or confirm memory only after scope is clear.

## 10. MCP Tool Reference

- `codedna_load_memory`: loads user preferences, successful patterns, rejected patterns, and task history.
- `codedna_scan_project`: scans a local project and saves a Project Profile under `data/memory/project_profiles/`.
- `codedna_build_project_genome`: writes `.codedna/project-genome.json` with architecture, safe edit zones, forbidden zones, tests, and Codex rules.
- `codedna_run_full_workflow`: runs memory load, project scan, requirement capture, analysis, pairing, and gated task-pack generation.
- `codedna_parse_requirement`: converts a natural-language request into a Requirement Strand.
- `codedna_reverse_analyze`: converts the Requirement Strand into technical architecture, modules, risks, tests, rollback, and assumptions.
- `codedna_pair_strands`: scores the pairing between requirement and analysis.
- `codedna_generate_task_pack`: writes a copy-ready Codex Task Pack under `data/tasks/`.
- `codedna_generate_guardrails`: generates allowed files, forbidden files, required tests, safety rules, and response format.
- `codedna_validate_changes`: checks a diff or changed-file list against guardrails.
- `codedna_review_diff`: checks real changes for forbidden files, unrelated edits, secrets, dangerous commands, missing tests, and mismatch.
- `codedna_review_output`: writes a Review Report under `data/reviews/`.
- `codedna_generate_repair_task`: writes a focused repair prompt under `data/tasks/`.
- `codedna_propose_memory_update`: creates a session, project, or user memory proposal without directly writing long-term memory.
- `codedna_confirm_memory_update`: writes confirmed memory to the selected memory layer.
- `codedna_generate_test_plan`: writes a test plan under `data/test-plans/`.
- `codedna_score_outcome`: scores requirement match, constraints, code quality, test coverage, architecture consistency, and risk.
- `codedna_update_memory`: appends or merges local memory under `data/memory/`.

Each tool returns structured JSON through MCP `structuredContent` and also returns formatted JSON text.

## 11. Complete Workflow Example

Input:

```text
C:\path\to\codedna-plugin\examples\full-workflow\input-requirement.md
```

Run the full MCP client workflow:

```powershell
cd C:\path\to\codedna-plugin\mcp-server
npm run smoke
```

This command:

- Builds the MCP server.
- Starts the server through `.mcp.json`.
- Calls the core MCP workflow through a real MCP stdio client.
- Writes task, review, and memory artifacts.
- Updates:
  - `examples\full-workflow\generated-task-pack.md`
  - `examples\full-workflow\generated-review-report.md`

### Real Project Test Flow

Run the real-project validation script against this plugin project:

```powershell
cd C:\path\to\codedna-plugin\mcp-server
npm run validate:real-project
```

This writes:

```text
C:\path\to\codedna-plugin\examples\real-project-validation\validation-report.md
```

## 12. Output Files

Runtime data is local and ignored by git:

```text
C:\path\to\codedna-plugin\data
|-- guardrails\
|-- memory\
|   |-- user_preferences.json
|   |-- user\preferences.json
|   |-- projects\
|   |-- sessions\
|   |-- proposals\
|   |-- project_profiles\
|   |-- successful_patterns\
|   |-- rejected_patterns\
|   `-- task_history\
|-- reviews\
|-- strands\
|-- test-plans\
`-- tasks\
```

Project Genome files are written inside the target project:

```text
<target-project>\.codedna\project-genome.json
```

Generated task packs:

```text
C:\path\to\codedna-plugin\data\tasks
```

Generated review reports:

```text
C:\path\to\codedna-plugin\data\reviews
```

## 13. Common Questions

### Why did CodeDNA block my task?

The pairing score was below 70. Check `missing_information` in the pairing result or task pack, answer the missing questions, then run the workflow again.

### Why are hooks not in plugin.json?

The current plugin validator rejects unsupported manifest fields such as `hooks`. CodeDNA keeps hook guidance in `hooks/` as optional compatibility assets without registering invalid manifest fields.

### Does CodeDNA call external AI APIs?

No. The MCP tools use local rules, local project scanning, and local JSON/Markdown storage.

### What do Review Report verdicts mean?

- `pass`: no issues detected.
- `pass_with_warnings`: non-blocking concerns such as missing test evidence or missing assumptions.
- `needs_fix`: fixable issues that should be addressed before accepting.
- `blocked`: high-risk output such as forbidden file edits, important file deletion, dangerous commands, plaintext API keys, or serious constraint violations.

### How does memory migration work?

CodeDNA writes `schema_version` into `data/memory/user_preferences.json` and task-history records. `MemoryStore.ensureLayout()` migrates older memory files to the current schema before tools use them.

Long-term user memory is written under `data/memory/user/preferences.json` only after explicit remember instructions or proposal confirmation. Current-task details go to session memory, and project rules go to project memory.

### Can I edit generated task packs?

Yes. They are Markdown files under `data/tasks/`. Treat edits as local working notes.

## 14. Windows Path Notes

Use quoted paths when a path contains spaces or non-ASCII directory names:

```powershell
cd "C:\path\to\codedna-plugin\mcp-server"
```

The `.mcp.json` paths are relative to the plugin root, not to `mcp-server/`.

If `node` is not on PATH, replace the command in `.mcp.json` with the absolute Node executable path.

## 15. Uninstall Or Disable

If using the Codex app, disable or remove CodeDNA from the plugin settings.

If your Codex CLI supports plugin removal, use:

```powershell
codex plugin remove codedna-plugin
```

To remove the local marketplace registration, use the Codex marketplace management command for your installed Codex version, or remove it through the Codex app plugin settings.

Generated local data can be deleted manually:

```powershell
Remove-Item -LiteralPath C:\path\to\codedna-plugin\data -Recurse -Force
```

## 16. Extension Plan

Planned next steps:

- Add richer project scanners for more frameworks.
- Add stronger semantic pairing rules.
- Add more real-world review checks for security and performance.
- Add optional hook registration when the plugin validator supports it.
- Add marketplace screenshots and release packaging.
- Add migration tools for memory schema changes.

## More Documentation

- [Windows install guide](docs/INSTALL_WINDOWS.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Workflow examples](docs/WORKFLOW_EXAMPLES.md)
- [Release checklist](RELEASE_CHECKLIST.md)
- [Changelog](CHANGELOG.md)

## Verification Commands

Run all checks before publishing or reinstalling:

```powershell
cd C:\path\to\codedna-plugin\mcp-server
npm test
npm run build
npm run smoke
npm run validate:real-project
npm run release:check
```

Validate the plugin manifest:

```powershell
python "%USERPROFILE%\.codex\skills\.system\plugin-creator\scripts\validate_plugin.py" "C:\path\to\codedna-plugin"
```
