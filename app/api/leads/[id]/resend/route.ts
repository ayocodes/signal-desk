// POST /api/leads/:id/resend { proposalId }: a person approves resending a bounced email to
// the proposed address. The admin or the lead's rep (RLS decides who can read the lead).
import { NextResponse } from "next/server";
import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { resendToCorrected } from "@/lib/sequence-service";

const Body = z.object({ proposalId: z.uuid() });

export async function POST(request: Request, ctx: RouteContext<"/api/leads/[id]/resend">) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: { code: "unauthorized", message: "Sign in again." } }, { status: 401 });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: { code: "invalid", message: "Send the proposal id." } }, { status: 400 });
  const { id } = await ctx.params;
  const result = await resendToCorrected(profile, id, body.data.proposalId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data);
}
