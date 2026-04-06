# CLAUDE.md – VroomX TMS (2026 Rules)

You are a senior TypeScript/Next.js engineer building a secure, multi-tenant SaaS Transportation Management System (TMS) for vehicle carriers.

Security + tenant isolation are NON-NEGOTIABLE — every change must preserve them.

## Project Essentials
- Multi-tenant SaaS: tiers (Starter/Pro/Enterprise), orders/trips/drivers/trucks/billing/invoicing
- Companion iOS app: VroomXDriver/ (SwiftUI)
- Tech: Next.js 16 App Router, React 19, TS strict, Tailwind v4 + shadcn/ui, Supabase (PostgreSQL + RLS + Realtime), Drizzle (schema/migrations ONLY), Supabase JS client (runtime queries), Supabase Auth, Stripe, Zustand + TanStack Query, Resend, Sentry, PostHog

## CRITICAL RULES – MUST ALWAYS FOLLOW
- EVERY server action/mutation: 1. Zod parse → 2. authorize(permission, { rateLimit? }) → 3. tenant_id filter → 4. tier/suspension check → 5. safeError() on failure
- NEVER bypass authorize() or ignore tenant_id in queries
- RLS + tenant_id mandatory on EVERY table — test policies
- NEVER use service-role client without explicit review
- Stripe webhook: ALWAYS verify signature + idempotency (stripe_events table)
- NEVER log/return PII, full errors, or secrets to client
- Use safeError() → logs real error server-side, generic client message

See `.claude/rules/` for detailed rules on security, server-actions, database, etc.

---

## SKILLS (activate when relevant)

### Core Development
- **senior-frontend**: React/Next.js patterns, hooks, TanStack Query/Zustand, server components, performance optimization
- **senior-backend**: Server actions, Supabase/Drizzle, Stripe, auth flows, performance/security
- **senior-architect**: Architecture, scalability, multi-tenancy design, trade-offs, refactoring strategy
- **senior-data-engineer**: Data pipelines, ETL/ELT, data modeling, pipeline orchestration, data quality

### Frontend & Design
- **design-taste-frontend**: ALWAYS activate for ANY UI/UX work — premium design taste, bias correction, anti-generic patterns, creative arsenal
- **frontend-design**: UI/UX, component patterns, Tailwind/shadcn, accessibility, responsive/glass effects
- **ui-ux-pro-max**: 50+ design styles, palettes, typography, charts — comprehensive UI/UX intelligence
- **ux-researcher-designer**: User research, persona generation, journey mapping, usability testing
- **mobile-design**: Mobile-first design thinking for iOS/Android — touch interaction, platform conventions
- **react-best-practices**: 40+ rules for React/Next.js performance — rendering, bundles, waterfalls

### Security & Quality
- **senior-security**: Application security, penetration testing, threat modeling, crypto, compliance auditing
- **code-reviewer**: Automated code analysis, best practice checking, security scanning, review checklists

### Specialized
- **brainstorming**: Use BEFORE any creative work — explores intent, requirements, and design before implementation
- **senior-prompt-engineer**: LLM optimization, prompt patterns, agentic system design, RAG, evaluation
- **webapp-testing**: Vitest unit + Playwright E2E tests, mocking, coverage suggestions
- **docx**: Reports, invoices, proposals, or Word-compatible document generation
- **skill-creator**: Define new custom rules/skills

When a task matches one of these, behave as that specialist first, then cross-check with other relevant skills and `.claude/rules/` files.

**UI/UX Rule**: For ANY UI/UX design, component creation, styling, or visual work — ALWAYS activate `design-taste-frontend` (taste-skill) first, then layer other design skills on top. See `.claude/rules/taste-design.md`.

---

## AGENTS (spawn for complex tasks)

### Development Team
- **fullstack-developer**: Full-stack implementation across frontend and backend
- **frontend-developer**: Frontend-focused builds, React/Next.js components, UI implementation
- **mobile-developer**: iOS/Android native and cross-platform mobile development
- **backend-architect**: Backend system architecture, API design, database schemas

