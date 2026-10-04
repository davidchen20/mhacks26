import type { ServiceData } from "@/lib/types";
import { currency, lbs, dateLabel, title } from "@/lib/format";
import { wasteAdvice } from "@/lib/wasteAdvice";
export default function KitchenBatchTracker({service}: {service: ServiceData}) {
  return <section className="panel p-5" aria-label="Kitchen Batch Tracker">
    <h2 className="section-title">Kitchen Batch Tracker</h2>
    <p className="muted mt-1">{dateLabel(service.date)} · {title(service.meal)} · Simulated end-of-service discards, not a live inventory.</p>
    <p className="muted mt-2">Fractional pans are weight equivalents. Reusable, donated or safely retained food is excluded from discarded waste in real logs.</p>
    <ul className="mt-4 space-y-4">{service.items.map(item => <li key={item.id} className="rounded-lg border border-slate-200 p-3">
      <h3 className="font-semibold">{item.name}</h3>
      <p className="text-sm">{item.unservedUnitsWasted.toFixed(2)} pans discarded · {lbs(item.unservedLbs)} · {currency(item.unservedOverproductionDollars, "per service", 2)} thrown away</p>
      <p className="muted">{lbs(item.weightPerPanLbs)} per pan · {currency(item.costPerPan, "per pan", 2)} · Tray returns: {item.postConsumerPct}% of served food</p>
      <p className="mt-2 text-sm">{wasteAdvice(item).title}</p>
    </li>)}</ul>
  </section>;
}
