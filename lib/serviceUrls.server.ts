// Read bindings only when a server function handles a request.
export function wasteApiUrl(path: string): URL {
  const base = process.env.WASTE_API_URL || process.env.DEMO_FASTAPI_URL ||
    (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8000" : "");
  if (!base) throw new Error("WASTE_API_URL service binding is unavailable");
  return new URL(path, base);
}

export function recommenderUrl(): URL {
  const base = process.env.RECOMMENDER_URL;
  if (!base) throw new Error("RECOMMENDER_URL service binding is unavailable; use vercel dev");
  return new URL("/recommendations", base);
}
