import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import security from "eslint-plugin-security";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: { security },
    rules: {
      ...security.configs.recommended.rules,
      // React Compiler preparation rules — downgraded to warn until RC is adopted.
      //
      // eslint-plugin-react-hooks ships two rules that are designed to help
      // projects prepare for the React Compiler: `set-state-in-effect` and
      // `preserve-manual-memoization`. They fire as errors by default, but
      // they only represent actual bugs IF you have the React Compiler
      // turned on (the rules check for patterns the compiler can't optimize).
      //
      // VroomX does NOT have React Compiler enabled in next.config.ts as of
      // 2026-04-11. The existing call sites flagged by these rules are all
      // legitimate patterns (form resets on prop change, SSR hydration guards,
      // imperative bridges for drag state, memoized CSV export callbacks, etc.)
      // documented in scripts/2026-04-11 lint-triage.
      //
      // Leaving these as warnings keeps them visible if the project adopts
      // React Compiler later, but doesn't block CI today. Each legitimate
      // false-positive site was reviewed by the senior-frontend agent on
      // 2026-04-11 — see commit message for the full per-file audit.
      //
      // To re-enable as errors: opt into React Compiler in next.config.ts,
      // then flip these back to 'error' and fix the flagged sites in the
      // order documented in the audit.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Build output / deployment artifacts — never lint generated code:
    ".netlify/**",
    "coverage/**",
    "playwright-report/**",
    // Tooling / editor / agent caches — not application code:
    ".claude/**",
    ".playwright-cli/**",
    ".playwright-mcp/**",
    ".codex/**",
    ".agents/**",
    "Vault/**",
    // Separate workspace with its own lint pipeline (browser extension):
    "vroomx-pdf-extension/**",
  ]),
]);

export default eslintConfig;
