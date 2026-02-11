# Research Summary: VroomX SaaS TMS

**Domain:** Multi-tenant SaaS Transportation Management System for vehicle transport carriers
**Researched:** 2026-02-11
**Overall Confidence:** HIGH

## Executive Summary

VroomX is a multi-tenant SaaS TMS where vehicle transport carriers sign up, pick a tier, and get dispatch, driver management, billing, and an iOS driver app. The proposed stack (Next.js App Router + Supabase + Stripe + SwiftUI) is validated by current ecosystem research as the mainstream, well-supported choice for this type of product in 2025/2026.

The technology landscape for SaaS TMS products is mature. PostgreSQL RLS-based multi-tenancy is the consensus approach endorsed by AWS, Supabase, Crunchy Data, and Nile. Next.js dominates the SaaS boilerplate ecosystem with more production-ready starters than any alternative. Supabase provides the fastest path to a working multi-tenant backend with native auth-to-RLS integration that would take months to replicate with a custom backend.

The critical research finding is not about technology selection (the proposed stack is sound) but about implementation patterns. RLS performance can vary by 100x depending on whether policies use `(SELECT auth.uid())` vs `auth.uid()`. Stripe webhook idempotency and dunning flow handling are where SaaS billing breaks. And the shadcn/ui component library should use Base UI primitives (not Radix UI) for new projects, given Radix's reduced maintenance status.

The main risk vector is not technology -- it is execution speed. Every component in this stack is well-documented with production examples. The team has prior Supabase experience from Horizon Star. The goal should be shipping an MVP to real carriers as fast as possible.

## Key Findings

**Stack:** Next.js 15 App Router + Supabase + Stripe + TanStack Query + Zustand + shadcn/ui + Drizzle. All validated, no changes needed from initial proposal.

**Architecture:** Shared PostgreSQL schema with RLS tenant isolation. Supabase handles auth/DB/storage/realtime. Complex queries via Drizzle ORM server-side. Stripe Checkout (not custom payment UI) for billing.

**Critical pitfall:** RLS policies without `(SELECT ...)` wrapper and without indexed `tenant_id` columns can degrade query performance by 100x+ on large tables. This must be established as a pattern from day one.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Foundation & Multi-Tenancy** -- Database schema with RLS, Supabase Auth with tenant_id in JWT claims, Stripe subscription integration
   - Addresses: Core tenant isolation, billing infrastructure
   - Avoids: RLS performance pitfalls by establishing patterns early

2. **Core TMS Features** -- Orders, trips, dispatch board, driver management
   - Addresses: Table stakes features carriers expect
   - Avoids: Building features before billing works (carriers cannot pay)

3. **Driver App Integration** -- SwiftUI app connecting to multi-tenant backend
   - Addresses: Driver-facing workflows (inspections, BOL, earnings)
   - Avoids: Building app before backend APIs are stable

4. **Billing & Self-Service** -- Tier enforcement, usage limits, billing portal, dunning
   - Addresses: Revenue infrastructure beyond basic checkout
   - Avoids: Manual billing operations

5. **Reporting & Analytics** -- Financial reports, fleet performance, compliance
   - Addresses: Differentiator features
   - Avoids: Premature optimization before core CRUD is solid

6. **Growth Features** -- Custom branding, API access, integrations (load boards, ELD)
   - Addresses: Enterprise tier value proposition
   - Avoids: Building before there is demand signal

**Phase ordering rationale:**
- Multi-tenancy foundation MUST come first -- every subsequent feature depends on tenant isolation working correctly
- Billing before features ensures you can charge from the moment features ship
- Driver app after backend because the app is a consumer of APIs, not a producer
- Reporting and growth features are differentiators that can wait for post-MVP

**Research flags for phases:**
- Phase 1: Needs careful RLS policy design -- follow the optimization patterns documented in PITFALLS.md
- Phase 3: May need research on Supabase Swift SDK capabilities for multi-tenant auth
- Phase 6: Load board API integrations (Central Dispatch, Super Dispatch) will need specific API research

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies verified with official docs and multiple sources |
| Features | HIGH | TMS domain is well-understood, team has existing product |
| Architecture | HIGH | RLS multi-tenancy is consensus, verified with AWS/Supabase/Crunchy Data |
| Pitfalls | HIGH | RLS performance patterns documented from official Supabase troubleshooting guide |
| Pricing/Billing | MEDIUM-HIGH | Stripe patterns well-documented; tier structure needs market validation |

## Gaps to Address

- Supabase Swift SDK multi-tenant auth patterns (needed for Phase 3)
- Load board API documentation (Central Dispatch, Super Dispatch) for Phase 6
- Exact Vercel cost projections at 100/500/1000 tenant scale
- Background job strategy for heavy tasks (report generation, bulk operations) -- Trigger.dev or Inngest evaluation needed for Phase 5
