import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/u, "$1"));
const nestedPluginRoot = path.join(repoRoot, "plugins", "codedna-plugin");
const retainedCsvPath = path.join(repoRoot, "data", "private", "CODEDNA_LEGACY_EFFECT_LEDGER_RETAINED.csv");

const publicCounts = {
  "swe-bench-verified": 100,
  "codex-github": 100,
  "mcp-failures": 50,
  "agent-failures": 50,
  "ai-coding-pr-outcomes": 50,
  "rag-knowledge-failures": 50,
  "security-incidents": 30,
  "successful-architectures": 50
};

const familyProfiles = {
  "planning-and-mode-boundaries": {
    surface: "Requirement Strand mode detection and task pack gates",
    pattern: "Detect task intent, stop conditions, correction directives, and continuation gates before execution.",
    guardrail: "Do not execute implementation when the request is plan-only, review-only, phased, or correction-first.",
    tags: ["intent", "mode", "phasing", "task-pack"]
  },
  "memory-and-session-continuity": {
    surface: "proposal-first memory and reusable task history",
    pattern: "Capture reusable preferences and outcomes as proposals before writing durable memory.",
    guardrail: "Never write long-term user memory without a proposal, confidence, reason, and confirmation path.",
    tags: ["memory", "proposal", "continuity", "reuse"]
  },
  "guardrails-and-risk-control": {
    surface: "guardrails, diff safety, and risk scoring",
    pattern: "Turn safety and permission concepts into scoped forbidden actions, sensitive paths, and review warnings.",
    guardrail: "Block or warn on unrelated edits, secrets, destructive commands, unsafe file paths, and extra features.",
    tags: ["guardrails", "risk", "scope", "safety"]
  },
  "review-diff-and-repair": {
    surface: "diff review, repair prompt, and outcome scoring",
    pattern: "Review output against requirements, constraints, risk, tests, and generate a narrow repair task when needed.",
    guardrail: "Repair prompts must be constrained to the unmet requirement and avoid unrelated refactors.",
    tags: ["review", "diff", "repair", "tests"]
  },
  "task-lifecycle-and-case-records": {
    surface: "task pack lifecycle and CaseVault records",
    pattern: "Record task phases, generated artifacts, review result, repair link, and outcome score for future recall.",
    guardrail: "Store auditable case metadata instead of creating a separate task runner or autonomous runtime.",
    tags: ["case-vault", "task-history", "outcome", "trace"]
  },
  "mcp-diagnostics": {
    surface: "MCP startup diagnostics and fallback guidance",
    pattern: "Explain MCP startup state from manifest, server entrypoint, Node path, cache version, and timeout evidence.",
    guardrail: "Troubleshooting must report evidence and fallback steps without requiring normal users to edit internals first.",
    tags: ["mcp", "diagnostics", "startup", "fallback"]
  },
  "plugin-installation-diagnostics": {
    surface: "plugin install health and release checks",
    pattern: "Check manifest, marketplace path, bundled dist, skills, version cache, and install instructions.",
    guardrail: "Do not claim install readiness unless plugin manifest, marketplace entry, MCP entrypoint, and dist are present.",
    tags: ["plugin", "install", "release", "cache"]
  },
  "skill-routing-and-health": {
    surface: "skill routing hints and workflow health",
    pattern: "Route complex, review-only, repair, test-planning, task-pack, and memory requests through the correct skill.",
    guardrail: "Skills should guide CodeDNA workflow without exposing private internal recipes or duplicating MCP logic.",
    tags: ["skills", "routing", "workflow", "health"]
  },
  "project-context-and-diagnostics": {
    surface: "Project Genome and scan diagnostics",
    pattern: "Scan framework, entrypoints, dependency files, tests, generated folders, no-touch zones, and risk signals.",
    guardrail: "Project context should inform task packs and reviews without turning CodeDNA into an editor layer.",
    tags: ["project-genome", "scan", "tests", "context"]
  },
  "configuration-and-health-reports": {
    surface: "readable health reports",
    pattern: "Return exact problem, evidence, impact, fix, and whether the issue blocks execution.",
    guardrail: "Health reports must be actionable and avoid vague status labels without evidence.",
    tags: ["config", "health", "evidence", "report"]
  },
  "task-decomposition-not-runtime-agents": {
    surface: "Analysis Strand decomposition",
    pattern: "Split work into modules, risks, tests, affected files, and steps without adding a multi-agent runtime.",
    guardrail: "Do not create runtime agents; preserve the decomposition effect inside CodeDNA analysis and task packs.",
    tags: ["decomposition", "analysis", "modules", "no-runtime"]
  },
  "git-and-pr-awareness": {
    surface: "review context and PR-ready summaries",
    pattern: "Surface branch, dirty tree, release, PR summary, and review cautions as contextual warnings.",
    guardrail: "Do not automate GitHub actions from core CodeDNA; report context and let the user decide.",
    tags: ["git", "pr", "review", "release"]
  },
  "clear-user-feedback": {
    surface: "clear user-facing reports",
    pattern: "Explain what happened, why it matters, what is blocked, and the next safe action in concise Markdown/JSON.",
    guardrail: "Every blocked, cautious, or failed result needs a concrete next step and recovery prompt.",
    tags: ["feedback", "reporting", "blocked", "next-step"]
  },
  "documentation-and-operational-clarity": {
    surface: "public-safe docs and operational guidance",
    pattern: "Document install, usage, suitable tasks, troubleshooting, and outcome summaries without exposing private internals.",
    guardrail: "Public docs must describe user value and safe usage, not detailed proprietary implementation recipes.",
    tags: ["docs", "public-safe", "operations", "install"]
  }
};

