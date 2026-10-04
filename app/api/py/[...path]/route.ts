import { wasteApiUrl } from "@/lib/serviceUrls.server";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Supports direct Next.js development; Vercel routes this prefix to api directly.
async function proxy(request: NextRequest) {
  try {
    const url = wasteApiUrl(request.nextUrl.pathname);
    url.search = request.nextUrl.search;
    const response = await fetch(url, {
      method: request.method,
      headers: { "Content-Type": request.headers.get("content-type") || "application/json" },
      body: request.method === "GET" ? undefined : await request.text(),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    return new Response(response.body, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") || "application/json", "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ detail: "Waste API unavailable; check WASTE_API_URL and service logs" }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
