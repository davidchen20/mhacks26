import json
from collections import defaultdict
import os

# ==========================================
# HARD-CODED RECOMMENDATION RULES
# ==========================================
RECOMMENDATIONS_DB = {
    "SLICED ITEMS": {
        "low": "Slightly increase the number of slices per pizza to decrease the serving size. Add olive oil and hot honey by the pizza station as quick add-ons with big flavor boosts.",
        "high": "Try different varieties of pizza - for example, a Greek-themed pizza with feta, olives and red onion; a classic Italian pizza with burrata and basil; or even a dessert pizza with banana and chocolate."
    },
    "COOKED VEGETABLES": {
        "low": "Pivot to a roasting or sautéing method tossed with either olive oil, sea salt, and black pepper or ginger, garlic, and red pepper.",
        "high": "Replace with brussels sprouts slow-roasted with a balsamic glaze or sweet peas sautéd with miso paste, red pepper, and sesame oil."
    },
    "PLAIN GRAINS & STARCHES": {
        "low": "Fluff post-cook with olive oil, sea salt, pepper, and herbs to prevent clumping.",
        "high": "Pivot to a different {dietary_text}grain (e.g., farro or brown rice) of similar nutritional profile, utilizing herbs and spices rather than serving it plain."
    },
    "SANDWICHES, BURGERS & WRAPS": {
        "low": "Reduce the bread or wrap mass by ~25% or offer a custom bowl format to eliminate discarded bread.",
        "high": "Replace {food_name} with a different {dietary_text}sandwich or wrap concept, intentionally designing it with a lighter bread-to-filling ratio."
    },
    "CASSEROLES & PAN DISHES": {
        "low": "Adjust pan grid scoring to yield slightly smaller default portions (e.g., 12 cuts to 16 cuts).",
        "high": "Replace {food_name} with a completely different {dietary_text}casserole or pan dish, and ensure it is scored into smaller portions."
    },
    "WHOLE ROASTED MEATS & POULTRY": {
        "low": "Implement improved carving and resting techniques to control portion sizes and retain moisture.",
        "high": "Substitute {food_name} with a different {dietary_text}roasted protein, focusing on precise carving techniques to limit waste."
    },
    "PLANT-BASED PROTEINS": {
        "low": "Utilize texture-enhancing techniques like pan-searing or marinating to make the food more appetizing on the hot line.",
        "high": "Replace {food_name} with a different {dietary_text}plant-based protein dish that relies on a more durable, texture-heavy cooking method."
    },
    "BREAKFAST MAINS": {
        "low": "Scale down default portion sizes or shift to fresher, smaller-batch cooking methods.",
        "high": "Pivot from {food_name} to a different {dietary_text}breakfast main cooked in smaller, more frequent batches."
    },
    "SOUPS, STEWS & CHILIS": {
        "low": "Finish before service with a fresh lemon spritz, olive oil glaze, and fresh herbs to brighten flavor.",
        "high": "Replace {food_name} with a lighter, distinctly flavored {dietary_text}soup or stew to prevent the dish from tasting flat or heavy. Alternatively, use puréed cauliflower or white beans instead of cream for a rich and hearty base."
    },
    "FRUITS": {
        "low": "Use finer cutting and portioning techniques, refreshing the display frequently to keep it vibrant.",
        "high": "Substitute {food_name} with a different {dietary_text}fruit option that is less prone to oxidation and visual degradation."
    },
    "RAW SALAD BAR VEGETABLES": {
        "low": "Toss raw with a light olive oil and lemon marinade to cut bitterness and enhance texture.",
        "high": "Replace {food_name} with a different {dietary_text}raw vegetable or a pre-mixed salad format that is more palatable."
    },
    "PASTA & NOODLE BAR": {
        "low": "Toss with a touch of oil post-cook to prevent starch sticking and steam-table clumping.",
        "high": "Pivot from {food_name} to a completely different {dietary_text}pasta shape or noodle dish that holds up better to steam-table holding."
    },
    "SAUCES & DRESSINGS": {
        "low": "Pivot from a heavy bulk option to a lighter, more vibrant flavor profile.",
        "high": "Replace {food_name} with a distinctly different, lighter {dietary_text}sauce or vinaigrette."
    },
    "SELF-SERVE BEVERAGES": {
        "low": "Enhance with natural fresh ingredients (like citrus slices or mint) over artificial flavorings.",
        "high": "Replace {food_name} with a completely different {dietary_text}beverage offering focused on fresh, natural enhancements."
    },
    "BAKERY ITEMS": {
        "low": "Scale down the unit mass of the dough/batter by ~25% to encourage finishing the item.",
        "high": "Substitute {food_name} with a completely different {dietary_text}bakery item baked in miniature or bite-sized formats."
    },
    "POTATO CHIPS": {
        "low": "Kettle-cook the potato chips before finishing with a zesty rub to offer a novel take on a classic side. Allow self-serving so students take only as many chips as they need.",
        "high": "Consider different sides that would pair well with sandwiches or anything else; tortilla chips and freshly made guacamole or salsa could work wonders."
    }
}


