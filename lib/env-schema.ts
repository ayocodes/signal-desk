// Environment rules, shared by next.config.ts (fails `next dev` / `next build` early),
// lib/env.ts (server) and lib/env.public.ts (browser). Pure functions: no process.env here.
import { z } from "zod";

type Source = Record<string, string | undefined>;

export class EnvError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    this.name = "EnvError";
  }
}

// Empty or whitespace-only values count as missing.
function clean(source: Source, keys: readonly string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const key of keys) {
    const value = source[key]?.trim();
    out[key] = value ? value : undefined;
  }
  return out;
}

// Turn zod issues into messages that name the variable but never echo its value.
function describe(issues: z.core.$ZodIssue[]): string[] {
  return issues.map((issue) => {
    const key = String(issue.path[0] ?? "unknown");
    if (issue.code === "invalid_type") return `Missing environment variable ${key}`;
    return `Invalid environment variable ${key}: ${issue.message}`;
  });
}

const PUBLIC_KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ error: "must be a URL" }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string(),
});

const SERVER_KEYS = [
  ...PUBLIC_KEYS,
  "SUPABASE_SERVICE_ROLE_KEY",
  "LLM_PROVIDER",
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "GROQ_API_KEY",
  "GROQ_MODEL",
  "RESEND_API_KEY",
  "RESEND_FROM",
  "RESEND_WEBHOOK_SECRET",
  "DEMO_ADMIN_EMAIL",
  "DEMO_ADMIN_PASSWORD",
  "DEMO_REP_EMAIL",
  "DEMO_REP_PASSWORD",
  "GITHUB_DISPATCH_TOKEN",
  "GITHUB_REPO",
] as const;

// The selected provider's key and model are required; the other provider's are optional.
const PROVIDER_KEYS = {
  gemini: ["GEMINI_API_KEY", "GEMINI_MODEL"],
  groq: ["GROQ_API_KEY", "GROQ_MODEL"],
} as const;

const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  LLM_PROVIDER: z.enum(["gemini", "groq"], { error: 'must be "gemini" or "groq"' }),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().optional(),
  RESEND_API_KEY: z.string(),
  RESEND_FROM: z.string(),
  RESEND_WEBHOOK_SECRET: z.string().optional(),
  DEMO_ADMIN_EMAIL: z.email({ error: "must be an email address" }),
  DEMO_ADMIN_PASSWORD: z.string(),
  DEMO_REP_EMAIL: z.email({ error: "must be an email address" }),
  DEMO_REP_PASSWORD: z.string(),
  GITHUB_DISPATCH_TOKEN: z.string().optional(),
  GITHUB_REPO: z.string().optional(),
});

// Checked outside zod so these are reported together with any other problems
// (zod skips refinements while the object has other errors).
function missingProviderKeys(values: Record<string, string | undefined>): string[] {
  const provider = values.LLM_PROVIDER;
  if (provider !== "gemini" && provider !== "groq") return [];
  return PROVIDER_KEYS[provider]
    .filter((key) => !values[key])
    .map((key) => `Missing environment variable ${key} (required when LLM_PROVIDER=${provider})`);
}

export type PublicEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export type ServerEnv = PublicEnv & {
  supabaseServiceRoleKey: string;
  llm: { provider: "gemini" | "groq"; apiKey: string; model: string };
  resend: {
    apiKey: string;
    from: string;
    // null means the webhook route rejects every request.
    webhookSecret: string | null;
  };
  demo: {
    admin: { email: string; password: string };
    rep: { email: string; password: string };
  };
  // null hides the "Run agent now" button; both values are needed.
  githubDispatch: { token: string; repo: string } | null;
};

export function parsePublicEnv(source: Source): PublicEnv {
  const result = publicSchema.safeParse(clean(source, PUBLIC_KEYS));
  if (!result.success) throw new EnvError(describe(result.error.issues));
  return {
    supabaseUrl: result.data.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: result.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function parseServerEnv(source: Source): ServerEnv {
  const values = clean(source, SERVER_KEYS);
  const result = serverSchema.safeParse(values);
  const problems = [...(result.success ? [] : describe(result.error.issues)), ...missingProviderKeys(values)];
  if (!result.success || problems.length > 0) throw new EnvError(problems);

  const v = result.data;
  // Non-null is safe: missingProviderKeys() rejected a missing key or model for the selected provider.
  const llm =
    v.LLM_PROVIDER === "gemini"
      ? { provider: v.LLM_PROVIDER, apiKey: v.GEMINI_API_KEY!, model: v.GEMINI_MODEL! }
      : { provider: v.LLM_PROVIDER, apiKey: v.GROQ_API_KEY!, model: v.GROQ_MODEL! };

  return {
    supabaseUrl: v.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: v.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: v.SUPABASE_SERVICE_ROLE_KEY,
    llm,
    resend: { apiKey: v.RESEND_API_KEY, from: v.RESEND_FROM, webhookSecret: v.RESEND_WEBHOOK_SECRET ?? null },
    demo: {
      admin: { email: v.DEMO_ADMIN_EMAIL, password: v.DEMO_ADMIN_PASSWORD },
      rep: { email: v.DEMO_REP_EMAIL, password: v.DEMO_REP_PASSWORD },
    },
    githubDispatch:
      v.GITHUB_DISPATCH_TOKEN && v.GITHUB_REPO ? { token: v.GITHUB_DISPATCH_TOKEN, repo: v.GITHUB_REPO } : null,
  };
}
