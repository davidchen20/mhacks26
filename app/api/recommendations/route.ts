import { spawn } from "child_process";
import { NextResponse } from "next/server";
import { join } from "path";

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

  const script = join(process.cwd(), "app", "api", "recommender_worker.py");
  return new Promise<NextResponse>((resolve) => {
    const python = spawn(process.env.PYTHON_BIN || "python3", [script], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: join(process.cwd(), "app", "api"),
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (response: NextResponse) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(response);
    };
    const timer = setTimeout(() => {
      python.kill("SIGTERM");
      finish(NextResponse.json({ error: "Recommendation generation timed out" }, { status: 504 }));
    }, 115_000);

    python.stdout.setEncoding("utf8");
    python.stderr.setEncoding("utf8");
    python.stdout.on("data", (chunk: string) => (stdout += chunk));
    python.stderr.on("data", (chunk: string) => (stderr += chunk));
    python.on("error", () => {
      finish(NextResponse.json({ error: "Python runtime is unavailable" }, { status: 503 }));
    });
    python.on("close", (code) => {
      if (settled) return;
      if (code !== 0) {
        finish(
          NextResponse.json(
            { error: "Recommendation engine failed", details: stderr.slice(-1500) },
            { status: 502 },
          ),
        );
        return;
      }
      try {
        finish(NextResponse.json(JSON.parse(stdout)));
      } catch {
        finish(NextResponse.json({ error: "Recommendation engine returned invalid data" }, { status: 502 }));
      }
    });

    python.stdin.end(JSON.stringify(body));
  });
}