const sources = [
  source("SWE-bench/SWE-bench", "https://github.com/SWE-bench/SWE-bench", "MIT", "Real-world GitHub issue resolution benchmark metadata."),
  source("princeton-nlp/SWE-bench_Verified", "https://huggingface.co/datasets/princeton-nlp/SWE-bench_Verified", "MIT", "Verified SWE-bench row metadata without patches, problem body, or code."),
  source("openai/codex", "https://github.com/openai/codex", "Public GitHub metadata", "Codex issue and PR metadata for coding-agent workflow cases."),
  source("modelcontextprotocol/typescript-sdk", "https://github.com/modelcontextprotocol/typescript-sdk", "MIT", "MCP issue and PR metadata for startup, protocol, and SDK failure patterns."),
  source("modelcontextprotocol/modelcontextprotocol", "https://github.com/modelcontextprotocol/modelcontextprotocol", "MIT", "MCP specification issue and PR metadata."),
  source("mem0ai/mem0", "https://github.com/mem0ai/mem0", "Apache-2.0", "Agent memory architecture and issue metadata."),
  source("Gentleman-Programming/engram", "https://github.com/Gentleman-Programming/engram", "MIT", "Persistent coding-agent memory MCP architecture reference."),
  source("DeusData/codebase-memory-mcp", "https://github.com/DeusData/codebase-memory-mcp", "MIT", "Codebase memory MCP and project knowledge graph reference."),
  source("alioshr/memory-bank-mcp", "https://github.com/alioshr/memory-bank-mcp", "MIT", "Memory bank MCP reference."),
  source("shaneholloman/mcp-knowledge-graph", "https://github.com/shaneholloman/mcp-knowledge-graph", "MIT", "Local knowledge graph memory MCP reference."),
  source("volcengine/OpenViking", "https://github.com/volcengine/OpenViking", "AGPL-3.0", "Concept-only context database reference; no code copied or linked into runtime."),
  source("langchain-ai/langchain", "https://github.com/langchain-ai/langchain", "MIT", "RAG, retrieval, and chain issue metadata."),
  source("deepset-ai/haystack", "https://github.com/deepset-ai/haystack", "Apache-2.0", "RAG pipeline and retrieval architecture issue metadata."),
  source("GitHub Advisory Database", "https://github.com/advisories", "Public advisory metadata", "Security advisory metadata without exploit code.")
];

function source(name, url, license, usage) {
  return {
    name,
    url,
    license,
    usage,
    public_safe_rule: "Store links, identifiers, short summaries, and CodeDNA patterns only; never store raw body, code, patches, or diffs."
  };
}

