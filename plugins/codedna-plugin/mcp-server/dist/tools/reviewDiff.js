import { sanitizeFilename, timestampedName } from "../storage/jsonStore.js";
import { analyzeDiffRisk } from "./diffSafety.js";
export async function reviewDiff(input, memoryStore) {
    const risk = analyzeDiffRisk(input);
    const reviewId = reviewIdFrom(input.original_request);
    const nextPrompt = repairPrompt(input, risk.required_fixes);
    const review = {
        review_id: reviewId,
        modified_files: risk.changes.modified_files,
        added_files: risk.changes.added_files,
        deleted_files: risk.changes.deleted_files,
        forbidden_files_touched: risk.forbidden_files_touched,
        unrelated_changes: risk.unrelated_changes,
        dangerous_commands: risk.dangerous_commands,
        hardcoded_secrets: risk.hardcoded_secrets,
        api_keys: risk.api_keys,
        large_unrequested_refactor: risk.large_unrequested_refactor,
        missing_tests: risk.missing_tests,
        requirement_mismatch: risk.requirement_mismatch,
        architecture_risks: risk.architecture_risks,
        security_risks: risk.security_risks,
        performance_risks: risk.performance_risks,
        risk_level: risk.risk_level,
        required_fixes: risk.required_fixes,
        final_verdict: risk.final_verdict,
        next_codex_repair_prompt: nextPrompt
    };
    let artifactPath;
    if (input.save !== false) {
        artifactPath = await memoryStore.saveArtifact(`reviews/${timestampedName(input.original_request, ".diff_review.json")}`, review);
    }
    return { ...review, artifact_path: artifactPath };
}
function reviewIdFrom(request) {
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    return `codedna-diff-review-${stamp}-${sanitizeFilename(request, "diff")}`.slice(0, 150);
}
function repairPrompt(input, requiredFixes) {
    if (requiredFixes.length === 0) {
        return "No repair prompt is required. The diff appears ready for final human review.";
    }
    return `Please repair the previous Codex changes for this original request:

${input.original_request}

Only fix the issues listed below. Do not reimplement the entire feature and do not perform unrelated refactors.

Issues to fix:
${requiredFixes.map((item) => `- ${item}`).join("\n")}

Guardrails:
${input.guardrails ? input.guardrails.safety_rules.map((item) => `- ${item}`).join("\n") : "- Keep changes scoped to the requested behavior."}

Return a concise summary, files changed, verification evidence, and any remaining risks.`;
}
