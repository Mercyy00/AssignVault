import { NextResponse } from "next/server";
import { getBatches } from "@/lib/data/catalog";

export const revalidate = 300; // Cache for 5 minutes

export async function GET() {
  try {
    const batches = await getBatches();
    return NextResponse.json({ batches }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Failed to fetch batches" }, { status: 500 });
  }
}
