import { LAST_UPDATED } from "@/lib/mockData";
import { timestamp } from "@/lib/format";
export default function PageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6">
      <p className="muted uppercase tracking-widest">
        University Dining Services / Operations
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
        {title}
      </h1>
      <p className="mt-2 text-slate-600">{description}</p>
      <p className="muted mt-3">
        Last updated{" "}
        <time dateTime={LAST_UPDATED}>{timestamp(LAST_UPDATED)}</time> · Fixed
        demo snapshot · All waste data is simulated
      </p>
    </div>
  );
}
