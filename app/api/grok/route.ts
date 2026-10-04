import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 70;

type ChatMessage = { role: "user" | "assistant"; content: string };

function validMessages(value: unknown): value is ChatMessage[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 24 &&
    value.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        ["user", "assistant"].includes((entry as ChatMessage).role) &&
        typeof (entry as ChatMessage).content === "string" &&
        (entry as ChatMessage).content.length <= 4000,
    )
  );
}

export async function POST(request: Request) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Grok chat is not configured. Set XAI_API_KEY on the server." },
      { status: 503 },
    );
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const messages =
    typeof parsed === "object" && parsed !== null
      ? (parsed as { messages?: unknown }).messages
      : undefined;
  if (!validMessages(messages)) {
    return NextResponse.json(
      { error: "Send between 1 and 24 messages, each no longer than 4,000 characters." },
      { status: 400 },
    );
  }

  try {
    const upstream = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GROK_MODEL || "grok-4.5",
        instructions:
          "You are Grok, a helpful assistant inside the WolverLean university dining analytics app. Be clear and conversational. Do not claim that the app's simulated waste measurements are real.",
        input: messages,
        store: false,
        max_output_tokens: 1200,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: "Grok could not complete the request. Check the server API key and account access." },
        { status: upstream.status === 429 ? 429 : 502 },
      );
    }

    const result = await upstream.json();
    const answer = Array.isArray(result.output)
      ? result.output
          .filter((entry: { type?: string }) => entry.type === "message")
          .flatMap((entry: { content?: { type?: string; text?: string }[] }) =>
            (entry.content ?? [])
              .filter((part) => part.type === "output_text" && typeof part.text === "string")
              .map((part) => part.text),
          )
          .join("\n")
          .trim()
      : "";
    if (!answer) {
      return NextResponse.json({ error: "Grok returned no text response." }, { status: 502 });
    }
    return NextResponse.json({ answer });
  } catch {
    return NextResponse.json(
      { error: "Grok is unavailable or the request timed out." },
      { status: 502 },
    );
  }
}
