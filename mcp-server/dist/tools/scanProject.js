import { readFile, readdir, stat } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";
import { nowIso } from "../storage/jsonStore.js";
import { uniqueStrings } from "./common.js";
const ignoreDirs = new Set([
    ".git",
    ".hg",
    ".svn",
    ".idea",
    ".vscode",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".venv",
    "venv",
    "env",
    "node_modules",
    "dist",
    "build",
    ".next",
    ".nuxt",
    "target",
    "coverage"
]);
const languageByExtension = {
    ".py": "Python",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".html": "HTML",
    ".css": "CSS",
    ".scss": "SCSS",
    ".java": "Java",
    ".go": "Go",
    ".rs": "Rust",
    ".cs": "C#",
    ".php": "PHP",
    ".rb": "Ruby",
    ".swift": "Swift",
    ".kt": "Kotlin"
};
const dependencyFileKinds = {
    "package.json": "node",
    "requirements.txt": "python",
    "pyproject.toml": "python",
    "poetry.lock": "python",
    "Pipfile": "python",
    "Cargo.toml": "rust",
    "go.mod": "go",
    "pom.xml": "java",
    "build.gradle": "java"
};
const configNames = new Set([
    ".env",
    ".env.local",
    ".gitignore",
    "tsconfig.json",
    "vite.config.ts",
    "vite.config.js",
    "next.config.js",
    "next.config.mjs",
    "tailwind.config.js",
    "tailwind.config.ts",
    "pyproject.toml",
    "pytest.ini",
    "ruff.toml",
    "mypy.ini",
    "setup.cfg"
]);
const protectedNames = new Set([
    ".env",
    ".env.local",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "poetry.lock",
    "Pipfile.lock",
    "Cargo.lock"
]);
export async function scanProject(input, memoryStore) {
    const root = resolve(input.project_path);
    const rootStat = await stat(root);
    if (!rootStat.isDirectory()) {
        throw new Error(`codedna_scan_project requires a directory: ${root}`);
    }
    const files = await walkFiles(root);
    const languageCounts = new Map();
    for (const file of files.filter((item) => !isConfigOnlyFile(item))) {
        const language = languageByExtension[extname(file)];
        if (language) {
            languageCounts.set(language, (languageCounts.get(language) ?? 0) + 1);
        }
    }
    const dependencyFiles = await Promise.all(files.filter((file) => dependencyFileKinds[basename(file)]).map((file) => readDependencyFile(root, file)));
    const framework = detectFrameworks(root, dependencyFiles, files);
    const profile = {
        project_path: root,
        project_name: basename(root),
        language: sortedLanguages(languageCounts),
        framework,
        package_manager: detectPackageManager(root, files, dependencyFiles),
        dependency_files: dependencyFiles,
        main_directories: await mainDirectories(root),
        entry_points: entryPoints(root, files),
        component_dirs: namedDirectories(root, files, new Set(["components", "component", "ui", "widgets", "pages", "views", "screens"])),
        api_dirs: namedDirectories(root, files, new Set(["api", "apis", "routes", "controllers", "endpoints", "services"])),
        config_files: files.filter((file) => configNames.has(basename(file))).map((file) => toRelative(root, file)).sort(),
        test_dirs: namedDirectories(root, files, new Set(["test", "tests", "__tests__", "spec", "specs"])),
        do_not_touch: protectedFiles(root, files),
        tree_summary: await treeSummary(root, input.max_depth ?? 3),
        notes: notes(languageCounts, framework, dependencyFiles),
        scanned_at: nowIso()
    };
    let artifactPath;
    if (input.save !== false) {
        artifactPath = await memoryStore.saveProjectProfile(profile);
    }
    return { project_profile: profile, artifact_path: artifactPath };
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
async function readDependencyFile(root, file) {
    const name = basename(file);
    let packages = [];
    try {
        const text = await readFile(file, "utf8");
        if (name === "package.json") {
            const data = JSON.parse(text);
            packages = Object.keys({ ...(data.dependencies ?? {}), ...(data.devDependencies ?? {}) }).sort();
        }
        else if (name === "requirements.txt") {
            packages = text
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter((line) => line && !line.startsWith("#"))
                .map((line) => line.split(/[<>=!~]/)[0].trim());
        }
        else if (name.endsWith(".toml")) {
            packages = text
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter((line) => line && !line.startsWith("#") && line.includes("="))
                .map((line) => line.split("=")[0].trim().replace(/^["']|["']$/g, ""))
                .filter((key) => !["name", "version", "description", "requires-python"].includes(key));
        }
    }
    catch {
        packages = [];
    }
    return {
        path: toRelative(root, file),
        kind: dependencyFileKinds[name] ?? "dependency",
        packages: uniqueStrings(packages)
    };
}
function detectFrameworks(root, dependencies, files) {
    const packages = new Set(dependencies.flatMap((dependency) => dependency.packages.map((item) => item.toLowerCase())));
    const frameworks = [];
    const checks = [
        ["React", ["react", "@vitejs/plugin-react"]],
        ["Next.js", ["next"]],
        ["Vue", ["vue", "@vitejs/plugin-vue"]],
        ["Nuxt", ["nuxt"]],
        ["Svelte", ["svelte"]],
        ["Express", ["express"]],
        ["Vite", ["vite"]],
        ["FastAPI", ["fastapi"]],
        ["Django", ["django"]],
        ["Flask", ["flask"]],
        ["Qt for Python", ["qtpy"]],
        ["pytest", ["pytest"]],
        ["Vitest", ["vitest"]]
    ];
    for (const [frameworkName, names] of checks) {
        if (names.some((name) => packages.has(name))) {
            frameworks.push(frameworkName);
        }
    }
    if (files.some((file) => basename(file) === "manage.py")) {
        frameworks.push("Django");
    }
    if (files.some((file) => ["vite.config.ts", "vite.config.js"].includes(basename(file)))) {
        frameworks.push("Vite");
    }
    if (files.some((file) => toRelative(root, file).startsWith("src/app/") && file.endsWith("page.tsx"))) {
        frameworks.push("Next.js");
    }
    return uniqueStrings(frameworks).sort();
}
function detectPackageManager(root, files, dependencies) {
    const names = new Set(files.map((file) => basename(file)));
    if (names.has("pnpm-lock.yaml")) {
        return "pnpm";
    }
    if (names.has("yarn.lock")) {
        return "yarn";
    }
    if (names.has("package-lock.json") || dependencies.some((file) => file.path === "package.json")) {
        return "npm";
    }
    if (names.has("poetry.lock")) {
        return "poetry";
    }
    if (dependencies.some((file) => file.path === "requirements.txt")) {
        return "pip";
    }
    if (dependencies.some((file) => file.path === "pyproject.toml")) {
        return "python";
    }
    if (dependencies.some((file) => file.path === "go.mod")) {
        return "go";
    }
    if (dependencies.some((file) => file.path === "Cargo.toml")) {
        return "cargo";
    }
    return "unknown";
}
async function mainDirectories(root) {
    const entries = await readdir(root, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory() && !ignoreDirs.has(entry.name)).map((entry) => entry.name).sort();
}
function entryPoints(root, files) {
    const names = new Set([
        "main.py",
        "app.py",
        "manage.py",
        "index.js",
        "index.ts",
        "main.js",
        "main.ts",
        "main.tsx",
        "App.tsx",
        "App.jsx"
    ]);
    const known = new Set(["src/main.tsx", "src/main.ts", "src/index.tsx", "src/index.ts", "src/app/page.tsx", "app/page.tsx"]);
    return uniqueStrings(files.map((file) => toRelative(root, file)).filter((file) => names.has(basename(file)) || known.has(file))).sort();
}
function namedDirectories(root, files, names) {
    const directories = files
        .map((file) => relative(root, file).split(/[\\/]/).slice(0, -1))
        .flatMap((parts) => parts.map((_part, index) => parts.slice(0, index + 1).join("/")))
        .filter((dir) => names.has(basename(dir).toLowerCase()));
    return uniqueStrings(directories).sort().slice(0, 40);
}
function protectedFiles(root, files) {
    return uniqueStrings([
        ...files.filter((file) => protectedNames.has(basename(file))).map((file) => toRelative(root, file)),
        ".git/",
        "node_modules/",
        "dist/",
        "build/",
        ".venv/",
        "venv/",
        "__pycache__/"
    ]).sort();
}
async function treeSummary(root, maxDepth) {
    const result = [];
    async function visit(directory, depth) {
        if (depth > maxDepth || result.length >= 300) {
            return;
        }
        const entries = await readdir(directory, { withFileTypes: true });
        for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
            if (ignoreDirs.has(entry.name)) {
                continue;
            }
            const fullPath = join(directory, entry.name);
            const relativePath = toRelative(root, fullPath);
            result.push(entry.isDirectory() ? `${relativePath}/` : relativePath);
            if (result.length >= 300) {
                result.push("...");
                return;
            }
            if (entry.isDirectory()) {
                await visit(fullPath, depth + 1);
            }
        }
    }
    await visit(root, 1);
    return result;
}
function notes(languageCounts, framework, dependencies) {
    const items = [];
    if (languageCounts.size === 0) {
        items.push("No source files were detected in the selected directory.");
    }
    if (dependencies.length === 0) {
        items.push("No standard dependency file was detected.");
    }
    if (framework.length > 0) {
        items.push(`Detected frameworks: ${framework.join(", ")}`);
    }
    return items;
}
function sortedLanguages(languageCounts) {
    const priority = new Map([
        ["TypeScript", 1],
        ["JavaScript", 2],
        ["Python", 3],
        ["HTML", 4],
        ["CSS", 5]
    ]);
    return [...languageCounts.entries()]
        .sort((a, b) => {
        const count = b[1] - a[1];
        if (count !== 0) {
            return count;
        }
        return (priority.get(a[0]) ?? 99) - (priority.get(b[0]) ?? 99) || a[0].localeCompare(b[0]);
    })
        .map(([name]) => name);
}
function isConfigOnlyFile(file) {
    const name = basename(file);
    return configNames.has(name) || name.endsWith(".config.js") || name.endsWith(".config.ts");
}
function toRelative(root, file) {
    return relative(root, file).replace(/\\/g, "/");
}
