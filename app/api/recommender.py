import json
from collections import defaultdict

# Safely check if the ollama python package is installed
try:
    import ollama
    OLLAMA_INSTALLED = True
except ImportError:
    OLLAMA_INSTALLED = False


SYSTEM_PROMPT = """
You are an expert AI culinary director for a university dining hall waste-reduction recommender system.
Your job is to analyze high-waste menu items and output a SINGLE, complete, actionable sentence detailing a customized kitchen recommendation. 
You will be provided with the Food Item, its exact Waste Ratio, and its Dietary Category.

CORE OPERATIONAL RULES:
You have full creative freedom to determine the most reasonable, appetizing, or healthier preparation method to fix the root cause of the waste. You may suggest pivoting to a completely different cooking technique, flavor profile, or presentation style as long as it is culinary sound and practical for a dining hall.
Write exactly one clear, natural sentence containing either the recommended new cooking method or by how much the portion size should be shrunk. Do not include category names, labels, or dictionary fields in the text. Do NOT mention ANYTHING about waste or reducing waste in your recommendation sentence.

15-CATEGORY BASELINE STRATEGIES (Adapt creatively based on the specific food item):
1. SLICED ITEMS (PIES, PIZZA, BAKERY BARS) -> Slightly INCREASE the number of slices per pizza or number of baked goods per tray by a REASONABLE AMOUNT (for example, 8 to 10 or 10 to 12 or 4 to 5, go based off standard slices per item). 
    NEVER DECREASE the number of slices per pizza, number of cookies per tray, number of brownies per tray, or something similar. NEVER INCREASE the size of a slice of pizza, of a cookie, or of a baked good.
2. COOKED VEGETABLES -> Pivot to a more appealing, flavorful, or healthier preparation method (e.g., choose an alternative to steaming/boiling) that improves texture and reduces soggy and/or bland waste. 
3. PLAIN GRAINS & STARCHES -> Suggest different flavor profiles for the grains by adding in herbs and/or spices.
4. SANDWICHES, BURGERS & WRAPS -> Reduce bread bulk dynamically based on waste data, or suggest unbundled, healthier formats (like bowls or lettuce wraps).
5. CASSEROLES & PAN DISHES -> Adjust pan grid scoring dynamically based on the waste ratio to yield appropriately sized default portions.
6. WHOLE ROASTED MEATS & POULTRY -> Recommend carving, slicing, or resting techniques that improve portion control and retain moisture.
7. PLANT-BASED PROTEINS -> Suggest texture-enhancing cooking methods that make the protein more appetizing and less prone to degrading on a hot line.
8. BREAKFAST MAINS -> Scale down sizes per the waste ratio, or shift to fresher batch-cooking methods.
9. SOUPS, STEWS & CHILIS -> Recommend finishing techniques that brighten the flavor profile and prevent the dish from tasting flat or heavy.
10. FRUITS -> Suggest better cutting, portioning, or refreshing techniques to keep fruit looking vibrant and easy to eat.
11. RAW SALAD BAR VEGETABLES -> Recommend light preparations (like mild marination or specific cuts) to make raw items more palatable.
12. PASTA & NOODLE BAR -> Choose methods that prevent starch sticking and steam-table clumping.
13. SAUCES & DRESSINGS -> Pivot from heavy, cloying bulk options to lighter, more vibrant, or healthier flavor profiles.
14. SELF-SERVE BEVERAGES -> Suggest natural, fresh enhancements over artificial flavorings.
15. BAKERY ITEMS -> Scale down the size a little bit because people are more likely to finish an item if only a tiny bit remains. Do not change the recipe.

When the waste ratio is greater than 0.3, recommend a DIFFERENT food from the same category but with the SAME dietary restrictions (halal, kosher, etc.). Also, if the original item sounds tasteless or bland, feel free to change the original cooking method.

OUTPUT FORMAT:
Return ONLY a valid JSON object with a single key "recommendation" containing your sentence. 
"""