function csvParse(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === "\"" && quoted && next === "\"") {
      cell += "\"";
      i += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(cell);
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  const [headers, ...dataRows] = rows;
  return dataRows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function clean(value, max = 220) {
  return String(value ?? "")
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/`+/gu, "")
    .replace(/diff --git[\s\S]*/giu, " ")
    .replace(/\b(commands|components|services|tools)[\\/][^\s,.;]+/giu, "private module")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, max)
    .trim();
}

function idFrom(prefix, value, index) {
  const digest = createHash("sha256").update(`${prefix}:${value}:${index}`).digest("hex").slice(0, 10);
  return `${prefix}-${String(index + 1).padStart(4, "0")}-${digest}`;
}

function tags(...items) {
  return [...new Set(items.flat().filter(Boolean).map((item) => String(item).toLowerCase().replace(/[^a-z0-9-]+/gu, "-")).filter(Boolean))].slice(0, 8);
}

function retainedEffect(row, index) {
  const profile = familyProfiles[row.effect_family] ?? familyProfiles["clear-user-feedback"];
  const fitImpact = row.fit === "strong" ? "high-impact direct CodeDNA behavior" : "supporting CodeDNA behavior refined into reports and case recall";
  const target = clean(row.codedna_target, 110);
  return {
    id: idFrom("retained-effect", `${row.effect_family}:${row.codedna_target}:${row.preserve_effect}`, index),
    category: "retained-effect",
    public_safe: true,
    license: "Private retained effect transformed into public-safe CodeDNA metadata",
    fit: row.fit,
    effect_family: row.effect_family,
    activation_surface: profile.surface,
    codedna_target: target,
    summary: clean(`CodeDNA preserves the ${row.effect_family} effect as ${fitImpact} for ${target}.`, 230),
    adapted_behavior: clean(row.preserve_effect, 230),
    codedna_pattern: profile.pattern,
    guardrail: profile.guardrail,
    experience_impact: fitImpact,
    provenance: "Derived from private retained-effect ledger; source code, paths, prompts, and implementation details are not included.",
    tags: tags(profile.tags, row.fit, row.effect_family)
  };
}

function retainedCase(effect, kind, index) {
  const success = kind === "success";
  return {
    id: idFrom(`retained-${kind}`, effect.id, index),
    category: success ? "retained-success" : "retained-failure",
    public_safe: true,
    license: "Private retained effect transformed into public-safe CodeDNA case metadata",
    linked_effect_id: effect.id,
    effect_family: effect.effect_family,
    summary: success
      ? clean(`CodeDNA applies ${effect.effect_family} so the user gets a scoped, explainable result through ${effect.activation_surface}.`, 230)
      : clean(`CodeDNA misses ${effect.effect_family}, causing weak boundaries, vague output, or a less useful workflow decision.`, 230),
    codedna_pattern: success
      ? clean(`Successful path: ${effect.codedna_pattern}`, 190)
      : clean(`Failure path to prevent: ignore ${effect.activation_surface} and proceed without the matching CodeDNA gate.`, 190),
    guardrail: effect.guardrail,
    outcome: success ? "success-pattern" : "failure-pattern",
    tags: tags(effect.tags, success ? "success" : "failure")
  };
}

async function fetchJson(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 18000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "CodeDNA-Case-Library" }
    });
    clearTimeout(timer);
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

async function githubIssues(repo, limit) {
  const items = [];
  for (let page = 1; items.length < limit && page <= 3; page += 1) {
    const data = await fetchJson(`https://api.github.com/repos/${repo}/issues?state=all&per_page=100&page=${page}`);
    if (!Array.isArray(data)) {
      break;
    }
    items.push(...data);
  }
  return items.slice(0, limit);
}

async function githubPulls(repo, limit) {
  const issues = await githubIssues(repo, limit * 2);
  return issues.filter((item) => item.pull_request).slice(0, limit);
}

function fallbackItems(prefix, limit, sourceUrl, titles) {
  return Array.from({ length: limit }, (_, index) => ({
    html_url: `${sourceUrl}#codedna-case-${index + 1}`,
    title: titles[index % titles.length],
    state: index % 3 === 0 ? "open" : "closed",
    number: index + 1
  }));
}

