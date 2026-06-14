import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import assert from "node:assert/strict";
import { MemoryStore } from "../src/storage/memoryStore.js";
import { JsonStore } from "../src/storage/jsonStore.js";
import { parseRequirement } from "../src/tools/parseRequirement.js";
import { reverseAnalyze } from "../src/tools/reverseAnalyze.js";
import { pairStrands } from "../src/tools/pairStrands.js";
import { scanProject } from "../src/tools/scanProject.js";
import { generateTaskPack } from "../src/tools/generateTaskPack.js";
import { reviewCodexOutput } from "../src/tools/reviewCodexOutput.js";
import { updateMemory } from "../src/tools/updateMemory.js";
import { loadMemory } from "../src/tools/loadMemory.js";

async function withWorkspace<T>(fn: (workspace: string, memory: MemoryStore) => Promise<T>): Promise<T> {
  const workspace = await mkdtemp(join(tmpdir(), "codedna-test-"));
  const memory = new MemoryStore(join(workspace, "data"));
  await memory.ensureLayout();
  try {
    return await fn(workspace, memory);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

async function createSampleProject(root: string): Promise<string> {
  const project = join(root, "sample-project");
  await mkdir(join(project, "src", "components"), { recursive: true });
  await mkdir(join(project, "src", "app", "api"), { recursive: true });
  await mkdir(join(project, "tests"), { recursive: true });
  await writeFile(
    join(project, "package.json"),
    JSON.stringify(
      {
        scripts: {
          build: "tsc",
          test: "vitest"
        },
        dependencies: {
          next: "15.0.0",
          react: "19.0.0"
        },
        devDependencies: {
          typescript: "5.8.3",
          vitest: "2.0.0"
        }
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(join(project, "src", "app", "page.tsx"), "export default function Page() { return null; }\n", "utf8");
  await writeFile(join(project, "src", "components", "LoginForm.tsx"), "export function LoginForm() { return null; }\n", "utf8");
  await writeFile(join(project, "src", "app", "api", "login.ts"), "export async function POST() {}\n", "utf8");
  await writeFile(join(project, "tests", "login.test.ts"), "import { test } from 'vitest';\n", "utf8");
  await writeFile(join(project, "next.config.js"), "module.exports = {};\n", "utf8");
  return project;
}

test("CodeDNA tools produce persisted strands, task packs, reviews, and memory", async () => {
  await withWorkspace(async (workspace, memory) => {
    const projectPath = await createSampleProject(workspace);
    const scan = await scanProject({ project_path: projectPath }, memory);

    assert.equal(scan.project_profile.project_name, "sample-project");
    assert.deepEqual(scan.project_profile.language, ["TypeScript"]);
    assert.ok(scan.project_profile.framework.includes("Next.js"));
    assert.equal(scan.project_profile.package_manager, "npm");
    assert.ok(scan.project_profile.dependency_files.some((file) => file.path === "package.json"));
    assert.ok(scan.project_profile.entry_points.includes("src/app/page.tsx"));
    assert.ok(scan.project_profile.component_dirs.includes("src/components"));
    assert.ok(scan.project_profile.api_dirs.includes("src/app/api"));
    assert.ok(scan.project_profile.test_dirs.includes("tests"));
    assert.ok(scan.project_profile.do_not_touch.includes("node_modules/"));
    assert.ok(scan.project_profile.tree_summary.length > 0);
    assert.match(scan.artifact_path ?? "", /data[\\/]+memory[\\/]+project_profiles/);

    const parsed = await parseRequirement(
      {
        request:
          "Add a login page with a dark minimal style. Support email login and verification-code login. Do not modify unrelated files. Run tests after completion.",
        project_profile: scan.project_profile
      },
      memory
    );
    assert.equal(parsed.requirement_strand.original_request.includes("Add a login page"), true);
    assert.equal(parsed.requirement_strand.core_goal, "Add a login page with a dark minimal style");
    assert.ok(parsed.requirement_strand.features.some((item) => item.includes("login page")));
    assert.ok(parsed.requirement_strand.constraints.some((item) => item.includes("Do not modify unrelated files")));
    assert.ok(parsed.requirement_strand.preferences.some((item) => item.includes("dark minimal")));
    assert.ok(parsed.requirement_strand.acceptance_criteria.length > 0);
    assert.equal(parsed.requirement_strand.unknowns.length, 0);

    const analysis = await reverseAnalyze(
      {
        requirement_strand: parsed.requirement_strand,
        project_profile: scan.project_profile
      },
      memory
    );
    assert.ok(analysis.analysis_strand.risks.length > 0);
    assert.ok(analysis.analysis_strand.assumptions.length > 0);
    assert.ok(analysis.analysis_strand.required_modules.includes("Authentication flow"));
    assert.ok(analysis.analysis_strand.affected_files.includes("src/app/page.tsx"));

    const pairing = await pairStrands(
      {
        requirement_strand: parsed.requirement_strand,
        analysis_strand: analysis.analysis_strand
      },
      memory
    );
    assert.ok(pairing.pairing_result.pairing_score >= 70);
    assert.equal(pairing.pairing_result.ready_for_codex, true);
    assert.match(pairing.pairing_result.execution_level, /full|cautious/);

    const pack = await generateTaskPack(
      {
        requirement_strand: parsed.requirement_strand,
        analysis_strand: analysis.analysis_strand,
        pairing_result: pairing.pairing_result,
        project_profile: scan.project_profile
      },
      memory
    );
    assert.match(pack.codex_task_pack.markdown, /Codex Task Pack/);
    assert.match(pack.codex_task_pack.markdown, /Task ID:/);
    assert.match(pack.codex_task_pack.markdown, /Pairing Score/);
    assert.match(pack.codex_task_pack.markdown, /Execution Level/);
    assert.match(pack.codex_task_pack.markdown, /Project Profile Summary/);
    assert.match(pack.codex_task_pack.markdown, /Allowed Files/);
    assert.match(pack.codex_task_pack.markdown, /Forbidden Files/);
    assert.match(pack.codex_task_pack.markdown, /Implementation Plan/);
    assert.match(pack.codex_task_pack.markdown, /Rollback Plan/);
    assert.match(pack.codex_task_pack.markdown, /Required Final Response Format/);
    assert.match(pack.artifact_path ?? "", /data[\\/]+tasks/);

    const review = await reviewCodexOutput(
      {
        requirement_strand: parsed.requirement_strand,
        analysis_strand: analysis.analysis_strand,
        project_profile: scan.project_profile,
        codex_output:
          "Summary:\n- Added login page.\n\nVerification:\n- npm test passed.\n\ndiff --git a/src/app/page.tsx b/src/app/page.tsx\n"
      },
      memory
    );
    assert.match(review.review_report.markdown, /CodeDNA Review Report/);
    assert.match(review.review_report.markdown, /Review ID:/);
    assert.match(review.review_report.markdown, /Original Requirement/);
    assert.match(review.review_report.markdown, /Codex Output Summary/);
    assert.match(review.review_report.markdown, /Requirement Match/);
    assert.match(review.review_report.markdown, /Constraint Violations/);
    assert.match(review.review_report.markdown, /Unrelated File Changes/);
    assert.match(review.review_report.markdown, /Architecture Risks/);
    assert.match(review.review_report.markdown, /Security Risks/);
    assert.match(review.review_report.markdown, /Performance Risks/);
    assert.match(review.review_report.markdown, /Test Gaps/);
    assert.match(review.review_report.markdown, /Required Fixes/);
    assert.match(review.review_report.markdown, /Next Codex Repair Prompt/);
    assert.match(review.review_report.markdown, /Final Verdict/);
    assert.match(review.artifact_path ?? "", /data[\\/]+reviews/);

    const updated = await updateMemory(
      {
        memory_patch: {
          ui_style_preferences: ["dark", "minimal"],
          common_project_rules: ["Keep changes scoped."]
        },
        event: {
          type: "task_completed",
          result: "success"
        },
        successful_pattern: {
          name: "Scoped login page task",
          summary: "Login page task completed with scoped files and tests."
        }
      },
      memory
    );
    assert.ok(updated.memory.ui_style_preferences.includes("dark"));
    assert.ok(updated.memory.common_project_rules.includes("Keep changes scoped."));

    const loaded = await loadMemory(memory);
    assert.ok(loaded.successful_patterns.length >= 1);
    assert.ok(loaded.task_history.length >= 1);
  });
});

test("CodeDNA blocks direct execution when pairing score is below 70", async () => {
  await withWorkspace(async (_workspace, memory) => {
    const parsed = await parseRequirement(
      {
        request: "Fix it.",
        save: false
      },
      memory
    );
    const analysis = await reverseAnalyze(
      {
        requirement_strand: parsed.requirement_strand,
        save: false
      },
      memory
    );
    const pairing = await pairStrands(
      {
        requirement_strand: parsed.requirement_strand,
        analysis_strand: analysis.analysis_strand,
        save: false
      },
      memory
    );

    assert.equal(pairing.pairing_result.ready_for_codex, false);
    assert.equal(pairing.pairing_result.execution_level, "blocked");
    assert.ok(pairing.pairing_result.pairing_score < 70);

    const pack = await generateTaskPack(
      {
        requirement_strand: parsed.requirement_strand,
        analysis_strand: analysis.analysis_strand,
        pairing_result: pairing.pairing_result,
        save: false
      },
      memory
    );
    assert.match(pack.codex_task_pack.markdown, /Do not execute this task directly/);
    assert.match(pack.codex_task_pack.markdown, /Missing Information/);
  });
});

test("CodeDNA review detects risky Codex output and produces a repair prompt", async () => {
  await withWorkspace(async (workspace, memory) => {
    const projectPath = await createSampleProject(workspace);
    const scan = await scanProject({ project_path: projectPath }, memory);
    const parsed = await parseRequirement(
      {
        request: "Add a login page. Do not modify unrelated files. Run tests after completion.",
        project_profile: scan.project_profile,
        save: false
      },
      memory
    );
    const analysis = await reverseAnalyze(
      {
        requirement_strand: parsed.requirement_strand,
        project_profile: scan.project_profile,
        save: false
      },
      memory
    );

    const review = await reviewCodexOutput(
      {
        requirement_strand: parsed.requirement_strand,
        analysis_strand: analysis.analysis_strand,
        project_profile: scan.project_profile,
        codex_output:
          "Summary:\n- Quick fix with a hardcoded password.\n- Ignored unrelated-file constraint.\n\nFiles Changed:\n- src/app/page.tsx: login\n- package.json: unrelated refactor\n\ndiff --git a/package.json b/package.json\n"
      },
      memory
    );

    assert.match(review.review_report.verdict, /needs_fix|blocked/);
    assert.match(review.review_report.next_codex_fix_prompt, /Please revise/);
    assert.match(review.review_report.markdown, /hardcoded password|security/i);
  });
});

test("JsonStore creates directories, writes JSON, and appends arrays", async () => {
  await withWorkspace(async (workspace) => {
    const store = new JsonStore(join(workspace, "data"));
    await store.writeJson("nested/value.json", { ok: true });
    assert.deepEqual(await store.readJson("nested/value.json", { ok: false }), { ok: true });
    await store.appendJsonArray("events/history.json", { id: 1 });
    await store.appendJsonArray("events/history.json", { id: 2 });
    assert.deepEqual(await store.readJson("events/history.json", []), [{ id: 1 }, { id: 2 }]);
    const text = await readFile(join(workspace, "data", "events", "history.json"), "utf8");
    assert.match(text, /"id": 2/);
  });
});
