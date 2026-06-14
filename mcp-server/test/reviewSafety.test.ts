import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import assert from "node:assert/strict";
import { MemoryStore } from "../src/storage/memoryStore.js";
import { parseRequirement } from "../src/tools/parseRequirement.js";
import { reverseAnalyze } from "../src/tools/reverseAnalyze.js";
import { reviewCodexOutput } from "../src/tools/reviewCodexOutput.js";
import { scanProject } from "../src/tools/scanProject.js";

async function withWorkspace<T>(fn: (workspace: string, memory: MemoryStore) => Promise<T>): Promise<T> {
  const workspace = await mkdtemp(join(tmpdir(), "codedna-review-safety-"));
  const memory = new MemoryStore(join(workspace, "data"));
  await memory.ensureLayout();
  try {
    return await fn(workspace, memory);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

async function project(root: string): Promise<string> {
  const dir = join(root, "review-project");
  await mkdir(join(dir, "src", "auth"), { recursive: true });
  await writeFile(
    join(dir, "package.json"),
    JSON.stringify({ dependencies: { react: "19.0.0" }, devDependencies: { vitest: "2.0.0" } }, null, 2),
    "utf8"
  );
  await writeFile(join(dir, ".env"), "SECRET=keep-local\n", "utf8");
  await writeFile(join(dir, "src", "auth", "LoginForm.tsx"), "export function LoginForm() { return null; }\n", "utf8");
  return dir;
}

test("review blocks high-risk output touching forbidden files, secrets, deletes, and dangerous commands", async () => {
  await withWorkspace(async (workspace, memory) => {
    const fakeOpenAiKey = "sk-" + "test1234567890abcdef";
    const profile = (await scanProject({ project_path: await project(workspace) }, memory)).project_profile;
    const requirement = (await parseRequirement(
      {
        request: "Add login validation. Only modify src/auth/LoginForm.tsx. Do not modify secrets. Run tests.",
        project_profile: profile,
        save: false
      },
      memory
    )).requirement_strand;
    const analysis = (await reverseAnalyze({ requirement_strand: requirement, project_profile: profile, save: false }, memory)).analysis_strand;
    const review = await reviewCodexOutput(
      {
        requirement_strand: requirement,
        analysis_strand: analysis,
        project_profile: profile,
        save: false,
        codex_output: [
          "Summary:",
          "- Added unrelated broad refactor and no assumptions.",
          `- Added OPENAI_API_KEY=${fakeOpenAiKey}.`,
          "- Added shell: true and rm -rf / command.",
          "deleted: src/auth/LoginForm.tsx",
          "diff --git a/.env b/.env",
          "diff --git a/package.json b/package.json"
        ].join("\n")
      },
      memory
    );

    assert.equal(review.review_report.verdict, "blocked");
    assert.match(review.review_report.markdown, /Forbidden File Changes/);
    assert.match(review.review_report.markdown, /Plaintext API Key/);
    assert.match(review.review_report.markdown, /Dangerous Command/);
    assert.match(review.review_report.markdown, /Deleted Important Files/);
  });
});

test("review can pass with warnings when only non-blocking concerns are present", async () => {
  await withWorkspace(async (workspace, memory) => {
    const profile = (await scanProject({ project_path: await project(workspace) }, memory)).project_profile;
    const requirement = (await parseRequirement(
      {
        request: "Add login validation. Only modify src/auth/LoginForm.tsx. Run tests.",
        project_profile: profile,
        save: false
      },
      memory
    )).requirement_strand;
    const analysis = (await reverseAnalyze({ requirement_strand: requirement, project_profile: profile, save: false }, memory)).analysis_strand;
    const review = await reviewCodexOutput(
      {
        requirement_strand: requirement,
        analysis_strand: analysis,
        project_profile: profile,
        save: false,
        codex_output: [
          "Summary:",
          "- Added login validation.",
          "Files Changed:",
          "- src/auth/LoginForm.tsx: validation",
          "diff --git a/src/auth/LoginForm.tsx b/src/auth/LoginForm.tsx"
        ].join("\n")
      },
      memory
    );

    assert.equal(review.review_report.verdict, "pass_with_warnings");
    assert.match(review.review_report.markdown, /Test Gaps/);
  });
});