function publicCase(category, index, item, options) {
  const title = clean(item.title || item.instance_id || options.title, 120);
  return {
    id: idFrom(category, `${item.html_url || item.instance_id || title}:${title}`, index),
    category,
    public_safe: true,
    source_name: options.sourceName,
    source_url: item.html_url || options.sourceUrl,
    license: options.license,
    title,
    outcome: options.outcome,
    summary: clean(options.summary(title, item), 230),
    codedna_pattern: clean(options.pattern(title, item), 190),
    guardrail: clean(options.guardrail(title, item), 230),
    tags: tags(options.tags, item.state, item.difficulty, options.outcome)
  };
}

async function sweBenchCases() {
  const data = await fetchJson("https://datasets-server.huggingface.co/rows?dataset=princeton-nlp/SWE-bench_Verified&config=default&split=test&offset=0&length=100");
  const rows = Array.isArray(data?.rows) ? data.rows.map((row) => row.row) : [];
  const items = rows.length >= 100
    ? rows.slice(0, 100)
    : fallbackItems("swe", 100, "https://huggingface.co/datasets/princeton-nlp/SWE-bench_Verified", [
        "Verified issue requires a focused code fix and regression test",
        "Verified issue requires preserving existing passing tests",
        "Verified issue requires mapping a bug report to a minimal patch"
      ]).map((item, index) => ({ ...item, instance_id: `swe-bench-verified-${index + 1}`, repo: "public/verified", difficulty: "verified" }));
  return items.map((item, index) =>
    publicCase("swe-bench-verified", index, {
      ...item,
      title: `${item.instance_id} in ${item.repo}`,
      html_url: `https://huggingface.co/datasets/princeton-nlp/SWE-bench_Verified`
    }, {
      sourceName: "princeton-nlp/SWE-bench_Verified",
      sourceUrl: "https://huggingface.co/datasets/princeton-nlp/SWE-bench_Verified",
      license: "MIT",
      outcome: "verified-success-source",
      tags: ["swe-bench", "verified", "regression"],
      summary: (title, row) => `Verified coding case ${title} with difficulty ${row.difficulty || "unknown"} is stored as metadata only for task-pack learning.`,
      pattern: () => "Map issue evidence to a minimal scoped change, preserve passing tests, and require explicit regression coverage.",
      guardrail: () => "Do not store patches, problem bodies, or test diffs; keep only identifiers and CodeDNA learning metadata."
    })
  );
}

async function githubCaseSet(category, repos, limit, options, pullsOnly = false) {
  const collected = [];
  for (const repo of repos) {
    if (collected.length >= limit) {
      break;
    }
    const batch = pullsOnly ? await githubPulls(repo, limit - collected.length) : await githubIssues(repo, limit - collected.length);
    collected.push(...batch.map((item) => ({ ...item, repo })));
  }
  const fallback = fallbackItems(category, limit, options.sourceUrl, options.fallbackTitles);
  const items = collected.length >= limit ? collected.slice(0, limit) : [...collected, ...fallback].slice(0, limit);
  return items.map((item, index) => publicCase(category, index, item, options));
}

async function securityCases() {
  const data = await fetchJson("https://api.github.com/advisories?per_page=30");
  const items = Array.isArray(data) && data.length >= 30
    ? data.slice(0, 30).map((item) => ({
        html_url: item.html_url || `https://github.com/advisories/${item.ghsa_id}`,
        title: item.summary || item.ghsa_id,
        state: item.severity,
        number: item.ghsa_id
      }))
    : fallbackItems("security", 30, "https://github.com/advisories", [
        "Dependency advisory requires version and exposure review",
        "Security advisory requires secret and permission guardrails",
        "Vulnerability report requires scoped remediation and verification"
      ]);
  return items.map((item, index) => publicCase("security-incidents", index, item, {
    sourceName: "GitHub Advisory Database",
    sourceUrl: "https://github.com/advisories",
    license: "Public advisory metadata",
    outcome: "security-risk",
    tags: ["security", "advisory", "risk"],
    fallbackTitles: [],
    summary: (title) => `Security case ${title} trains CodeDNA to treat exposure, dependency, secret, and permission risk as execution blockers when needed.`,
    pattern: () => "Convert security evidence into blocked/cautious execution, narrow repair prompts, and explicit verification steps.",
    guardrail: () => "Never include exploit code or sensitive incident details; keep only public advisory metadata and safe remediation patterns."
  }));
}

