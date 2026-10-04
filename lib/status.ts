export type Status = "on-track" | "monitor" | "review";
export const THRESHOLDS = {
  remaining: { onTrack: 20, monitor: 35 },
  perMeal: { onTrack: 0.1, monitor: 0.14 },
  highTray: 65,
};
export const STATUS: Record<
  Status,
  { label: string; icon: string; color: string; classes: string }
> = {
  "on-track": {
    label: "On track",
    icon: "✓",
    color: "#047857",
    classes: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  monitor: {
    label: "Monitor",
    icon: "◷",
    color: "#b45309",
    classes: "bg-amber-50 text-amber-900 border-amber-200",
  },
  review: {
    label: "Review",
    icon: "!",
    color: "#be123c",
    classes: "bg-rose-50 text-rose-800 border-rose-200",
  },
};
export function statusFor(
  value: number,
  kind: "remaining" | "perMeal" = "remaining",
): Status {
  const t = THRESHOLDS[kind];
  return value <= t.onTrack
    ? "on-track"
    : value <= t.monitor
      ? "monitor"
      : "review";
}
