import DemoGate from "@/components/demo/DemoGate";
// Server component; interactive controls and feed live in the client dashboard.
import { Suspense } from "react";
import FoodDashboard from "@/components/food/FoodDashboard";
import { Skeleton } from "@/components/shared/DataState";
export const metadata = { title: "Food Data" };
export default function Page() {
  return (
    <Suspense fallback={<Skeleton label="Loading food data" />}>
      <DemoGate>
        <FoodDashboard />
      </DemoGate>
    </Suspense>
  );
}
