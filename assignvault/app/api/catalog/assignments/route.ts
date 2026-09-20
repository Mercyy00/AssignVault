import { NextRequest, NextResponse } from "next/server";
import { getAssignments } from "@/lib/data/catalog";

export const revalidate = 60; // Cache for 1 minute

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const subjectSlug = searchParams.get("subject");
  const availableOnly = searchParams.get("availableOnly") === "true";

  if (!subjectSlug) {
    return NextResponse.json(
      { error: "Subject slug query parameter is required (?subject=slug)" },
      { status: 400 }
    );
  }

  try {
    const assignments = await getAssignments(subjectSlug, availableOnly);
    return NextResponse.json({ assignments }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Failed to fetch assignments" }, { status: 500 });
  }
}
