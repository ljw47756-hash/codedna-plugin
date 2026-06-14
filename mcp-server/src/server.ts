#!/usr/bin/env node
import { resolve } from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { MemoryStore } from "./storage/memoryStore.js";
import { parseRequirement } from "./tools/parseRequirement.js";
import { reverseAnalyze } from "./tools/reverseAnalyze.js";
import { pairStrands } from "./tools/pairStrands.js";
import { scanProject } from "./tools/scanProject.js";
import { generateTaskPack } from "./tools/generateTaskPack.js";
import { reviewCodexOutput } from "./tools/reviewCodexOutput.js";
import { updateMemory } from "./tools/updateMemory.js";
import { loadMemory } from "./tools/loadMemory.js";
import { runFullWorkflow } from "./tools/runFullWorkflow.js";
import { buildProjectGenome } from "./tools/buildProjectGenome.js";
import { reviewDiff } from "./tools/reviewDiff.js";
import { generateGuardrails } from "./tools/generateGuardrails.js";
import { validateChanges } from "./tools/validateChanges.js";
import { generateRepairTask } from "./tools/generateRepairTask.js";
import { proposeMemoryUpdate } from "./tools/proposeMemoryUpdate.js";
import { confirmMemoryUpdate } from "./tools/confirmMemoryUpdate.js";
import { generateTestPlan } from "./tools/generateTestPlan.js";
import { scoreOutcome } from "./tools/scoreOutcome.js";

const dataRoot = resolve(process.env.CODEDNA_DATA_DIR || "data");
const memoryStore = new MemoryStore(dataRoot);
await memoryStore.ensureLayout();

