import { sourceLabel, type ServiceData } from "@/lib/mockData";
export default function SourceNotice({
  services,
}: {
  services: ServiceData[];
}) {
  const missing = services.filter(
    (s) => s.availability === "unavailable",
  ).length;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p>{sourceLabel(services)}</p>
      {missing > 0 && (
        <p className="mt-1">
          Partial coverage: {missing} service(s) unavailable. Totals include
          available, tracked menu items only.
        </p>
      )}
    </div>
  );
}
