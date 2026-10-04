"use client";
export default function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-[13px] font-semibold text-slate-600">
        {label}
      </legend>
      <div className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={`min-h-10 rounded-lg px-3 py-2 text-sm font-semibold ${value === o.value ? "bg-navy text-white" : "text-slate-700 hover:bg-slate-100"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