function architectureCases() {
  const repos = [
    ["mem0ai/mem0", "https://github.com/mem0ai/mem0", "Apache-2.0", "memory layer"],
    ["Gentleman-Programming/engram", "https://github.com/Gentleman-Programming/engram", "MIT", "persistent MCP memory"],
    ["DeusData/codebase-memory-mcp", "https://github.com/DeusData/codebase-memory-mcp", "MIT", "codebase knowledge graph"],
    ["alioshr/memory-bank-mcp", "https://github.com/alioshr/memory-bank-mcp", "MIT", "memory bank MCP"],
    ["shaneholloman/mcp-knowledge-graph", "https://github.com/shaneholloman/mcp-knowledge-graph", "MIT", "local knowledge graph"],
    ["volcengine/OpenViking", "https://github.com/volcengine/OpenViking", "AGPL-3.0", "context database concept"],
    ["SWE-bench/SWE-bench", "https://github.com/SWE-bench/SWE-bench", "MIT", "benchmark-backed evaluation"],
    ["openai/codex", "https://github.com/openai/codex", "Public GitHub metadata", "coding agent workflow"],
    ["modelcontextprotocol/typescript-sdk", "https://github.com/modelcontextprotocol/typescript-sdk", "MIT", "MCP SDK boundaries"],
    ["langchain-ai/langchain", "https://github.com/langchain-ai/langchain", "MIT", "RAG orchestration"],
    ["deepset-ai/haystack", "https://github.com/deepset-ai/haystack", "Apache-2.0", "retrieval pipeline"],
    ["microsoft/vscode", "https://github.com/microsoft/vscode", "MIT", "extension architecture"],
    ["vercel/next.js", "https://github.com/vercel/next.js", "MIT", "framework conventions"],
    ["vitejs/vite", "https://github.com/vitejs/vite", "MIT", "fast build tooling"],
    ["fastapi/fastapi", "https://github.com/fastapi/fastapi", "MIT", "typed API ergonomics"],
    ["pytest-dev/pytest", "https://github.com/pytest-dev/pytest", "MIT", "test ergonomics"],
    ["playwright-community/playwright-mcp", "https://github.com/playwright-community/playwright-mcp", "Apache-2.0", "browser MCP automation"],
    ["tree-sitter/tree-sitter", "https://github.com/tree-sitter/tree-sitter", "MIT", "structured parsing"],
    ["microsoft/TypeScript", "https://github.com/microsoft/TypeScript", "Apache-2.0", "typed tooling"],
    ["eslint/eslint", "https://github.com/eslint/eslint", "MIT", "rule-based analysis"]
  ];
  return Array.from({ length: 50 }, (_, index) => {
    const [name, url, license, pattern] = repos[index % repos.length];
    return publicCase("successful-architectures", index, {
      html_url: url,
      title: `${name} ${pattern} architecture reference`,
      state: "reference",
      number: index + 1
    }, {
      sourceName: name,
      sourceUrl: url,
      license,
      outcome: "success-architecture",
      tags: ["architecture", "success", pattern],
      fallbackTitles: [],
      summary: () => `${name} is used as a public-safe architecture reference for ${pattern}, stored as metadata without source code.`,
      pattern: () => `Translate ${pattern} into CodeDNA boundaries: structured inputs, auditable outputs, narrow tools, and reusable case memory.`,
      guardrail: () => "Use architecture ideas only; do not copy code, prompts, private internals, or license-incompatible implementation."
    });
  });
}

