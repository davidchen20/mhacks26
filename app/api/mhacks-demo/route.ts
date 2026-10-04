import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const base = process.env.DEMO_FASTAPI_URL;
  if (!base) return NextResponse.json(
    { detail: "Set DEMO_FASTAPI_URL on the Next.js server." }, { status: 503 });
  try {
    const url = new URL("/api/py/demo/waste", base);
    url.searchParams.set("service_date", request.nextUrl.searchParams.get("service_date") ?? "");
    url.searchParams.set("meal", request.nextUrl.searchParams.get("meal") ?? "all");
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    return NextResponse.json(await response.json(), {
      status: response.status, headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ detail: "Demo backend unavailable." }, { status: 502 });
  }
}
