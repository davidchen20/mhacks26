"use client";
import { useEffect, useState } from "react";
import type { ServiceData } from "./types";
import { toDemoServices, type DemoResponse } from "./demoData";
export function useDemoServices(enabled: boolean, start: string, end: string) {
  const key = `${start}|${end}`;
  const [snapshot, setSnapshot] = useState<{key: string; services: ServiceData[]} | null>(null);
  const [failure, setFailure] = useState<{key: string; error: string} | null>(null);
  useEffect(() => {
    if (!enabled) { setSnapshot(null); setFailure(null); return; }
    const controller = new AbortController();
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      try {
        const query = new URLSearchParams({date_from: start, date_to: end});
        const response = await fetch(`/api/mhacks-demo/range?${query}`, {
          cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(typeof body?.detail === "string" ? body.detail : "Demo database unavailable");
        }
        const data: DemoResponse = await response.json();
        const services = toDemoServices(data);
        if (!stopped) { setSnapshot({key, services}); setFailure(null); }
      } catch (error) {
        if (!stopped) setFailure({key, error: error instanceof Error ? error.message : "Demo fetch failed"});
      } finally {
        if (!stopped) timer = setTimeout(poll, 2000);
      }
    }
    void poll();
    return () => { stopped = true; controller.abort(); if (timer) clearTimeout(timer); };
  }, [enabled, start, end, key]);
  const current = enabled && snapshot?.key === key ? snapshot.services : [];
  return {services: current, loaded: enabled && snapshot?.key === key,
    loading: enabled && snapshot?.key !== key && failure?.key !== key,
    error: enabled && failure?.key === key ? failure.error : null};
}
