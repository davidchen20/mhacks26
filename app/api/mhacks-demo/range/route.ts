import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const base = process.env.DEMO_FASTAPI_URL || (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8000" : "");
  if (!base) return NextResponse.json(
    { detail: "Set DEMO_FASTAPI_URL on the Next.js server." }, { status: 503 });
  try {
    const url = new URL("/api/py/demo/waste/range", base);
    for (const field of ["date_from", "date_to"]) {
      url.searchParams.set(field, request.nextUrl.searchParams.get(field) ?? "");
    }
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    return NextResponse.json(await response.json(), {
      status: response.status, headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ detail: "Cannot reach FastAPI. Start python -m uvicorn api.index:app on port 8000 and check DEMO_FASTAPI_URL." }, { status: 502 });
  }
}
