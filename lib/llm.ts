// The single LLM interface for the web app (AGENTS.md), the twin of agent/llm.py.
// Gemini is called over its REST API with fetch (no SDK); the model comes from GEMINI_MODEL.
// The API key travels in a header, so it never appears in a URL, a log line or an error.
//
// Rate limits: a 429 for the per-day quota throws LlmQuotaExhausted. A 429 for the per-minute
// quota waits for the delay Google asks for (at most 60 s) and tries once more. A 500 or 503
// (Google overloaded) waits 5 s and tries once more. Retries happen inside one reserved call,
// so they don't spend more of the budget.

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent";
const TIMEOUT_MS = 90_000;
const MAX_WAIT_SECONDS = 60;
const BUSY_STATUSES = [500, 503];
const BUSY_WAIT_SECONDS = 5;

/** The call failed; the message is safe to store and show (no key, no prompt). */
export class LlmError extends Error {
  name = "LlmError";
}
/** The model's daily quota is used up; no call can succeed until it resets. */
export class LlmQuotaExhausted extends LlmError {
  name = "LlmQuotaExhausted";
}
/** Still over the per-minute limit after waiting once. */
export class LlmRateLimited extends LlmError {
  name = "LlmRateLimited";
}

export type LlmResult = { text: string; model: string; tokensIn: number; tokensOut: number; ms: number };
export type LlmSettings = { provider: "gemini" | "groq"; apiKey: string; model: string };
type Deps = { fetch?: typeof fetch; sleep?: (seconds: number) => Promise<void> };

type GoogleError = { message?: string; details?: { retryDelay?: string; violations?: { quotaId?: string }[] }[] };

const defaultSleep = (seconds: number) => new Promise<void>((resolve) => setTimeout(resolve, seconds * 1000));

function retryDelay(details: GoogleError["details"] = []): number | null {
  for (const detail of details) {
    const match = /^(\d+(?:\.\d+)?)s$/.exec(detail.retryDelay ?? "");
    if (match) return Number(match[1]);
  }
  return null;
}

function isDailyQuota(details: GoogleError["details"] = []): boolean {
  return details.some((detail) => (detail.violations ?? []).some((v) => (v.quotaId ?? "").includes("PerDay")));
}

async function googleError(response: Response): Promise<GoogleError> {
  try {
    const body = (await response.json()) as { error?: GoogleError };
    return body.error ?? {};
  } catch {
    return {}; // not JSON: the status code alone describes the failure
  }
}

type GeminiAnswer = {
  candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  modelVersion?: string;
};

function toResult(data: GeminiAnswer, model: string, ms: number): LlmResult {
  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .filter((part) => !part.thought)
    .map((part) => part.text ?? "")
    .join("");
  if (!text) throw new LlmError(`Gemini returned no text (${candidate?.finishReason ?? "no candidates"})`);
  const usage = data.usageMetadata ?? {};
  return {
    text,
    model: data.modelVersion || model,
    tokensIn: usage.promptTokenCount ?? 0,
    // Thinking tokens are billed as output, so they count here too.
    tokensOut: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
    ms,
  };
}

export async function geminiGenerateJson(
  settings: LlmSettings,
  prompt: string,
  schema: object,
  deps: Deps = {},
): Promise<LlmResult> {
  const doFetch = deps.fetch ?? fetch;
  const sleep = deps.sleep ?? defaultSleep;
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", responseJsonSchema: schema },
  });

  for (const attempt of [1, 2]) {
    const started = performance.now();
    let response: Response;
    try {
      response = await doFetch(GEMINI_URL.replace("{model}", settings.model), {
        method: "POST",
        headers: { "x-goog-api-key": settings.apiKey, "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new LlmError(`Request to Gemini failed: ${error instanceof Error ? error.name : "unknown error"}`);
    }
    const ms = Math.round(performance.now() - started);
    if (response.status === 429) {
      const details = (await googleError(response)).details;
      if (isDailyQuota(details)) throw new LlmQuotaExhausted("Gemini's daily request quota is used up");
      if (attempt === 1) {
        await sleep(Math.min(retryDelay(details) ?? 30, MAX_WAIT_SECONDS));
        continue;
      }
      throw new LlmRateLimited("Gemini is still rate limiting after one wait");
    }
    if (BUSY_STATUSES.includes(response.status) && attempt === 1) {
      await sleep(BUSY_WAIT_SECONDS);
      continue;
    }
    if (!response.ok) {
      const message = (await googleError(response)).message ?? "";
      throw new LlmError(`Gemini answered ${response.status}: ${message.slice(0, 200)}`);
    }
    return toResult((await response.json()) as GeminiAnswer, settings.model, ms);
  }
  throw new LlmRateLimited("Gemini is still rate limiting after one wait");
}

/** One prompt, answered as JSON following `schema`, by the provider LLM_PROVIDER selects. */
export async function generateJson(prompt: string, schema: object): Promise<LlmResult> {
  const { env } = await import("@/lib/env"); // server only; loaded here so tests can import this file
  if (env.llm.provider !== "gemini") throw new LlmError("The Groq provider isn't built yet: set LLM_PROVIDER=gemini.");
  return geminiGenerateJson(env.llm, prompt, schema);
}
