// POST /api/mailboxes/:id/resume: an admin resumes a paused mailbox (lib/mailbox-service.ts).
import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { resumeMailbox } from "@/lib/mailbox-service";

export async function POST(_request: Request, ctx: RouteContext<"/api/mailboxes/[id]/resume">) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: { code: "unauthorized", message: "Sign in again." } }, { status: 401 });
  if (profile.role !== "admin") {
    return NextResponse.json({ error: { code: "forbidden", message: "Only admins can resume a mailbox." } }, { status: 403 });
  }
  const { id } = await ctx.params;
  const result = await resumeMailbox(profile, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data);
}
