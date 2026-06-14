# Case: Review Bad Output

Codex output:

```text
Summary:
- Quick fix with a hardcoded password.
- Ignored unrelated-file constraint.

Files Changed:
- src/app/page.tsx: login
- package.json: unrelated refactor

diff --git a/package.json b/package.json
```

Expected CodeDNA behavior:

- Mark the review as `needs_fix`.
- Flag security risk, constraint violation, and unrelated file changes.
- Generate a next Codex repair prompt.
