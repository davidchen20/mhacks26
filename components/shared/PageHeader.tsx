import scrapeStatus from "@/lib/scrapeStatus.json";
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
        Last scrape attempt{" "}
        <time dateTime={scrapeStatus.attemptedAt}>
          {timestamp(scrapeStatus.attemptedAt)}
        </time>{" "}
        · All waste readings and costs are simulated
      </p>
    </div>
  );
}
