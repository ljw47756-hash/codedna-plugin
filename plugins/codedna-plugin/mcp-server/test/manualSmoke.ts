import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MemoryStore } from "../src/storage/memoryStore.js";
import { generateTaskPack } from "../src/tools/generateTaskPack.js";
import { loadMemory } from "../src/tools/loadMemory.js";
import { pairStrands } from "../src/tools/pairStrands.js";
import { parseRequirement } from "../src/tools/parseRequirement.js";
import { reviewCodexOutput } from "../src/tools/reviewCodexOutput.js";
import { reverseAnalyze } from "../src/tools/reverseAnalyze.js";
import { scanProject } from "../src/tools/scanProject.js";
import { updateMemory } from "../src/tools/updateMemory.js";

const here = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(here, "..");
const pluginRoot = resolve(serverRoot, "..");
const dataRoot = resolve(process.env.CODEDNA_DATA_DIR || join(pluginRoot, "data"));
const testInputs = join(serverRoot, "test-inputs");

const memory = new MemoryStore(dataRoot);
await memory.ensureLayout();

const sampleRequirement = JSON.parse(
  await readFile(join(testInputs, "sample-requirement.json"), "utf8")
) as { request: string };
const sampleCodexOutput = await readFile(join(testInputs, "sample-codex-output.md"), "utf8");

const scan = await scanProject({ project_path: pluginRoot, max_depth: 2 }, memory);
const parsed = await parseRequirement(
  {
    request: sampleRequirement.request,
    project_profile: scan.project_profile
  },
  memory
);
const analysis = await reverseAnalyze(
  {
    requirement_strand: parsed.requirement_strand,
    project_profile: scan.project_profile
  },
  memory
);
const pairing = await pairStrands(
  {
    requirement_strand: parsed.requirement_strand,
    analysis_strand: analysis.analysis_strand
  },
  memory
);
const taskPack = await generateTaskPack(
  {
    requirement_strand: parsed.requirement_strand,
    analysis_strand: analysis.analysis_strand,
    pairing_result: pairing.pairing_result,
    project_profile: scan.project_profile
  },
  memory
);
const review = await reviewCodexOutput(
  {
    requirement_strand: parsed.requirement_strand,
    analysis_strand: analysis.analysis_strand,
    project_profile: scan.project_profile,
    codex_output: sampleCodexOutput
  },
  memory
);
const updated = await updateMemory(
  {
    memory_patch: {
      common_project_rules: ["Keep CodeDNA plugin changes scoped to plugin files."]
    },
    event: {
      type: "manual_smoke_test",
      result: pairing.pairing_result.ready_for_codex ? "ready" : "blocked"
    },
    successful_pattern: pairing.pairing_result.ready_for_codex
      ? {
          name: "Manual smoke flow",
          summary: "All CodeDNA tools produced structured output in sequence."
        }
      : undefined
  },
  memory
);
const loaded = await loadMemory(memory);

console.log(
  JSON.stringify(
    {
      ok: true,
      data_root: dataRoot,
      tools_exercised: [
        "codedna_scan_project",
        "codedna_load_memory",
        "codedna_parse_requirement",
        "codedna_reverse_analyze",
        "codedna_pair_strands",
        "codedna_generate_task_pack",
        "codedna_review_output",
        "codedna_update_memory"
      ],
      pairing_score: pairing.pairing_result.pairing_score,
      ready_for_codex: pairing.pairing_result.ready_for_codex,
      execution_level: pairing.pairing_result.execution_level,
      artifacts: {
        project_profile: scan.artifact_path,
        requirement: parsed.artifact_path,
        analysis: analysis.artifact_path,
        pairing: pairing.artifact_path,
        task_pack: taskPack.artifact_path,
        review: review.artifact_path
      },
      memory_counts: {
        preferences: Object.keys(updated.memory).length,
        successful_patterns: loaded.successful_patterns.length,
        rejected_patterns: loaded.rejected_patterns.length,
        task_history: loaded.task_history.length
      }
    },
    null,
    2
  )
);
