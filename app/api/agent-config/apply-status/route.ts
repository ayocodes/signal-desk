// GET /api/agent-config/apply-status?version=N: has that rules version reached the leads yet?
// applying | applied | failed (lib/rescore.ts). Admins only, like the editor that polls it.
import { NextResponse } from "next/server";
import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { applyState } from "@/lib/rescore";

const Version = z.coerce.number().int().min(1);

export async function GET(request: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: { code: "unauthorized", message: "Sign in again." } }, { status: 401 });
  if (profile.role !== "admin") {
    return NextResponse.json({ error: { code: "forbidden", message: "Only admins can see this." } }, { status: 403 });
  }
  const version = Version.safeParse(new URL(request.url).searchParams.get("version"));
  if (!version.success) {
    return NextResponse.json({ error: { code: "invalid", message: "Send a version number." } }, { status: 400 });
  }
  return NextResponse.json({ state: await applyState(profile.orgId, version.data) });
}
