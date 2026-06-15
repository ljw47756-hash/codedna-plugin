import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tokens, uniqueStrings } from "../tools/common.js";
const CASE_LIMIT = 4;
let cachedLibrary;
export async function loadCaseLibrary() {
    cachedLibrary ??= readLibrary();
    return cachedLibrary;
}
export function clearCaseLibraryCache() {
    cachedLibrary = undefined;
}
export function inferEffectFamilies(text) {
    const normalized = text.toLocaleLowerCase();
    const familySignals = [
        {
            family: "planning-and-mode-boundaries",
            hints: ["plan-only", "review-only", "implementation", "phase", "continue", "wait", "先做", "继续", "等我说", "不要继续", "最终检查", "文档收口"]
        },
        {
            family: "guardrails-and-risk-control",
            hints: ["guardrail", "risk", "constraint", "scope", "do not", "avoid", "forbid", "不要", "禁止", "只能", "范围", "约束", "公开", "抄袭", "泄露"]
        },
        {
            family: "documentation-and-operational-clarity",
            hints: ["readme", "docs", "documentation", "homepage", "install", "guide", "文档", "说明", "安装", "主页", "调用规则"]
        },
        {
            family: "plugin-installation-diagnostics",
            hints: ["plugin", "marketplace", "mcp", "install", "cache", "插件", "市场", "安装", "启动", "缓存"]
        },
        {
            family: "mcp-diagnostics",
            hints: ["mcp", "server", "tool", "stdio", "工具", "服务器", "启动失败", "没有启动"]
        },
        {
            family: "task-decomposition-not-runtime-agents",
            hints: ["module", "step", "task pack", "decompose", "模块", "步骤", "任务包", "拆分", "双链"]
        },
        {
            family: "review-diff-and-repair",
            hints: ["review", "diff", "repair", "fix", "审查", "反向审查", "修复", "补测试", "失败后"]
        },
        {
            family: "memory-and-session-continuity",
            hints: ["memory", "remember", "evolution", "history", "记忆", "沉淀", "进化", "历史", "偏好"]
        },
        {
            family: "project-context-and-diagnostics",
            hints: ["project", "scan", "genome", "context", "项目", "扫描", "上下文", "基因组"]
        },
        {
            family: "configuration-and-health-reports",
            hints: ["config", "health", "validate", "release", "配置", "健康", "校验", "验收", "发布"]
        },
        {
            family: "skill-routing-and-health",
            hints: ["skill", "skills", "routing", "技能", "路由", "触发"]
        },
        {
            family: "clear-user-feedback",
            hints: ["feedback", "explain", "summary", "用户反馈", "总结", "说明", "别缩减", "不要偷懒"]
        },
        {
            family: "task-lifecycle-and-case-records",
            hints: ["case", "record", "success", "failure", "案例", "成功", "失败", "记录"]
        },
        {
            family: "git-and-pr-awareness",
            hints: ["git", "github", "pr", "commit", "push", "仓库", "提交", "上传"]
        }
    ];
    return familySignals
        .filter((signal) => signal.hints.some((hint) => normalized.includes(hint.toLocaleLowerCase()) || text.includes(hint)))
        .map((signal) => signal.family);
}
export function recallCases(library, query, families, limit = CASE_LIMIT) {
    const queryTokens = [...tokens(query)];
    const scored = library.cases
        .map((entry) => ({ entry, score: scoreEntry(entry, query, queryTokens, families) }))
        .filter((item) => item.score > 0)
        .sort((left, right) => right.score - left.score || left.entry.id.localeCompare(right.entry.id));
    const successPatterns = takeCases(scored.filter((item) => isSuccessCase(item.entry)), limit);
    const failurePatterns = takeCases(scored.filter((item) => isFailureCase(item.entry)), limit);
    const publicPatterns = takeCases(scored.filter((item) => !String(item.entry.category).startsWith("retained-")), limit);
    return {
        query_terms: uniqueStrings([...families, ...queryTokens.slice(0, 14)]),
        success_patterns: successPatterns.length ? successPatterns : fallbackCases(library, families, "success", limit),
        failure_patterns: failurePatterns.length ? failurePatterns : fallbackCases(library, families, "failure", limit),
        public_patterns: publicPatterns
    };
}
function takeCases(scored, limit) {
    return scored.slice(0, limit).map(({ entry, score }) => ({
        id: entry.id,
        category: entry.category,
        outcome: entry.outcome ?? (isFailureCase(entry) ? "failure-pattern" : isSuccessCase(entry) ? "success-pattern" : "reference-pattern"),
        effect_family: entry.effect_family,
        score: roundScore(score),
        summary: entry.summary,
        codedna_pattern: entry.codedna_pattern,
        guardrail: entry.guardrail,
        tags: entry.tags
    }));
}
function fallbackCases(library, families, outcome, limit) {
    const predicate = outcome === "success" ? isSuccessCase : isFailureCase;
    const entries = library.cases
        .filter(predicate)
        .filter((entry) => !families.length || families.includes(entry.effect_family ?? ""))
        .slice(0, limit);
    return takeCases(entries.map((entry) => ({ entry, score: 0.2 })), limit);
}
function scoreEntry(entry, query, queryTokens, families) {
    let score = 0;
    const entryText = `${entry.effect_family ?? ""} ${entry.summary} ${entry.codedna_pattern} ${entry.guardrail} ${entry.tags.join(" ")}`.toLocaleLowerCase();
    for (const token of queryTokens) {
        if (entryText.includes(token.toLocaleLowerCase())) {
            score += token.length > 2 ? 0.35 : 0.15;
        }
    }
    if (entry.effect_family && families.includes(entry.effect_family)) {
        score += 3;
    }
    for (const family of families) {
        if (entryText.includes(family)) {
            score += 0.75;
        }
    }
    if (/不要|禁止|避免|do not|avoid|forbid|risk|guardrail/i.test(query) && isFailureCase(entry)) {
        score += 0.8;
    }
    if (/成功|ready|pass|accepted|stable/i.test(query) && isSuccessCase(entry)) {
        score += 0.5;
    }
    return score;
}
function isSuccessCase(entry) {
    return entry.category.includes("success") || entry.outcome === "success-pattern";
}
function isFailureCase(entry) {
    return entry.category.includes("failure") || entry.outcome === "failure-pattern";
}
async function readLibrary() {
    const root = await findCaseLibraryRoot();
    const warnings = [];
    if (!root) {
        return { root: "", effects: [], cases: [], warnings: ["CodeDNA case-library directory was not found."] };
    }
    const effects = await readJsonlFile(path.join(root, "effects", "codedna-retained-effects.jsonl"), warnings);
    const cases = [];
    try {
        const caseDir = path.join(root, "cases");
        const files = (await readdir(caseDir)).filter((name) => name.endsWith(".jsonl")).sort();
        for (const file of files) {
            cases.push(...(await readJsonlFile(path.join(caseDir, file), warnings)));
        }
    }
    catch (error) {
        warnings.push(`Failed to read case-library cases: ${error instanceof Error ? error.message : String(error)}`);
    }
    return { root, effects, cases, warnings };
}
async function readJsonlFile(file, warnings) {
    try {
        const content = await readFile(file, "utf8");
        const values = [];
        for (const [index, line] of content.split(/\r?\n/u).entries()) {
            if (!line.trim()) {
                continue;
            }
            try {
                values.push(JSON.parse(line));
            }
            catch (error) {
                warnings.push(`Failed to parse ${path.basename(file)} line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        return values;
    }
    catch (error) {
        warnings.push(`Failed to read ${file}: ${error instanceof Error ? error.message : String(error)}`);
        return [];
    }
}
async function findCaseLibraryRoot() {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const candidates = uniqueStrings([
        path.resolve(currentDir, "../..", "case-library"),
        path.resolve(currentDir, "../../..", "case-library"),
        path.resolve(process.cwd(), "case-library"),
        path.resolve(process.cwd(), "..", "case-library")
    ]);
    for (const candidate of candidates) {
        try {
            const value = await stat(candidate);
            if (value.isDirectory()) {
                return candidate;
            }
        }
        catch {
            // Try the next candidate; the plugin may run from src, dist, or a Codex cache directory.
        }
    }
    return undefined;
}
function roundScore(value) {
    return Math.round(value * 100) / 100;
}
