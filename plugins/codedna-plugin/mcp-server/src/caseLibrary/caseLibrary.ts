import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CaseRecall, RecalledCase } from "../types/pairingResult.js";
import { tokens, uniqueStrings } from "../tools/common.js";

export interface RetainedEffect {
  id: string;
  category: "retained-effect";
  public_safe: boolean;
  license: string;
  fit: "strong" | "medium" | string;
  effect_family: string;
  activation_surface: string;
  codedna_target: string;
  summary: string;
  adapted_behavior: string;
  codedna_pattern: string;
  guardrail: string;
  experience_impact: string;
  provenance: string;
  tags: string[];
}

export interface CodeDnaCase {
  id: string;
  category: string;
  public_safe: boolean;
  license: string;
  linked_effect_id?: string;
  effect_family?: string;
  source_url?: string;
  summary: string;
  codedna_pattern: string;
  guardrail: string;
  outcome?: string;
  tags: string[];
}

export interface CaseLibrary {
  root: string;
  effects: RetainedEffect[];
  cases: CodeDnaCase[];
  warnings: string[];
}

const CASE_LIMIT = 4;
let cachedLibrary: Promise<CaseLibrary> | undefined;

export async function loadCaseLibrary(): Promise<CaseLibrary> {
  cachedLibrary ??= readLibrary();
  return cachedLibrary;
}

export function clearCaseLibraryCache(): void {
  cachedLibrary = undefined;
}

export function inferEffectFamilies(text: string): string[] {
  const normalized = text.toLocaleLowerCase();
  const familySignals: Array<{ family: string; hints: string[] }> = [
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

export function recallCases(library: CaseLibrary, query: string, families: string[], limit = CASE_LIMIT): CaseRecall {
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

function takeCases(scored: Array<{ entry: CodeDnaCase; score: number }>, limit: number): RecalledCase[] {
  return selectDiverseCases(scored, limit).map(({ entry, score }) => ({
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

function selectDiverseCases(scored: Array<{ entry: CodeDnaCase; score: number }>, limit: number): Array<{ entry: CodeDnaCase; score: number }> {
  const grouped = new Map<string, Array<{ entry: CodeDnaCase; score: number }>>();
  const seenPatterns = new Set<string>();
  for (const item of scored) {
    const key = caseDedupeKey(item.entry);
    if (seenPatterns.has(key)) {
      continue;
    }
    seenPatterns.add(key);
    const family = item.entry.effect_family ?? item.entry.category;
    const group = grouped.get(family) ?? [];
    group.push(item);
    grouped.set(family, group);
  }

  const groups = [...grouped.entries()]
    .map(([family, items]) => ({ family, items }))
    .sort((left, right) => (right.items[0]?.score ?? 0) - (left.items[0]?.score ?? 0) || left.family.localeCompare(right.family));
  const selected: Array<{ entry: CodeDnaCase; score: number }> = [];
  const familyCounts = new Map<string, number>();

  for (const passLimit of [1, 2]) {
    let added = true;
    while (selected.length < limit && added) {
      added = false;
      for (const group of groups) {
        if (selected.length >= limit) {
          break;
        }
        const count = familyCounts.get(group.family) ?? 0;
        if (count >= passLimit || group.items.length === 0) {
          continue;
        }
        selected.push(group.items.shift()!);
        familyCounts.set(group.family, count + 1);
        added = true;
      }
    }
  }

  return selected;
}

function fallbackCases(library: CaseLibrary, families: string[], outcome: "success" | "failure", limit: number): RecalledCase[] {
  const predicate = outcome === "success" ? isSuccessCase : isFailureCase;
  const entries = library.cases
    .filter(predicate)
    .filter((entry) => !families.length || families.includes(entry.effect_family ?? ""))
    .slice(0, limit);
  return takeCases(entries.map((entry) => ({ entry, score: 0.2 })), limit);
}

function scoreEntry(entry: CodeDnaCase, query: string, queryTokens: string[], families: string[]): number {
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
  if (entry.effect_family && families[0] === entry.effect_family) {
    score += 0.9;
  }
  for (const family of families) {
    if (entryText.includes(family)) {
      score += 0.75;
    }
  }
  if (entry.tags.includes("strong")) {
    score += 0.8;
  } else if (entry.tags.includes("medium")) {
    score += 0.25;
  }
  if (/guardrail|constraint|scope|risk|不要|禁止|范围|约束/i.test(query) && /guardrail|scope|risk|constraint|Do not/i.test(entry.guardrail)) {
    score += 0.6;
  }
  if (/不要|禁止|避免|do not|avoid|forbid|risk|guardrail/i.test(query) && isFailureCase(entry)) {
    score += 0.8;
  }
  if (/成功|ready|pass|accepted|stable/i.test(query) && isSuccessCase(entry)) {
    score += 0.5;
  }
  return score;
}

function caseDedupeKey(entry: CodeDnaCase): string {
  return `${entry.effect_family ?? entry.category}|${entry.codedna_pattern}|${entry.guardrail}`.toLocaleLowerCase();
}

function isSuccessCase(entry: CodeDnaCase): boolean {
  return entry.category.includes("success") || entry.outcome === "success-pattern";
}

function isFailureCase(entry: CodeDnaCase): boolean {
  return entry.category.includes("failure") || entry.outcome === "failure-pattern";
}

async function readLibrary(): Promise<CaseLibrary> {
  const root = await findCaseLibraryRoot();
  const warnings: string[] = [];
  if (!root) {
    return { root: "", effects: [], cases: [], warnings: ["CodeDNA case-library directory was not found."] };
  }

  const effects = await readJsonlFile<RetainedEffect>(path.join(root, "effects", "codedna-retained-effects.jsonl"), warnings);
  const cases: CodeDnaCase[] = [];
  try {
    const caseDir = path.join(root, "cases");
    const files = (await readdir(caseDir)).filter((name) => name.endsWith(".jsonl")).sort();
    for (const file of files) {
      cases.push(...(await readJsonlFile<CodeDnaCase>(path.join(caseDir, file), warnings)));
    }
  } catch (error) {
    warnings.push(`Failed to read case-library cases: ${error instanceof Error ? error.message : String(error)}`);
  }
  return { root, effects, cases, warnings };
}

async function readJsonlFile<T>(file: string, warnings: string[]): Promise<T[]> {
  try {
    const content = await readFile(file, "utf8");
    const values: T[] = [];
    for (const [index, line] of content.split(/\r?\n/u).entries()) {
      if (!line.trim()) {
        continue;
      }
      try {
        values.push(JSON.parse(line) as T);
      } catch (error) {
        warnings.push(`Failed to parse ${path.basename(file)} line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return values;
  } catch (error) {
    warnings.push(`Failed to read ${file}: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

async function findCaseLibraryRoot(): Promise<string | undefined> {
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
    } catch {
      // Try the next candidate; the plugin may run from src, dist, or a Codex cache directory.
    }
  }
  return undefined;
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}
