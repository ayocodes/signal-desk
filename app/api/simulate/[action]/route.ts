// POST /api/simulate/{reply|open|fast-forward} { leadId }: admin-only demo actions, labelled
// "Simulated" everywhere (lib/sequence-service.ts).
import { NextResponse } from "next/server";
import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { simulate } from "@/lib/sequence-service";

const Action = z.enum(["reply", "open", "fast-forward"]);
const Body = z.object({ leadId: z.uuid() });

export async function POST(request: Request, ctx: RouteContext<"/api/simulate/[action]">) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: { code: "unauthorized", message: "Sign in again." } }, { status: 401 });
  if (profile.role !== "admin") {
    return NextResponse.json({ error: { code: "forbidden", message: "Only admins can simulate events." } }, { status: 403 });
  }
  const action = Action.safeParse((await ctx.params).action);
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!action.success || !body.success) {
    return NextResponse.json({ error: { code: "invalid", message: "Unknown action or lead." } }, { status: 400 });
  }
  const result = await simulate(profile, action.data, body.data.leadId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data);
}
