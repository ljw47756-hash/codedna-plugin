import { nowIso, timestampedName } from "../storage/jsonStore.js";
import { classifyClause, detectTaskMode, extractCorrections, isPhasedInstruction, isPrivacyInstruction, taskModeNote, zhAcceptanceHints, zhConstraintHints, zhFeatureHints, zhPreferenceHints } from "../language/zhLexicon.js";
import { containsAny, normalizeText, splitClauses, splitSentences, uniqueStrings } from "./common.js";
const featureHints = [
    "add",
    "bump",
    "build",
    "create",
    "generate",
    "implement",
    "support",
    "improve",
    "scan",
    "save",
    "review",
    "diagnose",
    "troubleshoot",
    "page",
    "screen",
    "feature",
    "module",
    "workflow",
    "memory",
    "memory update",
    "long-term memory",
    "tool",
    "integration",
    "include",
    "built",
    "entrypoint",
    "plan",
    "optimization",
    "optimize",
    "prepare",
    "repository",
    "github",
    "readme",
    "docs",
    "repair",
    "fix",
    "添加",
    "新增",
    "创建",
    "生成",
    "实现",
    "支持",
    "修复",
    "优化",
    "重构",
    "检查",
    "审查",
    "扫描",
    "保存",
    "上传",
    "安装",
    "启用",
    "解析",
    "迁移",
    "替换",
    "换成",
    "进入",
    "完善",
    "补",
    "方案",
    "指导"
];
featureHints.push(...zhFeatureHints);
const constraintHints = [
    "must",
    "only",
    "without",
    "avoid",
    "do not",
    "don't",
    "never",
    "forbid",
    "forbidden",
    "preserve",
    "keep",
    "no unrelated",
    "do not modify",
    "must not",
    "not normal",
    "not normal install",
    "fallback only",
    "不要",
    "别",
    "不再",
    "不许",
    "不能",
    "不用",
    "不得",
    "禁止",
    "避免",
    "只允许",
    "只做",
    "只能",
    "仅",
    "必须",
    "务必",
    "一定要",
    "保留",
    "不要改",
    "不要修改",
    "不要提交",
    "不要上传",
    "不要继续",
    "不要缩减",
    "先不要",
    "先不用",
    "除非",
    "等待我说",
    "等我说",
    "不要再"
];
constraintHints.push(...zhConstraintHints);
const preferenceHints = [
    "prefer",
    "preference",
    "style",
    "simple",
    "minimal",
    "dark",
    "clean",
    "clear",
    "technical",
    "compact",
    "scannable",
    "consistent",
    "偏好",
    "风格",
    "简单",
    "简洁",
    "清晰",
    "一致",
    "紧凑",
    "可读",
    "用中文",
    "用英文",
    "中文描述",
    "英文",
    "一步步",
    "先给方案",
    "不要太详细",
    "避免暴露",
    "保密",
    "说明"
];
preferenceHints.push(...zhPreferenceHints);
const acceptanceHints = [
    "acceptance",
    "verify",
    "verification",
    "test",
    "pass",
    "should",
    "must be able",
    "complete",
    "done",
    "check off",
    "check them off",
    "explain",
    "sparse path",
    "summarize",
    "summary",
    "review report",
    "changed files",
    "ready to accept",
    "reinstall",
    "manual add",
    "risks",
    "risk conclusion",
    "next steps",
    "expected",
    "criteria",
    "validator",
    "plugin validator",
    "release:check",
    "release check",
    "node -v",
    "npm -v",
    "dist/server.js",
    "验收",
    "验证",
    "校验",
    "检查",
    "测试",
    "回归测试",
    "运行",
    "通过",
    "完成后",
    "最后",
    "输出",
    "告诉我",
    "逐项打勾",
    "结论",
    "结果",
    "编译",
    "构建",
    "npm test",
    "npm run"
];
acceptanceHints.push(...zhAcceptanceHints);
export async function parseRequirement(input, memoryStore) {
    const request = normalizeText(input.request);
    if (!request) {
        throw new Error("codedna_parse_requirement requires a non-empty request.");
    }
    const sentences = splitSentences(request);
    const coreGoal = coreGoalFromSentences(sentences);
    const features = extractByHints(sentences, featureHints, true);
    const constraints = extractByHints(sentences, constraintHints);
    const preferences = extractByHints(sentences, preferenceHints);
    let acceptanceCriteria = extractByHints(sentences, acceptanceHints);
    enrichWithClauseClassification(sentences, features, constraints, preferences, acceptanceCriteria);
    enrichWithStructuredDirectives(request, features, constraints, preferences, acceptanceCriteria);
    const memoryRules = input.memory_rules?.length
        ? uniqueStrings(input.memory_rules)
        : await memoryStore.relatedRules(request);
    if (coreGoal && !features.includes(coreGoal)) {
        features.unshift(coreGoal);
    }
    if (acceptanceCriteria.length === 0) {
        acceptanceCriteria = defaultAcceptance(features, constraints);
    }
    const taskMode = detectTaskMode(request);
    preferences.push(taskModeNote(taskMode));
    const requirement = {
        original_request: input.request.trim(),
        core_goal: coreGoal,
        features: uniqueStrings(features),
        constraints: uniqueStrings(constraints),
        preferences: uniqueStrings(preferences),
        acceptance_criteria: uniqueStrings(acceptanceCriteria),
        unknowns: unknowns(request, input.project_profile, features, taskMode),
        priority: priority(request, constraints),
        user_memory_related_rules: memoryRules,
        created_at: nowIso()
    };
    const warnings = requirement.unknowns.map((item) => `Missing information: ${item}`);
    let artifactPath;
    if (input.save !== false) {
        artifactPath = await memoryStore.saveArtifact(`strands/${timestampedName(requirement.core_goal, ".requirement.json")}`, requirement);
    }
    return {
        requirement_strand: requirement,
        artifact_path: artifactPath,
        warnings
    };
}
function coreGoalFromSentences(sentences) {
    if (sentences.length === 0) {
        return "Clarify and implement the requested Codex coding task";
    }
    const scored = sentences
        .map((sentence, index) => ({ sentence, index, score: goalScore(sentence, index) }))
        .sort((left, right) => right.score - left.score || left.index - right.index);
    const selected = scored[0]?.sentence || sentences[0];
    return cleanGoal(selected).slice(0, 240);
}
function extractByHints(sentences, hints, includeContinuation = false) {
    const extracted = [];
    for (const sentence of sentences) {
        let previousMatched = false;
        for (const clause of splitClauses(sentence)) {
            const matched = containsAny(clause, hints);
            if (matched || (includeContinuation && previousMatched && looksLikeContinuation(clause))) {
                extracted.push(clause);
            }
            previousMatched = matched;
        }
    }
    return uniqueStrings(extracted);
}
function looksLikeContinuation(clause) {
    return !containsAny(clause, constraintHints) && !/^(and|or|but)?\s*(without|avoid|do not|don't|never|must not)/iu.test(clause);
}
function enrichWithClauseClassification(sentences, features, constraints, preferences, acceptanceCriteria) {
    for (const sentence of sentences) {
        for (const clause of splitClauses(sentence)) {
            const classification = classifyClause(clause);
            if (classification.labels.includes("feature")) {
                features.push(clause);
            }
            if (classification.labels.includes("constraint")) {
                constraints.push(clause);
            }
            if (classification.labels.includes("preference")) {
                preferences.push(clause);
            }
            if (classification.labels.includes("acceptance")) {
                acceptanceCriteria.push(clause);
            }
        }
    }
}
function enrichWithStructuredDirectives(request, features, constraints, preferences, acceptanceCriteria) {
    for (const correction of extractCorrections(request)) {
        if (correction.required_direction) {
            features.push(`Required direction: ${correction.required_direction}`);
        }
        if (correction.rejected_direction) {
            constraints.push(`Do not continue rejected direction: ${correction.rejected_direction}`);
        }
    }
    for (const match of request.matchAll(/(?:只修改|只改)\s*([^，。；,.;]+)/gu)) {
        constraints.push(`只修改 ${match[1].trim()}`);
    }
    for (const match of request.matchAll(/\b(?:only\s+modify|only\s+touch|touch\s+only|modify\s+only)\s+([^,.;]+)/giu)) {
        constraints.push(`Only modify ${match[1].trim()}`);
    }
    if (isPhasedInstruction(request)) {
        constraints.push("Phased execution: finish the current phase and wait for explicit user confirmation before continuing.");
        acceptanceCriteria.push("Phase output clearly states what was completed and what waits for user confirmation.");
    }
    if (isPrivacyInstruction(request)) {
        constraints.push("Do not disclose detailed internal capability design or implementation-sensitive workflow details.");
        preferences.push("Public-facing documentation should describe benefits without exposing proprietary implementation details.");
    }
}
function unknowns(request, projectProfile, features, taskMode) {
    const missing = [];
    if (!projectProfile) {
        missing.push("Target project directory has not been scanned yet.");
    }
    if (taskMode === "implementation" && !hasVerificationSignal(request) && !isDocumentationOnlyRequest(request)) {
        missing.push("Preferred verification command is not specified.");
    }
    if (taskMode === "implementation" && !hasTargetSignal(request) && !isPlanOnlyRequest(request)) {
        missing.push("Exact files or modules to modify are not fully specified.");
    }
    if (taskMode === "implementation" && features.length <= 1 && request.length < 80 && !hasStructuredScopeSignal(request)) {
        missing.push("Feature scope may need more detail before implementation.");
    }
    return uniqueStrings(missing);
}
function priority(request, constraints) {
    if (/(urgent|asap|immediately|today|high priority|紧急|马上|立即|今天|高优先级)/iu.test(request)) {
        return "high";
    }
    if (constraints.length >= 3) {
        return "high";
    }
    if (request.length < 40) {
        return "low";
    }
    return "medium";
}
function defaultAcceptance(features, constraints) {
    const criteria = ["Implemented behavior matches the original user request."];
    if (features.length > 0) {
        criteria.push("Each requested feature is visible in code, tests, or user-facing behavior.");
    }
    if (constraints.length > 0) {
        criteria.push("All listed constraints are respected.");
    }
    criteria.push("Relevant verification steps can be run or clearly explained.");
    return criteria;
}
function goalScore(sentence, index) {
    let score = Math.max(0, 5 - index);
    const hasFeatureHint = containsAny(sentence, featureHints);
    if (hasFeatureHint) {
        score += 8;
    }
    if (containsAny(sentence, acceptanceHints)) {
        score += hasFeatureHint ? 1 : 4;
    }
    if (/(目标|核心|阶段|任务|需求|要做|接下来|下一步|优化哪些|最终交付|最终检查)/iu.test(sentence)) {
        score += 5;
    }
    if (containsAny(sentence, constraintHints)) {
        score -= containsAny(sentence, featureHints) ? 3 : 8;
    }
    if (/^(现在)?(不要|别|不再|先不要|先不用)/u.test(sentence.trim())) {
        score -= 4;
    }
    return score;
}
function cleanGoal(value) {
    return value.replace(/^(please|help me|could you|can you|请|麻烦|帮我)\s*/iu, "").trim();
}
function hasVerificationSignal(request) {
    return /(test|pytest|verification|verify|acceptance|lint|build|release:check|release\s+check|npm\s+(test|run|run\s+build)|pnpm|yarn|测试|回归测试|验证|校验|检查|编译|构建|运行|跑一次|跑通|通过)/iu.test(request);
}
function hasTargetSignal(request) {
    return /(file|directory|path|page|screen|component|api|route|module|tool|server|mcp|src[\\/]|tests?[\\/]|package\.json|plugin\.json|README|docs?[\\/]|文件|目录|路径|页面|界面|组件|接口|路由|模块|工具|服务器|插件|仓库|项目|服务|配置|脚本)/iu.test(request);
}
function isPlanOnlyRequest(request) {
    return /(plan only|do not edit|no code changes|proposal only|方案|计划|先给我方案|先不用改代码|不用改代码|不要改代码|不改代码|不要提交|先不用提交|只给方案|先不用再改|不要继续开发|最终检查|最终交付验收)/iu.test(request);
}
function isDocumentationOnlyRequest(request) {
    return /(readme|docs|documentation|homepage|guide|文档|说明|主页|仓库主页|安装说明|介绍|描述|总结|写清楚)/iu.test(request);
}
function hasStructuredScopeSignal(request) {
    return /(逐项|对照.+打勾|[0-9一二三四五六七八九十百]+个部分|不要缩减.+范围|文件里?的范围|all\s+\w+\s+sections|check\s+them\s+off|requested\s+scope|do\s+not\s+reduce.+scope)/iu.test(request);
}
