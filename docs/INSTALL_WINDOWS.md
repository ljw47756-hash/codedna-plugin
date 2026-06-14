# Install CodeDNA On Windows

This guide is for the local CodeDNA plugin at:

```text
C:\path\to\codedna-plugin
```

## 1. Build The MCP Server

```powershell
cd C:\path\to\codedna-plugin\mcp-server
npm ci
npm run build
```

## 2. Validate The Plugin Files

```powershell
python "%USERPROFILE%\.codex\skills\.system\plugin-creator\scripts\validate_plugin.py" "C:\path\to\codedna-plugin"
```

## 3. Install With CLI When Available

Register the local marketplace:

```powershell
codex plugin marketplace add C:\path\to\codedna-plugin\.agents\plugins
```

Install the plugin:

```powershell
codex plugin add codedna-plugin@codedna-local
```

Start a new Codex thread after installing.

## 4. If PowerShell Returns Access Is Denied

On this machine, `Get-Command codex -All` resolves to:

```text
C:\Program Files\WindowsApps\OpenAI.Codex_<version>_x64__<package-id>\app\resources\codex.exe
```

Calling that executable directly from PowerShell returned:

```text
Access is denied
```

Calling `cmd /c codex plugin --help` returned the same result. This indicates that the WindowsApps packaged app executable is not available as a normal CLI entry point from this shell. It does not mean the plugin files are invalid.

Use one of these alternatives:

1. Open the Codex app.
2. Open plugin or marketplace settings.
3. Add a local marketplace root:

```text
C:\path\to\codedna-plugin\.agents\plugins
```

4. Install or enable `codedna-plugin` from the `codedna-local` marketplace.
5. Start a new Codex thread.

## 5. Confirm The Plugin Loaded

In a new Codex thread, ask:

```text
Use CodeDNA to prepare this coding task: add a login page with a dark minimal style and do not modify unrelated files.
```

The plugin is loaded when Codex can use CodeDNA skills and MCP tools named:

```text
codedna_load_memory
codedna_scan_project
codedna_build_project_genome
codedna_run_full_workflow
codedna_parse_requirement
codedna_reverse_analyze
codedna_pair_strands
codedna_generate_task_pack
codedna_generate_guardrails
codedna_validate_changes
codedna_review_diff
codedna_review_output
codedna_generate_repair_task
codedna_propose_memory_update
codedna_confirm_memory_update
codedna_generate_test_plan
codedna_score_outcome
codedna_update_memory
```

For a quick functional check, ask CodeDNA to run a full workflow:

```text
Use CodeDNA full workflow for this task: add a small README section, do not modify unrelated files, and run verification.
```

Expected result: a Requirement Strand, Analysis Strand, Pairing Result, optional Project Genome, and a gated task pack or clarification questions.

## 6. Reinstall During Local Development

Update the plugin cachebuster:

```powershell
python "%USERPROFILE%\.codex\skills\.system\plugin-creator\scripts\update_plugin_cachebuster.py" "C:\path\to\codedna-plugin"
```

Then reinstall from the same marketplace when the CLI is available:

```powershell
codex plugin add codedna-plugin@codedna-local
```

Open a new Codex thread after reinstalling.
