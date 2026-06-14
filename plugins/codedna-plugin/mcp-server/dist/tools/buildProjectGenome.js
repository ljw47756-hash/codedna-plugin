import { readFile, readdir, stat } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { JsonStore, nowIso, sanitizeFilename } from "../storage/jsonStore.js";
import { uniqueStrings } from "./common.js";
import { scanProject } from "./scanProject.js";
const ignoreDirs = new Set([
    ".git",
    ".hg",
    ".svn",
    "node_modules",
    "dist",
    "build",
    ".venv",
    "venv",
    "env",
    "__pycache__",
    "coverage",
    ".next",
    "out",
    ".nuxt",
    "target"
]);
const sensitiveFiles = [
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lockb",
    "poetry.lock",
    "Pipfile.lock",
    "tsconfig.json",
    "vite.config.ts",
    "vite.config.js",
    "next.config.js",
    "next.config.mjs"
];
export async function buildProjectGenome(input, memoryStore) {
    const projectRoot = resolve(input.project_path);
    const rootStat = await stat(projectRoot);
    if (!rootStat.isDirectory()) {
        throw new Error(`codedna_build_project_genome requires a directory: ${projectRoot}`);
    }
    const profile = input.project_profile ?? (await scanProject({ project_path: projectRoot, save: input.save }, memoryStore)).project_profile;
    const files = await walkFiles(projectRoot);
    const existing = await readExistingGenome(projectRoot);
    const manualForbidden = Array.isArray(existing?.forbidden_zones) ? existing.forbidden_zones.map(String) : [];
    const genome = {
        ...(existing ?? {}),
        schema_version: 1,
        project_id: String(existing?.project_id ?? projectId(projectRoot, profile.project_name)),
        project_name: profile.project_name,
        project_root: projectRoot,
        project_type: projectTypes(profile, files),
        language: profile.language,
        framework: profile.framework,
        package_manager: profile.package_manager,
        architecture_style: architectureStyles(profile, files),
        entry_points: profile.entry_points,
        routing_files: routingFiles(projectRoot, files),
        api_files: apiFiles(projectRoot, files, profile),
        component_dirs: profile.component_dirs,
        state_management_files: stateManagementFiles(projectRoot, files),
        config_files: profile.config_files,
        test_dirs: profile.test_dirs,
        test_strategy: testStrategy(profile),
        safe_edit_zones: safeEditZones(profile),
        forbidden_zones: uniqueStrings([...profile.do_not_touch, ...sensitiveFilesPresent(files), ...manualForbidden]).sort(),
        detected_patterns: detectedPatterns(profile, files),
        dependency_files: profile.dependency_files,
        risk_areas: riskAreas(profile, files),
        recommended_codex_rules: recommendedRules(profile),
        tree_summary: profile.tree_summary.slice(0, 300),
        last_scanned_at: nowIso()
    };
    const store = new JsonStore(projectRoot);
    const artifactPath = input.save === false
        ? store.path(".codedna/project-genome.json")
        : await store.writeJson(".codedna/project-genome.json", genome);
    return {
        project_genome: genome,
        artifact_path: artifactPath,
        warnings: warnings(profile, files)
    };
}
async function walkFiles(root) {
    const result = [];
    async function visit(directory) {
        const entries = await readdir(directory, { withFileTypes: true });
        for (const entry of entries) {
            if (ignoreDirs.has(entry.name)) {
                continue;
            }
            const fullPath = join(directory, entry.name);
            if (entry.isDirectory()) {
                await visit(fullPath);
            }
            else if (entry.isFile()) {
                result.push(fullPath);
            }
        }
    }
    await visit(root);
    return result;
}
async function readExistingGenome(projectRoot) {
    try {
        const text = await readFile(join(projectRoot, ".codedna", "project-genome.json"), "utf8");
        return JSON.parse(text);
    }
    catch {
        return undefined;
    }
}
function projectId(projectRoot, name) {
    return sanitizeFilename(`${name}-${projectRoot.toLowerCase()}`, "project");
}
function projectTypes(profile, files) {
    const types = [];
    if (profile.framework.includes("Next.js")) {
        types.push("Next.js");
    }
    if (profile.framework.includes("React") && profile.language.includes("TypeScript")) {
        types.push("React + TypeScript");
    }
    if (profile.framework.includes("Vue")) {
        types.push("Vue");
    }
    if (profile.package_manager === "npm" && files.some((file) => /(^|[\\/])bin[\\/]|cli\.[jt]s$/i.test(file))) {
        types.push("Node CLI");
    }
    if (profile.framework.includes("FastAPI")) {
        types.push("Python FastAPI");
    }
    if (profile.framework.includes("Qt for Python")) {
        types.push("Python GUI project");
    }
    if (isMcpServer(profile, files)) {
        types.push("MCP server project");
    }
    if (profile.language.length > 1) {
        types.push("Mixed project");
    }
    if (profile.language.length === 0 && files.length === 0) {
        types.push("Empty project");
    }
    return uniqueStrings(types.length ? types : ["General code project"]);
}
function isMcpServer(profile, files) {
    return (profile.dependency_files.some((file) => file.packages.includes("@modelcontextprotocol/sdk")) ||
        files.some((file) => /(^|[\\/])server\.ts$/i.test(file) && /mcp|server/i.test(file)));
}
function architectureStyles(profile, files) {
    return uniqueStrings([
        profile.framework.includes("Next.js") && files.some((file) => toRelative(profile.project_path, file).startsWith("src/app/"))
            ? "Next.js App Router"
            : "",
        profile.component_dirs.length > 0 ? "Component-based UI" : "",
        profile.api_dirs.length > 0 ? "API route/service modules" : "",
        isMcpServer(profile, files) ? "MCP stdio server" : "",
        profile.framework.includes("FastAPI") ? "FastAPI route/service layout" : "",
        profile.framework.includes("Qt for Python") ? "Python GUI event-driven layout" : "",
        profile.test_dirs.length > 0 ? "Test directory present" : ""
    ]);
}
function routingFiles(root, files) {
    return files
        .map((file) => toRelative(root, file))
        .filter((file) => /(^|\/)(page|layout|router|routes?|route)\.(tsx|ts|jsx|js|py)$|^pages\/|^src\/pages\//i.test(file))
        .sort()
        .slice(0, 80);
}
function apiFiles(root, files, profile) {
    const apiDirs = profile.api_dirs;
    return files
        .map((file) => toRelative(root, file))
        .filter((file) => apiDirs.some((dir) => file.startsWith(`${dir}/`)) || /(^|\/)(api|routes?|controllers?)\//i.test(file))
        .sort()
        .slice(0, 100);
}
function stateManagementFiles(root, files) {
    return files
        .map((file) => toRelative(root, file))
        .filter((file) => /(store|redux|zustand|context|state|reducer|slice)\.(tsx|ts|jsx|js|py)$|(^|\/)(stores?|state)\//i.test(file))
        .sort()
        .slice(0, 80);
}
function testStrategy(profile) {
    const items = [];
    if (profile.framework.includes("Vitest")) {
        items.push("Run Vitest for unit and component-level tests.");
    }
    if (profile.framework.includes("pytest") || profile.language.includes("Python")) {
        items.push("Run pytest or the project's Python test command.");
    }
    if (profile.framework.includes("Next.js") || profile.framework.includes("React") || profile.framework.includes("Vue")) {
        items.push("Run frontend build/lint checks and focused UI manual verification.");
    }
    if (profile.test_dirs.length === 0) {
        items.push("No test directory detected; include manual verification steps.");
    }
    return uniqueStrings(items.length ? items : ["Use the existing project test command when available."]);
}
function safeEditZones(profile) {
    return uniqueStrings([
        ...profile.component_dirs,
        ...profile.api_dirs,
        ...profile.test_dirs,
        ...profile.main_directories.filter((dir) => ["src", "app", "lib", "packages", "tests"].includes(basename(dir).toLowerCase()))
    ]).sort();
}
function sensitiveFilesPresent(files) {
    const names = new Set(files.map((file) => basename(file)));
    return sensitiveFiles.filter((name) => names.has(name));
}
function detectedPatterns(profile, files) {
    return uniqueStrings([
        profile.framework.includes("Next.js") ? "File-system routing" : "",
        profile.component_dirs.length > 0 ? "Reusable component directories" : "",
        profile.api_dirs.length > 0 ? "Dedicated API/service directories" : "",
        stateManagementFiles(profile.project_path, files).length > 0 ? "State management files detected" : "",
        profile.dependency_files.length > 0 ? "Dependency manifest driven project" : "",
        profile.test_dirs.length > 0 ? "Automated test area detected" : ""
    ]);
}
function riskAreas(profile, files) {
    return uniqueStrings([
        ...sensitiveFilesPresent(files).map((file) => `Sensitive file: ${file}`),
        profile.do_not_touch.length ? "Protected dependency/build/cache paths exist." : "",
        profile.test_dirs.length === 0 ? "No automated test directory detected." : "",
        profile.dependency_files.length === 0 ? "No dependency manifest detected." : ""
    ]);
}
function recommendedRules(profile) {
    return uniqueStrings([
        "Read Project Genome before planning broad edits.",
        "Generate guardrails before asking Codex to modify files.",
        "Keep changes inside safe_edit_zones unless the user explicitly expands scope.",
        "Never modify forbidden_zones without explicit user permission.",
        profile.test_dirs.length > 0 ? "Run or update focused tests for changed behavior." : "Provide manual verification steps when automated tests are unavailable.",
        "Review final diff with codedna_review_diff before accepting the result."
    ]);
}
function warnings(profile, files) {
    return uniqueStrings([
        files.length > 300 ? "Large project detected; Project Genome stores a bounded summary." : "",
        profile.test_dirs.length === 0 ? "No test directory was detected." : "",
        profile.language.length === 0 ? "No primary source language was detected." : ""
    ]);
}
function toRelative(root, file) {
    return relative(root, file).replace(/\\/g, "/");
}
