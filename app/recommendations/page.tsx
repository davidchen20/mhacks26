// Server component; decisions, animation and history are client components.
import RecommendationsDashboard from "@/components/recommendations/RecommendationsDashboard";
export const metadata = { title: "AI Recommendations" };
export default function Page() {
  return <RecommendationsDashboard />;
}