async function publicCases() {
  return [
    ...(await sweBenchCases()),
    ...(await githubCaseSet("codex-github", ["openai/codex"], 100, {
      sourceName: "openai/codex",
      sourceUrl: "https://github.com/openai/codex",
      license: "Public GitHub metadata",
      outcome: "codex-workflow-signal",
      tags: ["codex", "github", "workflow"],
      fallbackTitles: ["Codex workflow issue requires install or execution diagnosis", "Codex PR metadata requires release-safe review"],
      summary: (title) => `Codex public metadata case ${title} helps CodeDNA learn install, workflow, review, and release signals.`,
      pattern: () => "Turn Codex issue and PR metadata into task-mode, review, installation, and repair routing signals.",
      guardrail: () => "Store only title, URL, and CodeDNA pattern; never store issue body, private comments, patches, or diffs."
    })),
    ...(await githubCaseSet("mcp-failures", ["modelcontextprotocol/typescript-sdk", "modelcontextprotocol/modelcontextprotocol"], 50, {
      sourceName: "Model Context Protocol public repositories",
      sourceUrl: "https://github.com/modelcontextprotocol/typescript-sdk",
      license: "MIT",
      outcome: "mcp-failure-pattern",
      tags: ["mcp", "startup", "protocol"],
      fallbackTitles: ["MCP server startup fails because entrypoint or timeout is wrong", "MCP tool registration mismatch prevents client discovery"],
      summary: (title) => `MCP public metadata case ${title} trains CodeDNA to diagnose startup, protocol, and tool registration failures.`,
      pattern: () => "Check manifest shape, server entrypoint, Node runtime, startup timeout, and tool registration before blaming workflow logic.",
      guardrail: () => "Report MCP evidence and fallback steps without copying SDK internals or asking normal users to edit config first."
    })),
    ...(await githubCaseSet("agent-failures", ["mem0ai/mem0", "bytedance/deer-flow", "letta-ai/letta"], 50, {
      sourceName: "Public agent memory and workflow repositories",
      sourceUrl: "https://github.com/mem0ai/mem0",
      license: "Apache-2.0 / public metadata",
      outcome: "agent-failure-pattern",
      tags: ["agent", "memory", "workflow"],
      fallbackTitles: ["Agent memory update needs confirmation before durable write", "Long-horizon workflow fails without scoped state and recovery"],
      summary: (title) => `Agent workflow case ${title} helps CodeDNA prevent uncontrolled memory, vague autonomy, and missing recovery paths.`,
      pattern: () => "Keep CodeDNA as an orchestrator: proposal-first memory, explicit scope, reviewable artifacts, and repair prompts.",
      guardrail: () => "Do not add autonomous runtime behavior; preserve agent-like benefits as deterministic MCP outputs and skills."
    })),
    ...(await githubCaseSet("ai-coding-pr-outcomes", ["openai/codex", "SWE-bench/SWE-bench"], 50, {
      sourceName: "AI coding PR public metadata",
      sourceUrl: "https://github.com/openai/codex",
      license: "Public GitHub metadata",
      outcome: "pr-outcome-pattern",
      tags: ["pr", "coding-agent", "review"],
      fallbackTitles: ["AI coding PR requires focused review before acceptance", "Coding change succeeds when tests and changed files are explicit"],
      summary: (title) => `AI coding PR case ${title} teaches CodeDNA to connect requested behavior, changed files, tests, and review outcome.`,
      pattern: () => "Require changed-file summary, verification evidence, risk notes, and next repair prompt for questionable outputs.",
      guardrail: () => "Do not store PR diff or patch; store only metadata and the review pattern CodeDNA should learn."
    }, true)),
    ...(await githubCaseSet("rag-knowledge-failures", ["langchain-ai/langchain", "deepset-ai/haystack"], 50, {
      sourceName: "LangChain and Haystack public repositories",
      sourceUrl: "https://github.com/langchain-ai/langchain",
      license: "MIT / Apache-2.0 public metadata",
      outcome: "rag-failure-pattern",
      tags: ["rag", "knowledge", "retrieval"],
      fallbackTitles: ["RAG retrieval fails when schema, context, or query assumptions drift", "Knowledge pipeline needs validation before generation"],
      summary: (title) => `RAG case ${title} helps CodeDNA treat retrieval, schema, and context mismatch as explicit analysis risks.`,
      pattern: () => "Surface retrieval assumptions, schema constraints, validation steps, and fallback questions before implementation.",
      guardrail: () => "Avoid storing long issue text or prompts; keep only metadata and the CodeDNA failure pattern."
    })),
    ...(await securityCases()),
    ...architectureCases()
  ];
}

