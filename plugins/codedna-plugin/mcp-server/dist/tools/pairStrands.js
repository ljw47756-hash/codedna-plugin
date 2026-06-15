import { nowIso, timestampedName } from "../storage/jsonStore.js";
import { similarity, tokens } from "./common.js";
const pairWeights = {
    "Goal <-> Task": 20,
    "Constraint <-> Risk": 18,
    "Preference <-> Pattern": 14,
    "Feature <-> Module": 20,
    "Acceptance <-> Test": 18,
    "Memory <-> Reuse": 10
};
export async function pairStrands(input, memoryStore) {
    const requirement = input.requirement_strand;
    const analysis = input.analysis_strand;
    if (!requirement?.core_goal || !analysis?.technical_goal) {
        throw new Error("codedna_pair_strands requires requirement_strand and analysis_strand.");
    }
    const matched = [];
    const unmatched = [];
    addGoalPair(requirement, analysis, matched, unmatched);
    addCollectionPairs("Constraint <-> Risk", requirement.constraints, analysis.risks, matched, unmatched);
    addCollectionPairs("Preference <-> Pattern", requirement.preferences, analysis.suggested_architecture, matched, unmatched);
    addCollectionPairs("Feature <-> Module", requirement.features, analysis.required_modules, matched, unmatched);
    addCollectionPairs("Acceptance <-> Test", requirement.acceptance_criteria, analysis.test_plan, matched, unmatched);
    addCollectionPairs("Memory <-> Reuse", requirement.user_memory_related_rules, [...analysis.suggested_architecture, ...analysis.assumptions], matched, unmatched);
    const pairingScore = score(matched, unmatched, requirement.unknowns);
    const result = {
        pairing_score: pairingScore,
        matched_pairs: matched,
        unmatched_pairs: unmatched,
        warnings: warnings(pairingScore, unmatched, requirement.unknowns),
        missing_information: requirement.unknowns,
        ready_for_codex: pairingScore >= 70,
        execution_level: pairingScore >= 90 ? "full" : pairingScore >= 70 ? "cautious" : "blocked",
        created_at: nowIso()
    };
    let artifactPath;
    if (input.save !== false) {
        artifactPath = await memoryStore.saveArtifact(`strands/${timestampedName(requirement.core_goal, ".pairing.json")}`, result);
    }
    return { pairing_result: result, artifact_path: artifactPath };
}
function addGoalPair(requirement, analysis, matched, unmatched) {
    const confidence = itemConfidence("Goal <-> Task", requirement.core_goal, analysis.technical_goal);
    const target = confidence >= 0.35 ? matched : unmatched;
    target.push({
        pair_type: "Goal <-> Task",
        requirement_item: requirement.core_goal,
        analysis_item: analysis.technical_goal,
        status: confidence >= 0.35 ? "matched" : "weak",
        confidence,
        notes: confidence >= 0.35 ? "Core goal is represented by the technical goal." : "Technical goal should be more explicit."
    });
}
function addCollectionPairs(pairType, requirementItems, analysisItems, matched, unmatched) {
    if (requirementItems.length === 0) {
        matched.push({
            pair_type: pairType,
            requirement_item: "No explicit item supplied.",
            analysis_item: "No explicit pairing required.",
            status: "not_applicable",
            confidence: 1
        });
        return;
    }
    for (const requirementItem of requirementItems) {
        const best = bestCandidate(pairType, requirementItem, analysisItems);
        if (best.score >= 0.32 || analysisItems.length > 0) {
            const confidence = best.item ? Math.max(best.score, generalCoverageConfidence(pairType)) : 0.48;
            matched.push({
                pair_type: pairType,
                requirement_item: requirementItem,
                analysis_item: best.item || "Covered by general analysis.",
                status: best.score >= 0.5 ? "matched" : "general",
                confidence
            });
        }
        else {
            unmatched.push({
                pair_type: pairType,
                requirement_item: requirementItem,
                analysis_item: "",
                status: "unmatched",
                confidence: 0,
                notes: "Requirement item needs stronger technical coverage."
            });
        }
    }
}
function bestCandidate(pairType, source, candidates) {
    let item = "";
    let score = 0;
    for (const candidate of candidates) {
        const current = itemConfidence(pairType, source, candidate);
        if (current > score) {
            item = candidate;
            score = current;
        }
    }
    return { item, score };
}
function itemConfidence(pairType, source, candidate) {
    const normalizedSource = source.toLocaleLowerCase();
    const normalizedCandidate = candidate.toLocaleLowerCase();
    const lexical = similarity(source, candidate);
    let semantic = 0;
    if (normalizedSource && normalizedCandidate.includes(normalizedSource)) {
        semantic = Math.max(semantic, 0.96);
    }
    if (normalizedCandidate && normalizedSource.includes(normalizedCandidate)) {
        semantic = Math.max(semantic, 0.82);
    }
    const sourceTokens = tokens(source);
    const candidateTokens = tokens(candidate);
    for (const group of semanticGroups(pairType)) {
        const sourceHit = group.requirement.some((token) => sourceTokens.has(token) || normalizedSource.includes(token));
        const candidateHit = group.analysis.some((token) => candidateTokens.has(token) || normalizedCandidate.includes(token));
        if (sourceHit && candidateHit) {
            semantic = Math.max(semantic, group.confidence);
        }
    }
    return Math.min(1, Math.max(lexical, semantic));
}
function semanticGroups(pairType) {
    const shared = [
        {
            requirement: ["cli", "command", "script", "helper", "terminal", "shell", "powershell"],
            analysis: ["cli", "command", "entrypoint", "script", "helper", "terminal", "shell", "runner"],
            confidence: 0.86
        },
        {
            requirement: ["login", "auth", "authentication", "email", "verification-code", "password", "session", "登录", "认证", "邮箱", "验证码", "密码", "会话", "权限"],
            analysis: ["auth", "authentication", "form", "validation", "security", "session", "login", "认证", "表单", "校验", "安全", "登录"],
            confidence: 0.84
        },
        {
            requirement: ["page", "screen", "ui", "interface", "component", "layout", "页面", "界面", "组件", "布局", "前端", "视图"],
            analysis: ["ui", "component", "route", "frontend", "view", "page", "组件", "路由", "前端", "视图", "页面"],
            confidence: 0.8
        },
        {
            requirement: ["style", "dark", "minimal", "theme", "visual", "clean", "风格", "深色", "极简", "主题", "视觉", "清爽", "简洁"],
            analysis: ["style", "theme", "design", "ui", "visual", "component", "样式", "主题", "设计", "视觉", "组件"],
            confidence: 0.82
        },
        {
            requirement: ["test", "tests", "verify", "verification", "acceptance", "criteria", "测试", "回归测试", "验证", "校验", "验收", "标准", "运行", "通过"],
            analysis: ["test", "tests", "verify", "verification", "lint", "build", "manual", "测试", "验证", "校验", "编译", "构建", "手动"],
            confidence: 0.86
        },
        {
            requirement: ["memory", "preference", "pattern", "history", "reuse", "记忆", "偏好", "模式", "历史", "复用", "习惯"],
            analysis: ["memory", "pattern", "reuse", "preference", "assumption", "architecture", "记忆", "模式", "复用", "偏好", "假设", "架构"],
            confidence: 0.76
        },
        {
            requirement: [
                "unrelated",
                "scope",
                "sections",
                "section",
                "complete",
                "check",
                "check off",
                "scoped",
                "avoid",
                "forbid",
                "modify",
                "constraint",
                "不要",
                "不能",
                "禁止",
                "避免",
                "只允许",
                "只能",
                "不要改",
                "不要修改",
                "约束",
                "范围",
                "无关"
            ],
            analysis: ["risk", "guard", "constraint", "scoped", "unrelated", "review", "checklist", "coverage", "verifier", "风险", "保护", "约束", "范围", "无关", "审查", "守护"],
            confidence: 0.86
        },
        {
            requirement: ["privacy", "secret", "internal", "disclose", "leak", "copy", "plagiarism", "公开", "暴露", "泄露", "保密", "抄袭", "内部", "详细能力"],
            analysis: ["risk", "guard", "security", "documentation", "review", "constraint", "风险", "保护", "安全", "文档", "审查", "约束"],
            confidence: 0.84
        },
        {
            requirement: ["readme", "docs", "documentation", "homepage", "guide", "文档", "说明", "主页", "仓库主页", "安装说明"],
            analysis: ["documentation", "readme", "docs", "guide", "review", "文档", "说明", "指南", "审查"],
            confidence: 0.82
        },
        {
            requirement: ["mcp", "tool", "tools", "server", "handler", "工具", "服务器", "完整逻辑", "注册"],
            analysis: ["mcp", "tool", "tools", "server", "handler", "registration", "工具", "服务器", "处理器", "注册"],
            confidence: 0.86
        },
        {
            requirement: ["phase", "stage", "batch", "continue", "wait", "first", "second", "阶段", "分批", "继续", "等待", "第一批", "第二批"],
            analysis: ["phase", "phased", "workflow", "continuation", "gate", "batch", "阶段", "分批", "继续", "门控", "等待"],
            confidence: 0.86
        },
        {
            requirement: ["version", "cache", "plugin", "plugin.json", "manifest", "bump", "版本", "缓存", "清单"],
            analysis: ["version", "cache", "plugin", "manifest", "updater", "cache-busting", "版本", "缓存", "清单"],
            confidence: 0.86
        }
    ];
    if (pairType === "Goal <-> Task") {
        return shared.map((group) => ({ ...group, confidence: Math.min(0.9, group.confidence + 0.04) }));
    }
    if (pairType === "Feature <-> Module") {
        return shared;
    }
    if (pairType === "Acceptance <-> Test") {
        return shared.filter((group) => group.requirement.includes("test"));
    }
    if (pairType === "Constraint <-> Risk") {
        return shared.filter((group) => group.requirement.includes("constraint") ||
            group.requirement.includes("privacy") ||
            group.requirement.includes("disclose") ||
            group.requirement.includes("公开"));
    }
    if (pairType === "Preference <-> Pattern") {
        return shared.filter((group) => group.requirement.includes("style") || group.requirement.includes("memory"));
    }
    return shared;
}
function generalCoverageConfidence(pairType) {
    if (pairType === "Memory <-> Reuse") {
        return 0.62;
    }
    if (pairType === "Feature <-> Module") {
        return 0.6;
    }
    return 0.65;
}
function score(matched, unmatched, unknowns) {
    const all = [...matched, ...unmatched];
    let earned = 0;
    const total = Object.values(pairWeights).reduce((sum, weight) => sum + weight, 0);
    for (const [pairType, weight] of Object.entries(pairWeights)) {
        const relevant = all.filter((pair) => pair.pair_type === pairType);
        if (relevant.length === 0) {
            continue;
        }
        const confidence = relevant
            .filter((pair) => matched.includes(pair))
            .reduce((sum, pair) => sum + pair.confidence, 0) / relevant.length;
        earned += weight * Math.min(confidence, 1);
    }
    const penalty = Math.min(unknowns.length * 8 + unmatched.length * 8, 45);
    const rawScore = Math.max(0, Math.min(100, Math.round((earned / total) * 100 - penalty)));
    if (unknowns.length >= 3) {
        return Math.min(rawScore, 64);
    }
    if (unknowns.length >= 2) {
        return Math.min(rawScore, 76);
    }
    return rawScore;
}
function warnings(scoreValue, unmatched, missing) {
    const items = [];
    if (scoreValue >= 90) {
        items.push("Pairing score is high enough for a complete Codex Task Pack.");
    }
    else if (scoreValue >= 70) {
        items.push("Task Pack can be generated, but include assumptions, risks, and caution notes.");
    }
    else {
        items.push("Do not execute directly; clarify missing information first.");
    }
    if (unmatched.length > 0) {
        items.push(`${unmatched.length} requirement item(s) need stronger analysis coverage.`);
    }
    if (missing.length > 0) {
        items.push(`${missing.length} missing information item(s) should be reviewed.`);
    }
    return items;
}
