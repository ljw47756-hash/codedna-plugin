import { nowIso, timestampedName } from "../storage/jsonStore.js";
import { inferEffectFamilies, loadCaseLibrary, recallCases } from "../caseLibrary/caseLibrary.js";
import { activateEffects, basePairWeights, codexAssistanceSteps, dnaAlignment, ruleWeightAdjustments, scoreAdjustmentFromEffects, scoreExplanation } from "../caseLibrary/effectWeights.js";
import { similarity, tokens, uniqueStrings } from "./common.js";
import { evaluateVagueRequest, vagueClarificationQuestions } from "./vagueRequest.js";
const pairWeights = basePairWeights;
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
    const baseScore = score(matched, unmatched, requirement.unknowns);
    const query = dnaQuery(requirement, analysis);
    const library = await loadCaseLibrary();
    const inferredFamilies = inferEffectFamilies(query);
    const activatedEffects = activateEffects(library, query, inferredFamilies);
    const caseRecall = recallCases(library, query, inferredFamilies);
    const evidenceAdjustment = scoreAdjustmentFromEffects(activatedEffects, requirement.unknowns.length, unmatched.length);
    const adjustedScore = applyEvidenceAdjustment(baseScore, evidenceAdjustment, requirement.unknowns.length);
    const vagueGate = evaluateVagueRequest(requirement, analysis);
    const safetyGate = evaluateSafetyGate(requirement);
    const pairingScore = applyScoreCaps(adjustedScore, requirement, analysis, vagueGate.is_vague, safetyGate);
    const blocked = vagueGate.is_vague || safetyGate.blocked || pairingScore < 70;
    const result = {
        pairing_score: pairingScore,
        matched_pairs: matched,
        unmatched_pairs: unmatched,
        warnings: uniqueStrings([
            ...warnings(pairingScore, unmatched, requirement.unknowns, vagueGate.is_vague),
            ...vagueGate.warnings,
            ...safetyGate.warnings,
            ...library.warnings
        ]),
        missing_information: uniqueStrings([...requirement.unknowns, ...(vagueGate.is_vague ? vagueClarificationQuestions : [])]),
        ready_for_codex: !blocked,
        execution_level: blocked ? "blocked" : pairingScore >= 90 ? "full" : "cautious",
        dna_alignment: dnaAlignment(pairingScore),
        activated_effects: activatedEffects,
        case_recall: caseRecall,
        rule_weight_adjustments: ruleWeightAdjustments(activatedEffects),
        score_explanation: scoreExplanation(baseScore, pairingScore, activatedEffects, {
            success: caseRecall.success_patterns.length,
            failure: caseRecall.failure_patterns.length,
            public: caseRecall.public_patterns.length
        }, evidenceAdjustment),
        codex_assistance: codexAssistanceSteps(pairingScore),
        created_at: nowIso()
    };
    let artifactPath;
    if (input.save !== false) {
        artifactPath = await memoryStore.saveArtifact(`strands/${timestampedName(requirement.core_goal, ".pairing.json")}`, result);
    }
    return { pairing_result: result, artifact_path: artifactPath };
}
function dnaQuery(requirement, analysis) {
    return [
        requirement.original_request,
        requirement.core_goal,
        requirement.features.join(" "),
        requirement.constraints.join(" "),
        requirement.preferences.join(" "),
        requirement.acceptance_criteria.join(" "),
        requirement.user_memory_related_rules.join(" "),
        analysis.technical_goal,
        analysis.suggested_architecture.join(" "),
        analysis.required_modules.join(" "),
        analysis.implementation_steps.join(" "),
        analysis.risks.join(" "),
        analysis.test_plan.join(" "),
        analysis.assumptions.join(" ")
    ].join("\n");
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
function applyEvidenceAdjustment(baseScore, adjustment, unknownCount) {
    const adjusted = Math.max(0, Math.min(100, Math.round(baseScore + adjustment)));
    if (unknownCount >= 3) {
        return Math.min(adjusted, 64);
    }
    if (unknownCount >= 2) {
        return Math.min(adjusted, 76);
    }
    if (baseScore < 70 && adjusted >= 70) {
        return Math.min(adjusted, 72);
    }
    return adjusted;
}
function applyScoreCaps(scoreValue, requirement, analysis, vagueRequest, safetyGate) {
    let value = scoreValue;
    if (vagueRequest) {
        value = Math.min(value, 60);
    }
    if (safetyGate.blocked) {
        value = Math.min(value, 69);
    }
    else if (safetyGate.cautious) {
        value = Math.min(value, 89);
    }
    if (requirement.acceptance_criteria.length === 0) {
        value -= 15;
    }
    if (analysis.affected_files.length === 0 || analysis.affected_files.some((file) => /inspect project structure|scan the target project/i.test(file))) {
        value -= 15;
    }
    if (requirement.constraints.length === 0) {
        value -= 10;
    }
    return Math.max(0, Math.min(100, Math.round(value)));
}
function evaluateSafetyGate(requirement) {
    const request = requirement.original_request;
    const lowered = request.toLowerCase();
    const protectiveMention = /assert(?:ing)?\s+\.env\s+is\s+forbidden|\.env\s+is\s+forbidden|unless explicitly requested/i.test(request) ||
        /(security review|review for hardcoded secrets|report risks|do not change files|do not edit files|只报告|不要改 files|不改 files)/i.test(request);
    const asksForSecret = /(hardcoded|add|write|store|commit|put|save).{0,40}(api key|token|secret|password|\.env)/i.test(request) ||
        /(api key|token|secret|password).{0,40}(\.env|hardcoded|commit|store|save)/i.test(request) ||
        /密钥|令牌|硬编码/u.test(request);
    const dangerousCommand = /rm\s+-rf|postinstall|curl\s+.*\|\s*sh|powershell\s+-enc|删除核心配置|直接执行/u.test(request);
    const destructiveConfig = /\b(delete|remove|wipe|reset|overwrite|format)\b/i.test(request) &&
        /(\.env|package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|tsconfig\.json|vite\.config|next\.config)/i.test(request);
    const deceptiveOrNoReview = /skip verification|no tests needed|do not mention|mark it complete without review|不要写验收标准|不写验收标准/i.test(request);
    const approvalBeforeEdit = hasApprovalBeforeEditSignal(request);
    const packageFileBoundary = hasPackageFileBoundary(request);
    const planOnlyOrApproval = /\b(do not edit files yet|wait for approval|before editing|do not apply it until|plan a .*change|only prepare|do not modify production code)\b/i.test(request) || /先不要改文件|只生成任务包|只准备修复方案|不要继续新增功能|等待.*确认/u.test(request);
    if (!protectiveMention && (asksForSecret || dangerousCommand || destructiveConfig || deceptiveOrNoReview)) {
        return {
            blocked: true,
            cautious: false,
            warnings: ["High-risk request detected; block direct execution and require clarification or explicit safe scope."]
        };
    }
    if (approvalBeforeEdit || packageFileBoundary || planOnlyOrApproval || (!protectiveMention && /(\.env|package\.json|package-lock\.json|tsconfig\.json)/i.test(lowered))) {
        return {
            blocked: false,
            cautious: true,
            warnings: ["Cautious execution gate applied because the request requires approval, planning first, or sensitive-file guardrails."]
        };
    }
    return { blocked: false, cautious: false, warnings: [] };
}
function hasApprovalBeforeEditSignal(request) {
    return (/\b(?:hold|defer|pause)\b.{0,50}\b(?:all\s+)?(?:file|code)?\s*(?:changes|edits)\b.{0,50}\b(?:until|unless)\b.{0,40}\b(?:i\s+)?(?:confirm|approve|say\s+continue)\b/iu.test(request) ||
        /\b(?:wait|pause)\b.{0,30}\b(?:for|until)\b.{0,30}\b(?:approval|confirmation|my confirmation|i approve|i confirm)\b/iu.test(request) ||
        /\b(?:prepare|draft|produce)\b.{0,40}\b(?:repair plan|plan|proposal)\b.{0,80}\b(?:before|without)\b.{0,40}\b(?:editing|edits|file changes|code changes)\b/iu.test(request));
}
function hasPackageFileBoundary(request) {
    return /\b(?:avoid|do not|don't|without|must not|no)\b.{0,50}\b(?:package files?|package-manager files?|package manager files?|dependency files?|lockfiles?|lock files?)\b/iu.test(request);
}
function warnings(scoreValue, unmatched, missing, vagueRequest) {
    const items = [];
    if (vagueRequest) {
        items.push("Vague request blocked; ask clarification questions before generating an editing task pack.");
    }
    else if (scoreValue >= 90) {
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