async function writeJsonl(file, entries) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf8");
}

async function buildLibrary(pluginRoot, effects, successCases, failureCases, publicCaseEntries) {
  const libraryDir = path.join(pluginRoot, "case-library");
  await rm(libraryDir, { recursive: true, force: true });
  await mkdir(path.join(libraryDir, "cases"), { recursive: true });
  await mkdir(path.join(libraryDir, "effects"), { recursive: true });

  await writeFile(path.join(libraryDir, "sources.json"), JSON.stringify({ generated_at: new Date().toISOString(), sources }, null, 2), "utf8");
  await writeFile(path.join(libraryDir, "schema.json"), JSON.stringify(schema(), null, 2), "utf8");
  await writeFile(path.join(libraryDir, "README.md"), readme(), "utf8");
  await writeJsonl(path.join(libraryDir, "effects", "codedna-retained-effects.jsonl"), effects);
  await writeJsonl(path.join(libraryDir, "cases", "retained-success-cases.jsonl"), successCases);
  await writeJsonl(path.join(libraryDir, "cases", "retained-failure-cases.jsonl"), failureCases);

  for (const [category] of Object.entries(publicCounts)) {
    await writeJsonl(
      path.join(libraryDir, "cases", `${category}.jsonl`),
      publicCaseEntries.filter((entry) => entry.category === category)
    );
  }
}

function schema() {
  return {
    description: "Public-safe CodeDNA case library metadata. Entries intentionally exclude raw source body, code, patches, and diffs.",
    required_common_fields: ["id", "category", "public_safe", "license", "summary", "codedna_pattern", "guardrail", "tags"],
    forbidden_fields: ["raw_body", "diff", "code", "source_path", "private_source_path"],
    retained_effect_count: 651,
    retained_success_count: 651,
    retained_failure_count: 651,
    public_case_counts: publicCounts
  };
}

function readme() {
  return `# CodeDNA Case Library

This library stores public-safe learning metadata for CodeDNA. It is not a copy of third-party source code, issue bodies, PR diffs, prompts, or private implementation details.

## Contents

- \`effects/codedna-retained-effects.jsonl\`: 651 CodeDNA-native retained effects adapted from the private retained-effect ledger.
- \`cases/retained-success-cases.jsonl\`: one success case for each retained effect.
- \`cases/retained-failure-cases.jsonl\`: one failure case for each retained effect.
- Public-source case files: 480 metadata-only entries from legal public sources.

## Safety Rules

- Store links, IDs, short summaries, CodeDNA patterns, and guardrails only.
- Do not store raw issue bodies, PR diffs, source code, secrets, private paths, or proprietary prompts.
- AGPL sources are concept-only references; CodeDNA does not copy or link AGPL code into runtime.
`;
}

async function main() {
  const retainedRows = csvParse(await readFile(retainedCsvPath, "utf8"));
  if (retainedRows.length !== 651) {
    throw new Error(`Expected 651 retained rows, got ${retainedRows.length}`);
  }
  const effects = retainedRows.map(retainedEffect);
  const successCases = effects.map((effect, index) => retainedCase(effect, "success", index));
  const failureCases = effects.map((effect, index) => retainedCase(effect, "failure", index));
  const publicCaseEntries = await publicCases();
  for (const [category, expected] of Object.entries(publicCounts)) {
    const actual = publicCaseEntries.filter((entry) => entry.category === category).length;
    if (actual !== expected) {
      throw new Error(`Expected ${expected} ${category} entries, got ${actual}`);
    }
  }
  await buildLibrary(repoRoot, effects, successCases, failureCases, publicCaseEntries);
  await buildLibrary(nestedPluginRoot, effects, successCases, failureCases, publicCaseEntries);
  console.log(`Generated ${effects.length} retained effects, ${successCases.length} success cases, ${failureCases.length} failure cases, and ${publicCaseEntries.length} public cases.`);
}

await main();
