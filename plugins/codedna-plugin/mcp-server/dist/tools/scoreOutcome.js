import { sanitizeFilename } from "../storage/jsonStore.js";
export async function scoreOutcome(input, _memoryStore) {
    const requirementMatchScore = requirementScore(input);
    const constraintComplianceScore = constraintScore(input);
    const codeQualityScore = codeQualityScoreFor(input);
    const testCoverageScore = testScore(input);
    const architectureConsistencyScore = architectureScore(input);
    const riskScore = riskScoreFor(input);
    const overall = Math.round(requirementMatchScore * 0.22 +
        constraintComplianceScore * 0.22 +
        codeQualityScore * 0.16 +
        testCoverageScore * 0.16 +
        architectureConsistencyScore * 0.14 +
        riskScore * 0.1);
    const finalVerdict = verdictFor({
        input,
        requirementMatchScore,
        constraintComplianceScore,
        testCoverageScore,
        overall
    });
    const reasons = scoreReasons(input, {
        requirementMatchScore,
        constraintComplianceScore,
        codeQualityScore,
        testCoverageScore,
        architectureConsistencyScore,
        riskScore,
        overall
    });
    return {
        outcome_score_id: `outcome-${Date.now()}-${sanitizeFilename(input.original_request, "task")}`,
        requirement_match_score: requirementMatchScore,
        constraint_compliance_score: constraintComplianceScore,
        code_quality_score: codeQualityScore,
        test_coverage_score: testCoverageScore,
        architecture_consistency_score: architectureConsistencyScore,
        risk_score: riskScore,
        overall_score: overall,
        final_verdict: finalVerdict,
        next_action: nextAction(finalVerdict, testCoverageScore, requirementMatchScore, constraintComplianceScore),
        score_reasons: reasons
    };
}
function requirementScore(input) {
    if (input.diff_review?.requirement_mismatch.length) {
        return 55;
    }
    const text = `${input.codex_output ?? ""} ${input.diff_review?.modified_files.join(" ") ?? ""}`.toLowerCase();
    const goal = input.requirement_strand?.core_goal || input.original_request;
    const terms = (goal.toLowerCase().match(/[a-z0-9_-]{4,}/g) ?? []).slice(0, 8);
    if (terms.length === 0) {
        return 75;
    }
    const hits = terms.filter((term) => text.includes(term)).length;
    return clampScore(65 + Math.round((hits / terms.length) * 35));
}
function constraintScore(input) {
    const forbidden = input.diff_review?.forbidden_files_touched.length ?? 0;
    const unrelated = input.diff_review?.unrelated_changes.length ?? 0;
    const blocked = input.diff_review?.final_verdict === "blocked";
    if (blocked) {
        return 30;
    }
    return clampScore(100 - forbidden * 30 - unrelated * 12);
}
function codeQualityScoreFor(input) {
    const risks = (input.diff_review?.architecture_risks.length ?? 0) + (input.diff_review?.performance_risks.length ?? 0);
    const refactorPenalty = input.diff_review?.large_unrequested_refactor ? 30 : 0;
    const reviewPenalty = reviewIssues(input.review_report) * 8;
    return clampScore(90 - risks * 12 - refactorPenalty - reviewPenalty);
}
function testScore(input) {
    if (input.diff_review?.missing_tests.length) {
        return 45;
    }
    const result = input.test_plan_result ?? {};
    const testsRun = Array.isArray(result.tests_run) ? result.tests_run.length : Array.isArray(result.commands_run) ? result.commands_run.length : 0;
    const passed = result.passed === true || /test.*pass|passed|verification.*pass/i.test(String(input.codex_output ?? ""));
    if (!passed && testsRun === 0) {
        return 40;
    }
    if (passed && testsRun > 0) {
        return 95;
    }
    if (passed) {
        return 80;
    }
    return 60;
}
function architectureScore(input) {
    if (input.diff_review?.large_unrequested_refactor) {
        return 55;
    }
    return clampScore(90 - (input.diff_review?.architecture_risks.length ?? 0) * 12);
}
function riskScoreFor(input) {
    if (input.diff_review?.final_verdict === "blocked") {
        return 10;
    }
    if (input.diff_review?.risk_level === "high") {
        return 45;
    }
    if (input.diff_review?.risk_level === "medium") {
        return 70;
    }
    return 90;
}
function verdictFor(input) {
    if (input.input.diff_review?.final_verdict === "blocked") {
        return "blocked";
    }
    if (input.requirementMatchScore < 70 || input.constraintComplianceScore < 70) {
        return "needs_fix";
    }
    if (input.testCoverageScore < 60 || input.overall < 80 || input.input.diff_review?.final_verdict === "needs_fix") {
        return "needs_fix";
    }
    if (input.overall < 90 || input.input.diff_review?.final_verdict === "pass_with_warnings") {
        return "pass_with_warnings";
    }
    return "pass";
}
function nextAction(verdict, testScoreValue, requirementScoreValue, constraintScoreValue) {
    if (verdict === "blocked") {
        return "Stop acceptance and generate a repair task for blocked safety or scope issues.";
    }
    if (requirementScoreValue < 70 || constraintScoreValue < 70) {
        return "Generate a repair task focused on requirement mismatch or constraint violations.";
    }
    if (testScoreValue < 60) {
        return "Add tests or manual verification evidence before accepting the result.";
    }
    if (verdict === "needs_fix") {
        return "Run a focused repair pass, then review the diff again.";
    }
    if (verdict === "pass_with_warnings") {
        return "Accept only after human review of warnings and verification evidence.";
    }
    return "Complete the task and optionally propose memory updates for stable lessons.";
}
function scoreReasons(input, scores) {
    const reasons = [
        `Requirement match score: ${scores.requirementMatchScore}.`,
        `Constraint compliance score: ${scores.constraintComplianceScore}.`,
        `Code quality score: ${scores.codeQualityScore}.`,
        `Test coverage score: ${scores.testCoverageScore}.`,
        `Architecture consistency score: ${scores.architectureConsistencyScore}.`,
        `Risk score: ${scores.riskScore}.`,
        `Overall score: ${scores.overall}.`
    ];
    if (input.diff_review?.final_verdict === "blocked") {
        reasons.push("Diff review was blocked, so final verdict must be blocked.");
    }
    if (scores.testCoverageScore < 60) {
        reasons.push("Test coverage score is below 60, so additional test or verification work is required.");
    }
    return reasons;
}
function reviewIssues(reviewReport) {
    const checks = reviewReport?.checks ?? [];
    return checks.filter((check) => check.status !== "pass").length;
}
function clampScore(value) {
    return Math.max(0, Math.min(100, Math.round(value)));
}
