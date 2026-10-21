// POST /api/agent-config/reset: every rule back to the defaults, as a new version, then a
// re-score. Admins only (lib/agent-config-service.ts).
import { NextResponse } from "next/server";
import { resetRules } from "@/lib/agent-config-service";
import { getProfile } from "@/lib/auth";

export async function POST() {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: { code: "unauthorized", message: "Sign in again." } }, { status: 401 });
  if (profile.role !== "admin") {
    return NextResponse.json({ error: { code: "forbidden", message: "Only admins can change the agent rules." } }, { status: 403 });
  }
  const result = await resetRules(profile);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data);
}
