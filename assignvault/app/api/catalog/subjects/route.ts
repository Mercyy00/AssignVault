import { NextResponse } from "next/server";
import { getSubjects } from "@/lib/data/catalog";

export const revalidate = 300; // Cache for 5 minutes

export async function GET() {
  try {
    const subjects = await getSubjects();
    return NextResponse.json({ subjects }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Failed to fetch subjects" }, { status: 500 });
  }
}