def load_food_database(json_filename):
    """Reads a JSON file relative to this module (absolute paths also work)."""
    # Build the path using the current working directory instead of __file__
    current_dir = os.path.dirname(os.path.abspath(__file__))
    json_filepath = os.path.join(current_dir, json_filename)
    
    with open(json_filepath, 'r') as f:
        return json.load(f)


def generate_recommendation(food_name, waste_ratio, category, dietary):
    """Generates a hard-coded recommendation based on category, waste ratio, and dietary restrictions."""
    
    # Format the dietary text for the sentence (e.g., "halal " or "vegan ")
    dietary_text = f"{dietary} " if dietary.lower() not in ["none", ""] else ""
    
    # Fallback if category is missing or invalid
    if category not in RECOMMENDATIONS_DB:
        if waste_ratio > 0.3:
            return f"Replace {food_name} with a different {dietary_text}item and adjust the cooking method."
        return f"Adjust the portion size or cooking method of {food_name} to reduce waste."
    
    # Select low or high waste rule
    severity = "high" if waste_ratio > 0.3 else "low"
    template = RECOMMENDATIONS_DB[category][severity]
    
    # Fill in the blanks
    return template.format(food_name=food_name, dietary_text=dietary_text)


def analyze_food_waste(waste_entries, served_data, food_database, threshold=0.20):
    """Evaluates Waste Ratio R = Wasted / Served and outputs single-sentence recommendations."""
    total_wasted = defaultdict(float)
    
    for food_name, amount in waste_entries:
        total_wasted[food_name] += amount

    flagged_items = []
    for food_name, wasted_amount in total_wasted.items():
        total_served = served_data.get(food_name, 0.0)
        
        if total_served <= 0:
            continue
        
        waste_ratio = wasted_amount / total_served
        
        if waste_ratio > threshold:
            # Look up category and dietary restrictions from the loaded JSON data
            food_info = food_database.get(food_name, {})
            category = food_info.get("category", "UNKNOWN")
            dietary = food_info.get("dietary", "none")
            
            recommendation = generate_recommendation(food_name, waste_ratio, category, dietary)
            
            flagged_items.append({
                "food_name": food_name,
                "category": category,
                "dietary": dietary,
                "waste_ratio": waste_ratio,
                "formatted_ratio": f"{waste_ratio:.1%}",
                "total_wasted": round(wasted_amount, 2),
                "total_served": round(total_served, 2),
                "recommendation": recommendation
            })

    flagged_items.sort(key=lambda x: x["waste_ratio"], reverse=True)
    return flagged_items

