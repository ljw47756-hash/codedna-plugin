import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import assert from "node:assert/strict";
import { MemoryStore } from "../src/storage/memoryStore.js";
import { scanProject } from "../src/tools/scanProject.js";

type FileMap = Record<string, string>;

async function withMemory<T>(fn: (workspace: string, memory: MemoryStore) => Promise<T>): Promise<T> {
  const workspace = await mkdtemp(join(tmpdir(), "codedna-scan-matrix-"));
  const memory = new MemoryStore(join(workspace, "data"));
  await memory.ensureLayout();
  try {
    return await fn(workspace, memory);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

async function createProject(root: string, name: string, files: FileMap): Promise<string> {
  const dir = join(root, name);
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path);
    await mkdir(full.split(/[\\/]/).slice(0, -1).join("\\"), { recursive: true });
    await writeFile(full, content, "utf8");
  }
  return dir;
}

test("scanProject detects common real project structures and ignores dependency output dirs", async () => {
  await withMemory(async (workspace, memory) => {
    const cases = [
      {
        name: "react-ts",
        files: {
          "package.json": JSON.stringify({ dependencies: { react: "19.0.0", vite: "6.0.0" }, devDependencies: { typescript: "5.8.3" } }),
          "src/main.tsx": "import React from 'react';",
          "src/components/Button.tsx": "export const Button = () => null;",
          "node_modules/ignored/index.ts": "ignored"
        },
        framework: "React",
        language: "TypeScript"
      },
      {
        name: "next",
        files: {
          "package.json": JSON.stringify({ dependencies: { next: "15.0.0", react: "19.0.0" } }),
          "src/app/page.tsx": "export default function Page() { return null; }",
          "src/app/api/login/route.ts": "export function POST() {}"
        },
        framework: "Next.js",
        language: "TypeScript"
      },
      {
        name: "vue",
        files: {
          "package.json": JSON.stringify({ dependencies: { vue: "3.0.0", vite: "6.0.0" } }),
          "src/main.ts": "import { createApp } from 'vue';",
          "src/components/App.vue": "<template />"
        },
        framework: "Vue",
        language: "TypeScript"
      },
      {
        name: "node-cli",
        files: {
          "package.json": JSON.stringify({ bin: { demo: "dist/index.js" }, dependencies: { commander: "12.0.0" } }),
          "src/index.ts": "console.log('cli');"
        },
        framework: undefined,
        language: "TypeScript"
      },
      {
        name: "fastapi",
        files: {
          "requirements.txt": "fastapi\nuvicorn\npytest\n",
          "main.py": "from fastapi import FastAPI\napp = FastAPI()\n",
          "tests/test_app.py": "def test_app(): pass"
        },
        framework: "FastAPI",
        language: "Python"
      },
      {
        name: "python-gui",
        files: {
          "pyproject.toml": "qtpy = \"2.4.0\"\npytest = \"8.0.0\"\n",
          "gui/app_launcher.py": "from qtpy.QtWidgets import QApplication\n",
          "gui/window.py": "class Window: pass"
        },
        framework: "Qt for Python",
        language: "Python"
      },
      {
        name: "mixed",
        files: {
          "package.json": JSON.stringify({ dependencies: { react: "19.0.0" } }),
          "requirements.txt": "fastapi\n",
          "src/main.tsx": "export {};",
          "api/main.py": "from fastapi import FastAPI\n"
        },
        framework: "FastAPI",
        language: "TypeScript"
      },
      {
        name: "empty",
        files: {
          "README.md": "# Empty"
        },
        framework: undefined,
        language: undefined
      },
      {
        name: "huge",
        files: Object.fromEntries(Array.from({ length: 360 }, (_item, index) => [`src/generated/file${index}.ts`, "export {};"])),
        framework: undefined,
        language: "TypeScript"
      },
      {
        name: "ignored-dirs",
        files: {
          "package.json": JSON.stringify({ dependencies: { react: "19.0.0" } }),
          "src/index.ts": "export {};",
          "dist/bundle.ts": "ignored",
          "build/output.py": "ignored",
          ".venv/lib/python.py": "ignored",
          ".git/config": "ignored"
        },
        framework: "React",
        language: "TypeScript"
      }
    ];

    for (const item of cases) {
      const dir = await createProject(workspace, item.name, item.files);
      const profile = (await scanProject({ project_path: dir, max_depth: 3, save: false }, memory)).project_profile;
      if (item.framework) {
        assert.ok(profile.framework.includes(item.framework), `${item.name} should detect ${item.framework}`);
      }
      if (item.language) {
        assert.equal(profile.language[0], item.language, `${item.name} should detect ${item.language}`);
      }
      assert.equal(profile.tree_summary.some((path) => path.includes("node_modules") || path.includes("dist/bundle") || path.includes("build/output") || path.includes(".venv") || path.includes(".git")), false);
      assert.ok(profile.tree_summary.length <= 301);
    }
  });
});
