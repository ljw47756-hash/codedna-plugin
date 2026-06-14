import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import { MemoryStore } from "../src/storage/memoryStore.js";
import { generateTaskPack } from "../src/tools/generateTaskPack.js";
import { pairStrands } from "../src/tools/pairStrands.js";
import { parseRequirement } from "../src/tools/parseRequirement.js";
import { reviewCodexOutput } from "../src/tools/reviewCodexOutput.js";
import { reverseAnalyze } from "../src/tools/reverseAnalyze.js";
import { scanProject } from "../src/tools/scanProject.js";
import { updateMemory } from "../src/tools/updateMemory.js";

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

async function withMemory<T>(fn: (workspace: string, memory: MemoryStore) => Promise<T>): Promise<T> {
  const workspace = await mkdtemp(join(tmpdir(), "codedna-fixtures-"));
  const memory = new MemoryStore(join(workspace, "data"));
  await memory.ensureLayout();
  try {
    return await fn(workspace, memory);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

async function fixture(name: string): Promise<string> {
  return readFile(join(fixtureDir, name), "utf8");
}

async function sampleProject(root: string): Promise<string> {
  const project = join(root, "fixture-project");
  await mkdir(join(project, "src", "auth"), { recursive: true });
  await mkdir(join(project, "src", "checkout"), { recursive: true });
  await mkdir(join(project, "src", "scanner"), { recursive: true });
  await mkdir(join(project, "tests"), { recursive: true });
  await writeFile(
    join(project, "package.json"),
    JSON.stringify(
      {
        scripts: { test: "vitest", build: "tsc" },
        dependencies: { next: "15.0.0", react: "19.0.0" },
        devDependencies: { typescript: "5.8.3", vitest: "2.0.0" }
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(join(project, "src", "auth", "LoginForm.tsx"), "export function LoginForm() { return null; }\n", "utf8");
  await writeFile(join(project, "src", "checkout", "checkout.ts"), "export function checkout() {}\n", "utf8");
  await writeFile(join(project, "src", "scanner", "scanProject.ts"), "export function scanProject() {}\n", "utf8");
  await writeFile(join(project, "tests", "fixture.test.ts"), "import { test } from 'vitest';\n", "utf8");
  return project;
}

test("fixtures cover login, bug fix, refactor, and specified-file scenarios with project scan", async () => {
  await withMemory(async (workspace, memory) => {
    const project = await sampleProject(workspace);
    const profile = (await scanProject({ project_path: project }, memory)).project_profile;
    const cases = [
      { file: "login-page.md", expected: /login|Authentication flow/i },
      { file: "bug-fix.md", expected: /checkout|regression|constraint/i },
      { file: "refactor.md", expected: /refactor|behavior|rollback/i },
      { file: "specified-file-only.md", expected: /Only modify|LoginForm/i }
    ];

    for (const item of cases) {
      const parsed = await parseRequirement({ request: await fixture(item.file), project_profile: profile, save: false }, memory);
      const analysis = await reverseAnalyze({ requirement_strand: parsed.requirement_strand, project_profile: profile, save: false }, memory);
      const pairing = await pairStrands({ requirement_strand: parsed.requirement_strand, analysis_strand: analysis.analysis_strand, save: false }, memory);
      const pack = await generateTaskPack(
        {
          requirement_strand: parsed.requirement_strand,
          analysis_strand: analysis.analysis_strand,
          pairing_result: pairing.pairing_result,
          project_profile: profile,
          save: false
        },
        memory
      );
      assert.equal(pairing.pairing_result.ready_for_codex, true);
      assert.match(pack.codex_task_pack.markdown, item.expected);
    }
  });
});

test("fixtures cover vague request, no scan, bad output review, and memory update", async () => {
  await withMemory(async (_workspace, memory) => {
    const vague = await parseRequirement({ request: await fixture("vague-request.md"), save: false }, memory);
    assert.ok(vague.requirement_strand.unknowns.length >= 3);
    const vagueAnalysis = await reverseAnalyze({ requirement_strand: vague.requirement_strand, save: false }, memory);
    const vaguePairing = await pairStrands(
      {
        requirement_strand: vague.requirement_strand,
        analysis_strand: vagueAnalysis.analysis_strand,
        save: false
      },
      memory
    );
    assert.equal(vaguePairing.pairing_result.execution_level, "blocked");

    const noScan = await parseRequirement({ request: await fixture("bug-fix.md"), save: false }, memory);
    assert.ok(noScan.requirement_strand.unknowns.some((item) => item.includes("Target project directory")));

    const analysis = await reverseAnalyze({ requirement_strand: noScan.requirement_strand, save: false }, memory);
    const review = await reviewCodexOutput(
      {
        requirement_strand: noScan.requirement_strand,
        analysis_strand: analysis.analysis_strand,
        codex_output: await fixture("bad-codex-output.md"),
        save: false
      },
      memory
    );
    assert.match(review.review_report.verdict, /needs_fix|blocked/);
    assert.match(review.review_report.markdown, /Security Risks/);

    const patch = JSON.parse(await fixture("memory-update.json"));
    const updated = await updateMemory(patch, memory);
    assert.ok(updated.memory.ui_style_preferences.includes("dark"));
    assert.ok(updated.memory.code_preferences.includes("keep changes scoped"));
  });
});
