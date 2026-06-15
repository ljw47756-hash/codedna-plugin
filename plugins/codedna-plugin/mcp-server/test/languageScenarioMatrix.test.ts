import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { MemoryStore } from "../src/storage/memoryStore.js";
import { pairStrands } from "../src/tools/pairStrands.js";
import { parseRequirement } from "../src/tools/parseRequirement.js";
import { reverseAnalyze } from "../src/tools/reverseAnalyze.js";
import { scanProject } from "../src/tools/scanProject.js";
import type { RequirementStrand } from "../src/types/requirementStrand.js";

type Mode = "plan-only" | "review-only" | "implementation";

interface Scenario {
  name: string;
  request: string;
  mode: Mode;
  expect: {
    feature?: string;
    constraint?: string;
    preference?: string;
    acceptance?: string;
  };
  minScore?: number;
}

async function withWorkspace<T>(fn: (workspace: string, memory: MemoryStore, projectPath: string) => Promise<T>): Promise<T> {
  const workspace = await mkdtemp(join(tmpdir(), "codedna-language-matrix-"));
  const memory = new MemoryStore(join(workspace, "data"));
  await memory.ensureLayout();
  const projectPath = await createProject(workspace);
  try {
    return await fn(workspace, memory, projectPath);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

async function createProject(root: string): Promise<string> {
  const project = join(root, "matrix-project");
  await mkdir(join(project, "src", "app", "api", "login"), { recursive: true });
  await mkdir(join(project, "src", "components"), { recursive: true });
  await mkdir(join(project, "src", "checkout"), { recursive: true });
  await mkdir(join(project, "src", "settings"), { recursive: true });
  await mkdir(join(project, "docs"), { recursive: true });
  await mkdir(join(project, "tests"), { recursive: true });
  await writeFile(
    join(project, "package.json"),
    JSON.stringify(
      {
        scripts: { test: "vitest", build: "tsc", lint: "eslint ." },
        dependencies: { next: "15.0.0", react: "19.0.0" },
        devDependencies: { typescript: "5.8.3", vitest: "2.0.0", eslint: "9.0.0" }
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(join(project, "src", "components", "LoginForm.tsx"), "export function LoginForm() { return null; }\n", "utf8");
  await writeFile(join(project, "src", "app", "api", "login", "route.ts"), "export async function POST() {}\n", "utf8");
  await writeFile(join(project, "src", "checkout", "checkout.ts"), "export function checkout() {}\n", "utf8");
  await writeFile(join(project, "src", "settings", "SettingsPanel.tsx"), "export function SettingsPanel() { return null; }\n", "utf8");
  await writeFile(join(project, "tests", "login.test.ts"), "import { test } from 'vitest';\n", "utf8");
  await writeFile(join(project, "README.md"), "# Matrix Project\n", "utf8");
  return project;
}

const chineseScenarios: Scenario[] = [
  {
    name: "cn-not-a-but-b",
    request: "不是清掉配置，是换成英文文案。只修改 README.md，完成后告诉我变更摘要。",
    mode: "implementation",
    expect: { feature: "Required direction", constraint: "Do not continue rejected direction", acceptance: "告诉我" }
  },
  {
    name: "cn-phased-wait",
    request: "先生成第一批核心文件，等我说继续再生成第二批。不要一次性全部生成，最后列出第一批完成内容。",
    mode: "implementation",
    expect: { constraint: "Phased execution", acceptance: "Phase output" }
  },
  {
    name: "cn-final-check",
    request: "不要继续新增功能，只做最终检查。运行 npm test 和 npm run build，最后告诉我是否可以接受变更。",
    mode: "review-only",
    expect: { constraint: "不要继续新增功能", acceptance: "npm test", preference: "review-only" }
  },
  {
    name: "cn-privacy-doc",
    request: "完善 GitHub 主页说明，但不要公开详细能力，避免别人抄袭。只描述适合哪些任务，完成后给我总结。",
    mode: "implementation",
    expect: { feature: "主页说明", constraint: "Do not disclose", preference: "Public-facing" }
  },
  {
    name: "cn-plan-only",
    request: "请先给我方案，先不用改代码，也不要提交 GitHub。告诉我下一步该优化哪些东西。",
    mode: "plan-only",
    expect: { feature: "方案", constraint: "不用改代码", preference: "plan-only" }
  },
  {
    name: "cn-plugin-not-desktop",
    request: "停止当前方向，改成 Codex Plugin。不要生成 PySide6 或 main.py，必须包含 .codex-plugin/plugin.json，运行插件校验。",
    mode: "implementation",
    expect: { feature: "Codex Plugin", constraint: "不要生成", acceptance: "插件校验" }
  },
  {
    name: "cn-only-edit-files",
    request: "修复登录页验证码错误，只允许修改 src/components/LoginForm.tsx 和 tests/login.test.ts，必须补回归测试，完成后运行 npm test。",
    mode: "implementation",
    expect: { feature: "修复登录页验证码错误", constraint: "只允许修改", acceptance: "回归测试" }
  },
  {
    name: "cn-github-privacy",
    request: "帮我上传到 GitHub。不要上传 data/memory、.env、token 或个人路径。提交前检查 .gitignore，最后输出远端地址。",
    mode: "implementation",
    expect: { feature: "上传到 GitHub", constraint: "不要上传", acceptance: "最后输出" }
  },
  {
    name: "cn-mcp-troubleshoot",
    request: "先排查 MCP 为什么没启动，不要改业务逻辑。检查 .mcp.json 和 plugin.json，最后给我原因和下一步。",
    mode: "plan-only",
    expect: { feature: "排查 MCP", constraint: "不要改业务逻辑", acceptance: "最后给我" }
  },
  {
    name: "cn-english-only-content",
    request: "插件里面请全部用英文，不要用中文。不是删除内容，是把已有中文换成英文，完成后跑 npm test。",
    mode: "implementation",
    expect: { feature: "Required direction", constraint: "不要用中文", preference: "用英文" }
  },
  {
    name: "cn-install-guide",
    request: "一步步指导我在 Codex App 里安装插件。先不要改代码，只说明来源、Git 引用和稀疏路径。",
    mode: "plan-only",
    expect: { feature: "指导", constraint: "先不要改代码", preference: "一步步" }
  },
  {
    name: "cn-review-diff",
    request: "只审查这次 diff，不要继续开发。检查是否违反限制、是否有无关文件，最后给最终验收结论。",
    mode: "review-only",
    expect: { feature: "审查", constraint: "不要继续开发", acceptance: "最终验收结论" }
  },
  {
    name: "cn-build-dist",
    request: "修复 MCP 启动入口没有打包的问题。必须提交 mcp-server/dist/server.js，不要提交 node_modules，运行 npm run build。",
    mode: "implementation",
    expect: { feature: "修复 MCP", constraint: "不要提交 node_modules", acceptance: "npm run build" }
  },
  {
    name: "cn-cache-version",
    request: "bump plugin version，避免 Codex 继续读旧缓存。只改 plugin.json，完成后运行 release:check。",
    mode: "implementation",
    expect: { feature: "bump plugin version", constraint: "只改", acceptance: "release:check" }
  },
  {
    name: "cn-fallback-script-doc",
    request: "把兜底 PowerShell 脚本写进 README。不要说这是正常安装流程，要说明只是 MCP 不启动时使用。",
    mode: "implementation",
    expect: { feature: "README", constraint: "不要说", preference: "说明" }
  },
  {
    name: "cn-no-shrink-scope",
    request: "请不要缩减文件里的范围。逐项完成十二个部分，并在最后对照十二个部分逐项打勾。",
    mode: "implementation",
    expect: { constraint: "不要缩减", acceptance: "逐项打勾" }
  },
  {
    name: "cn-real-project-validate",
    request: "重新运行 npm test、npm run build、npm run smoke 和 plugin validator，最后告诉我全部结果。",
    mode: "review-only",
    expect: { acceptance: "npm test", feature: "重新运行" }
  },
  {
    name: "cn-memory-confirm",
    request: "记忆更新必须先 proposal 再确认，不要直接写长期记忆。完成后给我保存路径。",
    mode: "implementation",
    expect: { feature: "记忆更新", constraint: "不要直接写", acceptance: "保存路径" }
  },
  {
    name: "cn-guardrails-before-edit",
    request: "执行前必须生成 guardrails，只允许改允许列表里的文件，执行后审查 diff。",
    mode: "implementation",
    expect: { feature: "guardrails", constraint: "只允许改", acceptance: "审查 diff" }
  },
  {
    name: "cn-repair-after-failure",
    request: "如果测试失败，不要扩大范围，生成 repair task，只修复失败点并重新运行测试。",
    mode: "implementation",
    expect: { feature: "repair task", constraint: "不要扩大范围", acceptance: "重新运行测试" }
  },
  {
    name: "cn-doc-hide-details",
    request: "README 要写适合哪些任务，但不要把所有内部能力具体说出去，避免别人照着抄。",
    mode: "implementation",
    expect: { feature: "README", constraint: "不要把所有内部能力", preference: "Public-facing" }
  },
  {
    name: "cn-local-path",
    request: "检查本地路径 E:\\chat-codex\\CodeDNA，只做诊断，不要删除任何文件。",
    mode: "plan-only",
    expect: { feature: "诊断", constraint: "不要删除" }
  },
  {
    name: "cn-marketplace",
    request: "检查 marketplace.json 是否适合 GitHub 安装方式。如果 source.path 不对就修复，最后说明稀疏路径怎么填。",
    mode: "implementation",
    expect: { feature: "marketplace.json", acceptance: "稀疏路径" }
  },
  {
    name: "cn-node-version",
    request: "排查别人 MCP 不启动的问题。先确认 node -v，再检查 dist/server.js，不要改功能代码。",
    mode: "plan-only",
    expect: { feature: "排查", constraint: "不要改功能代码", acceptance: "node -v" }
  },
  {
    name: "cn-review-only-no-new",
    request: "现在进入最终交付验收阶段，不要新增第六阶段功能，只做最终检查和安装说明。",
    mode: "review-only",
    expect: { constraint: "不要新增", feature: "最终检查" }
  },
  {
    name: "cn-protect-user-data",
    request: "检查隐私数据，不要上传 API key、token、个人路径或本地 memory 文件，最后给风险结论。",
    mode: "review-only",
    expect: { constraint: "不要上传", acceptance: "风险结论" }
  },
  {
    name: "cn-smoke-workflow",
    request: "用一个真实测试需求跑完整 CodeDNA workflow，执行前生成任务包，执行后生成 review report。",
    mode: "implementation",
    expect: { feature: "workflow", acceptance: "review report" }
  },
  {
    name: "cn-continue-next-stage",
    request: "继续第二阶段开发，实现 MCP Server 核心工具完整逻辑，不要只写空函数。",
    mode: "implementation",
    expect: { feature: "第二阶段开发", constraint: "不要只写空函数" }
  },
  {
    name: "cn-no-desktop-app",
    request: "我要的是 Codex Plugin，不是桌面应用。不要生成 main.py、PySide6 或 app/ui。",
    mode: "implementation",
    expect: { feature: "Codex Plugin", constraint: "不要生成 main.py" }
  },
  {
    name: "cn-check-mcp-format",
    request: "重点检查 .mcp.json 格式，确认 codedna MCP 能被插件读取，最后告诉我是否需要手动添加。",
    mode: "review-only",
    expect: { feature: ".mcp.json", acceptance: "是否需要手动添加" }
  }
];

const englishScenarios: Scenario[] = [
  {
    name: "en-not-a-but-b",
    request: "This is not a desktop app; make it a Codex plugin. Do not create PySide files. Run the plugin validator.",
    mode: "implementation",
    expect: { feature: "Codex plugin", constraint: "Do not create", acceptance: "validator" }
  },
  {
    name: "en-plan-only",
    request: "Give me the optimization plan first. Do not edit code and do not push to GitHub.",
    mode: "plan-only",
    expect: { feature: "optimization plan", constraint: "Do not edit code", preference: "plan-only" }
  },
  {
    name: "en-review-only",
    request: "Do a final delivery check only. Do not add features. Run npm test and npm run build.",
    mode: "review-only",
    expect: { constraint: "Do not add features", acceptance: "npm test" }
  },
  {
    name: "en-privacy-doc",
    request: "Improve the README, but do not disclose detailed internal capability design. Explain suitable task types only.",
    mode: "implementation",
    expect: { feature: "README", constraint: "Do not disclose", preference: "Public-facing" }
  },
  {
    name: "en-phased",
    request: "Generate the first batch, then wait until I say continue before generating the second batch.",
    mode: "implementation",
    expect: { feature: "Generate", constraint: "Phased execution", acceptance: "Phase output" }
  },
  {
    name: "en-login-fix",
    request: "Fix the login verification-code bug. Only edit src/components/LoginForm.tsx and tests/login.test.ts. Run npm test.",
    mode: "implementation",
    expect: { feature: "Fix the login", constraint: "Only edit", acceptance: "npm test" }
  },
  {
    name: "en-github-upload",
    request: "Prepare the repository for GitHub. Do not upload node_modules, .env, tokens, runtime data, or personal paths.",
    mode: "implementation",
    expect: { feature: "GitHub", constraint: "Do not upload" }
  },
  {
    name: "en-mcp-startup",
    request: "Diagnose why the MCP server is not starting. Do not change business logic. Check .mcp.json and dist/server.js.",
    mode: "plan-only",
    expect: { feature: "Diagnose", constraint: "Do not change business logic" }
  },
  {
    name: "en-version-bump",
    request: "Bump the plugin version so Codex does not use the old cache. Only edit plugin.json and run release:check.",
    mode: "implementation",
    expect: { feature: "Bump", constraint: "Only edit", acceptance: "release:check" }
  },
  {
    name: "en-fallback-doc",
    request: "Document the PowerShell fallback script in README. Make clear it is only for MCP startup fallback.",
    mode: "implementation",
    expect: { feature: "README", preference: "fallback" }
  },
  {
    name: "en-no-scope-reduction",
    request: "Do not reduce the requested scope. Complete all twelve sections and check them off at the end.",
    mode: "implementation",
    expect: { constraint: "Do not reduce", acceptance: "check them off" }
  },
  {
    name: "en-memory-proposal",
    request: "Memory updates must be proposal first and confirmation second. Do not write long-term memory directly.",
    mode: "implementation",
    expect: { feature: "Memory updates", constraint: "Do not write" }
  },
  {
    name: "en-guardrails",
    request: "Generate guardrails before editing. Only touch allowed files and review the diff after execution.",
    mode: "implementation",
    expect: { feature: "guardrails", constraint: "Only touch", acceptance: "review the diff" }
  },
  {
    name: "en-repair-task",
    request: "If tests fail, do not broaden the scope. Generate a repair task and rerun the focused tests.",
    mode: "implementation",
    expect: { feature: "repair task", constraint: "do not broaden", acceptance: "rerun" }
  },
  {
    name: "en-marketplace",
    request: "Check marketplace.json for GitHub installation. Fix source.path if needed and explain the sparse path.",
    mode: "implementation",
    expect: { feature: "marketplace.json", acceptance: "sparse path" }
  },
  {
    name: "en-node-check",
    request: "Troubleshoot a user whose MCP does not start. First check node -v, then check dist/server.js. Do not edit feature code.",
    mode: "plan-only",
    expect: { feature: "Troubleshoot", constraint: "Do not edit feature code", acceptance: "node -v" }
  },
  {
    name: "en-final-install-guide",
    request: "Guide me step by step through installing the plugin in Codex App. Do not change code.",
    mode: "plan-only",
    expect: { feature: "Guide", constraint: "Do not change code" }
  },
  {
    name: "en-review-diff",
    request: "Review this diff only. Do not continue development. Check unrelated files and constraint violations.",
    mode: "review-only",
    expect: { feature: "Review", constraint: "Do not continue development" }
  },
  {
    name: "en-build-dist",
    request: "Include the built MCP server entrypoint. Commit mcp-server/dist/server.js but do not commit node_modules.",
    mode: "implementation",
    expect: { feature: "MCP server", constraint: "do not commit node_modules" }
  },
  {
    name: "en-api-route",
    request: "Add an API route for login status. Only touch src/app/api/login/route.ts and add focused tests.",
    mode: "implementation",
    expect: { feature: "API route", constraint: "Only touch", acceptance: "tests" }
  },
  {
    name: "en-settings-ui",
    request: "Create a settings panel toggle. Keep the existing style and run npm run build.",
    mode: "implementation",
    expect: { feature: "settings panel", preference: "existing style", acceptance: "npm run build" }
  },
  {
    name: "en-doc-only",
    request: "Update docs only. Do not modify source code. Summarize the changed documentation sections.",
    mode: "implementation",
    expect: { feature: "docs", constraint: "Do not modify source code", acceptance: "Summarize" }
  },
  {
    name: "en-security-review",
    request: "Perform a security review for hardcoded secrets. Do not change files; report risks and next steps.",
    mode: "plan-only",
    expect: { feature: "security review", constraint: "Do not change files", acceptance: "risks" }
  },
  {
    name: "en-real-project-validation",
    request: "Run npm test, npm run build, npm run smoke, and plugin validator. Report each result clearly.",
    mode: "review-only",
    expect: { acceptance: "npm test", feature: "Run" }
  },
  {
    name: "en-task-pack",
    request: "Generate a Codex task pack before implementation and a review report after the output.",
    mode: "implementation",
    expect: { feature: "task pack", acceptance: "review report" }
  },
  {
    name: "en-cli-helper",
    request: "Add a focused CLI helper. Keep changes scoped and run tests after completion.",
    mode: "implementation",
    expect: { feature: "CLI helper", constraint: "Keep changes scoped", acceptance: "run tests" }
  },
  {
    name: "en-package-protect",
    request: "Do not modify package.json unless a dependency change is required. Explain any dependency change.",
    mode: "implementation",
    expect: { constraint: "Do not modify package.json", acceptance: "Explain" }
  },
  {
    name: "en-project-scan",
    request: "Scan the project structure and generate a Project Genome. Do not edit files during the scan.",
    mode: "plan-only",
    expect: { feature: "Project Genome", constraint: "Do not edit files" }
  },
  {
    name: "en-output-format",
    request: "After finishing, output changed files, verification evidence, risks, and whether the task is ready to accept.",
    mode: "implementation",
    expect: { acceptance: "changed files", feature: "output" }
  },
  {
    name: "en-cache-install",
    request: "If Codex keeps using the old cache, bump the version and tell the user to reinstall from main.",
    mode: "implementation",
    expect: { feature: "bump the version", acceptance: "reinstall" }
  }
];

const mixedScenarios: Scenario[] = [
  {
    name: "mix-plugin-json",
    request: "必须创建 .codex-plugin/plugin.json，do not generate PySide6，最后 run plugin validator。",
    mode: "implementation",
    expect: { feature: ".codex-plugin/plugin.json", constraint: "do not generate", acceptance: "plugin validator" }
  },
  {
    name: "mix-not-a-but-b",
    request: "不是 local desktop app，是 Codex Plugin。Keep MCP server, remove desktop UI direction, run npm test。",
    mode: "implementation",
    expect: { feature: "Required direction", constraint: "Do not continue rejected direction", acceptance: "npm test" }
  },
  {
    name: "mix-plan-only",
    request: "先给 optimization plan, do not edit files, 不要 push GitHub。",
    mode: "plan-only",
    expect: { feature: "optimization plan", constraint: "do not edit files", preference: "plan-only" }
  },
  {
    name: "mix-final-check",
    request: "不要继续新增功能，only final delivery check，run npm test and npm run build。",
    mode: "review-only",
    expect: { constraint: "不要继续新增功能", acceptance: "npm test", preference: "review-only" }
  },
  {
    name: "mix-privacy",
    request: "Update README in Chinese, but 不要公开 detailed internal capability, 避免别人抄袭。",
    mode: "implementation",
    expect: { feature: "README", constraint: "Do not disclose", preference: "Public-facing" }
  },
  {
    name: "mix-phased",
    request: "先 build phase one, 等我说 continue 再做 phase two, do not finish all batches at once。",
    mode: "implementation",
    expect: { feature: "build phase one", constraint: "Phased execution", acceptance: "Phase output" }
  },
  {
    name: "mix-login",
    request: "修复 login verification-code bug，只允许修改 LoginForm.tsx and tests/login.test.ts，run npm test。",
    mode: "implementation",
    expect: { feature: "login verification-code", constraint: "只允许修改", acceptance: "npm test" }
  },
  {
    name: "mix-github",
    request: "Upload to GitHub，但不要上传 .env、token、data/memory or personal paths。",
    mode: "implementation",
    expect: { feature: "GitHub", constraint: "不要上传" }
  },
  {
    name: "mix-mcp-diagnose",
    request: "Diagnose MCP startup，先 check node -v，再 check dist/server.js，不要改业务逻辑。",
    mode: "plan-only",
    expect: { feature: "Diagnose MCP", constraint: "不要改业务逻辑", acceptance: "node -v" }
  },
  {
    name: "mix-english-only",
    request: "插件内容 must be English，不要用中文，replace Chinese docs with English and run release:check。",
    mode: "implementation",
    expect: { feature: "replace Chinese docs", constraint: "不要用中文", acceptance: "release:check" }
  },
  {
    name: "mix-install-guide",
    request: "一步步 guide Codex App install，do not change code，只说明 source, Git ref, sparse path。",
    mode: "plan-only",
    expect: { feature: "guide", constraint: "do not change code", preference: "一步步" }
  },
  {
    name: "mix-review-diff",
    request: "Review this diff only，不要继续开发，check unrelated files and constraint violations。",
    mode: "review-only",
    expect: { feature: "Review", constraint: "不要继续开发" }
  },
  {
    name: "mix-dist",
    request: "Include mcp-server/dist/server.js，不要提交 node_modules，then npm run build。",
    mode: "implementation",
    expect: { feature: "dist/server.js", constraint: "不要提交 node_modules", acceptance: "npm run build" }
  },
  {
    name: "mix-version",
    request: "bump plugin version 避免旧缓存，只改 plugin.json and run release:check。",
    mode: "implementation",
    expect: { feature: "bump plugin version", constraint: "只改", acceptance: "release:check" }
  },
  {
    name: "mix-fallback-doc",
    request: "Document fallback PowerShell script，但说明 this is not normal install flow。",
    mode: "implementation",
    expect: { feature: "fallback PowerShell", constraint: "not normal install" }
  },
  {
    name: "mix-scope",
    request: "不要缩减 scope，complete all sections and check them off at the end。",
    mode: "implementation",
    expect: { constraint: "不要缩减", acceptance: "check them off" }
  },
  {
    name: "mix-memory",
    request: "Memory update must be proposal then confirmation，不要直接写 long-term memory。",
    mode: "implementation",
    expect: { feature: "Memory update", constraint: "不要直接写" }
  },
  {
    name: "mix-guardrails",
    request: "Before editing 必须 generate guardrails，only touch allowed files，after execution review diff。",
    mode: "implementation",
    expect: { feature: "guardrails", constraint: "only touch", acceptance: "review diff" }
  },
  {
    name: "mix-repair",
    request: "If tests fail，不要扩大范围，generate repair task and rerun focused tests。",
    mode: "implementation",
    expect: { feature: "repair task", constraint: "不要扩大范围", acceptance: "rerun" }
  },
  {
    name: "mix-doc-hide",
    request: "README should explain suitable tasks，但不要把 internal workflow 全部说出去。",
    mode: "implementation",
    expect: { feature: "README", constraint: "不要把 internal workflow", preference: "Public-facing" }
  },
  {
    name: "mix-local-path",
    request: "Check E:\\chat-codex\\CodeDNA，只做 diagnosis，do not delete files。",
    mode: "plan-only",
    expect: { feature: "diagnosis", constraint: "do not delete" }
  },
  {
    name: "mix-marketplace",
    request: "检查 marketplace.json source.path, fix if wrong, explain sparse path in Chinese。",
    mode: "implementation",
    expect: { feature: "marketplace.json", acceptance: "sparse path" }
  },
  {
    name: "mix-protect-data",
    request: "Check privacy data，不要 upload API key/token/local memory，report risk conclusion。",
    mode: "review-only",
    expect: { constraint: "不要 upload", acceptance: "risk conclusion" }
  },
  {
    name: "mix-workflow",
    request: "Run full CodeDNA workflow，生成 task pack before edit，review report after output。",
    mode: "implementation",
    expect: { feature: "workflow", acceptance: "review report" }
  },
  {
    name: "mix-stage-two",
    request: "继续 phase two development，实现 MCP tools，不要写 empty stub functions。",
    mode: "implementation",
    expect: { feature: "MCP tools", constraint: "不要写 empty stub" }
  },
  {
    name: "mix-no-desktop",
    request: "This is Codex Plugin，不是桌面应用，不要生成 main.py or app/ui。",
    mode: "implementation",
    expect: { feature: "Codex Plugin", constraint: "不要生成 main.py" }
  },
  {
    name: "mix-mcp-format",
    request: "Check .mcp.json format，confirm plugin can read codedna MCP，最后 tell me if manual add is required。",
    mode: "review-only",
    expect: { feature: ".mcp.json", acceptance: "manual add" }
  },
  {
    name: "mix-api",
    request: "Add login status API，只修改 src/app/api/login/route.ts, add focused tests。",
    mode: "implementation",
    expect: { feature: "login status API", constraint: "只修改", acceptance: "tests" }
  },
  {
    name: "mix-settings-ui",
    request: "Create settings toggle，保持 existing style，run npm run build。",
    mode: "implementation",
    expect: { feature: "settings toggle", preference: "existing style", acceptance: "npm run build" }
  },
  {
    name: "mix-security",
    request: "Security review for hardcoded secrets，只报告 risks，不要改 files。",
    mode: "plan-only",
    expect: { feature: "Security review", constraint: "不要改 files", acceptance: "risks" }
  }
];

test("Chinese, English, and mixed language scenario matrix stays parseable and pairable", async () => {
  await withWorkspace(async (_workspace, memory, projectPath) => {
    const profile = (await scanProject({ project_path: projectPath }, memory)).project_profile;
    const groups = [
      { label: "Chinese", scenarios: chineseScenarios },
      { label: "English", scenarios: englishScenarios },
      { label: "Mixed", scenarios: mixedScenarios }
    ];

    for (const group of groups) {
      assert.equal(group.scenarios.length, 30, `${group.label} scenarios must contain exactly 30 cases.`);
      for (const scenario of group.scenarios) {
        const parsed = await parseRequirement({ request: scenario.request, project_profile: profile, save: false }, memory);
        assertScenarioParsed(scenario, parsed.requirement_strand);

        const analysis = await reverseAnalyze({ requirement_strand: parsed.requirement_strand, project_profile: profile, save: false }, memory);
        const pairing = await pairStrands(
          {
            requirement_strand: parsed.requirement_strand,
            analysis_strand: analysis.analysis_strand,
            save: false
          },
          memory
        );

        assert.ok(
          pairing.pairing_result.pairing_score >= (scenario.minScore ?? 70),
          `${group.label}/${scenario.name} pairing score ${pairing.pairing_result.pairing_score} was below threshold.`
        );
        assert.notEqual(pairing.pairing_result.execution_level, "blocked", `${group.label}/${scenario.name} should not be blocked.`);
      }
    }
  });
});

function assertScenarioParsed(scenario: Scenario, requirement: RequirementStrand): void {
  assert.ok(requirement.core_goal.length > 0, `${scenario.name} should have a core goal.`);
  assert.ok(
    requirement.preferences.some((item) => item.includes(`Task mode: ${scenario.mode}`)),
    `${scenario.name} should detect task mode ${scenario.mode}.`
  );
  if (scenario.expect.feature) {
    assertContains(requirement.features, scenario.expect.feature, `${scenario.name} feature`);
  }
  if (scenario.expect.constraint) {
    assertContains(requirement.constraints, scenario.expect.constraint, `${scenario.name} constraint`);
  }
  if (scenario.expect.preference) {
    assertContains(requirement.preferences, scenario.expect.preference, `${scenario.name} preference`);
  }
  if (scenario.expect.acceptance) {
    assertContains(requirement.acceptance_criteria, scenario.expect.acceptance, `${scenario.name} acceptance`);
  }
}

function assertContains(items: string[], expected: string, label: string): void {
  const normalizedExpected = expected.toLocaleLowerCase();
  assert.ok(
    items.some((item) => item.toLocaleLowerCase().includes(normalizedExpected)),
    `${label} should contain "${expected}" in ${JSON.stringify(items, null, 2)}`
  );
}
