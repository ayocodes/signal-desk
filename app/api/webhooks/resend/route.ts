// POST /api/webhooks/resend: Resend's email events (delivered, bounced, complained, ...).
// Every request is refused until RESEND_WEBHOOK_SECRET is set, and any request whose Svix
// signature doesn't match. Duplicates (Resend retries) are stored once. proxy.ts skips this
// path: Resend has no session; the signature is the authentication.
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { applyEmailEvent } from "@/lib/email-events";
import { verifyWebhook } from "@/lib/webhook-signature";
import type { Json } from "@/lib/database.types";

export async function POST(request: Request) {
  const secret = env.resend.webhookSecret;
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });

  const body = await request.text();
  const headers = {
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
  };
  if (!verifyWebhook(secret, body, headers)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { type?: unknown; data?: { email_id?: unknown } };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Body is not JSON" }, { status: 400 });
  }
  const type = typeof event.type === "string" ? event.type.replace(/^email\./, "") : null;
  const messageId = typeof event.data?.email_id === "string" ? event.data.email_id : null;
  if (!type || !messageId) return NextResponse.json({ ok: true, ignored: "Not an email event" });

  // Errors throw and answer 500, so Resend retries; a repeat is then ignored by its id.
  const result = await applyEmailEvent({
    messageId,
    type,
    source: "resend",
    providerEventId: headers.id,
    payload: event as unknown as Json,
    actorId: null,
  });
  return NextResponse.json({ ok: true, ...result });
}
