// POST /api/leads/:id/draft { angle }: Regenerate one angle, or make the Unconstrained draft
// ("raw") the first time it's opened. Rate-limited per user and counted against the daily
// LLM budget (lib/draft-service.ts).
import { NextResponse } from "next/server";
import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { generateDraft } from "@/lib/draft-service";

const Body = z.object({ angle: z.enum(["signal", "peer", "short", "raw"]) });

export async function POST(request: Request, ctx: RouteContext<"/api/leads/[id]/draft">) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: { code: "unauthorized", message: "Sign in again." } }, { status: 401 });

  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: { code: "invalid", message: "Pick signal, peer, short or raw." } }, { status: 400 });
  }

  const { id } = await ctx.params;
  const result = await generateDraft(profile, id, body.data.angle);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ draft: result.data });
}
