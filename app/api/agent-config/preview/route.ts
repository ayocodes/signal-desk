// GET /api/agent-config/preview?threshold=55: how many leads that threshold would put in the
// queue, from stored scores. Admins only (it's a rules-editor helper).
import { NextResponse } from "next/server";
import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { thresholdPreview } from "@/lib/data/agent-config";

const Threshold = z.coerce.number().int().min(1).max(500);

export async function GET(request: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: { code: "unauthorized", message: "Sign in again." } }, { status: 401 });
  if (profile.role !== "admin") {
    return NextResponse.json({ error: { code: "forbidden", message: "Only admins can preview rule changes." } }, { status: 403 });
  }
  const threshold = Threshold.safeParse(new URL(request.url).searchParams.get("threshold"));
  if (!threshold.success) {
    return NextResponse.json({ error: { code: "invalid", message: "The threshold must be a whole number from 1 to 500." } }, { status: 400 });
  }
  return NextResponse.json({ preview: await thresholdPreview(threshold.data) });
}
