import { nowIso, timestampedName } from "../storage/jsonStore.js";
import { containsAny, normalizeText, splitClauses, splitSentences, uniqueStrings } from "./common.js";
const featureHints = [
    "add",
    "build",
    "create",
    "generate",
    "implement",
    "support",
    "scan",
    "save",
    "review",
    "page",
    "screen",
    "feature",
    "module",
    "workflow",
    "tool",
    "integration",
    "repair",
    "fix"
];
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
    "must not"
];
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
    "consistent"
];
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
    "expected",
    "criteria"
];
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
    const memoryRules = input.memory_rules?.length
        ? uniqueStrings(input.memory_rules)
        : await memoryStore.relatedRules(request);
    if (coreGoal && !features.includes(coreGoal)) {
        features.unshift(coreGoal);
    }
    if (acceptanceCriteria.length === 0) {
        acceptanceCriteria = defaultAcceptance(features, constraints);
    }
    const requirement = {
        original_request: input.request.trim(),
        core_goal: coreGoal,
        features: uniqueStrings(features),
        constraints: uniqueStrings(constraints),
        preferences: uniqueStrings(preferences),
        acceptance_criteria: uniqueStrings(acceptanceCriteria),
        unknowns: unknowns(request, input.project_profile, features),
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
    return sentences[0].replace(/^(please|help me|could you|can you)\s*/iu, "").slice(0, 240);
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
function unknowns(request, projectProfile, features) {
    const missing = [];
    if (!projectProfile) {
        missing.push("Target project directory has not been scanned yet.");
    }
    if (!/(test|pytest|verification|verify|acceptance|lint|build)/iu.test(request)) {
        missing.push("Preferred verification command is not specified.");
    }
    if (!/(file|directory|path|page|screen|component|api|route|module)/iu.test(request)) {
        missing.push("Exact files or modules to modify are not fully specified.");
    }
    if (features.length <= 1 && request.length < 80) {
        missing.push("Feature scope may need more detail before implementation.");
    }
    return uniqueStrings(missing);
}
function priority(request, constraints) {
    if (/(urgent|asap|immediately|today|high priority)/iu.test(request)) {
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
