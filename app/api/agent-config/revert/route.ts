// POST /api/agent-config/revert { version }: copy an old version in as the next one.
// Admins only (lib/agent-config-service.ts).
import { NextResponse } from "next/server";
import { z } from "zod";
import { revertRules } from "@/lib/agent-config-service";
import { getProfile } from "@/lib/auth";

const Body = z.object({ version: z.int().min(1) });

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: { code: "unauthorized", message: "Sign in again." } }, { status: 401 });
  if (profile.role !== "admin") {
    return NextResponse.json({ error: { code: "forbidden", message: "Only admins can change the agent rules." } }, { status: 403 });
  }
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: { code: "invalid", message: "Send a version number." } }, { status: 400 });
  const result = await revertRules(profile, body.data.version);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data);
}
