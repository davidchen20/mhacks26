"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { ScrapedArchive } from "@/lib/types";

const Ctx = createContext<{ archive: ScrapedArchive; today: string } | null>(
  null,
);

export function MenuDataProvider({
  archive,
  today,
  children,
}: {
  archive: ScrapedArchive;
  today: string;
  children: ReactNode;
}) {
  return <Ctx.Provider value={{ archive, today }}>{children}</Ctx.Provider>;
}

export function useMenuData() {
  const value = useContext(Ctx);
  if (!value) throw new Error("MenuDataProvider is missing");
  return value;
}
