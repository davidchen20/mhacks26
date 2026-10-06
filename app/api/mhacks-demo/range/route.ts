import { wasteApiUrl } from "@/lib/serviceUrls.server";
import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const url = wasteApiUrl("/api/py/demo/waste/range");
    for (const field of ["date_from", "date_to"]) {
      url.searchParams.set(field, request.nextUrl.searchParams.get(field) ?? "");
    }
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    return NextResponse.json(await response.json(), {
      status: response.status, headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ detail: "Cannot reach the waste API. Check the WASTE_API_URL service binding and backend logs." }, { status: 502 });
  }
}
