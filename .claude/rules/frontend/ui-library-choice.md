# UI Library Choice — Anti-Patterns to Avoid

Applies to: any new frontend dependency that renders animated counters,
odometers, overlays, tooltips, or other visual primitives on marketing /
dashboard pages.

## The anti-pattern

Do **not** introduce UI libraries that rely on **all** of the following:

1. A **Web Component** (`customElements.define(...)`) as the visible element.
2. An `esm-env`-style runtime browser check (e.g. a `BROWSER` constant) gating
   the `define()` call.
3. An **SSR fallback** that renders raw internal state (e.g. a `0–9` digit tape,
   a ruler, a raw data attribute) which is expected to be clipped by shadow DOM
   on hydration.

Libraries fitting this profile break catastrophically when **any** of our build
layers — Turbopack, `@serwist/next`, `@sentry/nextjs`, a Next.js minor bump,
`esm-env`, or the library itself — changes export-condition resolution. The
failure mode is "raw fallback text leaks onto the page," not a build error, so
it is easy to miss in CI and slips straight onto the public landing page.

## History (why this rule exists)

`@number-flow/react` regressed this way **twice** on VroomX:

- **8ce3a8b** (Apr 9, 2026) introduced `withSerwist` for PWA support. That
  change rewired Turbopack's module resolution for client chunks and caused
  `esm-env`'s `BROWSER` to resolve to `false` in the landing-page bundle.
  The result was the infamous `0123456789,0123456789,…` digit tape showing
  on `/` and `/pricing`.
- **8fc1f68** "fixed" it by adding
  `transpilePackages: ['@number-flow/react', 'number-flow', 'esm-env']` to
  `next.config.ts`. That worked at the time.
- Some time later the bug returned even with that `transpilePackages` block
  still in place. Another config knob was not a stable solution.

The correct fix (not a patch) was to eliminate the dependency entirely and
replace it with a pure-React component. See
[`src/components/ui/animated-number.tsx`](../../../src/components/ui/animated-number.tsx).

## What to do instead

For any animated-number / counter / odometer need, use
`src/components/ui/animated-number.tsx`. It:

- Renders plain DOM (`<span>`) — no Web Components, no shadow DOM.
- Uses `requestAnimationFrame` for the tween.
- Uses `Intl.NumberFormat` for grouping / decimals / locale.
- Is SSR-safe: server renders the final formatted value as plain text, so if
  JS never loads or if `trigger` never flips, the user still sees the correct
  number.
- Respects `prefers-reduced-motion`.
- Accepts a `trigger: boolean` prop so the parent can wire it to
  `useInView` from `motion/react` without the component owning scroll logic.

If a new requirement can't be satisfied by `AnimatedNumber`, **extend that
component**; do not reach for a new library.

## Green-light checklist for any new frontend dependency

Before installing a UI package, verify:

- [ ] It renders plain DOM or a React component tree — **no `customElements.define`**.
- [ ] If it does animation, it uses `requestAnimationFrame`, CSS transforms /
      transitions, or `motion/react` — not a web-component internal loop that
      depends on shadow-DOM clipping of fallback content.
- [ ] Its README has a "SSR-safe" statement, or you have verified that its
      SSR output is the final visible state (not a tape / ruler / raw state).
- [ ] If it uses `esm-env`, you can demonstrate that its `BROWSER` gate survives
      Turbopack's export-condition resolution under the current
      `withSentryConfig(withSerwist(withBundleAnalyzer(...)))` wrapper chain.
      In practice: **just avoid libraries that depend on `esm-env` for
      browser detection.**
- [ ] It has been in maintenance mode for at least 6 months without unexplained
      silent-failure issues in its tracker.

If any box is unchecked, do not install. Build the primitive in-house or pick a
different library.

## See also

- `.claude/rules/frontend/senior-frontend.md` — general React/Next conventions
- `.claude/rules/frontend/react-best-practices.md` — hook / component rules
- `src/components/ui/animated-number.tsx` — the canonical replacement component