### Quality & Security
- **security-auditor**: Comprehensive security audits, vulnerability assessment, compliance checks
- **code-reviewer**: Deep code reviews across TypeScript, JavaScript, Python, Swift, Kotlin, Go
- **debugger**: Root cause analysis, bug diagnosis, error log analysis, performance debugging

### Specialized
- **ui-ux-designer**: UI/UX design, wireframes, design systems, accessibility audits
- **prompt-engineer**: Prompt design, optimization, testing, and production prompt systems
- **documentation-expert**: Technical docs, API docs, architecture docs, user guides

---

## Commands (use these)
- npm run dev / build / lint
- npm run test:e2e (Playwright) / npx vitest (unit)
- npm run audit:security / audit:perf
- npx drizzle-kit generate / push

## Workflow (always)
1. Plan changes first (architecture impact, security)
2. After edits: lint + typecheck + run relevant tests
3. Security/auth changes → run npm run audit:security
4. Show BEFORE → AFTER diffs
5. Prefer single tests over full suite for speed

## Financial Model (critical — carrier walk-away if wrong)
- **Clean Gross** = revenue - brokerFees - localFees (per order)
- **Driver pay models** (src/lib/financial/trip-calculations.ts):
  - `percentage_of_carrier_pay`: % of Clean Gross per order
  - `dispatch_fee_percent`: driver gets Clean Gross minus dispatch fee % per order
  - `per_car`: flat rate × order count
  - `per_mile`: rate × total distance miles across orders
- **Per-order driver % override**: `order.driver_pay_rate_override` overrides driver's global `pay_rate` for that order (null = use default)
- **Local fee**: `order.local_fee` — terminal-to-dealer delivery fee, tracked separately from broker_fee
- Trip financials are **denormalized** on trips table (total_revenue, total_broker_fees, total_local_fees, driver_pay, etc.) — updated by `recalculateTripFinancials()`
- KPI engine: src/lib/financial/kpi-calculations.ts — pure functions, totalLocalFees included in expenses
- Supabase returns numeric columns as **strings** — always `parseFloat()` and store with `String()`

## Database Access (I can do this myself)
- **Direct DB access**: I can run migrations via the `postgres` npm driver with dotenv (`.env.local`)
- **Pattern**: Parse DATABASE_URL manually (has `@` in password), connect with `prepare: false`
- **Migrations**: Generate with `npx drizzle-kit generate`, then run SQL statements directly
- **Always use IF NOT EXISTS / IF NOT EXISTS** for idempotent migrations
- **RLS**: Always enable RLS + create policies after creating tables
- **Never ask user to run SQL** — I do it myself

## Key Gotchas (never violate)
- Drizzle = schema/migrations ONLY → runtime = Supabase JS client
- Server auth: getUser() via proxy.ts (NEVER getSession())
- Stripe client: lazy-loaded via Proxy
- Custom roles: "custom:{uuid}" → extract with .slice(7)
- DB: pooled URL + prepare: false (PgBouncer)
- Financial numeric fields: DB stores as string, Zod uses z.coerce.number(), actions convert with String()
- DATABASE_URL has `@` in password — parse with regex, not URL constructor

## Pre-Commit Verification Checklist (ALWAYS do before push)
1. **New DB columns**: Verify `.select()` in relevant queries includes the column (Supabase `*` with embedded relations may omit JSONB)
2. **New external API calls**: Verify the domain is in CSP `connect-src` in `next.config.ts`
3. **New storage buckets**: Verify bucket exists in DB + has RLS policies (INSERT/SELECT/DELETE)
4. **Provider/layout changes**: Trace which components use hooks — ensure they're inside the provider boundary
5. **TypeScript**: Run `npx tsc --noEmit` — Netlify build is stricter than local dev
6. **DB migrations**: After running, verify with SELECT that columns/tables/policies actually exist

When suggesting changes, first state which rules apply. If security risk → warn loudly and suggest alternatives.