#Example Usage
'''if __name__ == "__main__":
    # 1. Load the exported JSON database directly
    food_database = load_food_database("database.json")

    # 2. Process logs (Mocked names updated to match those in database.json)
    waste_logs = [
        ["Pepperoni Pizza", 140],
        ["Chocolate Chunk Cookies", 120],
        ["Garlic Roasted Broccoli", 125],
        ["Turkey Burger on White Bun", 90],
        ["Brown Rice", 60],
        ["Kale Saute", 60],
        ["Basmati Rice", 50],
        ["Tabbouleh Salad", 150],
        ["Peach Pie", 30],
        ["Lamb Vindaloo", 100]
    ]

    served_data = {
        "Pepperoni Pizza": 500.0,         # R = 28.0%
        "Chocolate Chunk Cookies": 400.0, # R = 30.0%
        "Garlic Roasted Broccoli": 300.0, # R = 41.7%
        "Turkey Burger on White Bun": 350.0, # R = 25.7%
        "Brown Rice": 250.0,              # R = 24.0%
        "Kale Saute": 90,                 # R = 66.7%
        "Basmati Rice": 80,               # R = 62.5%
        "Tabbouleh Salad": 500,           # R = 30.0%
        "Peach Pie": 300,                 # R = 10.0%
        "Lamb Vindaloo": 200              # R = 50.0%
    }

    # 3. Analyze waste
    results = analyze_food_waste(waste_logs, served_data, food_database, threshold=0.20)

    for entry in results:
        print(f"Item: {entry['food_name']}")
        print(f"Tags: [{entry['category']}] | [{entry['dietary']}]")
        print(f"Waste Ratio: {entry['formatted_ratio']}")
        print(f"Recommendation: {entry['recommendation']}\n")'''

# ... existing code ...

def recommend_waste_vectors(item):
    from api.waste import calculate_item

    row = calculate_item(item)
    dish = str(item.dish)
    kitchen_lbs = row["unserved_overproduction_lbs"]
    prepared_lbs = item.total_served_lbs + kitchen_lbs
    kitchen_pct = 100 * kitchen_lbs / prepared_lbs if prepared_lbs else 0

    high_kitchen = kitchen_pct >= 20
    high_plate = (
        item.total_served_lbs > 0 and item.post_consumer_pct >= 20
    )
    trial = (
        min(kitchen_lbs * 0.5, prepared_lbs * 0.20)
        / item.weight_per_pan_lbs
    )

    if high_kitchen and high_plate:
        action, change, severity = "menu-review", -0.35, "critical"
        reason = "High kitchen and plate waste"
        advice = (
            f"Both kitchen and tray waste are high for {dish}; "
            "review demand and preparation before changing production."
        )
    elif high_kitchen:
        action = "batch"
        change, severity = -min(0.20, kitchen_pct / 200), "review"
        reason = "High kitchen waste; low plate waste"
        avoidance = trial * row["cost_per_pan"]
        advice = (
            f"Trial {trial:.2f} fewer pans of {dish} next service; "
            f"potential food-cost avoidance is ${avoidance:.2f} "
            "per service (illustrative), subject to demand."
        )
    elif high_plate:
        action, change, severity = "portion", -0.15, "review"
        reason = "Low kitchen waste; high plate waste"
        advice = (
            f"Trial 15% smaller serving scoops of {dish}, "
            "keep seconds available, and measure tray returns."
        )
    else:
        action, change, severity = "monitor", 0.0, "on-track"
        reason = "No high waste signal"
        advice = f"Monitor {dish} across comparable services."

    return {
        **row,
        "dish": dish,
        "waste_origin": action,
        "severity": severity,
        "suggested_change": change,
        "change_target": "portion" if action == "portion" else "production",
        "unserved_pct_of_prepared": kitchen_pct,
        "suggested_pan_reduction": trial if action == "batch" else None,
        "reason": reason,
        "recommendation": advice,
        "engine_source": "Waste-vector rules",
    }


def analyze_waste_vectors(items):
    return [recommend_waste_vectors(item) for item in items]