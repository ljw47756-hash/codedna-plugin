import { uniqueStrings } from "./common.js";
export function compileCodexExecutionBrief(input) {
    const objective = compact(input.requirement.core_goal || input.requirement.original_request, 220);
    const executionMode = input.pairing.execution_level;
    const allowedScope = allowedScopeFor(input.analysis, input.project_profile);
    const doNot = doNotFor(input.requirement, input.project_profile);
    const executionSteps = executionStepsFor(input.analysis, input.pairing);
    const verification = verificationFor(input.analysis, input.requirement);
    const intentType = inferIntentType(input.requirement, input.analysis);
    const reviewGate = executionMode === "blocked"
        ? "Do not edit files. Ask the missing clarification questions first."
        : "After editing, provide changed files, verification evidence, and residual risks so CodeDNA can review the diff.";
    const markdown = [
        "# Codex Execution Brief",
        "",
        `Objective: ${objective}`,
        `Mode: ${executionMode}`,
        `Intent Type: ${intentType}`,
        "",
        "Allowed Scope:",
        bullets(allowedScope),
        "",
        "Do Not:",
        bullets(doNot),
        "",
        "Execution:",
        numbered(executionSteps),
        "",
        "Verification:",
        bullets(verification),
        "",
        "Review Gate:",
        `- ${reviewGate}`
    ].join("\n");
    return {
        objective,
        execution_mode: executionMode,
        intent_type: intentType,
        allowed_scope: allowedScope,
        do_not: doNot,
        execution_steps: executionSteps,
        verification,
        review_gate: reviewGate,
        markdown
    };
}
function allowedScopeFor(analysis, projectProfile) {
    return uniqueStrings([
        ...analysis.affected_files.slice(0, 10),
        ...analysis.required_modules.slice(0, 5),
        ...(projectProfile?.component_dirs.slice(0, 3) ?? []),
        ...(projectProfile?.api_dirs.slice(0, 3) ?? [])
    ]).slice(0, 12);
}
function doNotFor(requirement, projectProfile) {
    const hardConstraints = requirement.constraints.filter((item) => /(do not|don't|never|forbid|forbidden|only|must not|avoid|不要|不能|禁止|只|仅|不得|避免)/iu.test(item));
    return uniqueStrings([
        ...hardConstraints,
        "Do not broaden scope or perform unrelated refactors.",
        "Do not add hardcoded secrets, tokens, API keys, personal paths, or local runtime data.",
        "Do not modify dependency lockfiles, environment files, or generated output unless explicitly required.",
        ...(projectProfile?.do_not_touch.slice(0, 6) ?? [])
    ]).slice(0, 10);
}
function executionStepsFor(analysis, pairing) {
    if (pairing.execution_level === "blocked") {
        return uniqueStrings([
            ...pairing.missing_information.slice(0, 5).map((item) => `Clarify: ${item}`),
            "Do not edit files until the missing information is resolved."
        ]);
    }
    return analysis.implementation_steps.slice(0, 6);
}
function verificationFor(analysis, requirement) {
    return uniqueStrings([
        ...analysis.test_plan.slice(0, 5),
        ...requirement.acceptance_criteria.slice(0, 4).map((item) => `Verify acceptance: ${item}`),
        "If a command cannot be run, explain why and provide the closest manual verification."
    ]).slice(0, 8);
}
function inferIntentType(requirement, analysis) {
    const text = `${requirement.original_request}\n${requirement.features.join("\n")}\n${analysis.required_modules.join("\n")}`;
    if (/(review-only|review only|审查|审核|只检查|只做检查)/iu.test(text)) {
        return "review_only";
    }
    if (/(plan-only|plan only|只计划|只给方案|不要改代码|不要编辑文件)/iu.test(text)) {
        return "plan_only";
    }
    if (/(repair|fix failure|修复|失败|报错)/iu.test(text)) {
        return "repair";
    }
    if (/(readme|docs|documentation|文档|说明)/iu.test(text)) {
        return "documentation";
    }
    if (requirement.features.length || analysis.implementation_steps.length) {
        return "implementation";
    }
    return "unknown";
}
function bullets(items) {
    return items.length ? items.map((item) => `- ${compact(item, 180)}`).join("\n") : "- None";
}
function numbered(items) {
    return items.length ? items.map((item, index) => `${index + 1}. ${compact(item, 180)}`).join("\n") : "1. No execution step generated.";
}
function compact(value, limit) {
    const normalized = value.replace(/\s+/g, " ").trim();
    return normalized.length > limit ? `${normalized.slice(0, limit - 1)}...` : normalized;
}
