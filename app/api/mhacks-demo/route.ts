import { wasteApiUrl } from "@/lib/serviceUrls.server";
import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const url = wasteApiUrl("/api/py/demo/waste");
    url.searchParams.set("service_date", request.nextUrl.searchParams.get("service_date") ?? "");
    url.searchParams.set("meal", request.nextUrl.searchParams.get("meal") ?? "all");
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    return NextResponse.json(await response.json(), {
      status: response.status, headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ detail: "Cannot reach the waste API. Check the WASTE_API_URL service binding and backend logs." }, { status: 502 });
  }
}
