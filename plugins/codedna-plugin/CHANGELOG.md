# Changelog

## 0.1.0+codex.20260614062925

- Added `codedna_run_full_workflow` for one-command planning, scanning, pairing, and gated task-pack generation.
- Added `codedna_build_project_genome` and `.codedna/project-genome.json` support with incremental updates and preserved manual fields.
- Added `codedna_review_diff` for actual diff, changed-file, secret, dangerous-command, forbidden-file, refactor, missing-test, and mismatch review.
- Added `codedna_generate_guardrails` and `codedna_validate_changes` for pre-edit scope controls and post-edit validation.
- Added `codedna_generate_repair_task` for focused next-round Codex repair prompts.
- Added layered memory proposals and confirmation through `codedna_propose_memory_update` and `codedna_confirm_memory_update`.
- Added `codedna_generate_test_plan` for UI, API, bug fix, refactor, and general verification planning.
- Added `codedna_score_outcome` for quantitative completion, repair, test, or user-question decisions.
- Updated all CodeDNA skills, README, docs, tests, and release checks for fifth-stage behavior.

## 0.1.0+codex.20260613142845

- Added real MCP stdio client validation through `npm run smoke`.
- Added full-workflow generated task pack and review report examples.
- Refined all CodeDNA skills with complete trigger, input, output, workflow, tool, rule, failure, and example sections.
- Added advisory hook assets for pre-task and post-task CodeDNA reminders.
- Improved Codex Task Pack and Review Report Markdown formats.
- Added project scan matrix tests for React, Next.js, Vue, Node CLI, FastAPI, Python desktop, mixed, empty, huge, and ignored-directory cases.
- Strengthened review safety rules for forbidden files, dangerous commands, plaintext API keys, broad refactors, deleted files, test gaps, assumptions, and requirement mismatch.
- Added memory schema versioning and migration coverage.
- Added Windows install, troubleshooting, workflow examples, and release checklist documentation.

## 0.1.0

- Initial CodeDNA Codex Plugin scaffold.
- Added `.codex-plugin/plugin.json`, skills, `.mcp.json`, MCP server, examples, hooks assets, local marketplace config, README, and MIT license.
