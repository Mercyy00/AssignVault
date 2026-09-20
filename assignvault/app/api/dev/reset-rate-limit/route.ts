import { NextResponse } from "next/server";
import { resetRateLimits } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Only available in development" }, { status: 403 });
  }

  resetRateLimits();
  return NextResponse.json({
    success: true,
    message: "Rate limits successfully reset for local development.",
  });
}

export async function POST() {
  return GET();
}
