import { describe, expect, it } from "vitest";
import { EnvError, parsePublicEnv, parseServerEnv } from "./env-schema";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
  LLM_PROVIDER: "gemini",
  GEMINI_API_KEY: "gemini-key",
  GEMINI_MODEL: "gemini-model",
  LLM_DAILY_BUDGET: "20",
  RESEND_API_KEY: "resend-key",
  RESEND_FROM: "onboarding@resend.dev",
  DEMO_ADMIN_EMAIL: "admin@example.com",
  DEMO_ADMIN_PASSWORD: "admin-pass",
  DEMO_REP_EMAIL: "rep@example.com",
  DEMO_REP_PASSWORD: "rep-pass",
};

function problemsFor(source: Record<string, string | undefined>): string[] {
  try {
    parseServerEnv(source);
  } catch (error) {
    if (error instanceof EnvError) return error.problems;
    throw error;
  }
  return [];
}

describe("parseServerEnv", () => {
  it("requires LLM_DAILY_BUDGET as a whole number", () => {
    expect(parseServerEnv(valid).llm.dailyBudget).toBe(20);
    expect(problemsFor({ ...valid, LLM_DAILY_BUDGET: undefined })).toEqual(["Missing environment variable LLM_DAILY_BUDGET"]);
    expect(problemsFor({ ...valid, LLM_DAILY_BUDGET: "lots" })).toEqual([
      "Invalid environment variable LLM_DAILY_BUDGET: must be a whole number",
    ]);
    expect(problemsFor({ ...valid, LLM_DAILY_BUDGET: "2.5" })).toEqual([
      "Invalid environment variable LLM_DAILY_BUDGET: must be a whole number",
    ]);
  });

  it("accepts a complete gemini config and leaves optional features off", () => {
    const env = parseServerEnv(valid);
    expect(env.llm).toEqual({ provider: "gemini", apiKey: "gemini-key", model: "gemini-model", dailyBudget: 20 });
    expect(env.resend.webhookSecret).toBeNull();
    expect(env.githubDispatch).toBeNull();
  });

  it("treats empty and whitespace-only strings as missing", () => {
    expect(problemsFor({ ...valid, RESEND_FROM: "" })).toEqual(["Missing environment variable RESEND_FROM"]);
    expect(problemsFor({ ...valid, DEMO_REP_PASSWORD: "   " })).toEqual([
      "Missing environment variable DEMO_REP_PASSWORD",
    ]);
  });

  it("requires the selected provider's key and model", () => {
    expect(problemsFor({ ...valid, GEMINI_MODEL: undefined })).toEqual([
      "Missing environment variable GEMINI_MODEL (required when LLM_PROVIDER=gemini)",
    ]);
    expect(problemsFor({ ...valid, LLM_PROVIDER: "groq", GROQ_API_KEY: "k" })).toEqual([
      "Missing environment variable GROQ_MODEL (required when LLM_PROVIDER=groq)",
    ]);
  });

  it("does not require the other provider's values", () => {
    const env = parseServerEnv({ ...valid, LLM_PROVIDER: "groq", GROQ_API_KEY: "k", GROQ_MODEL: "m", GEMINI_API_KEY: "" });
    expect(env.llm).toEqual({ provider: "groq", apiKey: "k", model: "m", dailyBudget: 20 });
  });

  it("lists every problem at once, including provider keys", () => {
    const problems = problemsFor({ ...valid, RESEND_API_KEY: "", GEMINI_API_KEY: "", DEMO_ADMIN_EMAIL: undefined });
    expect(problems).toHaveLength(3);
    expect(problems.join("\n")).toContain("RESEND_API_KEY");
    expect(problems.join("\n")).toContain("DEMO_ADMIN_EMAIL");
    expect(problems.join("\n")).toContain("GEMINI_API_KEY (required when LLM_PROVIDER=gemini)");
  });

  it("rejects an unknown provider without echoing the value", () => {
    const problems = problemsFor({ ...valid, LLM_PROVIDER: "secret-ish-value" });
    expect(problems).toEqual(['Invalid environment variable LLM_PROVIDER: must be "gemini" or "groq"']);
  });

  it("never includes values in error messages", () => {
    const problems = problemsFor({ ...valid, DEMO_ADMIN_EMAIL: "not-an-email-hunter2", RESEND_API_KEY: "" });
    expect(problems.join("\n")).not.toContain("hunter2");
    expect(problems).toContain("Invalid environment variable DEMO_ADMIN_EMAIL: must be an email address");
  });

  it("enables GitHub dispatch only when both values are set", () => {
    expect(parseServerEnv({ ...valid, GITHUB_REPO: "owner/repo" }).githubDispatch).toBeNull();
    expect(parseServerEnv({ ...valid, GITHUB_REPO: "owner/repo", GITHUB_DISPATCH_TOKEN: "t" }).githubDispatch).toEqual({
      token: "t",
      repo: "owner/repo",
    });
  });

  it("passes the webhook secret through when set", () => {
    expect(parseServerEnv({ ...valid, RESEND_WEBHOOK_SECRET: "whsec_x" }).resend.webhookSecret).toBe("whsec_x");
  });
});

describe("parsePublicEnv", () => {
  it("names a missing public variable", () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co" })).toThrow(
      "Missing environment variable NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  });
});
