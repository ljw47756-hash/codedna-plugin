import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import assert from "node:assert/strict";
import { JsonStore } from "../src/storage/jsonStore.js";
import { MemoryStore, MEMORY_SCHEMA_VERSION } from "../src/storage/memoryStore.js";

test("MemoryStore migrates old user preferences and task history records", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "codedna-memory-migration-"));
  try {
    const store = new JsonStore(join(workspace, "data"));
    await store.writeJson("memory/user_preferences.json", {
      ui_style_preferences: ["compact"],
      code_preferences: ["no broad refactors"]
    });
    await store.writeJson("memory/task_history/old.json", {
      type: "old_task",
      result: "success"
    });

    const memory = new MemoryStore(join(workspace, "data"));
    await memory.ensureLayout();
    const loaded = await memory.loadSnapshot();

    assert.equal(loaded.memory.schema_version, MEMORY_SCHEMA_VERSION);
    assert.ok(loaded.memory.ui_style_preferences.includes("compact"));
    assert.equal(loaded.task_history[0]?.schema_version, MEMORY_SCHEMA_VERSION);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
