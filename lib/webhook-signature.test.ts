import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyWebhook } from "@/lib/webhook-signature";

const KEY = Buffer.from("a-test-signing-key-32-bytes-long!!");
const SECRET = `whsec_${KEY.toString("base64")}`;
const NOW = 1_800_000_000;
const BODY = JSON.stringify({ type: "email.bounced", data: { email_id: "msg-1" } });

const sign = (id: string, ts: number, body: string, key = KEY) =>
  `v1,${createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64")}`;
const headers = (signature: string, ts = NOW) => ({ id: "msg_evt_1", timestamp: String(ts), signature });

describe("verifyWebhook", () => {
  it("accepts a request signed with the endpoint's secret", () => {
    expect(verifyWebhook(SECRET, BODY, headers(sign("msg_evt_1", NOW, BODY)), NOW)).toBe(true);
  });

  it("accepts when one of several signatures matches (secret rotation)", () => {
    const signatures = `v1,AAAA ${sign("msg_evt_1", NOW, BODY)}`;
    expect(verifyWebhook(SECRET, BODY, headers(signatures), NOW)).toBe(true);
  });

  it("refuses a changed body, another secret, or a missing header", () => {
    expect(verifyWebhook(SECRET, BODY.replace("bounced", "delivered"), headers(sign("msg_evt_1", NOW, BODY)), NOW)).toBe(false);
    expect(verifyWebhook(SECRET, BODY, headers(sign("msg_evt_1", NOW, BODY, Buffer.from("other-key"))), NOW)).toBe(false);
    expect(verifyWebhook(SECRET, BODY, { id: null, timestamp: String(NOW), signature: "v1,x" }, NOW)).toBe(false);
  });

  it("refuses requests older or newer than five minutes (no replays)", () => {
    const old = NOW - 301;
    expect(verifyWebhook(SECRET, BODY, headers(sign("msg_evt_1", old, BODY), old), NOW)).toBe(false);
    const future = NOW + 301;
    expect(verifyWebhook(SECRET, BODY, headers(sign("msg_evt_1", future, BODY), future), NOW)).toBe(false);
  });
});
