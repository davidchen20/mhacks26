/** Mirrors recommender.py using its generated rule table and supplied database. */
import rulesJSON from "./recommendationRules.json";
import databaseJSON from "../database.json";
const rules = rulesJSON as Record<string, {low: string; high: string}>;
const database = databaseJSON as Record<string, {category: string; dietary: string}>;
export function hardcodedRecommendation(foodName: string, wasted: number, served: number, threshold = .20) {
  if (served <= 0) return null;
  const ratio = wasted / served;
  if (!(ratio > threshold)) return null;
  const info = database[foodName] ?? {category: "UNKNOWN", dietary: "none"};
  const dietaryText = ["none", ""].includes(info.dietary.toLowerCase()) ? "" : `${info.dietary} `;
  const severity = ratio > .30 ? "high" : "low";
  const rule = rules[info.category];
  const template = rule ? rule[severity] : severity === "high"
    ? "Replace {food_name} with a different {dietary_text}item and adjust the cooking method."
    : "Adjust the portion size or cooking method of {food_name} to reduce waste.";
  return {food_name: foodName, category: info.category, dietary: info.dietary, waste_ratio: ratio,
    recommendation: template.replaceAll("{food_name}", foodName).replaceAll("{dietary_text}", dietaryText), severity};
}