def generate_rule_based_recommendation(food_name, waste_ratio, category="none"):
    """Fallback rule-based recommender outputting single, natural sentence recommendations."""
    name_lower = food_name.lower()

    # Discrete Units & Bakery
    if "pizza" in name_lower:
        rec = f"Reduce the slice size of {food_name} by ~25% by shifting from an 8-cut pie to a 10-cut pie while retaining the identical crust and topping recipe."
    elif "cookie" in name_lower:
        rec = f"Reduce the unit dough mass of {food_name} by ~25% (scaling portions from 50g down to ~37.5g per cookie) while keeping the MBakery recipe identical."
    elif any(k in name_lower for k in ["pie", "muffin", "donut", "brownie", "cake"]):
        rec = f"Pre-cut {food_name} into ~25% smaller default portions while retaining 100% of the original recipe."

    # Sandwiches, Burgers & Casseroles
    elif "burger" in name_lower:
        rec = f"Downscale the bun mass for {food_name} by ~25% or offer a custom patty bowl on a bed of fresh greens to eliminate discarded bread."
    elif any(k in name_lower for k in ["sandwich", "wrap"]):
        rec = f"Reduce the bread or wrap mass for {food_name} by ~25% to match actual student appetite."
    elif any(k in name_lower for k in ["macaroni", "lasagna", "casserole", "enchilada"]):
        rec = f"Reduce default portion bulk of {food_name} by ~25% by shifting pan grid scoring from 12 cuts to 16 cuts per pan."

    # Grains, Rice & Noodles
    elif any(k in name_lower for k in ["rice", "quinoa", "couscous", "pasta", "penne", "noodle", "barley"]):
        if waste_ratio > 0.3:
            rec = f"Pivot from {food_name} to a different grain of similar nutritional profile, utilizing herbs and spices rather than serving it plain."
        else:
            rec = f"Fluff {food_name} post-cook with extra virgin olive oil, sea salt, black pepper, and fresh chives to prevent clumping and sogginess."

    # Soups & Liquids
    elif any(k in name_lower for k in ["soup", "stew", "chili", "chowder"]):
        rec = f"Finish {food_name} before service with a fresh lemon spritz, olive oil glaze, sea salt, and fresh herbs to brighten flavor."

    # Vegetables & Proteins (Cooking Method Transformations)
    else:
        is_veg = any(v in name_lower for v in ["broccoli", "spinach", "carrot", "vegetable", "corn", "bean", "pea"])
        
        if is_veg and waste_ratio > 0.3:
            rec = f"Replace {food_name} with an alternative vegetable with a similar nutritional profile, utilizing high-heat roasting instead of steam-table holding."
        elif "steamed" in name_lower or "steam" in name_lower:
            rec = f"Shift {food_name} from steam table holding to high-heat oven roasting tossed with olive oil, sea salt, and black pepper to eliminate sogginess."
        elif "boiled" in name_lower or "boil" in name_lower:
            rec = f"Transition {food_name} from boiling to high-heat oven roasting with olive oil, sea salt, and black pepper to build caramelized edges."
        elif "raw" in name_lower:
            rec = f"Toss raw {food_name} with extra virgin olive oil, fresh lemon juice, sea salt, and black pepper to cut bitterness and enhance texture."
        elif "sauteed" in name_lower:
            rec = f"Dry-sear {food_name} on a hot flat-top grill with minimal olive oil, sea salt, and black pepper to prevent excess oil pooling."
        elif "roasted" in name_lower:
            rec = f"Maintain oven roasting for {food_name}, but finish post-cook with a light lemon spritz, extra virgin olive oil glaze, sea salt, and fresh parsley."
        else:
            rec = f"Toss {food_name} with a light extra virgin olive oil glaze, sea salt, and black pepper to elevate natural flavor."

    return {
        "recommendation": rec,
        "source": "Rule-Based Fallback"
    }


