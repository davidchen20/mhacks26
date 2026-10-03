// Server component; only scenarios and charts require the client boundary.
import FinanceDashboard from "@/components/finances/FinanceDashboard";
export const metadata = { title: "Finances" };
export default function Page() {
  return <FinanceDashboard />;
}
