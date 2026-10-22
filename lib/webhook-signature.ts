// Verifies a Resend webhook. Resend signs with Svix: HMAC-SHA256 over "{id}.{timestamp}.{body}"
// with the endpoint's signing secret ("whsec_" + base64 key), sent as "v1,<base64>" entries
// in the svix-signature header. Checked with node:crypto, no SDK. Old timestamps are refused,
// so a captured request can't be replayed later.
import { createHmac, timingSafeEqual } from "node:crypto";

const TOLERANCE_SECONDS = 5 * 60;

export type SignatureHeaders = { id: string | null; timestamp: string | null; signature: string | null };

export function verifyWebhook(
  secret: string,
  body: string,
  headers: SignatureHeaders,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;
  const sent = Number(timestamp);
  if (!Number.isInteger(sent) || Math.abs(nowSeconds - sent) > TOLERANCE_SECONDS) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();
  return signature.split(" ").some((entry) => {
    const [version, value] = entry.split(",", 2);
    if (version !== "v1" || !value) return false;
    const given = Buffer.from(value, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
