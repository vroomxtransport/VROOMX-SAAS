# Netlify Secrets Scanning — Mandatory Rules

The Netlify build pipeline runs a secrets scanner on every deploy. It will
**fail the build** if it finds any value of an environment variable in the
publish directory. This rule documents how the scanner works and what NEVER
to do.

## How the scanner works (the trap)

1. Netlify enumerates all build env vars from TWO sources:
   - `[build.environment]` in `netlify.toml`
   - The Netlify dashboard (Site → Environment variables)
2. It filters out keys listed in `SECRETS_SCAN_OMIT_KEYS` (declared in
   `netlify.toml`).
3. For each remaining key, it greps the **publish directory** (`.next/`,
   `.netlify/functions-internal/`, etc.) for the literal **value** of that env
   var.
4. Any match → `Exposed secrets detected` → build fails.

The scanner does NOT need the variable to be referenced in source code. It
only needs the **value** to appear anywhere in build output. Common ways a
value ends up in build output without being "referenced":

- The operator's `.env.local` is read by Next.js during build and the contents
  are bundled into the serverless function handler at
  `.netlify/functions-internal/___netlify-server-handler/.env.local`. Even if
  no code calls `process.env.YOUR_KEY`, the file itself is present.
- The value matches a literal string elsewhere — e.g. an env var set to
  `"localhost"` or `"true"` or a common test email — will collide with
  unrelated content in the build and trigger a false positive.
- A doc, README, or generated repomix dump contains the value.

## NEVER do this

1. **NEVER remove a key from `SECRETS_SCAN_OMIT_KEYS` based on a source grep
   alone.** Source grep does not see `.env.local` (gitignored) and does not
   see the Netlify dashboard env vars. CFG-011 made exactly this mistake and
   broke 6 consecutive production builds before being caught.

2. **NEVER assume a `TEST_*` or `*_DEMO` key is "dead config" without
   operator confirmation.** Operators commonly set test fixtures in the
   Netlify dashboard for staging/preview environments and forget about them.

3. **NEVER add a value to source code or docs that matches a known env var
   value.** If you write `// Example: test@vroomx.dev` in a comment and
   `TEST_USER_EMAIL=test@vroomx.dev` is set in the dashboard, the build fails.

## ALWAYS do this

### Before removing any key from `SECRETS_SCAN_OMIT_KEYS`

Run the full procedure:

```bash
# Step 1: Check if the key is in any local .env file
grep -n "KEY_NAME_HERE" .env.local .env.local.example 2>/dev/null

# Step 2: Check if the value (not just the name) is in source
# Ask the operator for the current value, then:
grep -rn "the_actual_value" src/ public/ --include="*.ts" --include="*.tsx" --include="*.md"

# Step 3: Confirm with the operator that the key is NOT set in
# Netlify dashboard → Site → Environment variables.
# This MUST be a human confirmation — there is no API to check it
# from the agent's perspective.

# Step 4: If all clear, remove from the omit list AND delete from
# .env.local.example AND ask the operator to delete from the
# Netlify dashboard.
```

If any step is unclear or unconfirmed → **leave the key in the omit list**.
False-positive omits cost nothing. False-negative removals break production.

### After ANY change to `netlify.toml`, `.env.local.example`, or env var handling

You MUST:

1. Trigger or wait for a Netlify deploy after the change is pushed.
2. Verify the deploy succeeds. If you don't have access to the Netlify
   dashboard, ask the operator to confirm.
3. If the deploy fails with `Exposed secrets detected`, do NOT push more
   commits — diagnose and fix the secrets scanning issue first. Stacking
   commits on top of a failing build wastes operator time and pollutes the
   deploy history.

## Pre-Commit Verification Checklist addition

The CLAUDE.md Pre-Commit Verification Checklist already covers DB migrations,
CSP, storage buckets, and provider boundaries. **Add a check for any change
that touches `netlify.toml`, `.env.local.example`, or any new `process.env.*`
read in source code:**

- [ ] If I added a new env var read (`process.env.NEW_KEY`), is `NEW_KEY`
      either (a) in `SECRETS_SCAN_OMIT_KEYS` because it's non-secret, or
      (b) confirmed to never have its value appear in build output?
- [ ] If I modified `SECRETS_SCAN_OMIT_KEYS`, did I run the 4-step "before
      removing" procedure above?
- [ ] If I changed `.env.local.example`, did I verify no example value
      collides with a real Netlify dashboard env var?

## History

- `e8c3019` (Wave 6c CFG-011): Removed TEST_USER_EMAIL from omit list based
  on a source grep. **Caused 6 failed production builds** until reverted.
  This rule exists because of that incident.
