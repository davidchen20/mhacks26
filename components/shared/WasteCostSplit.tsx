import { currency, percent, lbs } from "@/lib/format";
export default function WasteCostSplit({plate, kitchen, days = 1, operatingDays = 290, plateLbs, kitchenLbs}: {
  plate: number; kitchen: number; days?: number; operatingDays?: number; plateLbs: number; kitchenLbs: number;
}) {
  const total = plate + kitchen;
  const factor = operatingDays / Math.max(1, days);
  return <section className="panel p-5" aria-label="Kitchen and tray waste financial split">
    <h2 className="section-title">Annual waste cost · {currency(total * factor, "per year")}</h2>
    <p className="muted">Illustrative projection: selected daily average × {operatingDays} equivalent operating days. Food cost only.</p>
    <dl className="mt-4 grid gap-4 sm:grid-cols-2">
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4"><dt className="font-semibold text-rose-800"><span aria-hidden="true">🔴 </span>Kitchen Overproduction (Unserved)</dt><dd className="mt-2 font-semibold">{currency(kitchen * factor, "per year")} · {percent(total ? kitchen / total * 100 : 0)} of total cost</dd><dd className="muted mt-1">{lbs(kitchenLbs)} discarded · {currency(kitchen, "for selected services", 2)}</dd></div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4"><dt className="font-semibold text-amber-900"><span aria-hidden="true">🟡 </span>Tray Plate Waste (Post-Consumer)</dt><dd className="mt-2 font-semibold">{currency(plate * factor, "per year")} · {percent(total ? plate / total * 100 : 0)} of total cost</dd><dd className="muted mt-1">{lbs(plateLbs)} returned · {currency(plate, "for selected services", 2)}</dd></div>
    </dl>
  </section>;
}
