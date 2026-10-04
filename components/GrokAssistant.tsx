"use client";
import type { MenuItem } from "@/lib/mockData";
import { lbs, currency, number } from "@/lib/format";
import { portionLabel, costPerLb } from "@/lib/foodWeights";
export default function ItemWastePanel({
  items,
  selectedId,
  onSelect,
}: {
  items: MenuItem[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const item = items.find((i) => i.id === selectedId) ?? items[0];
  if (!item) return null;
  return (
    <section className="panel p-5" aria-label="Waste by item">
      <h2 className="section-title">Waste by item</h2>
      <label className="mt-4 block text-sm font-semibold">
        Menu item
        <select
          className="input mt-2"
          value={item.id}
          onChange={(e) => onSelect(e.target.value)}
        >
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </label>
      <p className="muted mt-3">
        {portionLabel(item)}
        {item.servingSize ? ` · Published serving: ${item.servingSize}` : ""}
      </p>
      <p className="mt-5 text-sm font-semibold text-slate-600">
        Pounds NOT served
      </p>
      <p className="mt-1 text-3xl font-semibold text-navy">
        {lbs(item.unservedLbs)}
      </p>
      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
        {[
          ["Portions prepared", number(item.portionsPrepared)],
          ["Portions served", number(item.portionsServed)],
          [
            "Portions NOT served",
            number(item.portionsPrepared - item.portionsServed),
          ],
          ["Returned as plate waste", lbs(item.plateWasteLbs)],
          ["Total pounds wasted", lbs(item.wasteLbs)],
          ["Waste cost", currency(item.wasteCost, "per service", 2)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-slate-600">{label}</dt>
            <dd className="mt-1 font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="muted mt-4">
        Not served = (prepared − served) × portion oz ÷ 16. Plate waste = served
        × portion oz × remaining fraction ÷ 16. Cost uses illustrative{" "}
        {currency(costPerLb(item.category), "per lb", 2)} for {item.category}.
      </p>
    </section>
  );
}
