import "server-only";
import { readFileSync } from "fs";
import { join } from "path";
import type { ScrapedArchive } from "./types";

export function loadScrapedMenus(): ScrapedArchive {
  const path = join(process.cwd(), "lib/scrapedMenus.json");
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as ScrapedArchive;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