const server = new Server(
  {
    name: "codedna",
    version: "0.1.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

const tools = [
  {
    name: "codedna_parse_requirement",
    description: "Parse a natural-language user request into a structured CodeDNA Requirement Strand.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["request"],
      properties: {
        request: {
          type: "string",
          description: "The original user request to prepare for Codex."
        },
        project_profile: {
          type: "object",
          description: "Optional project profile returned by codedna_scan_project."
        },
        memory_rules: {
          type: "array",
          items: { type: "string" },
          description: "Optional memory rules to attach instead of loading local memory."
        },
        save: {
          type: "boolean",
          description: "Whether to persist the generated strand. Defaults to true."
        }
      }
    }
  },
  {
    name: "codedna_reverse_analyze",
    description: "Generate the technical Analysis Strand from a Requirement Strand and optional project profile.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["requirement_strand"],
      properties: {
        requirement_strand: { type: "object" },
        project_profile: { type: "object" },
        save: { type: "boolean" }
      }
    }
  },
  {
    name: "codedna_pair_strands",
    description: "Pair the Requirement Strand and Analysis Strand using Goal <-> Task, Constraint <-> Risk, Preference <-> Pattern, Feature <-> Module, Acceptance <-> Test, and Memory <-> Reuse rules.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["requirement_strand", "analysis_strand"],
      properties: {
        requirement_strand: { type: "object" },
        analysis_strand: { type: "object" },
        save: { type: "boolean" }
      }
    }
  },
  {
    name: "codedna_scan_project",
    description: "Scan a local project directory and return a structured Project Profile.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["project_path"],
      properties: {
        project_path: {
          type: "string",
          description: "Absolute or relative local project directory to scan."
        },
        max_depth: {
          type: "number",
          description: "Directory tree depth to include. Defaults to 3."
        },
        save: { type: "boolean" }
      }
    }
  },
  {
    name: "codedna_generate_task_pack",
    description: "Generate a copy-ready Markdown Codex Task Pack from CodeDNA strands, pairing result, and project context.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["requirement_strand", "analysis_strand", "pairing_result"],
      properties: {
        requirement_strand: { type: "object" },
        analysis_strand: { type: "object" },
        pairing_result: { type: "object" },
        project_profile: { type: "object" },
        save: { type: "boolean" }
      }
    }
  },
  {
    name: "codedna_review_output",
    description: "Review Codex output, diffs, logs, or summaries against the original request and CodeDNA analysis.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["requirement_strand", "analysis_strand", "codex_output"],
      properties: {
        requirement_strand: { type: "object" },
        analysis_strand: { type: "object" },
        codex_output: {
          type: "string",
          description: "Codex summary, diff, error log, or final output to review."
        },
        project_profile: { type: "object" },
        save: { type: "boolean" }
      }
    }
  },
  {
    name: "codedna_update_memory",
    description: "Update CodeDNA local memory with preferences, patterns, project rules, or task history events.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        memory_patch: {
          type: "object",
          description: "Partial memory object to merge into local CodeDNA memory."
        },
        event: {
          type: "object",
          description: "Optional task-history event to persist."
        },
        successful_pattern: {
          type: "object",
          description: "Optional successful reusable pattern to append under memory/successful_patterns."
        },
        rejected_pattern: {
          type: "object",
          description: "Optional rejected pattern to append under memory/rejected_patterns."
        }
      }
    }
  },
  {
    name: "codedna_load_memory",
    description: "Load CodeDNA local memory and return its storage root.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {}
    }
  },
  {
    name: "codedna_run_full_workflow",
    description: "Run the complete CodeDNA workflow: load memory, scan project, build optional Project Genome, parse requirements, reverse analyze, pair strands, and generate a gated task pack.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["user_request"],
      properties: {
        user_request: { type: "string" },
        project_path: { type: "string" },
        optional_constraints: {
          oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }]
        },
        mode: { type: "string", enum: ["plan_only", "task_pack", "full"] },
        use_project_genome: { type: "boolean" },
        use_memory: { type: "boolean" }
      }
    }
  },
  {
    name: "codedna_build_project_genome",
    description: "Scan a project and write .codedna/project-genome.json with architecture, safe edit zones, forbidden zones, tests, and Codex rules.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["project_path"],
      properties: {
        project_path: { type: "string" },
        project_profile: { type: "object" },
        save: { type: "boolean" }
      }
    }
  },
  {
    name: "codedna_review_diff",
    description: "Review git diff text, Codex summary, or changed files for forbidden edits, secrets, dangerous commands, unrelated changes, missing tests, and repair needs.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["original_request"],
      properties: {
        original_request: { type: "string" },
        requirement_strand: { type: "object" },
        analysis_strand: { type: "object" },
        pairing_result: { type: "object" },
        guardrails: { type: "object" },
        diff_text: { type: "string" },
        changed_files: { type: "array", items: { type: "string" } },
        codex_summary: { type: "string" },
        save: { type: "boolean" }
      }
    }
  },
  {
    name: "codedna_generate_guardrails",
    description: "Generate execution guardrails from Requirement Strand, Analysis Strand, Project Profile, and Project Genome before Codex edits files.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["requirement_strand", "analysis_strand"],
      properties: {
        requirement_strand: { type: "object" },
        analysis_strand: { type: "object" },
        project_profile: { type: "object" },
        project_genome: { type: "object" },
        pairing_result: { type: "object" },
        task_id: { type: "string" },
        save: { type: "boolean" }
      }
    }
  },
  {
    name: "codedna_validate_changes",
    description: "Validate a Codex diff or changed-file list against CodeDNA guardrails and return violations, warnings, and a verdict.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["guardrails"],
      properties: {
        guardrails: { type: "object" },
        diff_text: { type: "string" },
        changed_files: { type: "array", items: { type: "string" } },
        codex_summary: { type: "string" },
        save: { type: "boolean" }
      }
    }
  },
  {
    name: "codedna_generate_repair_task",
    description: "Generate a focused next-round Codex repair task from Review Report, Diff Review, or Guardrails Validation.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["original_request"],
      properties: {
        original_request: { type: "string" },
        review_report: { type: "object" },
        diff_review: { type: "object" },
        guardrails_validation: { type: "object" },
        project_profile: { type: "object" },
        project_genome: { type: "object" },
        save: { type: "boolean" }
      }
    }
  },
  {
    name: "codedna_propose_memory_update",
    description: "Create a scoped memory update proposal without directly writing long-term user memory.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["source_text"],
      properties: {
        source_text: { type: "string" },
        task_context: { type: "object" },
        project_path: { type: "string" },
        detected_preference: { type: "string" },
        suggested_scope: { type: "string", enum: ["session", "project", "user"] },
        reason: { type: "string" },
        confidence: { type: "number" }
      }
    }
  },
  {
    name: "codedna_confirm_memory_update",
    description: "Confirm or reject a CodeDNA memory proposal and write confirmed memory to session, project, or user memory.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["proposal_id", "confirmed"],
      properties: {
        proposal_id: { type: "string" },
        confirmed: { type: "boolean" },
        edited_memory_text: { type: "string" },
        target_scope: { type: "string", enum: ["session", "project", "user"] }
      }
    }
  },
  {
    name: "codedna_generate_test_plan",
    description: "Generate a copy-ready test plan for UI, API, bug fix, refactor, or general coding tasks.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["requirement_strand", "analysis_strand"],
      properties: {
        requirement_strand: { type: "object" },
        analysis_strand: { type: "object" },
        project_profile: { type: "object" },
        project_genome: { type: "object" },
        changed_files: { type: "array", items: { type: "string" } },
        task_type: { type: "string", enum: ["ui", "api", "bug_fix", "refactor", "general"] },
        save: { type: "boolean" }
      }
    }
  },
  {
    name: "codedna_score_outcome",
    description: "Score a Codex task outcome across requirement match, constraints, code quality, tests, architecture, and risk.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["original_request"],
      properties: {
        original_request: { type: "string" },
        requirement_strand: { type: "object" },
        analysis_strand: { type: "object" },
        pairing_result: { type: "object" },
        review_report: { type: "object" },
        diff_review: { type: "object" },
        test_plan_result: { type: "object" },
        codex_output: { type: "string" }
      }
    }
  }
] as const;

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [...tools] }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const args = (request.params.arguments ?? {}) as Record<string, unknown>;
  try {
    switch (request.params.name) {
      case "codedna_parse_requirement":
        return result(await parseRequirement(args as never, memoryStore));
      case "codedna_reverse_analyze":
        return result(await reverseAnalyze(args as never, memoryStore));
      case "codedna_pair_strands":
        return result(await pairStrands(args as never, memoryStore));
      case "codedna_scan_project":
        return result(await scanProject(args as never, memoryStore));
      case "codedna_generate_task_pack":
        return result(await generateTaskPack(args as never, memoryStore));
      case "codedna_review_output":
        return result(await reviewCodexOutput(args as never, memoryStore));
      case "codedna_update_memory":
        return result(await updateMemory(args as never, memoryStore));
      case "codedna_load_memory":
        return result(await loadMemory(memoryStore));
      case "codedna_run_full_workflow":
        return result(await runFullWorkflow(args as never, memoryStore));
      case "codedna_build_project_genome":
        return result(await buildProjectGenome(args as never, memoryStore));
      case "codedna_review_diff":
        return result(await reviewDiff(args as never, memoryStore));
      case "codedna_generate_guardrails":
        return result(await generateGuardrails(args as never, memoryStore));
      case "codedna_validate_changes":
        return result(await validateChanges(args as never, memoryStore));
      case "codedna_generate_repair_task":
        return result(await generateRepairTask(args as never, memoryStore));
      case "codedna_propose_memory_update":
        return result(await proposeMemoryUpdate(args as never, memoryStore));
      case "codedna_confirm_memory_update":
        return result(await confirmMemoryUpdate(args as never, memoryStore));
      case "codedna_generate_test_plan":
        return result(await generateTestPlan(args as never, memoryStore));
      case "codedna_score_outcome":
        return result(await scoreOutcome(args as never, memoryStore));
      default:
        throw new Error(`Unknown CodeDNA tool: ${request.params.name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: message,
              tool: request.params.name
            },
            null,
            2
          )
        }
      ]
    };
  }
});

function result(payload: unknown): { content: Array<{ type: "text"; text: string }>; structuredContent: unknown } {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2)
      }
    ],
    structuredContent: payload
  };
}

const transport = new StdioServerTransport();
await server.connect(transport);
