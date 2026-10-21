import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Env is read only through lib/env.ts (server) and lib/env.public.ts (browser),
    // which validate it. Config files and scripts read it directly.
    ignores: ["lib/env.ts", "lib/env.public.ts", "next.config.ts", "scripts/**"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message: "Read env through lib/env.ts (server) or lib/env.public.ts (browser).",
        },
      ],
    },
  },
  {
    // The agent's rules are read only through lib/agent-config.ts (twin of agent/config.py
    // load_config), so Phase 4.5 can move them into the database without touching callers.
    ignores: ["lib/agent-config.ts", "scripts/**", "**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/shared/defaults/rules.json", "**/shared/guardrails.json", "**/shared/outreach.json"],
              message: "Read the agent's rules through getAgentConfig(orgId) in lib/agent-config.ts.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "agent/**",
  ]),
]);

export default eslintConfig;
