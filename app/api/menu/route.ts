import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const hall = searchParams.get("hall") ?? "south-quad";
  const date = searchParams.get("date");
  const meal = searchParams.get("meal");
  const compact = searchParams.get("compact") ?? "true";

  const scraperPath = path.join(process.cwd(), "scraper.py");

  const args = [scraperPath, "--hall", hall];

  if (date) {
    args.push("--date", date);
  }

  if (meal) {
    args.push("--meal", meal);
  }

  if (compact === "true") {
    args.push("--compact");
  }

  return new Promise((resolve) => {
    const python = spawn("python3", args);

    let stdout = "";
    let stderr = "";

    python.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    python.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    python.on("close", (code) => {
      if (code !== 0) {
        resolve(
          NextResponse.json(
            {
              error: "Failed to run scraper",
              details: stderr,
            },
            { status: 500 }
          )
        );
        return;
      }

      try {
        const data = JSON.parse(stdout);
        resolve(NextResponse.json(data));
      } catch {
        resolve(
          NextResponse.json(
            {
              error: "Scraper did not return valid JSON",
              rawOutput: stdout,
            },
            { status: 500 }
          )
        );
      }
    });
  });
}