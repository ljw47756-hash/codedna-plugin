import { sanitizeFilename, timestampedName } from "../storage/jsonStore.js";
import { uniqueStrings } from "./common.js";
export async function generateRepairTask(input, memoryStore) {
    const issues = issuesToFix(input);
    const repairTaskId = `repair-${Date.now()}-${sanitizeFilename(input.original_request, "task")}`;
    const filesForbidden = uniqueStrings([
        ...(input.diff_review?.forbidden_files_touched ?? []),
        ...(input.guardrails_validation?.touched_forbidden_files ?? []),
        ...(input.project_genome?.forbidden_zones ?? []),
        ...(input.project_profile?.do_not_touch ?? [])
    ]).sort();
    const filesAllowed = uniqueStrings([
        ...(input.guardrails_validation?.touched_allowed_files ?? []),
        ...(input.project_genome?.safe_edit_zones ?? []),
        ...(input.project_profile?.component_dirs ?? []),
        ...(input.project_profile?.api_dirs ?? []),
        ...(input.project_profile?.test_dirs ?? [])
    ]).sort();
    const testsRequired = testsRequiredFor(input);
    const plan = fixPlan(issues);
    const markdown = renderRepairTask({
        originalRequest: input.original_request,
        repairTaskId,
        issues,
        filesAllowed,
        filesForbidden,
        plan,
        testsRequired,
        safetyRules: safetyRules(filesForbidden),
        rollbackNotes: rollbackNotes(input)
    });
    let repairTaskPath;
    if (input.save !== false) {
        repairTaskPath = await memoryStore.saveMarkdown(`tasks/${timestampedName(input.original_request, ".repair_task.md")}`, markdown);
    }
    return {
        repair_task_id: repairTaskId,
        repair_goal: "Fix only the issues identified by CodeDNA review without reimplementing the full feature.",
        issues_to_fix: issues,
        files_allowed: filesAllowed,
        files_forbidden: filesForbidden,
        step_by_step_fix_plan: plan,
        tests_required: testsRequired,
        safety_rules: safetyRules(filesForbidden),
        rollback_notes: rollbackNotes(input),
        final_response_format: finalResponseFormat(),
        repair_task_markdown: markdown,
        repair_task_path: repairTaskPath
    };
}
function issuesToFix(input) {
    const reviewChecks = Array.isArray(input.review_report?.checks)
        ? (input.review_report.checks ?? [])
            .filter((check) => check.status !== "pass")
            .map((check) => `${String(check.name ?? "Review issue")}: ${String(check.detail ?? "")}`)
        : [];
    return uniqueStrings([
        ...reviewChecks,
        ...(input.diff_review?.required_fixes ?? []),
        ...(input.guardrails_validation?.violations ?? []),
        ...(input.guardrails_validation?.warnings ?? []),
        input.diff_review?.missing_tests.length ? "Add missing tests or explicit verification evidence." : "",
        input.diff_review?.hardcoded_secrets.length ? "Remove plaintext secret values and replace them with environment-based configuration." : "",
        input.diff_review?.forbidden_files_touched.length ? "Restore or revert forbidden file changes." : ""
    ]);
}
function testsRequiredFor(input) {
    return uniqueStrings([
        ...(input.guardrails_validation?.missing_required_tests ?? []),
        ...(input.diff_review?.missing_tests ?? []),
        input.project_profile?.package_manager === "npm" ? "npm test or the nearest existing npm verification command" : "",
        input.project_profile?.language.includes("Python") ? "pytest or the nearest existing Python verification command" : ""
    ]);
}
function fixPlan(issues) {
    return uniqueStrings([
        "Inspect the previous diff and the CodeDNA findings before editing.",
        issues.some((issue) => /forbidden/i.test(issue)) ? "Restore or revert forbidden file changes before making any other fix." : "",
        issues.some((issue) => /secret|api key|token|password/i.test(issue))
            ? "Remove hardcoded secret material and use environment-based configuration or documented sample values."
            : "",
        issues.some((issue) => /test|verification/i.test(issue)) ? "Add focused tests or explicit verification steps for the changed behavior." : "",
        "Fix only the listed review findings.",
        "Run required verification commands or explain exactly why they cannot be run.",
        "Return a concise changed-file summary, verification evidence, and remaining risks."
    ]);
}
function safetyRules(filesForbidden) {
    return [
        "Do not reimplement the entire feature.",
        "Do not perform unrelated refactors.",
        "Only fix issues explicitly listed in this repair task.",
        filesForbidden.length ? `Do not edit forbidden files: ${filesForbidden.join(", ")}` : "Do not edit files outside the focused repair scope."
    ];
}
function rollbackNotes(input) {
    return uniqueStrings([
        "If the repair increases scope, stop and ask for clarification.",
        input.diff_review?.forbidden_files_touched.length ? "Use the prior version to restore forbidden files before continuing." : "",
        "Keep review artifacts so the next CodeDNA pass can compare before and after states."
    ]);
}
function renderRepairTask(input) {
    return `# CodeDNA Repair Task

Repair Task ID: ${input.repairTaskId}

## Original Request

${input.originalRequest}

## Repair Goal

Fix only the issues identified by CodeDNA review. Do not reimplement the entire feature.

## Issues To Fix

${bullets(input.issues)}

## Files Allowed

${bullets(input.filesAllowed)}

## Files Forbidden

${bullets(input.filesForbidden)}

## Step By Step Fix Plan

${numbered(input.plan)}

## Tests Required

${bullets(input.testsRequired)}

## Safety Rules

${bullets(input.safetyRules)}

## Rollback Notes

${bullets(input.rollbackNotes)}

## Final Response Format

\`\`\`markdown
${finalResponseFormat()}
\`\`\`
`;
}
function finalResponseFormat() {
    return `Summary:
- <focused repair summary>

Files Changed:
- <path>: <repair reason>

Verification:
- <command or manual check>: <result>

Remaining Risks:
- <risk or None>`;
}
function bullets(items) {
    return items.length ? items.map((item) => `- ${item}`).join("\n") : "- None";
}
function numbered(items) {
    return items.length ? items.map((item, index) => `${index + 1}. ${item}`).join("\n") : "1. No repair steps generated.";
}
