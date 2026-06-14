import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { MemoryStore } from "../src/storage/memoryStore.js";
import { parseRequirement } from "../src/tools/parseRequirement.js";
import { reverseAnalyze } from "../src/tools/reverseAnalyze.js";
import { pairStrands } from "../src/tools/pairStrands.js";
import { generateTaskPack } from "../src/tools/generateTaskPack.js";
import { updateMemory } from "../src/tools/updateMemory.js";
import { loadMemory } from "../src/tools/loadMemory.js";
import { buildProjectGenome } from "../src/tools/buildProjectGenome.js";
import { runFullWorkflow } from "../src/tools/runFullWorkflow.js";
import { reviewDiff } from "../src/tools/reviewDiff.js";
import { generateGuardrails } from "../src/tools/generateGuardrails.js";
import { validateChanges } from "../src/tools/validateChanges.js";
import { generateRepairTask } from "../src/tools/generateRepairTask.js";
import { proposeMemoryUpdate } from "../src/tools/proposeMemoryUpdate.js";
import { confirmMemoryUpdate } from "../src/tools/confirmMemoryUpdate.js";
import { generateTestPlan } from "../src/tools/generateTestPlan.js";
import { scoreOutcome } from "../src/tools/scoreOutcome.js";

async function withWorkspace<T>(fn: (workspace: string, memory: MemoryStore) => Promise<T>): Promise<T> {
  const workspace = await mkdtemp(join(tmpdir(), "codedna-phase5-"));
  const memory = new MemoryStore(join(workspace, "data"));
  await memory.ensureLayout();
  try {
    return await fn(workspace, memory);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

async function createNextProject(root: string): Promise<string> {
  const project = join(root, "next-project");
  await mkdir(join(project, "src", "app", "api", "login"), { recursive: true });
  await mkdir(join(project, "src", "components"), { recursive: true });
  await mkdir(join(project, "src", "state"), { recursive: true });
  await mkdir(join(project, "tests"), { recursive: true });
  await writeFile(
    join(project, "package.json"),
    JSON.stringify(
      {
        scripts: { build: "next build", test: "vitest" },
        dependencies: { next: "15.0.0", react: "19.0.0", zustand: "5.0.0" },
        devDependencies: { typescript: "5.8.3", vitest: "2.0.0" }
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(join(project, "package-lock.json"), "{}\n", "utf8");
  await writeFile(join(project, ".env"), "SECRET=local-only\n", "utf8");
  await writeFile(join(project, "next.config.js"), "module.exports = {};\n", "utf8");
  await writeFile(join(project, "tsconfig.json"), "{}\n", "utf8");
  await writeFile(join(project, "src", "app", "page.tsx"), "export default function Page() { return null; }\n", "utf8");
  await writeFile(join(project, "src", "app", "api", "login", "route.ts"), "export async function POST() {}\n", "utf8");
  await writeFile(join(project, "src", "components", "LoginForm.tsx"), "export function LoginForm() { return null; }\n", "utf8");
  await writeFile(join(project, "src", "state", "authStore.ts"), "export const authStore = {};\n", "utf8");
  await writeFile(join(project, "tests", "login.test.ts"), "import { test } from 'vitest';\n", "utf8");
  return project;
}

test("codedna_run_full_workflow generates a ready workflow and blocks vague execution", async () => {
  await withWorkspace(async (workspace, memory) => {
    const projectPath = await createNextProject(workspace);

    const ready = await runFullWorkflow(
      {
        user_request:
          "Add a login page with email and verification-code login. Do not modify unrelated files. Run tests after completion.",
        project_path: projectPath,
        optional_constraints: ["Only touch the login page, login component, API route, and focused tests."],
        mode: "task_pack",
        use_project_genome: true,
        use_memory: true
      },
      memory
    );

    assert.ok(ready.requirement_strand.core_goal.includes("Add a login page"));
    assert.ok(ready.analysis_strand.risks.length > 0);
    assert.ok(ready.project_profile?.framework.includes("Next.js"));
    assert.equal(ready.project_genome?.project_name, "next-project");
    assert.ok(ready.project_genome?.recommended_codex_rules.length);
    assert.ok(ready.pairing_result.pairing_score >= 70);
    assert.match(ready.next_action, /guardrails|execute/i);
    assert.match(ready.task_pack_path ?? "", /data[\\/]+tasks/);

    const blocked = await runFullWorkflow(
      {
        user_request: "Fix it.",
        project_path: join(workspace, "missing-project"),
        mode: "full",
        use_project_genome: true,
        use_memory: false
      },
      memory
    );

    assert.equal(blocked.pairing_result.ready_for_codex, false);
    assert.equal(blocked.pairing_result.execution_level, "blocked");
    assert.equal(blocked.task_pack_path, undefined);
    assert.ok(blocked.clarification_questions.length > 0);
    assert.ok(blocked.warnings.some((warning) => /scan|project|missing/i.test(warning)));
  });
});

test("codedna_build_project_genome creates and incrementally updates the project genome", async () => {
  await withWorkspace(async (workspace, memory) => {
    const projectPath = await createNextProject(workspace);
    const first = await buildProjectGenome({ project_path: projectPath }, memory);

    assert.equal(first.project_genome.schema_version, 1);
    assert.equal(first.project_genome.project_name, "next-project");
    assert.ok(first.project_genome.project_type.includes("Next.js"));
    assert.ok(first.project_genome.routing_files.includes("src/app/page.tsx"));
    assert.ok(first.project_genome.api_files.includes("src/app/api/login/route.ts"));
    assert.ok(first.project_genome.state_management_files.includes("src/state/authStore.ts"));
    assert.ok(first.project_genome.safe_edit_zones.includes("src/components"));
    assert.ok(first.artifact_path.endsWith(".codedna\\project-genome.json") || first.artifact_path.endsWith(".codedna/project-genome.json"));

    const saved = JSON.parse(await readFile(first.artifact_path, "utf8"));
    saved.custom_owner_note = "Keep this manual field.";
    saved.forbidden_zones = [...saved.forbidden_zones, "manual-secret.json"];
    await writeFile(first.artifact_path, `${JSON.stringify(saved, null, 2)}\n`, "utf8");

    const second = await buildProjectGenome({ project_path: projectPath }, memory);
    assert.equal(second.project_genome.custom_owner_note, "Keep this manual field.");
    assert.ok(second.project_genome.forbidden_zones.includes("manual-secret.json"));
  });
});

test("codedna_review_diff detects forbidden files, secrets, dangerous commands, refactors, missing tests, and mismatch", async () => {
  await withWorkspace(async (workspace, memory) => {
    const fakeOpenAiKey = "sk-" + "test1234567890abcdef";
    const projectPath = await createNextProject(workspace);
    const workflow = await runFullWorkflow(
      {
        user_request: "Add login validation. Only modify src/components/LoginForm.tsx. Do not modify unrelated files. Run tests.",
        project_path: projectPath,
        mode: "plan_only",
        use_project_genome: true,
        use_memory: false
      },
      memory
    );
    const guardrails = await generateGuardrails(
      {
        requirement_strand: workflow.requirement_strand,
        analysis_strand: workflow.analysis_strand,
        project_profile: workflow.project_profile,
        project_genome: workflow.project_genome
      },
      memory
    );

    const diffReview = await reviewDiff(
      {
        original_request: workflow.requirement_strand.original_request,
        requirement_strand: workflow.requirement_strand,
        analysis_strand: workflow.analysis_strand,
        pairing_result: workflow.pairing_result,
        guardrails: guardrails.guardrails,
        codex_summary: "Rewrote the whole app and skipped verification.",
        changed_files: [
          "src/components/LoginForm.tsx",
          ".env",
          "package.json",
          "src/app/page.tsx",
          "src/app/layout.tsx",
          "src/state/authStore.ts",
          "README.md",
          "docs/notes.md",
          "scripts/reset.js",
          "src/app/api/login/route.ts"
        ],
        diff_text: [
          "diff --git a/.env b/.env",
          `+OPENAI_API_KEY=${fakeOpenAiKey}`,
          "diff --git a/scripts/reset.js b/scripts/reset.js",
          "+exec('rm -rf /')",
          "diff --git a/package.json b/package.json",
          "+\"postinstall\": \"node scripts/reset.js\""
        ].join("\n")
      },
      memory
    );

    assert.equal(diffReview.final_verdict, "blocked");
    assert.ok(diffReview.forbidden_files_touched.includes(".env"));
    assert.ok(diffReview.hardcoded_secrets.length > 0);
    assert.ok(diffReview.api_keys.length > 0);
    assert.ok(diffReview.dangerous_commands.length > 0);
    assert.equal(diffReview.large_unrequested_refactor, true);
    assert.ok(diffReview.unrelated_changes.length > 0);
    assert.ok(diffReview.missing_tests.length > 0);
    assert.ok(diffReview.requirement_mismatch.length > 0);
    assert.match(diffReview.next_codex_repair_prompt, /Please repair/);
  });
});

test("guardrails validate changes and repair chain creates a focused repair task", async () => {
  await withWorkspace(async (workspace, memory) => {
    const projectPath = await createNextProject(workspace);
    const workflow = await runFullWorkflow(
      {
        user_request: "Add a login page UI component. Do not modify unrelated files. Run tests.",
        project_path: projectPath,
        mode: "task_pack",
        use_project_genome: true,
        use_memory: false
      },
      memory
    );
    const guardrails = await generateGuardrails(
      {
        requirement_strand: workflow.requirement_strand,
        analysis_strand: workflow.analysis_strand,
        project_profile: workflow.project_profile,
        project_genome: workflow.project_genome,
        pairing_result: workflow.pairing_result,
        task_id: "login-task"
      },
      memory
    );

    assert.equal(guardrails.guardrails.task_id, "login-task");
    assert.ok(guardrails.guardrails.allowed_files.some((file) => file.includes("src")));
    assert.ok(guardrails.guardrails.forbidden_files.includes(".env"));
    assert.ok(guardrails.guardrails.forbidden_files.includes("package-lock.json"));
    assert.ok(guardrails.guardrails.required_tests.length > 0);

    const validation = await validateChanges(
      {
        guardrails: guardrails.guardrails,
        diff_text: [
          "diff --git a/package-lock.json b/package-lock.json",
          "diff --git a/src/components/LoginForm.tsx b/src/components/LoginForm.tsx"
        ].join("\n"),
        changed_files: ["package-lock.json", "src/components/LoginForm.tsx"],
        codex_summary: "Added UI but did not run tests."
      },
      memory
    );

    assert.equal(validation.validation_passed, false);
    assert.ok(validation.touched_forbidden_files.includes("package-lock.json"));
    assert.ok(validation.missing_required_tests.length > 0);
    assert.match(validation.final_verdict, /needs_fix|blocked/);

    const repair = await generateRepairTask(
      {
        original_request: workflow.requirement_strand.original_request,
        guardrails_validation: validation,
        project_profile: workflow.project_profile,
        project_genome: workflow.project_genome
      },
      memory
    );

    assert.match(repair.repair_task_markdown, /Do not reimplement the entire feature/);
    assert.match(repair.repair_task_markdown, /Restore or revert forbidden file changes/);
    assert.match(repair.repair_task_path, /data[\\/]+tasks/);
  });
});

test("memory proposals support session, project, confirmed user, and rejected user writes", async () => {
  await withWorkspace(async (workspace, memory) => {
    const projectPath = await createNextProject(workspace);

    const sessionProposal = await proposeMemoryUpdate(
      {
        source_text: "For this task, keep the login fix limited to the failing component.",
        task_context: { task_id: "session-task" },
        project_path: projectPath,
        detected_preference: "Keep the login fix limited to the failing component.",
        suggested_scope: "session",
        reason: "This is a task-local constraint.",
        confidence: 0.9
      },
      memory
    );
    assert.equal(sessionProposal.memory_scope, "session");
    assert.equal(sessionProposal.requires_confirmation, false);
    const sessionSaved = await confirmMemoryUpdate(
      {
        proposal_id: sessionProposal.proposal_id,
        confirmed: true,
        target_scope: "session"
      },
      memory
    );
    assert.match(sessionSaved.memory_path ?? "", /memory[\\/]+sessions/);

    const projectProposal = await proposeMemoryUpdate(
      {
        source_text: "This project should not modify package.json unless dependency work is requested.",
        task_context: { task_id: "project-task" },
        project_path: projectPath,
        detected_preference: "Do not modify package.json unless dependency work is requested.",
        suggested_scope: "project",
        reason: "The preference names this project.",
        confidence: 0.86
      },
      memory
    );
    const projectSaved = await confirmMemoryUpdate(
      {
        proposal_id: projectProposal.proposal_id,
        confirmed: true,
        target_scope: "project"
      },
      memory
    );
    assert.match(projectSaved.memory_path ?? "", /memory[\\/]+projects/);

    const rejectedUser = await proposeMemoryUpdate(
      {
        source_text: "I usually prefer concise final answers.",
        detected_preference: "Prefer concise final answers.",
        suggested_scope: "user",
        reason: "This sounds like a long-term communication preference.",
        confidence: 0.82
      },
      memory
    );
    assert.equal(rejectedUser.requires_confirmation, true);
    const rejected = await confirmMemoryUpdate(
      {
        proposal_id: rejectedUser.proposal_id,
        confirmed: false,
        target_scope: "user"
      },
      memory
    );
    assert.equal(rejected.confirmed, false);
    assert.equal(rejected.memory_path, undefined);

    const confirmedUser = await proposeMemoryUpdate(
      {
        source_text: "Remember that I prefer scoped code changes.",
        detected_preference: "Prefer scoped code changes.",
        suggested_scope: "user",
        reason: "The user explicitly asked CodeDNA to remember it.",
        confidence: 0.95
      },
      memory
    );
    assert.equal(confirmedUser.requires_confirmation, false);
    const userSaved = await confirmMemoryUpdate(
      {
        proposal_id: confirmedUser.proposal_id,
        confirmed: true,
        edited_memory_text: "Prefer scoped code changes unless the task explicitly requests a broad refactor.",
        target_scope: "user"
      },
      memory
    );
    assert.match(userSaved.memory_path ?? "", /memory[\\/]+user[\\/]+preferences\.json/);
    assert.equal(userSaved.saved_memory?.confirmed, true);
    assert.equal(userSaved.saved_memory?.schema_version, 2);

    const loaded = await loadMemory(memory);
    assert.ok(loaded.layered_memory.user.memories.some((item) => item.confirmed === true));
    assert.ok(Object.keys(loaded.layered_memory.projects).length >= 1);
    assert.ok(Object.keys(loaded.layered_memory.sessions).length >= 1);
  });
});

test("test plan generation and outcome scoring follow task-type and verdict rules", async () => {
  await withWorkspace(async (workspace, memory) => {
    const projectPath = await createNextProject(workspace);
    const workflow = await runFullWorkflow(
      {
        user_request: "Add a login page, login API, bug fix verification, and avoid unrelated refactors. Run tests.",
        project_path: projectPath,
        mode: "plan_only",
        use_project_genome: true,
        use_memory: false
      },
      memory
    );

    const uiPlan = await generateTestPlan(
      {
        requirement_strand: workflow.requirement_strand,
        analysis_strand: workflow.analysis_strand,
        project_profile: workflow.project_profile,
        project_genome: workflow.project_genome,
        changed_files: ["src/components/LoginForm.tsx"],
        task_type: "ui"
      },
      memory
    );
    assert.match(uiPlan.test_plan_markdown, /visual check/i);
    assert.match(uiPlan.test_plan_markdown, /responsive/i);
    assert.match(uiPlan.test_plan_path ?? "", /data[\\/]+test-plans/);

    const apiPlan = await generateTestPlan(
      {
        requirement_strand: workflow.requirement_strand,
        analysis_strand: workflow.analysis_strand,
        project_profile: workflow.project_profile,
        project_genome: workflow.project_genome,
        changed_files: ["src/app/api/login/route.ts"],
        task_type: "api"
      },
      memory
    );
    assert.match(apiPlan.test_plan_markdown, /authentication/i);
    assert.match(apiPlan.test_plan_markdown, /failure/i);

    const bugPlan = await generateTestPlan(
      {
        requirement_strand: workflow.requirement_strand,
        analysis_strand: workflow.analysis_strand,
        project_profile: workflow.project_profile,
        project_genome: workflow.project_genome,
        task_type: "bug_fix"
      },
      memory
    );
    assert.match(bugPlan.test_plan_markdown, /reproduce/i);

    const refactorPlan = await generateTestPlan(
      {
        requirement_strand: workflow.requirement_strand,
        analysis_strand: workflow.analysis_strand,
        project_profile: workflow.project_profile,
        project_genome: workflow.project_genome,
        task_type: "refactor"
      },
      memory
    );
    assert.match(refactorPlan.test_plan_markdown, /regression/i);

    const blockedReview = await reviewDiff(
      {
        original_request: workflow.requirement_strand.original_request,
        requirement_strand: workflow.requirement_strand,
        analysis_strand: workflow.analysis_strand,
        pairing_result: workflow.pairing_result,
        diff_text: "+SECRET_TOKEN=abc123456789abcdef\n",
        changed_files: [".env"],
        codex_summary: "Changed env file."
      },
      memory
    );
    const score = await scoreOutcome(
      {
        original_request: workflow.requirement_strand.original_request,
        requirement_strand: workflow.requirement_strand,
        analysis_strand: workflow.analysis_strand,
        pairing_result: workflow.pairing_result,
        diff_review: blockedReview,
        test_plan_result: { tests_run: [], passed: false },
        codex_output: "No tests were run."
      },
      memory
    );

    assert.equal(score.final_verdict, "blocked");
    assert.ok(score.requirement_match_score < 100);
    assert.ok(score.test_coverage_score < 60);
    assert.match(score.next_action, /fix|repair|blocked|test/i);
  });
});

test("existing tools remain backward compatible with legacy task-pack and memory flow", async () => {
  await withWorkspace(async (_workspace, memory) => {
    const parsed = await parseRequirement(
      {
        request: "Add a focused CLI helper and run tests. Do not modify unrelated files.",
        save: false
      },
      memory
    );
    const analysis = await reverseAnalyze({ requirement_strand: parsed.requirement_strand, save: false }, memory);
    const pairing = await pairStrands(
      {
        requirement_strand: parsed.requirement_strand,
        analysis_strand: analysis.analysis_strand,
        save: false
      },
      memory
    );
    const taskPack = await generateTaskPack(
      {
        requirement_strand: parsed.requirement_strand,
        analysis_strand: analysis.analysis_strand,
        pairing_result: pairing.pairing_result,
        save: false
      },
      memory
    );
    assert.match(taskPack.codex_task_pack.markdown, /Codex Task Pack/);

    const updated = await updateMemory(
      {
        memory_patch: { code_preferences: ["Prefer small focused modules."] },
        layered_memory: {
          memory_scope: "session",
          content: "Legacy update path can also write session memory.",
          source_text: "Legacy compatibility test",
          reason: "Backwards compatibility",
          confidence: 0.7,
          task_id: "legacy-task"
        }
      },
      memory
    );
    assert.ok(updated.memory.code_preferences.includes("Prefer small focused modules."));
    const loaded = await loadMemory(memory);
    assert.ok(loaded.layered_memory.sessions["legacy-task"].memories.length >= 1);
  });
});
