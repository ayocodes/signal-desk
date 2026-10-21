// POST /api/agent-config { rules }: validate, describe the changes, save the next version.
// Admins only (lib/agent-config-service.ts).
import { NextResponse } from "next/server";
import { z } from "zod";
import { saveRules } from "@/lib/agent-config-service";
import { getProfile } from "@/lib/auth";

const Body = z.object({ rules: z.unknown() });

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: { code: "unauthorized", message: "Sign in again." } }, { status: 401 });
  if (profile.role !== "admin") {
    return NextResponse.json({ error: { code: "forbidden", message: "Only admins can change the agent rules." } }, { status: 403 });
  }
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success || body.data.rules === undefined) {
    return NextResponse.json({ error: { code: "invalid", message: "Send the rules to save." } }, { status: 400 });
  }
  const result = await saveRules(profile, body.data.rules);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data);
}