def generate_recommendation(food_name, waste_ratio, category, model="qwen2.5"):
    """Queries Ollama for a single-sentence recommendation, with graceful rule fallback."""
    if OLLAMA_INSTALLED:
        # Base user message
        user_content = f"High-waste food item: '{food_name}'. Exact Waste Ratio: {waste_ratio:.2f}. Dietary Category: {category}."
        
        # Aggressive prompt injection for >0.3 edge cases
        if waste_ratio > 0.3:
            category_rule = ""
            if category.lower() != "none":
                category_rule = f"However, this new recommended food MUST strictly comply with the '{category}' dietary restriction. "
                
            user_content += f"""
            CRITICAL RULE TRIGGERED: You MUST recommend replacing this item with a COMPLETELY DIFFERENT food item from the same category. 
            {category_rule}
            Also, if the original item sounds tasteless or bland, feel free to change the original cooking method and elaborate ONLY on the cooking method to make the new food item sound as tasty as possible. 
            Do NOT mention anything about being {category}, halal, kosher, lack of certain allergens, or anything similar in your response UNLESS the original food item explicitly contained that word in its name.
            You are FORBIDDEN from keeping the current food item."""
            
        try:
            response = ollama.chat(
                model=model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_content}
                ],
                format="json"
            )
            data = json.loads(response["message"]["content"])
            return {
                "recommendation": data.get("recommendation", ""),
                "source": f"Ollama AI ({model})"
            }
        except Exception:
            pass

    return generate_rule_based_recommendation(food_name, waste_ratio, category)


def analyze_food_waste(waste_entries, served_data, threshold=0.20, model="llama3.2"):
    """Evaluates Waste Ratio R = Wasted / Served and outputs single-sentence recommendations."""
    total_wasted = defaultdict(float)
    food_categories = {}
    
    # Extract amount and category from the updated waste_entries list
    for food_name, amount, category in waste_entries:
        total_wasted[food_name] += amount
        food_categories[food_name] = category

    flagged_items = []
    for food_name, wasted_amount in total_wasted.items():
        total_served = served_data.get(food_name, 0.0)
        category = food_categories.get(food_name, "none")
        
        if total_served <= 0:
            continue
        
        waste_ratio = wasted_amount / total_served
        
        if waste_ratio > threshold:
            rec = generate_recommendation(food_name, waste_ratio, category, model=model)
            
            flagged_items.append({
                "food_name": food_name,
                "category": category,
                "waste_ratio": waste_ratio,
                "formatted_ratio": f"{waste_ratio:.1%}",
                "total_wasted": round(wasted_amount, 2),
                "total_served": round(total_served, 2),
                "recommendation": rec.get("recommendation", ""),
                "engine_source": rec.get("source", "Unknown")
            })

    flagged_items.sort(key=lambda x: x["waste_ratio"], reverse=True)
    return flagged_items

#example usage
'''if __name__ == "__main__":
    waste_logs = [
        ["Pepperoni Pizza", 140, "none"],
        ["Chocolate Chip Cookie", 120, "vegetarian"],
        ["Steamed Broccoli", 125, "vegan"],
        ["Turkey Burger", 90, "halal"],
        ["Plain Quinoa", 60, "gluten-free"],
        ["Steamed Spinach", 60, "vegan"],
        ["Steamed Barley", 50, "vegan"],
        ["Salad Bar Spring Mix", 150, "vegan"],
        ["Mango Cheesecake", 30, "vegetarian"],
        ["Matzo Ball Soup", 100, "kosher"]
    ]

    served_data = {
        "Pepperoni Pizza": 500.0,         # R = 28.0%
        "Chocolate Chip Cookie": 400.0,   # R = 30.0%
        "Steamed Broccoli": 300.0,        # R = 41.7%
        "Turkey Burger": 350.0,           # R = 25.7%
        "Plain Quinoa": 250.0,            # R = 24.0%
        "Steamed Spinach": 90,            # R = 66.7%
        "Steamed Barley": 80,             # R = 62.5%
        "Salad Bar Spring Mix": 500,      # R = 30.0%
        "Mango Cheesecake": 300,          # R = 10.0%
        "Matzo Ball Soup": 200            # R = 50.0%
    }

    results = analyze_food_waste(waste_logs, served_data, threshold=0.20)

    for entry in results:
        print(f"Item: {entry['food_name']} (Category: {entry['category']}) (Waste Ratio: {entry['formatted_ratio']})")
        print(f"Recommendation: {entry['recommendation']}\n")'''
