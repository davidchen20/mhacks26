// Server component; the interactive dashboard is below a Suspense boundary.
import { Suspense } from "react";
import HomeDashboard from "@/components/home/HomeDashboard";
import { Skeleton } from "@/components/shared/DataState";
export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <HomeDashboard />
    </Suspense>
  );
}
