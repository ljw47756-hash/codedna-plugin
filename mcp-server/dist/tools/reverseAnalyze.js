import { nowIso, timestampedName } from "../storage/jsonStore.js";
import { uniqueStrings } from "./common.js";
export async function reverseAnalyze(input, memoryStore) {
    const requirement = input.requirement_strand;
    if (!requirement?.core_goal) {
        throw new Error("codedna_reverse_analyze requires a requirement_strand with core_goal.");
    }
    const profile = input.project_profile;
    const frameworks = profile?.framework ?? [];
    const languages = profile?.language ?? [];
    const recommendedFiles = affectedFiles(requirement, profile);
    const tests = testPlan(requirement, profile);
    const analysis = {
        technical_goal: technicalGoal(requirement, frameworks, languages),
        suggested_architecture: architecture(requirement, frameworks, languages),
        required_modules: requiredModules(requirement, frameworks),
        affected_files: recommendedFiles,
        implementation_steps: implementationSteps(requirement, recommendedFiles),
        risks: risks(requirement, profile),
        dependencies: dependencies(profile),
        test_plan: tests,
        rollback_plan: rollbackPlan(recommendedFiles),
        assumptions: assumptions(requirement, profile),
        created_at: nowIso()
    };
    let artifactPath;
    if (input.save !== false) {
        artifactPath = await memoryStore.saveArtifact(`strands/${timestampedName(requirement.core_goal, ".analysis.json")}`, analysis);
    }
    return {
        analysis_strand: analysis,
        artifact_path: artifactPath,
        warnings: analysis.assumptions.filter((item) => /unknown|not specified|No project scan/i.test(item))
    };
}
function technicalGoal(requirement, frameworks, languages) {
    const stack = [...frameworks, ...languages].slice(0, 5).join(", ") || "the existing project stack";
    return `Implement "${requirement.core_goal}" within ${stack} while keeping changes scoped, testable, and reviewable.`;
}
function architecture(requirement, frameworks, languages) {
    const items = [
        "Separate requirement interpretation, implementation planning, verification, and review output.",
        "Follow the existing project structure before adding new top-level directories.",
        "Prefer small modules with explicit inputs and outputs.",
        "Keep generated artifacts auditable as JSON or Markdown."
    ];
    if (frameworks.some((item) => ["React", "Next.js", "Vue", "Svelte", "Vite"].includes(item))) {
        items.push("For frontend work, keep UI state close to the affected route or component and preserve design-system conventions.");
    }
    if (frameworks.some((item) => ["FastAPI", "Django", "Flask", "Express"].includes(item))) {
        items.push("For API work, keep handlers thin and move reusable logic into services or domain modules.");
    }
    if (languages.includes("Python")) {
        items.push("For Python work, use pathlib for paths and dataclasses or typed models for structured data.");
    }
    if (requirement.preferences.length > 0) {
        items.push(`Reflect these user preferences where relevant: ${requirement.preferences.join("; ")}`);
    }
    return uniqueStrings(items);
}
function requiredModules(requirement, frameworks) {
    const text = [...requirement.features, ...requirement.preferences, requirement.core_goal].join(" ").toLowerCase();
    const modules = ["Requirement handling", "Implementation planning", "Verification", "Completion summary"];
    const map = [
        [/(ui|interface|page|screen|style|layout|visual)/iu, ["UI component", "Style layer"]],
        [/(api|route|endpoint|controller|request)/iu, ["API route", "Request validation"]],
        [/(login|auth|authentication|verification-code|password|session)/iu, ["Authentication flow", "Form validation", "Security review"]],
        [/(scan|scanner|project|profile)/iu, ["Project scanner", "Project profile persistence"]],
        [/(review|audit|diff|output|report)/iu, ["Review reporter", "Constraint checker"]],
        [/(test|verification|acceptance|verify|lint|build)/iu, ["Test planner", "Verification runner plan"]],
        [/(memory|preference|pattern|history|reuse)/iu, ["Memory evolution", "Reusable pattern capture"]]
    ];
    for (const [pattern, values] of map) {
        if (pattern.test(text)) {
            modules.push(...values);
        }
    }
    if (frameworks.length > 0) {
        modules.push(`${frameworks[0]} integration`);
    }
    return uniqueStrings(modules);
}
function affectedFiles(requirement, profile) {
    if (!profile) {
        return ["Scan the target project before selecting exact files."];
    }
    const items = [
        ...profile.entry_points.slice(0, 5),
        ...profile.component_dirs.slice(0, 8),
        ...profile.api_dirs.slice(0, 8)
    ];
    const request = requirement.original_request.toLowerCase();
    if (/(readme|docs|documentation)/iu.test(request)) {
        items.push("README.md", "docs/");
    }
    if (items.length === 0) {
        items.push(...profile.main_directories.slice(0, 8));
    }
    return uniqueStrings(items.length > 0 ? items : ["Inspect project structure before editing."]);
}
function risks(requirement, profile) {
    const items = [
        "Unrelated file changes would make the Codex result harder to review.",
        "Missing verification may hide regressions."
    ];
    items.push(...requirement.constraints.map((constraint) => `Constraint must be guarded: ${constraint}`));
    items.push(...requirement.unknowns.map((unknown) => `Unknown may affect execution: ${unknown}`));
    if (profile && profile.dependency_files.length === 0) {
        items.push("No dependency file was detected, so install and test commands may need manual confirmation.");
    }
    return uniqueStrings(items);
}
function dependencies(profile) {
    if (!profile) {
        return ["Existing project dependencies are unknown until scanning is complete."];
    }
    const items = profile.dependency_files.map((dependency) => `${dependency.path} (${dependency.kind})`);
    return items.length > 0 ? items : ["No standard dependency file detected."];
}
function testPlan(requirement, profile) {
    const items = [
        "Run the existing automated tests when available.",
        "Perform focused manual checks for the requested behavior.",
        "Confirm every constraint and non-goal remains respected."
    ];
    if (profile?.language.includes("Python") || profile?.framework.includes("pytest")) {
        items.push("For Python projects, run pytest or the closest existing project test command.");
    }
    if (profile?.framework.some((item) => ["React", "Next.js", "Vue", "Vite"].includes(item))) {
        items.push("For frontend projects, run lint/build and manually check the affected route or component.");
    }
    items.push(...requirement.acceptance_criteria.map((criterion) => `Verify acceptance criterion: ${criterion}`));
    return uniqueStrings(items);
}
function implementationSteps(requirement, affected) {
    const items = [
        "Read the target files and identify existing patterns before editing.",
        `Focus initial edits on: ${affected.slice(0, 8).join(", ")}`,
        "Implement the smallest coherent change that satisfies the feature request.",
        "Update or add tests only around changed behavior.",
        "Run verification and summarize exact results."
    ];
    if (requirement.constraints.length > 0) {
        items.splice(2, 0, `Check constraints before editing: ${requirement.constraints.slice(0, 5).join("; ")}`);
    }
    return uniqueStrings(items);
}
function rollbackPlan(affected) {
    return uniqueStrings([
        "Keep a clear list of files changed by Codex.",
        affected.length > 0 ? "If behavior regresses, revert only the files touched for this task." : "",
        "Preserve generated task and review artifacts for audit history."
    ]);
}
function assumptions(requirement, profile) {
    return uniqueStrings([
        "Codex will inspect files before editing them.",
        "The user wants scoped changes rather than broad refactors.",
        profile ? `The selected project root is ${profile.project_path}.` : "No project scan is available yet, so file recommendations are provisional.",
        ...requirement.unknowns
    ]);
}
