import { sanitizeFilename, timestampedName } from "../storage/jsonStore.js";
import { uniqueStrings } from "./common.js";
export async function generateTestPlan(input, memoryStore) {
    const taskType = input.task_type ?? inferTaskType(input);
    const testPlanId = `test-plan-${Date.now()}-${sanitizeFilename(input.requirement_strand.core_goal, "task")}`;
    const plan = {
        test_plan_id: testPlanId,
        manual_test_steps: manualSteps(taskType, input),
        automated_test_suggestions: automatedSuggestions(taskType, input),
        edge_cases: edgeCases(taskType, input),
        failure_cases: failureCases(taskType, input),
        regression_scope: regressionScope(taskType, input),
        required_commands: requiredCommands(input),
        acceptance_checklist: acceptanceChecklist(input),
        missing_test_warning: missingTestWarning(input)
    };
    const markdown = renderTestPlan(taskType, plan, input);
    let testPlanPath;
    if (input.save !== false) {
        testPlanPath = await memoryStore.saveMarkdown(`test-plans/${timestampedName(input.requirement_strand.core_goal, ".test_plan.md")}`, markdown);
    }
    return {
        ...plan,
        test_plan_markdown: markdown,
        test_plan_path: testPlanPath
    };
}
function inferTaskType(input) {
    const text = `${input.requirement_strand.original_request} ${input.analysis_strand.required_modules.join(" ")}`.toLowerCase();
    if (/api|endpoint|route|controller|auth|request|response/.test(text)) {
        return "api";
    }
    if (/bug|fix|error|regression|broken/.test(text)) {
        return "bug_fix";
    }
    if (/refactor|restructure|cleanup|migration/.test(text)) {
        return "refactor";
    }
    if (/ui|page|screen|component|style|layout|visual/.test(text)) {
        return "ui";
    }
    return "general";
}
function manualSteps(taskType, input) {
    const base = ["Confirm the implemented behavior satisfies the original request.", "Check every acceptance criterion manually if automated coverage is unavailable."];
    const typed = {
        ui: [
            "Perform a visual check for layout, spacing, typography, and state consistency.",
            "Perform interaction checks for inputs, buttons, loading states, and errors.",
            "Perform responsive checks at mobile, tablet, and desktop widths."
        ],
        api: [
            "Exercise the successful API path with valid input.",
            "Exercise authentication or authorization behavior where applicable.",
            "Check response status, body shape, and error messages."
        ],
        bug_fix: [
            "Reproduce the original bug before applying the fix when possible.",
            "Verify the bug no longer reproduces after the fix.",
            "Check the nearest related workflow for regressions."
        ],
        refactor: [
            "Verify behavior is unchanged from the user perspective.",
            "Run smoke checks around modules touched by the refactor."
        ],
        general: ["Run the nearest manual workflow that covers the changed behavior."]
    };
    return uniqueStrings([...base, ...typed[taskType], ...input.analysis_strand.test_plan]);
}
function automatedSuggestions(taskType, input) {
    return uniqueStrings([
        input.project_profile?.framework.includes("Vitest") || input.project_profile?.package_manager === "npm"
            ? "Add or update focused Vitest/Jest tests near changed TypeScript behavior."
            : "",
        input.project_profile?.language.includes("Python") ? "Add or update focused pytest coverage." : "",
        taskType === "ui" ? "Add component or route-level tests for visible states when the project has a frontend test setup." : "",
        taskType === "api" ? "Add request validation, success, failure, boundary, authentication, and exception tests." : "",
        taskType === "bug_fix" ? "Add a regression test that fails before the fix and passes after it." : "",
        taskType === "refactor" ? "Run existing regression tests for all affected modules." : ""
    ]);
}
function edgeCases(taskType, input) {
    return uniqueStrings([
        "Empty or missing input.",
        "Unexpected but valid input shape.",
        taskType === "ui" ? "Long text, narrow viewport, keyboard navigation, and focus states." : "",
        taskType === "api" ? "Boundary payload sizes, missing fields, invalid types, and expired credentials." : "",
        taskType === "bug_fix" ? "Original failure conditions and adjacent variants of the same failure." : "",
        taskType === "refactor" ? "All public entry points that depend on the refactored module." : "",
        ...input.requirement_strand.constraints.map((constraint) => `Constraint edge: ${constraint}`)
    ]);
}
function failureCases(taskType, _input) {
    return uniqueStrings([
        "Invalid input should fail safely with a clear result.",
        taskType === "api" ? "Unauthorized, forbidden, malformed, timeout, and upstream-error cases." : "",
        taskType === "ui" ? "Network error, validation error, loading state, disabled state, and empty state." : "",
        taskType === "bug_fix" ? "The original bug must not reappear under the known failure path." : "",
        taskType === "refactor" ? "No behavior changes or public contract breaks after the refactor." : ""
    ]);
}
function regressionScope(taskType, input) {
    return uniqueStrings([
        ...(input.changed_files ?? []),
        ...input.analysis_strand.affected_files,
        taskType === "refactor" ? "All imports and callers of refactored modules." : "",
        ...(input.project_genome?.risk_areas ?? [])
    ]);
}
function requiredCommands(input) {
    const profile = input.project_profile;
    return uniqueStrings([
        profile?.package_manager === "npm" ? "npm test" : "",
        profile?.package_manager === "npm" ? "npm run build" : "",
        profile?.package_manager === "pnpm" ? "pnpm test" : "",
        profile?.package_manager === "yarn" ? "yarn test" : "",
        profile?.language.includes("Python") ? "pytest" : "",
        ...input.analysis_strand.test_plan.filter((item) => /run|test|lint|build|verify/i.test(item))
    ]);
}
function acceptanceChecklist(input) {
    return uniqueStrings([
        ...input.requirement_strand.acceptance_criteria,
        "All user constraints are explicitly checked.",
        "Final summary includes commands run or manual checks performed."
    ]);
}
function missingTestWarning(input) {
    if (!input.project_profile || input.project_profile.test_dirs.length === 0) {
        return "No automated test directory was detected; include manual test evidence in the final response.";
    }
    return "";
}
function renderTestPlan(taskType, plan, input) {
    return `# CodeDNA Test Plan

Test Plan ID: ${plan.test_plan_id}
Task Type: ${taskType}

## Original Request

${input.requirement_strand.original_request}

## Manual Test Steps

${bullets(plan.manual_test_steps)}

## Automated Test Suggestions

${bullets(plan.automated_test_suggestions)}

## Edge Cases

${bullets(plan.edge_cases)}

## Failure Cases

${bullets(plan.failure_cases)}

## Regression Scope

${bullets(plan.regression_scope)}

## Required Commands

${bullets(plan.required_commands)}

## Acceptance Checklist

${bullets(plan.acceptance_checklist)}

## Missing Test Warning

${plan.missing_test_warning || "None"}
`;
}
function bullets(items) {
    return items.length ? items.map((item) => `- ${item}`).join("\n") : "- None";
}
