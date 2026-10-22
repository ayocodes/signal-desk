import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const KEY = Buffer.from("a-test-signing-key-32-bytes-long!!");
const state = vi.hoisted(() => ({ secret: null as string | null, apply: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: { resend: { get webhookSecret() { return state.secret; } } } }));
vi.mock("@/lib/email-events", () => ({ applyEmailEvent: state.apply }));

const { POST } = await import("@/app/api/webhooks/resend/route");

function signed(body: string, key = KEY) {
  const ts = Math.floor(Date.now() / 1000);
  const signature = `v1,${createHmac("sha256", key).update(`evt_1.${ts}.${body}`).digest("base64")}`;
  return new Request("http://localhost/api/webhooks/resend", {
    method: "POST",
    body,
    headers: { "svix-id": "evt_1", "svix-timestamp": String(ts), "svix-signature": signature },
  });
}

const bounce = JSON.stringify({ type: "email.bounced", data: { email_id: "msg-1", bounce: { message: "Mailbox does not exist" } } });

beforeEach(() => {
  vi.clearAllMocks();
  state.secret = `whsec_${KEY.toString("base64")}`;
  state.apply.mockResolvedValue({ stored: true });
});

describe("POST /api/webhooks/resend", () => {
  it("refuses everything while the signing secret isn't set", async () => {
    state.secret = null;
    expect((await POST(signed(bounce))).status).toBe(503);
    expect(state.apply).not.toHaveBeenCalled();
  });

  it("refuses a bad signature", async () => {
    expect((await POST(signed(bounce, Buffer.from("not-the-key")))).status).toBe(401);
    expect(state.apply).not.toHaveBeenCalled();
  });

  it("hands a signed event to the shared handler with Resend's event id", async () => {
    const response = await POST(signed(bounce));
    expect(response.status).toBe(200);
    expect(state.apply).toHaveBeenCalledWith(expect.objectContaining({
      messageId: "msg-1", type: "bounced", source: "resend", providerEventId: "evt_1", actorId: null,
    }));
  });

  it("acknowledges events that aren't about an email without storing them", async () => {
    const response = await POST(signed(JSON.stringify({ type: "domain.updated", data: {} })));
    expect(await response.json()).toEqual({ ok: true, ignored: "Not an email event" });
    expect(state.apply).not.toHaveBeenCalled();
  });
});
