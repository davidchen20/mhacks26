export type HallId =
  | "bursley"
  | "south-quad"
  | "east-quad"
  | "mosher-jordan"
  | "markley"
  | "twigs";
import type { Meal } from "./dates";
export type { Meal, Range, OverviewMeal } from "./dates";
export type Category = "Protein" | "Produce" | "Grains" | "Dairy";
export type Decision = "Accepted" | "Dismissed";
export interface Nutrition {
  fiberGrams: number | null;
  proteinGrams: number | null;
  calories: number | null;
  nutrientDensity: "moderate" | "high" | "unknown";
  densityScore: number;
}
export interface MenuItem {
  id: string;
  name: string;
  category: Category;
  remainingPct: number;
  wasteLbs: number;
  wasteCost: number;
  servings: number;
  nutrition: Nutrition;
  station: string;
  servingSize: string | null;
  traits: string[];
  allergens: string[];
  standardPortionOz: number;
  weightSource: "serving-size" | "converted-volume" | "category-default";
  portionsPrepared: number;
  portionsServed: number;
  unservedLbs: number;
  plateWasteLbs: number;
  culinarySuggestion: string;
  reductionRange: [number, number];
}
export interface ServiceData {
  hallId: HallId;
  date: string;
  meal: Meal;
  mealsServed: number;
  items: MenuItem[];
  menuSource: "mdining" | "illustrative";
  availability: "available" | "future" | "unavailable" | "no-service";
}
export interface Hall {
  id: HallId;
  name: string;
  reporting: boolean;
}
export interface HallSummary {
  hall: Hall;
  wasteLbs: number | null;
  wasteCost: number | null;
  mealsServed: number | null;
  wastePerMeal: number | null;
  topItem: MenuItem | null;
}
export interface TrendPoint {
  date: string;
  value: number | null;
  movingAverage?: number | null;
}
export interface Recommendation {
  id: string;
  hallId: HallId;
  date: string;
  meal: Meal;
  itemId: string;
  itemName: string;
  remainingPct: number;
  reductionRange: [number, number];
  wasteCost: number;
  title: string;
  origin: "production" | "nutrition";
}
export interface HistoryEntry {
  id: string;
  recommendation: Recommendation;
  decision: Decision;
  note: string;
  timestamp: string;
  reopenedAt?: string;
}
export interface TrayReading {
  category: Category;
  standardPortionOz: number;
  weightSource: MenuItem["weightSource"];
  remainingOz: number;
  remainingGrams: number;
  itemId: string;
  name: string;
  remainingPct: number;
}
export interface Tray {
  id: string;
  sequence: number;
  readings: TrayReading[];
}
export interface ScrapedItem {
  station: string;
  name: string;
  servingSize: string | null;
  calories: number | null;
  fiber: number | null;
  protein: number | null;
  traits: string[];
  allergens: string[];
}
export type ScrapedMenus = Partial<
  Record<HallId, Record<string, Partial<Record<Meal, ScrapedItem[]>>>>
>;
