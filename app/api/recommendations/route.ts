import { recommenderUrl } from "@/lib/serviceUrls.server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (
    typeof body !== "object" ||
    body === null ||
    !Array.isArray((body as { items?: unknown }).items) ||
    (body as { items: unknown[] }).items.length > 30
  ) {
    return NextResponse.json({ error: "Expected up to 30 recommendation items" }, { status: 400 });
  }

  try {
    const response = await fetch(recommenderUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(115_000),
    });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json(
      { error: timedOut ? "Recommendation generation timed out" : "Recommendation service unavailable; check RECOMMENDER_URL and service logs" },
      { status: timedOut ? 504 : 502 },
    );
  }
}
