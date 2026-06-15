import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { MemoryStore } from "../src/storage/memoryStore.js";
import { parseRequirement } from "../src/tools/parseRequirement.js";
import { pairStrands } from "../src/tools/pairStrands.js";
import { reverseAnalyze } from "../src/tools/reverseAnalyze.js";
import { scanProject } from "../src/tools/scanProject.js";

async function withWorkspace<T>(fn: (workspace: string, memory: MemoryStore) => Promise<T>): Promise<T> {
  const workspace = await mkdtemp(join(tmpdir(), "codedna-chinese-"));
  const memory = new MemoryStore(join(workspace, "data"));
  await memory.ensureLayout();
  try {
    return await fn(workspace, memory);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

async function createChineseFixtureProject(root: string): Promise<string> {
  const project = join(root, "cn-project");
  await mkdir(join(project, "src", "components"), { recursive: true });
  await mkdir(join(project, "tests"), { recursive: true });
  await writeFile(
    join(project, "package.json"),
    JSON.stringify(
      {
        scripts: { test: "vitest", build: "tsc" },
        dependencies: { react: "19.0.0" },
        devDependencies: { typescript: "5.8.3", vitest: "2.0.0" }
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(join(project, "src", "components", "LoginForm.tsx"), "export function LoginForm() { return null; }\n", "utf8");
  await writeFile(join(project, "tests", "login.test.ts"), "import { test } from 'vitest';\n", "utf8");
  return project;
}

test("Chinese requirement parsing extracts constraints, acceptance criteria, and verification commands", async () => {
  await withWorkspace(async (workspace, memory) => {
    const project = await createChineseFixtureProject(workspace);
    const profile = (await scanProject({ project_path: project }, memory)).project_profile;
    const parsed = await parseRequirement(
      {
        request:
          "现在不要继续新增功能了。第五阶段已经完成，接下来进入最终交付验收阶段。请只做最终检查，不要大改代码，除非发现明确 bug。重新运行 npm test 和 npm run build。最后告诉我是否可以接受变更。",
        project_profile: profile,
        save: false
      },
      memory
    );

    assert.match(parsed.requirement_strand.core_goal, /最终交付验收|最终检查/);
    assert.ok(parsed.requirement_strand.constraints.some((item) => item.includes("不要继续新增功能")));
    assert.ok(parsed.requirement_strand.constraints.some((item) => item.includes("不要大改代码")));
    assert.ok(parsed.requirement_strand.constraints.some((item) => item.includes("只做最终检查")));
    assert.ok(parsed.requirement_strand.acceptance_criteria.some((item) => item.includes("npm test")));
    assert.ok(parsed.requirement_strand.acceptance_criteria.some((item) => item.includes("npm run build")));
    assert.ok(parsed.requirement_strand.acceptance_criteria.some((item) => item.includes("最后告诉我")));
    assert.ok(!parsed.requirement_strand.unknowns.some((item) => item.includes("Preferred verification command")));
  });
});

test("Chinese correction and wait instructions are captured as actionable scope", async () => {
  await withWorkspace(async (_workspace, memory) => {
    const parsed = await parseRequirement(
      {
        request:
          "不是清掉，是换成英文。插件里面请全部用英文不要用中文。生成完第一批后，等待我说“继续”，再生成下一批。",
        save: false
      },
      memory
    );

    assert.ok(parsed.requirement_strand.features.some((item) => item.includes("换成英文")));
    assert.ok(parsed.requirement_strand.constraints.some((item) => item.includes("不要用中文")));
    assert.ok(parsed.requirement_strand.constraints.some((item) => item.includes("等待我说")));
    assert.ok(parsed.requirement_strand.preferences.some((item) => item.includes("用英文")));
  });
});

test("Chinese plan-only requests avoid implementation unknown noise", async () => {
  await withWorkspace(async (_workspace, memory) => {
    const parsed = await parseRequirement(
      {
        request: "请先给我方案，先不用改代码，也不要提交 GitHub。告诉我下一步该优化哪些东西。",
        save: false
      },
      memory
    );

    assert.ok(parsed.requirement_strand.features.some((item) => item.includes("给我方案")));
    assert.ok(parsed.requirement_strand.constraints.some((item) => item.includes("不用改代码")));
    assert.ok(parsed.requirement_strand.constraints.some((item) => item.includes("不要提交 GitHub")));
    assert.ok(!parsed.requirement_strand.unknowns.some((item) => item.includes("Exact files or modules")));
  });
});

test("Chinese feature, constraint, and acceptance pairs remain ready with project context", async () => {
  await withWorkspace(async (workspace, memory) => {
    const project = await createChineseFixtureProject(workspace);
    const profile = (await scanProject({ project_path: project }, memory)).project_profile;
    const parsed = await parseRequirement(
      {
        request:
          "修复登录页验证码错误，只允许修改 src/components/LoginForm.tsx 和 tests/login.test.ts，必须补回归测试，完成后运行 npm test。不要改 package.json。",
        project_profile: profile,
        save: false
      },
      memory
    );
    const analysis = await reverseAnalyze({ requirement_strand: parsed.requirement_strand, project_profile: profile, save: false }, memory);
    const pairing = await pairStrands(
      {
        requirement_strand: parsed.requirement_strand,
        analysis_strand: analysis.analysis_strand,
        save: false
      },
      memory
    );

    assert.ok(parsed.requirement_strand.features.some((item) => item.includes("修复登录页验证码错误")));
    assert.ok(parsed.requirement_strand.constraints.some((item) => item.includes("只允许修改")));
    assert.ok(parsed.requirement_strand.constraints.some((item) => item.includes("不要改 package.json")));
    assert.ok(parsed.requirement_strand.acceptance_criteria.some((item) => item.includes("回归测试")));
    assert.ok(parsed.requirement_strand.acceptance_criteria.some((item) => item.includes("npm test")));
    assert.equal(pairing.pairing_result.ready_for_codex, true);
    assert.ok(pairing.pairing_result.pairing_score >= 70);
  });
});
