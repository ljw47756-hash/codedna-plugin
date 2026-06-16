import { stat } from "node:fs/promises";
import { uniqueStrings } from "./common.js";
import { buildProjectGenome } from "./buildProjectGenome.js";
import { generateTaskPack } from "./generateTaskPack.js";
import { pairStrands } from "./pairStrands.js";
import { parseRequirement } from "./parseRequirement.js";
import { reverseAnalyze } from "./reverseAnalyze.js";
import { scanProject } from "./scanProject.js";
import { evaluateVagueRequest, vagueClarificationQuestions } from "./vagueRequest.js";
export async function runFullWorkflow(input, memoryStore) {
    const mode = input.mode ?? "task_pack";
    const request = buildRequest(input.user_request, input.optional_constraints);
    if (!request.trim()) {
        throw new Error("codedna_run_full_workflow requires user_request.");
    }
    const warnings = [];
    let projectProfile;
    let projectGenome;
    if (input.project_path) {
        try {
            await assertDirectory(input.project_path);
            projectProfile = (await scanProject({ project_path: input.project_path }, memoryStore)).project_profile;
        }
        catch (error) {
            warnings.push(`Project scan failed; continuing with generic planning: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    else {
        warnings.push("No project_path was provided; continuing with generic planning.");
    }
    if (input.use_project_genome !== false && input.project_path && projectProfile) {
        try {
            projectGenome = (await buildProjectGenome({ project_path: input.project_path, project_profile: projectProfile }, memoryStore)).project_genome;
        }
        catch (error) {
            warnings.push(`Project Genome generation failed; continuing without genome: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    const loadedMemory = input.use_memory === false ? undefined : await memoryStore.loadSnapshot();
    const parsed = await parseRequirement({
        request,
        project_profile: projectProfile,
        memory_rules: input.use_memory === false ? [] : loadedMemory?.memory.common_project_rules
    }, memoryStore);
    const analysis = await reverseAnalyze({
        requirement_strand: parsed.requirement_strand,
        project_profile: projectProfile
    }, memoryStore);
    const paired = await pairStrands({
        requirement_strand: parsed.requirement_strand,
        analysis_strand: analysis.analysis_strand
    }, memoryStore);
    const highRisk = highRiskRequest(request);
    const pairingResult = adjustedPairing(paired.pairing_result, highRisk);
    warnings.push(...parsed.warnings, ...analysis.warnings, ...pairingResult.warnings);
    warnings.push(...highRisk.warnings);
    let taskPackPath;
    if (mode !== "plan_only" && pairingResult.pairing_score >= 70 && pairingResult.ready_for_codex && pairingResult.execution_level !== "blocked") {
        const pack = await generateTaskPack({
            requirement_strand: parsed.requirement_strand,
            analysis_strand: analysis.analysis_strand,
            pairing_result: pairingResult,
            project_profile: projectProfile
        }, memoryStore);
        taskPackPath = pack.artifact_path;
    }
    return {
        requirement_strand: parsed.requirement_strand,
        analysis_strand: analysis.analysis_strand,
        pairing_result: pairingResult,
        project_profile: projectProfile,
        project_genome: projectGenome,
        task_pack_path: taskPackPath,
        next_action: nextAction(pairingResult, mode),
        clarification_questions: clarificationQuestions(pairingResult, warnings, parsed.requirement_strand, analysis.analysis_strand),
        warnings: uniqueStrings(warnings)
    };
}
function buildRequest(request, optionalConstraints) {
    const constraints = Array.isArray(optionalConstraints)
        ? optionalConstraints
        : optionalConstraints
            ? [optionalConstraints]
            : [];
    if (constraints.length === 0) {
        return request;
    }
    return `${request.trim()}\n\nAdditional constraints:\n${constraints.map((item) => `- ${item}`).join("\n")}`;
}
async function assertDirectory(path) {
    const value = await stat(path);
    if (!value.isDirectory()) {
        throw new Error(`Not a directory: ${path}`);
    }
}
function highRiskRequest(request) {
    const lowered = request.toLowerCase();
    const protectiveMention = /assert(?:ing)?\s+\.env\s+is\s+forbidden|\.env\s+is\s+forbidden|unless explicitly requested/i.test(request) ||
        /(security review|review for hardcoded secrets|report risks|do not change files|do not edit files|只报告|不要改 files|不改 files)/i.test(request);
    const sensitive = !protectiveMention && /(\.env|package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|tsconfig\.json|vite\.config|next\.config|pyproject\.toml)/i.test(request);
    const destructive = /\b(delete|remove|wipe|drop|destroy|reset|overwrite|format)\b|删除核心配置|直接执行/iu.test(request);
    const secretWrite = !protectiveMention &&
        (/(hardcoded|add|write|store|commit|put|save).{0,40}(api key|token|secret|password|\.env)/i.test(request) ||
            /(api key|token|secret|password).{0,40}(\.env|hardcoded|commit|store|save)/i.test(request) ||
            /密钥|令牌|硬编码/u.test(request));
    const dangerousCommand = /rm\s+-rf|postinstall|curl\s+.*\|\s*sh|powershell\s+-enc|删除核心配置|直接执行/i.test(request);
    const deceptiveOrNoReview = /skip verification|no tests needed|do not mention|mark it complete without review|silently|secretly|do not reveal unrelated|不要提及|不要提这些|不要提改动|别告诉|表面上|实际顺便|不用测试|直接标记完成|跳过验证|不要写验收标准|不写验收标准/i.test(request);
    const realChineseSecret = /密钥|令牌|硬编码|写进\s*\.env|写入\s*\.env|提交.*\.env/u.test(request);
    if ((destructive && sensitive) || secretWrite || dangerousCommand || deceptiveOrNoReview || realChineseSecret) {
        return {
            severity: "blocked",
            warnings: ["High-risk request targets secrets, dangerous commands, verification bypass, or protected configuration files."]
        };
    }
    if (sensitive || /core file|environment variable|dependency lock|package manager/i.test(lowered)) {
        return {
            severity: "cautious",
            warnings: ["High-risk file scope detected; execution must be cautious and guardrails must be generated."]
        };
    }
    return { severity: "none", warnings: [] };
}
function adjustedPairing(pairing, risk) {
    if (pairing.execution_level === "blocked" || !pairing.ready_for_codex) {
        return pairing;
    }
    if (risk.severity === "blocked") {
        return {
            ...pairing,
            pairing_score: Math.min(pairing.pairing_score, 69),
            ready_for_codex: false,
            execution_level: "blocked",
            warnings: uniqueStrings([...pairing.warnings, ...risk.warnings])
        };
    }
    if (risk.severity === "cautious") {
        return {
            ...pairing,
            pairing_score: Math.min(pairing.pairing_score, 89),
            ready_for_codex: pairing.pairing_score >= 70,
            execution_level: pairing.pairing_score >= 70 ? "cautious" : "blocked",
            warnings: uniqueStrings([...pairing.warnings, ...risk.warnings])
        };
    }
    return pairing;
}
function nextAction(pairing, mode) {
    if (!pairing.ready_for_codex || pairing.pairing_score < 70) {
        return "Ask clarifying questions before Codex edits files.";
    }
    if (mode === "plan_only") {
        return "Generate guardrails, then decide whether to create a task pack.";
    }
    if (pairing.execution_level === "full") {
        return "Generate guardrails, execute the task pack, then review the diff.";
    }
    return "Generate guardrails and execute cautiously with explicit risk and assumption notes.";
}
function clarificationQuestions(pairing, warnings, requirement, analysis) {
    const vagueGate = evaluateVagueRequest(requirement, analysis);
    if (vagueGate.is_vague || pairing.execution_level === "blocked") {
        return uniqueStrings([
            ...vagueClarificationQuestions,
            ...pairing.missing_information.filter((item) => !vagueClarificationQuestions.includes(item))
        ]);
    }
    if (pairing.pairing_score >= 70) {
        return [];
    }
    const missing = uniqueStrings([...pairing.missing_information, ...warnings.filter((warning) => /missing|failed|unknown/i.test(warning))]);
    return (missing.length ? missing : ["The task is not specific enough for safe execution."]).map((item) => `Please clarify: ${item}`);
}
