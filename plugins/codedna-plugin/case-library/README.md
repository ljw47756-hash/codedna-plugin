# CodeDNA Case Library

This library stores public-safe learning metadata for CodeDNA. It is not a copy of third-party source code, issue bodies, PR diffs, prompts, or private implementation details.

## Contents

- `effects/codedna-retained-effects.jsonl`: 651 CodeDNA-native retained effects adapted from the private retained-effect ledger.
- `cases/retained-success-cases.jsonl`: one success case for each retained effect.
- `cases/retained-failure-cases.jsonl`: one failure case for each retained effect.
- Public-source case files: 480 metadata-only entries from legal public sources.

## Safety Rules

- Store links, IDs, short summaries, CodeDNA patterns, and guardrails only.
- Do not store raw issue bodies, PR diffs, source code, secrets, private paths, or proprietary prompts.
- AGPL sources are concept-only references; CodeDNA does not copy or link AGPL code into runtime.
