// POST /api/leads/:id/test-inbox { inbox }: admin demo control, which Resend test inbox the
// lead's contact uses (delivered, bounced, complained). Audit logged (lib/sequence-service.ts).
import { NextResponse } from "next/server";
import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { setTestInbox } from "@/lib/sequence-service";

const Body = z.object({ inbox: z.enum(["delivered", "bounced", "complained"]) });

export async function POST(request: Request, ctx: RouteContext<"/api/leads/[id]/test-inbox">) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: { code: "unauthorized", message: "Sign in again." } }, { status: 401 });
  if (profile.role !== "admin") {
    return NextResponse.json({ error: { code: "forbidden", message: "Only admins can change the test inbox." } }, { status: 403 });
  }
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: { code: "invalid", message: "Pick delivered, bounced or complained." } }, { status: 400 });
  const { id } = await ctx.params;
  const result = await setTestInbox(profile, id, body.data.inbox);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data);
}
