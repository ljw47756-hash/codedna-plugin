# CodeDNA Release Checklist

Use this checklist before sharing or packaging CodeDNA.

## Required Verification

- [ ] Run `npm test` from `C:\path\to\codedna-plugin\mcp-server`.
- [ ] Run `npm run build` from `C:\path\to\codedna-plugin\mcp-server`.
- [ ] Run `npm run smoke` from `C:\path\to\codedna-plugin\mcp-server`.
- [ ] Run `npm run validate:real-project` from `C:\path\to\codedna-plugin\mcp-server`.
- [ ] Run `npm run benchmark:evolve -- --rounds=1 --cases=100 --threshold=95 --dry-run`.
- [ ] For release, run `npm run benchmark:evolve -- --rounds=1 --cases=100 --threshold=95 --seed=20260616`.
- [ ] Run the plugin validator against `C:\path\to\codedna-plugin`.
- [ ] Run an English scan outside `node_modules`, `dist`, and `data`.
- [ ] Run a wrong-direction file scan for non-plugin app leftovers.
- [ ] Run a development-marker scan outside `node_modules`, `dist`, and `data`.

## Plugin Structure

- [ ] `.codex-plugin/plugin.json` exists.
- [ ] `.mcp.json` points to `./mcp-server/dist/server.js`.
- [ ] `skills/` contains every CodeDNA `SKILL.md`.
- [ ] `.agents/plugins/marketplace.json` points to `./plugins/codedna-plugin`.
- [ ] `README.md`, `CHANGELOG.md`, and `docs/` are current.
- [ ] Fifth-stage MCP tools are registered in `mcp-server/src/server.ts`.
- [ ] Project Genome support writes `.codedna/project-genome.json` in target projects.
- [ ] Layered memory directories exist for user, project, session, and proposals.

## Publish Readiness

- [ ] Version contains the intended release or local cachebuster.
- [ ] Generated runtime `data/` is not packaged unless intentionally included as sample output.
- [ ] `node_modules/` is not packaged.
- [ ] `mcp-server/dist/` is regenerated from current TypeScript.
- [ ] Review Report verdict states are documented: `pass`, `pass_with_warnings`, `needs_fix`, `blocked`.
- [ ] Diff Review, Guardrails, Repair Chain, Test Plan, and Outcome Score are documented.
- [ ] Guardrails forbid environment, package-manager, and build-config files by default unless explicitly requested.
- [ ] Long-term user memory requires explicit remember language or confirmation.
- [ ] Self-benchmark accuracy is at least 95%.
- [ ] Public benchmark docs are sanitized and contain no local user paths.
- [ ] Full benchmark memory remains under ignored `data/memory/evolution/`.

## Codex App Validation

- [ ] If CLI works, install with `codex plugin add codedna-plugin@codedna-local`.
- [ ] If CLI returns `Access is denied`, use the manual Codex App flow in `docs/INSTALL_WINDOWS.md`.
- [ ] Open a new Codex thread after install or reinstall.
- [ ] Confirm CodeDNA skills and `codedna_*` tools are available.
- [ ] Confirm `codedna_run_full_workflow` returns a task pack or clarification questions.
- [ ] Confirm `codedna_review_diff` blocks plaintext secrets and dangerous commands.
- [ ] Confirm `codedna_generate_repair_task` creates a focused repair task when review fails.
