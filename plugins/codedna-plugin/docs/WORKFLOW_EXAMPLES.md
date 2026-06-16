# CodeDNA Workflow Examples

## First Use

1. Build the MCP server.
2. Install or enable the plugin in Codex.
3. Start a new Codex thread.
4. Ask CodeDNA to prepare a coding task before implementation.

Prompt:

```text
Use CodeDNA to prepare this task:
Add a login page with a dark minimal style. Support email login and verification-code login. Do not modify unrelated files. Run tests after completion.
```

## Real Project Test Flow

Run:

```powershell
cd C:\path\to\codedna-plugin\mcp-server
npm run validate:real-project
```

This scans the CodeDNA plugin project, runs the MCP workflow through a real stdio client, writes a Task Pack, writes a Review Report, and updates memory.

Generated report:

```text
C:\path\to\codedna-plugin\examples\real-project-validation\validation-report.md
```

## Bad Output Review

Use Diff Review when Codex output looks suspicious:

```text
Review this Codex output with CodeDNA:
- Added shell: true
- Added OPENAI_API_KEY=<redacted-example-value>
- Modified .env
```

Expected verdict: `blocked`.

## Fifth-Stage Deep Workflow

Use the full workflow tool for complex coding work:

```json
{
  "tool": "codedna_run_full_workflow",
  "arguments": {
    "user_request": "Add a login page. Do not modify unrelated files. Run tests.",
    "project_path": "C:\\path\\to\\codedna-plugin",
    "mode": "task_pack",
    "use_project_genome": true,
    "use_memory": true
  }
}
```

Then generate guardrails before any edits:

```json
{
  "tool": "codedna_generate_guardrails",
  "arguments": {
    "requirement_strand": "<from full workflow>",
    "analysis_strand": "<from full workflow>",
    "project_profile": "<from full workflow>",
    "project_genome": "<from full workflow>"
  }
}
```

After Codex edits files, review the actual diff:

```json
{
  "tool": "codedna_review_diff",
  "arguments": {
    "original_request": "Add a login page. Do not modify unrelated files. Run tests.",
    "diff_text": "<git diff>",
    "changed_files": ["src/components/LoginForm.tsx"],
    "codex_summary": "Added login UI and ran npm test."
  }
}
```

If review fails, generate a focused repair task:

```json
{
  "tool": "codedna_generate_repair_task",
  "arguments": {
    "original_request": "Add a login page. Do not modify unrelated files. Run tests.",
    "diff_review": "<review diff result>",
    "guardrails_validation": "<validate changes result>"
  }
}
```

## Project Genome

Run `codedna_build_project_genome` against a project path to create:

```text
<project-root>\.codedna\project-genome.json
```

The genome records project type, framework, routing files, API files, safe edit zones, forbidden zones, test strategy, risk areas, and recommended Codex rules. Existing manual fields and manual forbidden zones are preserved on refresh.

## Guardrails And Validation

Generate guardrails before Codex edits. Validate the final diff after Codex edits:

```json
{
  "tool": "codedna_validate_changes",
  "arguments": {
    "guardrails": "<guardrails result>",
    "diff_text": "<git diff>",
    "changed_files": ["package-lock.json", "src/components/LoginForm.tsx"]
  }
}
```

Expected behavior:

- Forbidden files create violations.
- Important deletions block acceptance.
- Missing tests create warnings or required fixes.
- Large unrequested refactors are flagged.

## Memory Update

Use memory evolution with proposal and confirmation:

```text
Remember that I prefer dark minimal UI and scoped diffs.
```

Expected tools:

1. `codedna_propose_memory_update`
2. `codedna_confirm_memory_update`

Session constraints go to session memory. Current-project rules go to project memory. Long-term user preferences require explicit remember language or user confirmation.

## Test Plan And Outcome Score

Generate a task-type test plan:

```json
{
  "tool": "codedna_generate_test_plan",
  "arguments": {
    "task_type": "ui",
    "changed_files": ["src/components/LoginForm.tsx"]
  }
}
```

## Self-Benchmark Evolution

Use this flow before publishing a CodeDNA update:

```powershell
cd C:\path\to\codedna-plugin\mcp-server
npm run benchmark:evolve -- --rounds=1 --cases=100 --threshold=95 --dry-run
```

If the dry run passes, write local evolution memory and refresh the public sanitized reports:

```powershell
npm run benchmark:evolve -- --rounds=1 --cases=100 --threshold=95 --seed=20260616
```

Expected result:

- Overall accuracy is at least 95%.
- The workflow still follows Requirement Strand -> Pairing Review -> Analysis Strand -> Codex Task Pack -> Reverse Review -> Memory Evolution.
- Full run details stay local under `data/memory/evolution/`.
- Public summaries are written to `docs/BENCHMARK_REPORT.md` and `docs/EVOLUTION_LOG.md`.

Score the finished work:

```json
{
  "tool": "codedna_score_outcome",
  "arguments": {
    "original_request": "Add a login page.",
    "diff_review": "<diff review result>",
    "test_plan_result": {
      "tests_run": ["npm test"],
      "passed": true
    }
  }
}
```
