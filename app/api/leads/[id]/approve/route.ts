// POST /api/leads/:id/approve { draftId, subject, body }: re-runs the guardrails on the server,
// then enrolls the lead through approve_lead(), which checks access again in the database.
import { NextResponse } from "next/server";
import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { approveLead } from "@/lib/draft-service";

const Body = z.object({
  draftId: z.uuid(),
  subject: z.string().max(300),
  body: z.string().min(1).max(5000),
});

export async function POST(request: Request, ctx: RouteContext<"/api/leads/[id]/approve">) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: { code: "unauthorized", message: "Sign in again." } }, { status: 401 });

  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: { code: "invalid", message: "Send a draft id, a subject and a body." } }, { status: 400 });
  }

  const { id } = await ctx.params;
  const result = await approveLead(profile, id, body.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ sequenceId: result.data.sequenceId });
}
