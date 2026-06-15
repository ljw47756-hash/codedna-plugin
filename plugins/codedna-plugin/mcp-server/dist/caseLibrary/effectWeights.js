import { tokens, uniqueStrings } from "../tools/common.js";
export const basePairWeights = {
    "Goal <-> Task": 20,
    "Constraint <-> Risk": 18,
    "Preference <-> Pattern": 14,
    "Feature <-> Module": 20,
    "Acceptance <-> Test": 18,
    "Memory <-> Reuse": 10
};
const familyToPairType = {
    "planning-and-mode-boundaries": "Goal <-> Task",
    "guardrails-and-risk-control": "Constraint <-> Risk",
    "documentation-and-operational-clarity": "Acceptance <-> Test",
    "plugin-installation-diagnostics": "Constraint <-> Risk",
    "mcp-diagnostics": "Feature <-> Module",
    "task-decomposition-not-runtime-agents": "Feature <-> Module",
    "review-diff-and-repair": "Acceptance <-> Test",
    "memory-and-session-continuity": "Memory <-> Reuse",
    "project-context-and-diagnostics": "Feature <-> Module",
    "configuration-and-health-reports": "Constraint <-> Risk",
    "skill-routing-and-health": "Preference <-> Pattern",
    "clear-user-feedback": "Preference <-> Pattern",
    "task-lifecycle-and-case-records": "Memory <-> Reuse",
    "git-and-pr-awareness": "Constraint <-> Risk"
};
export function activateEffects(library, query, inferredFamilies, limit = 10) {
    const queryTokens = [...tokens(query)];
    return library.effects
        .map((effect) => ({ effect, score: scoreEffect(effect, query, queryTokens, inferredFamilies) }))
        .filter((item) => item.score > 0)
        .sort((left, right) => right.score - left.score || left.effect.id.localeCompare(right.effect.id))
        .slice(0, limit)
        .map(({ effect, score }) => ({
        id: effect.id,
        effect_family: effect.effect_family,
        fit: effect.fit,
        activation_surface: effect.activation_surface,
        codedna_target: effect.codedna_target,
        pair_type: pairTypeForFamily(effect.effect_family),
        weight: roundWeight(score + fitWeight(effect.fit)),
        matched_terms: matchedTerms(effect, queryTokens, inferredFamilies),
        summary: effect.summary,
        codedna_pattern: effect.codedna_pattern,
        guardrail: effect.guardrail
    }));
}
export function ruleWeightAdjustments(activatedEffects) {
    return Object.entries(basePairWeights).map(([pairType, baseWeight]) => {
        const related = activatedEffects.filter((effect) => effect.pair_type === pairType);
        const boost = Math.min(6, related.reduce((sum, effect) => sum + effect.weight, 0) / 2.5);
        return {
            pair_type: pairType,
            base_weight: baseWeight,
            adjusted_weight: Math.round((baseWeight + boost) * 100) / 100,
            activated_effect_ids: related.map((effect) => effect.id)
        };
    });
}
export function scoreAdjustmentFromEffects(activatedEffects, missingCount, unmatchedCount) {
    if (activatedEffects.length === 0) {
        return 0;
    }
    const positive = Math.min(7, activatedEffects.reduce((sum, effect) => sum + effect.weight, 0) / 4);
    const uncertaintyPenalty = Math.min(4, missingCount * 1.25 + unmatchedCount * 0.5);
    return Math.round((positive - uncertaintyPenalty) * 100) / 100;
}
export function dnaAlignment(score) {
    return {
        requirement_strand: "User Requirement Strand",
        pairing_review: "Bidirectional Pairing Review",
        analysis_strand: "Reverse Analysis Strand",
        execution_layer: "Codex Task Pack",
        feedback_layer: "Reverse Review",
        evolution_layer: "Memory Evolution",
        flow: [
            "用户需求链",
            "配对审查",
            "反向解析链",
            "Codex 任务包",
            "代码执行",
            "反向审查",
            "记忆进化"
        ],
        gate_status: score >= 90 ? "ready" : score >= 70 ? "cautious" : "blocked"
    };
}
export function codexAssistanceSteps(score) {
    const gate = score >= 70 ? "Use after this CodeDNA stage completes." : "Use after the user answers missing information.";
    return [
        {
            stage: "Requirement Strand",
            codex_role: "Clarify intent and preserve the original request verbatim.",
            prompt: "Use the Requirement Strand to restate the goal, constraints, preferences, acceptance criteria, and unknowns before editing.",
            expected_output: "A concise confirmation of what will and will not be done.",
            use_when: "Before reverse analysis or when the request contains correction, phased, or privacy-sensitive language."
        },
        {
            stage: "Pairing Review",
            codex_role: "Judge whether Requirement and Analysis are aligned enough for execution.",
            prompt: "Use pairing_score, unmatched_pairs, missing_information, activated_effects, and case_recall to decide full, cautious, or blocked execution.",
            expected_output: "A go, cautious-go, or clarification decision with reasons.",
            use_when: gate
        },
        {
            stage: "Codex Task Pack",
            codex_role: "Turn the paired DNA strands into a concrete implementation brief.",
            prompt: "Follow the task pack exactly: scope, files, steps, risks, tests, and final response format.",
            expected_output: "A scoped implementation plan or edit set with verification evidence.",
            use_when: "When pairing_score is 70 or higher."
        },
        {
            stage: "Reverse Review",
            codex_role: "Inspect the result against the original request and guardrails.",
            prompt: "Compare the diff or output against Requirement Strand, forbidden scope, risks, tests, and relevant failure patterns.",
            expected_output: "A pass, warning, needs-fix, or blocked verdict plus a repair prompt if needed.",
            use_when: "After Codex produces code, a diff, logs, or a summary."
        },
        {
            stage: "Memory Evolution",
            codex_role: "Propose learning without silently writing long-term memory.",
            prompt: "Only propose memory updates from confirmed preferences, repeated successful patterns, or rejected patterns; wait for user confirmation.",
            expected_output: "A memory proposal or no-memory-needed decision.",
            use_when: "After review or when the user explicitly expresses a preference."
        }
    ];
}
export function scoreExplanation(baseScore, finalScore, activatedEffects, caseCounts, adjustment) {
    return [
        `Base double-strand pairing score: ${baseScore}.`,
        `Activated ${activatedEffects.length} CodeDNA effect rule(s) as auxiliary weights; score adjustment: ${adjustment >= 0 ? "+" : ""}${adjustment}.`,
        `Recalled ${caseCounts.success} success pattern(s), ${caseCounts.failure} failure pattern(s), and ${caseCounts.public} public reference pattern(s).`,
        `Final score after bounded DNA evidence adjustment: ${finalScore}.`
    ];
}
function scoreEffect(effect, query, queryTokens, families) {
    let score = 0;
    const effectText = [
        effect.effect_family,
        effect.activation_surface,
        effect.codedna_target,
        effect.summary,
        effect.adapted_behavior,
        effect.codedna_pattern,
        effect.guardrail,
        effect.tags.join(" ")
    ].join(" ").toLocaleLowerCase();
    for (const token of queryTokens) {
        if (effectText.includes(token.toLocaleLowerCase())) {
            score += token.length > 2 ? 0.35 : 0.12;
        }
    }
    if (families.includes(effect.effect_family)) {
        score += 4;
    }
    if (/不要|禁止|避免|do not|avoid|forbid|risk|guardrail/i.test(query) && effect.effect_family.includes("guardrails")) {
        score += 1;
    }
    if (/继续|阶段|phase|wait/i.test(query) && effect.effect_family.includes("planning")) {
        score += 1;
    }
    if (/记忆|memory|evolution/i.test(query) && effect.effect_family.includes("memory")) {
        score += 1;
    }
    return score;
}
function matchedTerms(effect, queryTokens, families) {
    const effectText = `${effect.effect_family} ${effect.tags.join(" ")} ${effect.codedna_pattern}`.toLocaleLowerCase();
    return uniqueStrings([
        ...families.filter((family) => family === effect.effect_family),
        ...queryTokens.filter((token) => effectText.includes(token.toLocaleLowerCase())).slice(0, 8)
    ]);
}
function pairTypeForFamily(family) {
    return familyToPairType[family] ?? "Goal <-> Task";
}
function fitWeight(fit) {
    if (fit === "strong") {
        return 1.8;
    }
    if (fit === "medium") {
        return 1.1;
    }
    return 0.7;
}
function roundWeight(value) {
    return Math.round(value * 100) / 100;
}
