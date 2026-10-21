// The Gemini call against canned HTTP answers (no network). Mirrors agent/tests/test_llm.py.
import { describe, expect, it } from "vitest";
import { geminiGenerateJson, LlmError, LlmQuotaExhausted, LlmRateLimited } from "@/lib/llm";

const SETTINGS = { provider: "gemini" as const, apiKey: "secret-key", model: "gemini-test" };
const OK = {
  candidates: [{ content: { parts: [{ text: "thinking...", thought: true }, { text: '{"drafts": []}' }] } }],
  usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 150, thoughtsTokenCount: 50 },
  modelVersion: "gemini-test-001",
};

function quotaError(quotaId: string, delay?: string) {
  const details: object[] = [{ "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId }] }];
  if (delay) details.push({ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: delay });
  return { error: { code: 429, message: "quota", details } };
}

function scripted(...answers: [number, object][]) {
  const requests: { url: string; init: RequestInit }[] = [];
  const waits: number[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    requests.push({ url, init });
    const [status, body] = answers.shift()!;
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof globalThis.fetch;
  const sleep = async (seconds: number) => {
    waits.push(seconds);
  };
  return { deps: { fetch, sleep }, requests, waits };
}

const MINUTE = "GenerateRequestsPerMinutePerProjectPerModel-FreeTier";

describe("geminiGenerateJson", () => {
  it("returns text and tokens, and sends the key in a header, never the URL", async () => {
    const { deps, requests } = scripted([200, OK]);
    const result = await geminiGenerateJson(SETTINGS, "prompt", { type: "object" }, deps);
    expect(result).toMatchObject({ text: '{"drafts": []}', model: "gemini-test-001", tokensIn: 900, tokensOut: 200 });
    const { url, init } = requests[0];
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("secret-key");
    expect(url).not.toContain("secret-key");
    expect(url).toContain("models/gemini-test:generateContent");
    expect(JSON.parse(init.body as string).generationConfig.responseJsonSchema).toEqual({ type: "object" });
  });

  it("stops on the daily quota without waiting", async () => {
    const { deps, waits } = scripted([429, quotaError("GenerateRequestsPerDayPerProjectPerModel-FreeTier", "40s")]);
    await expect(geminiGenerateJson(SETTINGS, "p", {}, deps)).rejects.toBeInstanceOf(LlmQuotaExhausted);
    expect(waits).toEqual([]);
  });

  it("waits the asked delay once on the per-minute limit, capped at 60 s", async () => {
    const first = scripted([429, quotaError(MINUTE, "12.5s")], [200, OK]);
    expect((await geminiGenerateJson(SETTINGS, "p", {}, first.deps)).tokensIn).toBe(900);
    expect(first.waits).toEqual([12.5]);

    const second = scripted([429, quotaError(MINUTE, "300s")], [429, quotaError(MINUTE, "300s")]);
    await expect(geminiGenerateJson(SETTINGS, "p", {}, second.deps)).rejects.toBeInstanceOf(LlmRateLimited);
    expect(second.waits).toEqual([60]);
  });

  it("names the status on other errors but never the key", async () => {
    const { deps } = scripted([400, { error: { code: 400, message: "Invalid JSON schema" } }]);
    const error = await geminiGenerateJson(SETTINGS, "p", {}, deps).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LlmError);
    expect(String(error)).toContain("400");
    expect(String(error)).not.toContain("secret-key");
  });

  it("treats an answer without text as an error", async () => {
    const { deps } = scripted([200, { candidates: [{ finishReason: "SAFETY", content: { parts: [] } }] }]);
    await expect(geminiGenerateJson(SETTINGS, "p", {}, deps)).rejects.toThrow(/SAFETY/);
  });
});
