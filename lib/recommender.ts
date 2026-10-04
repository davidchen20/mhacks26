/** Python API response; suggested_change is a signed fraction (-.2 = 20% less). */
export interface BackendRecommendation {
  food_name: string; category: string; dietary: string; waste_ratio: number;
  formatted_ratio: string; total_wasted: number; total_served: number; recommendation: string;
}
export interface RecommenderInput {
  waste_entries: ([string, number] | [string, number, string])[];
  served_data: Record<string, number>;
  menu_items?: (string | {name: string})[];
  aliases?: Record<string, string>;
  threshold?: number;
}
export async function fetchRecommendations(input: RecommenderInput): Promise<BackendRecommendation[]> {
  const response = await fetch('/api/py/recommendations', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(input)});
  if (!response.ok) throw new Error(`Recommendation request failed (${response.status})`);
  return response.json();
}

export interface WasteVectorItem {
  dish: string;
  total_served_lbs: number;
  post_consumer_pct: number; // 0..100, not 0..1
  unserved_units_wasted: number;
  unserved_unit: 'pans' | 'lbs';
  weight_per_pan_lbs: number;
  cost_per_lb?: number;
  cost_per_pan?: number;
}
export interface WasteVectorSummary {
  total_waste_dollars: number;
  plate_waste_dollars: number;
  unserved_overproduction_dollars: number;
  total_waste_lbs: number;
  plate_waste_lbs: number;
  unserved_overproduction_lbs: number;
}
export interface WasteVectorResult {
  summary: WasteVectorSummary;
  recommendations: BackendRecommendation[];
}
export async function analyzeWasteService(input: {hall: string; date: string; meal: string; items: WasteVectorItem[]}): Promise<WasteVectorResult> {
  const response = await fetch('/api/py/waste/analyze', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(input)});
  if (!response.ok) throw new Error(`Waste analysis failed (${response.status})`);
  return response.json();
}
