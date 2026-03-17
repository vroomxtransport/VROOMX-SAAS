# Code Reviewer Checklist – Apply on Every Change/Review

Positives first, then numbered issues (high/medium/low):
1. Security: tenant_id/RLS/authorize/Zod/no secrets?
2. Patterns: follow server-action sequence?
3. Style: strict TS, named exports, Tailwind utilities?
4. Perf: unnecessary renders/queries?
5. Tests: suggest Vitest/Playwright additions?
Suggest fixes with code diffs.