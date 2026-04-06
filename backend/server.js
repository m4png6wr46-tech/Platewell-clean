import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dotenv.config();

const app = express();
const PORT = 3001;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY in your environment variables");
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PRICES_DATA = JSON.parse(readFileSync(join(__dirname, "prices.json"), "utf8"));

function getStoreTier(storeName) {
  const name = String(storeName || "").toLowerCase().trim();
  if (!name) return "mid";
  for (const [tier, stores] of Object.entries(PRICES_DATA.store_tiers)) {
    if (stores.some((s) => name.includes(s.toLowerCase()) || s.toLowerCase().includes(name))) {
      return tier;
    }
  }
  return "mid";
}

function lookupPrice(itemName, tier) {
  const needle = String(itemName || "").toLowerCase().trim();
  if (!needle) return null;
  for (const category of Object.values(PRICES_DATA.prices)) {
    for (const [key, data] of Object.entries(category)) {
      if (needle === key || needle.includes(key) || key.includes(needle)) {
        return { price: data[tier] ?? data["mid"], unit: data.unit, isStaple: data.staple || false };
      }
    }
  }
  return null;
}

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.send("Platewell backend is running");
});

const SUPPORTED_CUISINES = [
  "American/Western",
  "Italian",
  "Mexican/Latin",
  "Asian",
  "Mediterranean",
  "Middle Eastern",
  "Indian",
  "African",
  "Japanese",
  "Other",
];

const MEAL_TYPES_BY_COUNT = {
  1: ["dinner"],
  2: ["lunch", "dinner"],
  3: ["breakfast", "lunch", "dinner"],
  4: ["breakfast", "lunch", "dinner", "snack"],
  5: ["breakfast", "lunch", "dinner", "snack", "snack"],
};

const ALLOWED_TAGS = [
  "high protein",
  "vegetarian",
  "vegan",
  "gluten-free",
  "dairy-free",
  "nut-free",
  "halal",
  "kosher",
  "pescatarian",
  "balanced",
  "fridge mode",
];

const ALLOWED_SKILL_LEVELS = [
  "quick & easy",
  "comfortable cook",
  "adventurous chef",
];

const ALLOWED_VARIETY_LEVELS = [
  "mix it up a little",
  "same favorites, different days",
  "a little of everything",
  "surprise me every meal",
];

const ALLOWED_DIETARY_GOALS = [
  "balanced",
  "high protein",
  "vegetarian",
  "vegan",
  "pescatarian",
];



function getMealSlots(mealsPerDay) {
  return MEAL_TYPES_BY_COUNT[mealsPerDay] || ["breakfast", "lunch", "dinner"];
}

function dedupeStrings(items) {
  return Array.from(
    new Set(
      (items || [])
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );
}

function normalizeRestrictions(restrictions) {
  if (!Array.isArray(restrictions)) return [];
  return restrictions
    .map((r) => String(r).trim().toLowerCase())
    .filter(Boolean)
    .filter((r) => r !== "none" && r !== "no restrictions");
}

function normalizeFridgeIngredients(fridgeIngredients) {
  if (!fridgeIngredients) return [];

  if (Array.isArray(fridgeIngredients)) {
    return Array.from(
      new Set(
        fridgeIngredients
          .map((item) => String(item).trim().toLowerCase())
          .filter(Boolean)
      )
    ).slice(0, 20);
  }

  return Array.from(
    new Set(
      String(fridgeIngredients)
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    )
  ).slice(0, 20);
}

async function extractFridgeIngredients(rawText) {
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: "You are a helpful assistant. Return only valid JSON with no extra text, no markdown, and no code fences.",
      messages: [{
        role: "user",
        content: `Extract a clean list of ingredients from this text. Return only a JSON array of ingredient names, nothing else. Normalize names (e.g. "half a bag of spinach" → "spinach", "some eggs" → "eggs", "leftover rice" → "rice").\n\nText: "${rawText}"\n\nReturn ONLY this format:\n["ingredient1", "ingredient2", "ingredient3"]`,
      }],
    });
    const content = response.content?.[0]?.text?.trim();
    if (!content) throw new Error("Empty response");
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) throw new Error("Not an array");
    return parsed.map((s) => String(s).trim().toLowerCase()).filter(Boolean).slice(0, 20);
  } catch {
    // Fall back to comma-split
    return String(rawText)
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 20);
  }
}

function normalizeDietaryGoal(goal) {
  const normalized = String(goal || "balanced").trim().toLowerCase();
  return ALLOWED_DIETARY_GOALS.includes(normalized) ? normalized : "balanced";
}

function normalizeCookingStyle(style) {
  const normalized = String(style || "quick & easy").trim().toLowerCase();
  return ALLOWED_SKILL_LEVELS.includes(normalized)
    ? normalized
    : "quick & easy";
}

function normalizeVarietyLevel(level) {
  const normalized = String(level || "a little of everything").trim().toLowerCase();
  return ALLOWED_VARIETY_LEVELS.includes(normalized)
    ? normalized
    : "a little of everything";
}

function titleCase(str) {
  if (!str) return "";
  return str
    .split(" ")
    .map((word) =>
      word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : ""
    )
    .join(" ");
}

function validateCuisines(cuisines) {
  if (!Array.isArray(cuisines) || cuisines.length === 0) return false;
  return cuisines.every((c) => typeof c === "string" && c.trim().length > 0);
}

function sanitizeMealType(mealType, allowedSlots) {
  const normalized = String(mealType || "").trim().toLowerCase();
  return allowedSlots.includes(normalized) ? normalized : allowedSlots[0];
}

function sanitizeCuisine(cuisine, selectedCuisines) {
  return selectedCuisines.includes(cuisine) ? cuisine : selectedCuisines[0];
}

function sanitizeIngredientAmounts(ingredientAmounts) {
  if (!Array.isArray(ingredientAmounts)) return [];
  return ingredientAmounts
    .map((i) => String(i).trim())
    .filter(Boolean)
    .slice(0, 10);
}

function sanitizeInstructions(instructions) {
  if (!Array.isArray(instructions)) return [];
  return instructions
    .map((step) => String(step).trim())
    .filter(Boolean)
    .slice(0, 6);
}

function sanitizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return Array.from(
    new Set(
      tags
        .map((t) => String(t).trim().toLowerCase())
        .filter((t) => ALLOWED_TAGS.includes(t))
    )
  );
}

function sanitizeSkillLevel(skillLevel, fallback) {
  const normalized = String(skillLevel || "").trim().toLowerCase();
  return ALLOWED_SKILL_LEVELS.includes(normalized)
    ? normalized
    : fallback || "quick & easy";
}

function sanitizePrepTime(prepTime) {
  const value = String(prepTime || "").trim();
  return value || "20 minutes";
}

function sanitizeServingSize(servingSize, mealType) {
  const value = String(servingSize || "").trim();
  if (value) return value;

  if (mealType === "breakfast") return "1 plate";
  if (mealType === "lunch") return "1 bowl";
  if (mealType === "dinner") return "1 plate";
  return "1 portion";
}

function sanitizeMealDescription(description, mealName) {
  const value = String(description || "").trim();
  if (value) return value;
  return `${mealName} made to fit your weekly plan.`;
}

function parseSimpleFraction(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  if (/^\d+\/\d+$/.test(trimmed)) {
    const [top, bottom] = trimmed.split("/").map(Number);
    if (!bottom) return null;
    return top / bottom;
  }

  if (/^\d+\s+\d+\/\d+$/.test(trimmed)) {
    const [whole, fraction] = trimmed.split(/\s+/);
    const [top, bottom] = fraction.split("/").map(Number);
    if (!bottom) return null;
    return Number(whole) + top / bottom;
  }

  return null;
}

function pluralizePhrase(phrase) {
  const words = String(phrase || "").split(" ");
  if (words.length === 0) return phrase;

  const last = words[words.length - 1].toLowerCase();

  // Already plural — don't touch
  if (last.endsWith("ies") || last.endsWith("es") || last.endsWith("s")) {
    return words.join(" ");
  }

  if (last.endsWith("y") && !/[aeiou]y$/.test(last)) {
    words[words.length - 1] = `${last.slice(0, -1)}ies`;
    return words.join(" ");
  }

  if (
    last.endsWith("x") ||
    last.endsWith("z") ||
    last.endsWith("ch") ||
    last.endsWith("sh")
  ) {
    words[words.length - 1] = `${last}es`;
    return words.join(" ");
  }

  words[words.length - 1] = `${last}s`;
  return words.join(" ");
}

function roundToNearest(value, step) {
  return Math.round(value / step) * step;
}

const GRAM_UNITS = new Set(["g", "gram", "grams", "kg"]);
const ML_UNITS = new Set(["ml", "l", "liter", "liters"]);
const CUP_UNITS = new Set(["cup", "cups"]);
const TBSP_UNITS = new Set(["tbsp", "tablespoon", "tablespoons"]);
const TSP_UNITS = new Set(["tsp", "teaspoon", "teaspoons"]);
const OZ_UNITS = new Set(["oz", "ounce", "ounces"]);
const LB_UNITS = new Set(["lb", "lbs", "pound", "pounds"]);
const OTHER_UNITS = new Set([
  "can", "cans", "jar", "jars", "bunch", "bunches",
  "piece", "pieces", "fillet", "fillets", "clove", "cloves",
  "head", "heads", "pack", "packs", "package", "packages",
  "bag", "bags", "slice", "slices", "stick", "sticks", "block", "blocks",
]);
const ALL_KNOWN_UNITS = new Set([
  ...GRAM_UNITS, ...ML_UNITS, ...CUP_UNITS, ...TBSP_UNITS,
  ...TSP_UNITS, ...OZ_UNITS, ...LB_UNITS, ...OTHER_UNITS,
]);

const GROCERY_DESCRIPTOR_WORDS = new Set([
  "sliced", "diced", "chopped", "minced", "crumbled", "pitted",
  "whole", "total", "cooked", "raw", "boneless", "skinless",
  "freshly", "rinsed", "drained", "softened", "melted", "beaten",
  "crushed", "grated", "shredded", "trimmed", "peeled", "halved", "cubed",
]);

function parseGroceryLine(str) {
  const s = String(str || "").toLowerCase().trim();
  if (!s) return null;

  const words = s.split(/\s+/).filter(Boolean);
  if (!words.length) return null;

  let qty = null;
  let unit = null;
  let startIndex = 0;

  // Try mixed fraction "1 1/2"
  if (words.length >= 2) {
    const mixed = parseSimpleFraction(`${words[0]} ${words[1]}`);
    if (mixed !== null) {
      qty = mixed;
      startIndex = 2;
    }
  }

  // Try plain number or simple fraction
  if (qty === null) {
    const simple = parseSimpleFraction(words[0]);
    if (simple !== null) {
      qty = simple;
      startIndex = 1;
    }
  }

  // Try to pick up a unit word
  if (qty !== null && words[startIndex] && ALL_KNOWN_UNITS.has(words[startIndex])) {
    unit = words[startIndex];
    startIndex += 1;
  }

  // Everything remaining is the ingredient name
  const nameParts = words
    .slice(startIndex)
    .filter((w) => !GROCERY_DESCRIPTOR_WORDS.has(w));

  const name = nameParts.join(" ").trim();
  if (!name || name.length < 2) return null;

  if (qty === null) qty = 1;
  return { qty, unit, name };
}

function formatGroceryEntry(name, amounts) {
  const displayName = titleCase(name);

  if (amounts.count > 0) {
    const qty = Math.max(1, Math.ceil(amounts.count));
    const label = qty === 1 ? name : pluralizePhrase(name);
    return `${qty} ${titleCase(label)}`;
  }

  if (amounts.grams > 0) {
    const lbs = amounts.grams / 453.6;
    if (lbs < 0.25) {
      const oz = amounts.grams / 28.3495;
      return `${Math.max(0.5, roundToNearest(oz, 0.5))} oz ${displayName}`;
    }
    const lbQty = Math.max(0.25, roundToNearest(lbs, 0.25));
    return `${lbQty} ${lbQty === 1 ? "lb" : "lbs"} ${displayName}`;
  }

  if (amounts.ml > 0) {
    const flOz = amounts.ml / 29.5735;
    return `${Math.max(0.5, roundToNearest(flOz, 0.5))} fl oz ${displayName}`;
  }

  if (amounts.lbs > 0) {
    const lbQty = Math.max(0.25, roundToNearest(amounts.lbs, 0.25));
    return `${lbQty} ${lbQty === 1 ? "lb" : "lbs"} ${displayName}`;
  }

  if (amounts.oz > 0) {
    return `${Math.max(0.5, roundToNearest(amounts.oz, 0.5))} oz ${displayName}`;
  }

  if (amounts.cups > 0) {
    const qty = Math.max(0.25, roundToNearest(amounts.cups, 0.25));
    return `${qty} ${qty === 1 ? "cup" : "cups"} ${displayName}`;
  }

  if (amounts.tbsp > 0) {
    return `${Math.max(1, Math.round(amounts.tbsp))} tbsp ${displayName}`;
  }

  if (amounts.tsp > 0) {
    return `${Math.max(1, Math.round(amounts.tsp))} tsp ${displayName}`;
  }

  if (amounts.otherQty > 0 && amounts.otherUnit) {
    return `${Math.max(1, Math.round(amounts.otherQty))} ${amounts.otherUnit} ${displayName}`;
  }

  return null;
}

function buildSimplifiedGroceryList(meals) {
  const agg = new Map();

  for (const meal of meals) {
    const ingredientAmounts = Array.isArray(meal.ingredientAmounts)
      ? meal.ingredientAmounts
      : [];

    const seenThisMeal = new Set();

    for (const entry of ingredientAmounts) {
      const parsed = parseGroceryLine(entry);
      if (!parsed) continue;

      const { qty, unit, name } = parsed;

      // Count each ingredient only once per meal
      if (seenThisMeal.has(name)) continue;
      seenThisMeal.add(name);
      const u = (unit || "").toLowerCase();

      const existing = agg.get(name) || {
        grams: 0, ml: 0, cups: 0, tbsp: 0, tsp: 0,
        oz: 0, lbs: 0, count: 0, otherQty: 0, otherUnit: null,
      };

      if (!unit) {
        existing.count += qty;
      } else if (GRAM_UNITS.has(u)) {
        existing.grams += u === "kg" ? qty * 1000 : qty;
      } else if (ML_UNITS.has(u)) {
        existing.ml += (u === "l" || u === "liter" || u === "liters") ? qty * 1000 : qty;
      } else if (CUP_UNITS.has(u)) {
        existing.cups += qty;
      } else if (TBSP_UNITS.has(u)) {
        existing.tbsp += qty;
      } else if (TSP_UNITS.has(u)) {
        existing.tsp += qty;
      } else if (OZ_UNITS.has(u)) {
        existing.oz += qty;
      } else if (LB_UNITS.has(u)) {
        existing.lbs += qty;
      } else {
        existing.otherQty += qty;
        existing.otherUnit = existing.otherUnit || unit;
      }

      agg.set(name, existing);
    }
  }

  return Array.from(agg.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, amounts]) => formatGroceryEntry(name, amounts))
    .filter(Boolean);
}

const PANTRY_STAPLES = new Set([
  "olive oil","oil","vegetable oil","canola oil","coconut oil","sesame oil",
  "butter","salt","pepper","black pepper","white pepper","sugar","brown sugar",
  "flour","cornstarch","baking powder","baking soda","water","soy sauce",
  "fish sauce","oyster sauce","vinegar","balsamic vinegar","red wine vinegar",
  "white wine vinegar","apple cider vinegar","hot sauce","worcestershire sauce",
  "honey","maple syrup","vanilla extract","cooking spray","mayonnaise","ketchup",
  "mustard","dijon mustard","paprika","cumin","coriander","turmeric","chili powder",
  "cayenne","oregano","thyme","rosemary","bay leaves","cinnamon","nutmeg","cloves",
  "red pepper flakes","garlic powder","onion powder","dried basil","dried parsley",
  "italian seasoning","curry powder","garam masala","za'atar","sumac","baharat",
  "white wine","red wine","vegetable broth","chicken broth","beef broth",
]);

function roundToShoppingLbs(lbs) {
  if (lbs <= 0.3) return "0.25 lbs";
  if (lbs <= 0.6) return "0.5 lbs";
  if (lbs <= 0.85) return "0.75 lbs";
  if (lbs <= 1.1) return "1 lb";
  if (lbs <= 1.35) return "1.25 lbs";
  if (lbs <= 1.6) return "1.5 lbs";
  if (lbs <= 1.85) return "1.75 lbs";
  if (lbs <= 2.1) return "2 lbs";
  return `${Math.round(lbs * 2) / 2} lbs`;
}

function enforceGroceryBudget(groceryItems, weeklyBudget) {
  if (!weeklyBudget || weeklyBudget <= 0) return groceryItems;

  const calcTotal = (items) =>
    items
      .filter((i) => !i.isStaple && i.estimatedPrice != null)
      .reduce((sum, i) => sum + Number(i.estimatedPrice || 0), 0);

  let items = [...groceryItems];

  for (let pass = 0; pass < 20 && calcTotal(items) > weeklyBudget; pass++) {
    // Rank non-staple priced items by cost descending
    const ranked = items
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => !item.isStaple && item.estimatedPrice != null)
      .sort((a, b) => Number(b.item.estimatedPrice) - Number(a.item.estimatedPrice));

    if (ranked.length === 0) break;

    const { item: target, idx } = ranked[0];
    const amountStr = String(target.displayAmount || "");
    const lbsMatch = amountStr.match(/^(\d+)\s*lbs?$/i);

    if (lbsMatch) {
      const currentLbs = parseInt(lbsMatch[1]);
      if (currentLbs > 1) {
        // Reduce by 1 lb
        const newLbs = currentLbs - 1;
        const pricePerLb = Number(target.estimatedPrice) / currentLbs;
        const newPrice = parseFloat((pricePerLb * newLbs).toFixed(2));
        const newAmount = `${newLbs} ${newLbs === 1 ? "lb" : "lbs"}`;
        items = items.map((it, i) =>
          i === idx ? { ...it, displayAmount: newAmount, estimatedPrice: newPrice } : it
        );
        continue;
      }
    }

    // Can't reduce further — remove the most expensive item
    items = items.filter((_, i) => i !== idx);
  }

  return items;
}

function normalizeGroceryItems(items) {
  return items.map((item) => {
    const nameLower = item.name.toLowerCase();
    const isKnownStaple = PANTRY_STAPLES.has(nameLower) ||
      [...PANTRY_STAPLES].some((s) => s.includes(" ") && nameLower.includes(s));
    if (isKnownStaple) {
      return { ...item, displayAmount: null, isStaple: true };
    }
    if (item.displayAmount) {
      const lower = item.displayAmount.toLowerCase();
      // Strip cooking-unit amounts → treat as staple
      if (/^\d+(\.\d+)?\s*(tbsp|tsp|cups?|ml|fl oz)/.test(lower)) {
        return { ...item, displayAmount: null, isStaple: true };
      }
      // Round ugly decimal lbs to clean shopping increments
      const lbsMatch = lower.match(/^(\d+(\.\d+)?)\s*lbs?$/);
      if (lbsMatch) {
        const lbs = parseFloat(lbsMatch[1]);
        return { ...item, displayAmount: roundToShoppingLbs(lbs) };
      }
    }
    return item;
  });
}

async function buildAIGroceryList(meals, people, { preferredStore = "", householdSize = null, weeklyBudget = null } = {}) {
  const mealSummary = meals.map((meal) => {
    return `${meal.meal} (${meal.mealType}, Day ${meal.day}): ${(meal.ingredientAmounts || []).join(", ")}`;
  }).join("\n");

  const household = householdSize || people;
  const storeContext = preferredStore
    ? `The user shops at ${preferredStore}. Use realistic ${preferredStore} price levels for all estimates.`
    : "Use average US grocery store prices.";

  const budgetContext = weeklyBudget
    ? `The user's total weekly grocery budget is $${weeklyBudget}. The sum of all estimatedPrice values for non-staple items MUST stay at or under this budget. If the total would exceed the budget, reduce quantities or swap expensive items for cheaper alternatives. If the total comes in well under budget (more than 15% below), try to add value — suggest a better cut of meat, an extra vegetable, or a snack item — to get closer to the budget without going over.`
    : "";

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 8192,
    system: "You are a grocery list assistant. Return only valid JSON with no extra text, no markdown, and no code fences.",
    messages: [{
      role: "user",
      content: `You are building a grocery list for ${household} people based on these meals for the week:\n\n${mealSummary}\n\nStore: ${storeContext}\n${budgetContext}\n\nBuild a clean, human-readable grocery list that a real person would write before going to the store. Scale all quantities for ${household} people.\n\nCRITICAL STAPLE RULE: The following must ALWAYS have displayAmount: null, estimatedPrice: null, and isStaple: true — no exceptions: olive oil, butter, salt, pepper, sugar, flour, soy sauce, vinegar (any kind), honey, spices, dried herbs, hot sauce, mayonnaise, mustard, cooking oil, garlic powder, onion powder, balsamic vinegar, white wine, red wine, any broth or stock.\n\nFor everything else, use ONLY the units a real person writes on a shopping list:\n- Items sold by count: whole numbers only — "4 Onions", "2 Lemons", "1 dozen Eggs"\n- Canned/jarred goods: "1 can Coconut Milk", "2 cans Diced Tomatoes"\n- Packaged/bagged goods: "1 bag Rice", "1 bag Frozen Peas", "1 box Pasta"\n- Meat and fish: round up to whole pounds only — "2 lbs Chicken Thighs", "1 lb Ground Beef". NEVER use decimal lbs — always round up to the next whole number\n- Fresh herbs: "1 bunch Cilantro", "1 bunch Basil"\n- Dairy: "1 block Feta", "1 container Greek Yogurt"\n- Bread: "1 loaf Bread"\n- Liquids in cartons: "1 carton Chicken Broth"\n- NEVER use decimal numbers (no "0.25", "1.5", "0.5", etc.)\n- NEVER use tbsp, tsp, cups, ml, fl oz, oz, or grams — those are cooking units not shopping units\n- Capitalize each ingredient name\n- Include an estimatedPrice (number, in USD) for every non-staple item. estimatedPrice should reflect the cost of the listed quantity.\n- Include exactTotal for reference\n\nReturn this exact JSON format:\n{\n  "groceryItems": [\n    {\n      "name": "Chicken Thighs",\n      "displayAmount": "2 lbs",\n      "estimatedPrice": 5.98,\n      "exactTotal": "900g total across 3 meals",\n      "isStaple": false\n    },\n    {\n      "name": "Olive Oil",\n      "displayAmount": null,\n      "estimatedPrice": null,\n      "exactTotal": "21 tbsp total across 5 meals",\n      "isStaple": true\n    }\n  ]\n}`,
    }],
  });

  const content = response.content?.[0]?.text;
  if (!content) return null;
  const cleaned = content.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed.groceryItems)) return null;

  // Override estimatedPrice with static prices from prices.json
  const tier = getStoreTier(preferredStore);
  const enriched = parsed.groceryItems.map((item) => {
    if (item.isStaple) return { ...item, estimatedPrice: null };
    const priceData = lookupPrice(item.name, tier);
    if (priceData) {
      return { ...item, estimatedPrice: priceData.price, isStaple: priceData.isStaple };
    }
    return item;
  });

  const normalized = normalizeGroceryItems(enriched);
  return weeklyBudget ? enforceGroceryBudget(normalized, weeklyBudget) : normalized;
}

function categorizeGroceryList(items) {
  const categories = {
    "Produce": [],
    "Proteins": [],
    "Dairy": [],
    "Grains & Bread": [],
    "Pantry & Spices": [],
  };

  const rules = [
    { category: "Produce", keywords: ["spinach","lettuce","kale","arugula","cabbage","onion","onions","garlic","tomato","tomatoes","pepper","peppers","zucchini","eggplant","eggplants","mushroom","mushrooms","carrot","carrots","celery","broccoli","cauliflower","cucumber","potato","potatoes","sweet potato","leek","leeks","shallot","shallots","scallion","scallions","ginger","lemon","lime","limes","orange","oranges","apple","apples","banana","berries","berry","avocado","avocados","herb","herbs","parsley","cilantro","basil","thyme","rosemary","mint","dill","chive","chives","green beans","peas","corn","squash","artichoke","asparagus","beet","beets","radish","fennel","bok choy","chard","collard"] },
    { category: "Proteins", keywords: ["chicken","beef","pork","lamb","turkey","salmon","tuna","shrimp","fish","fillet","fillets","egg","eggs","tofu","tempeh","lentil","lentils","chickpea","chickpeas","black beans","kidney beans","cannellini","fava beans","edamame","ground beef","ground turkey","steak","sausage","bacon","prosciutto","anchovy","anchovies","scallop","scallops","crab","lobster","clam","clams","mussels"] },
    { category: "Dairy", keywords: ["milk","cream","butter","cheese","parmesan","mozzarella","cheddar","feta","ricotta","brie","gouda","pecorino","romano","yogurt","sour cream","cream cheese","heavy cream","half and half","ghee","béchamel","bechamel"] },
    { category: "Grains & Bread", keywords: ["rice","pasta","spaghetti","penne","fettuccine","linguine","rigatoni","orzo","couscous","quinoa","bread","baguette","ciabatta","pita","tortilla","tortillas","noodle","noodles","flour","oat","oats","barley","bulgur","polenta","cornmeal","panko","breadcrumb","breadcrumbs","crouton"] },
  ];

  for (const item of items) {
    const lower = item.toLowerCase();
    let matched = false;
    for (const rule of rules) {
      if (rule.keywords.some((kw) => lower.includes(kw))) {
        categories[rule.category].push(item);
        matched = true;
        break;
      }
    }
    if (!matched) {
      categories["Pantry & Spices"].push(item);
    }
  }

  return Object.entries(categories)
    .filter(([, items]) => items.length > 0)
    .map(([category, items]) => ({ category, items }));
}

function positiveNumberOrFallback(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

function wholeNumberOrFallback(value, fallback) {
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : fallback;
}

function clampNumber(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function normalizeMealName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildMealLabel(day, mealType) {
  return `Day ${day} - ${titleCase(mealType)}`;
}

function getMealTypeOrderValue(mealType) {
  const mealTypeOrder = ["breakfast", "lunch", "dinner", "snack"];
  const index = mealTypeOrder.indexOf(mealType);
  return index === -1 ? 999 : index;
}

function ingredientAmountLooksLikeFridgeMatch(ingredientAmount, fridgeIngredients) {
  const text = String(ingredientAmount || "").toLowerCase();
  return fridgeIngredients.some((fridgeItem) => text.includes(fridgeItem));
}

function mealUsesFridgeIngredients(meal, fridgeIngredients) {
  if (!fridgeIngredients.length) return false;

  const ingredientAmounts = Array.isArray(meal.ingredientAmounts)
    ? meal.ingredientAmounts
    : [];

  return ingredientAmounts.some((item) =>
    ingredientAmountLooksLikeFridgeMatch(item, fridgeIngredients)
  );
}

function enforceFridgeTag(meal, fridgeIngredients) {
  const tags = sanitizeTags(meal.tags || []);
  const usesFridge = mealUsesFridgeIngredients(meal, fridgeIngredients);

  if (usesFridge && !tags.includes("fridge mode")) {
    tags.push("fridge mode");
  }

  if (!usesFridge) {
    return tags.filter((tag) => tag !== "fridge mode");
  }

  return tags;
}

function sanitizeMealObject(
  item,
  {
    slots,
    cuisines,
    cookingStyle,
    budgetTargetPerMeal,
    people,
    dayOverride = null,
    mealTypeOverride = null,
    fridgeIngredients = [],
  }
) {
  const resolvedMealType = sanitizeMealType(
    mealTypeOverride ?? item.mealType,
    slots
  );
  const dayValue = dayOverride ?? Number(item.day);

  const sanitized = {
    day: wholeNumberOrFallback(dayValue, 1),
    mealType: resolvedMealType,
    meal: String(item.meal || "").trim(),
    description: sanitizeMealDescription(
      item.description,
      item.meal || "This meal"
    ),
    cuisine: sanitizeCuisine(item.cuisine, cuisines),
    ingredientAmounts: sanitizeIngredientAmounts(item.ingredientAmounts),
    instructions: sanitizeInstructions(item.instructions),
    prepTime: sanitizePrepTime(item.prepTime),
    servings: wholeNumberOrFallback(item.servings, people),
    servingSize: sanitizeServingSize(item.servingSize, resolvedMealType),
    calories: clampNumber(
      positiveNumberOrFallback(item.calories, 450),
      50,
      1800
    ),
    protein: clampNumber(positiveNumberOrFallback(item.protein, 30), 1, 120),
    carbs: clampNumber(positiveNumberOrFallback(item.carbs, 35), 1, 250),
    fat: clampNumber(positiveNumberOrFallback(item.fat, 18), 1, 120),
    tags: sanitizeTags(item.tags),
    costPerServing: clampNumber(
      positiveNumberOrFallback(item.costPerServing, budgetTargetPerMeal),
      0.5,
      50
    ),
    skillLevel: sanitizeSkillLevel(item.skillLevel, cookingStyle),
  };

  sanitized.tags = enforceFridgeTag(sanitized, fridgeIngredients);

  return sanitized;
}

function toClientMeal(meal, numericPeople, cookingStyle, budgetTargetPerMeal) {
  const costPerServing = positiveNumberOrFallback(
    meal.costPerServing,
    budgetTargetPerMeal
  );
  const mealTotal = costPerServing * numericPeople;

  return {
    label: buildMealLabel(meal.day, meal.mealType),
    day: meal.day,
    meal: meal.meal,
    mealType: meal.mealType,
    description: meal.description,
    cuisine: meal.cuisine,
    costPerServing: costPerServing.toFixed(2),
    totalMealCost: mealTotal.toFixed(2),
    prepTime: meal.prepTime,
    servings: meal.servings,
    servingSize: meal.servingSize,
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fat: meal.fat,
    tags: meal.tags,
    skillLevel: meal.skillLevel,
    skillLabel: titleCase(meal.skillLevel),
    ingredientAmounts: meal.ingredientAmounts,
    instructions: meal.instructions,
  };
}

function sortMeals(meals) {
  return [...meals].sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    return getMealTypeOrderValue(a.mealType) - getMealTypeOrderValue(b.mealType);
  });
}

function uniqueMealLimit(varietyLevel) {
  const level = String(varietyLevel || "").toLowerCase();
  return level === "surprise me every meal" ? 1 : 2;
}

function findMissingSlots(meals, activeCookDays, slots) {
  const missing = [];

  for (let day = 1; day <= activeCookDays; day += 1) {
    for (const slot of slots) {
      const exists = meals.some(
        (meal) => meal.day === day && meal.mealType === slot
      );
      if (!exists) {
        missing.push({ day, mealType: slot });
      }
    }
  }

  return missing;
}

function removeDuplicateSlotMeals(meals) {
  const seen = new Set();
  const kept = [];

  for (const meal of meals) {
    const key = `${meal.day}-${meal.mealType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(meal);
  }

  return kept;
}

function enforceRepeatLimit(meals, varietyLevel) {
  const limit = uniqueMealLimit(varietyLevel);
  const usage = new Map();
  const filtered = [];

  for (const meal of meals) {
    const normalizedName = normalizeMealName(meal.meal);
    const used = usage.get(normalizedName) || 0;

    if (!normalizedName) continue;
    if (used >= limit) continue;

    usage.set(normalizedName, used + 1);
    filtered.push(meal);
  }

  return filtered;
}

function buildRepeatedMealsSummary(meals) {
  const usageCounts = {};

  for (const meal of meals) {
    const name = String(meal.meal || "").trim();
    if (!name) continue;
    usageCounts[name] = (usageCounts[name] || 0) + 1;
  }

  return Object.entries(usageCounts)
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([meal, count]) => ({ meal, timesUsed: count }));
}

function buildGroceryPriceContext(groceryItems, { preferredStore = "", weeklyBudget = null } = {}) {
  if (!groceryItems || groceryItems.length === 0) return null;

  const nonStapleItems = groceryItems.filter((item) => !item.isStaple && item.estimatedPrice != null);
  const estimatedTotal = nonStapleItems.reduce((sum, item) => sum + Number(item.estimatedPrice || 0), 0);

  if (estimatedTotal === 0) return null;

  let budgetSummary = null;
  if (weeklyBudget && weeklyBudget > 0) {
    const diff = weeklyBudget - estimatedTotal;
    const pct = Math.round((estimatedTotal / weeklyBudget) * 100);
    if (diff < 0) {
      budgetSummary = `Estimated total: $${estimatedTotal.toFixed(2)} — $${Math.abs(diff).toFixed(2)} over your $${weeklyBudget.toFixed(2)} budget`;
    } else {
      budgetSummary = `Estimated total: $${estimatedTotal.toFixed(2)} of your $${weeklyBudget.toFixed(2)} budget (${pct}% used, $${diff.toFixed(2)} remaining)`;
    }
  }

  return {
    priceEstimates: nonStapleItems.map((item) => ({
      item: item.displayAmount ? `${item.displayAmount} ${item.name}` : item.name,
      estimatedPrice: item.estimatedPrice,
    })),
    estimatedTotal,
    priceSource: preferredStore ? `${preferredStore} prices` : "US grocery averages",
    disclaimer: "Prices are estimates based on typical store pricing and may vary.",
    budgetSummary,
  };
}

function buildRatingsText(ratings) {
  if (!ratings || typeof ratings !== "object") return "";
  const liked = Object.entries(ratings).filter(([, v]) => v === "up").map(([k]) => k);
  const disliked = Object.entries(ratings).filter(([, v]) => v === "down").map(([k]) => k);
  if (!liked.length && !disliked.length) return "";
  const lines = ["User has previously rated these meals:"];
  if (liked.length) lines.push(`- Liked: ${liked.join(", ")}`);
  if (disliked.length) lines.push(`- Disliked: ${disliked.join(", ")}`);
  lines.push("Try to suggest meals similar to liked meals. Avoid suggesting disliked meals entirely.");
  return lines.join("\n");
}

async function generateMealPlanWithAI({
  cuisines,
  activeCookDays,
  slots,
  dietaryGoal,
  restrictions,
  cookingStyle,
  varietyLevel,
  budgetTargetPerMeal,
  people,
  fridgeIngredients,
  fridgeModeType,
  ratings,
  cookTime,
  avoidFoods = "",
  preferredStore = "",
  householdSize = null,
  weeklyBudget = null,
}) {
  const expectedMealCount = activeCookDays * slots.length;

  const restrictionText =
    restrictions.length > 0
      ? `Dietary restrictions: ${restrictions.join(", ")}.`
      : "No specific dietary restrictions.";

  const avoidFoodsText = avoidFoods.trim()
    ? `The user dislikes or cannot eat the following — never include these in any meal: ${avoidFoods.trim()}.`
    : "";

  const fridgeText =
    fridgeIngredients.length > 0
      ? fridgeModeType === "only"
        ? `STRICT FRIDGE MODE: Generate meals using ONLY these ingredients: ${fridgeIngredients.join(", ")}. Do not introduce any ingredients not on this list under any circumstances. Every meal must be buildable entirely from these ingredients. Tag every meal with "fridge mode".`
        : `FRIDGE MODE: The user has these ingredients available: ${fridgeIngredients.join(", ")}. Prioritize using these ingredients wherever possible across meals. You may add other common ingredients to complete meals when necessary. Tag any meal that uses fridge ingredients with "fridge mode".`
      : "Fridge mode is not active.";

  const cookingStyleDesc = {
    "quick & easy": "very simple recipes, minimal steps, beginner-friendly",
    "comfortable cook": "intermediate recipes with moderate complexity",
    "adventurous chef": "advanced recipes, more technique allowed",
  }[String(cookingStyle || "").toLowerCase()] || "simple recipes";

  const varietyDesc = {
    "same favorites, different days": "Meals can repeat frequently. The same meal title can appear up to 3 times across the week.",
    "a little of everything": "Meals can repeat, but no meal title should appear more than twice across the week.",
    "surprise me every meal": "Every meal must be completely different. Maximize diversity across cuisines, meal types, and ingredients.",
    "mix it up a little": "Meals can repeat, but no meal title should appear more than twice across the week.",
  }[String(varietyLevel || "").toLowerCase()] ?? "Meals can repeat, but no meal title should appear more than twice across the week.";

  const cookTimeDesc = {
    "under 20 min": "All meals must take under 20 minutes total to prepare and cook.",
    "20–40 min": "Meals should take between 20 and 40 minutes to prepare and cook.",
    "no preference": "",
  }[String(cookTime || "no preference").toLowerCase()] || "";

  const ratingsText = buildRatingsText(ratings);

  const household = householdSize || people;
  const storeText = preferredStore
    ? `Preferred grocery store: ${preferredStore}. Price all meals realistically for ${preferredStore} (e.g. Aldi is budget-friendly, Whole Foods is premium).`
    : "";
  const budgetGuardText = weeklyBudget
    ? `Total weekly grocery budget: $${weeklyBudget}. The combined ingredient cost across ALL meals must stay within this budget. Never suggest a protein-heavy plan where meat alone would exceed the total budget. If needed, include more plant-based or cheaper protein sources.`
    : "";

  const prompt = `Generate a ${activeCookDays}-day meal plan with exactly ${expectedMealCount} meals.

Requirements:
- Cuisines: ${cuisines.join(", ")}
- Meal slots per day: ${slots.join(", ")}
- Dietary goal: ${dietaryGoal || "balanced"}
- ${restrictionText}${avoidFoodsText ? `\n- ${avoidFoodsText}` : ""}
- Cooking skill: ${cookingStyleDesc}
- Variety: ${varietyDesc}
- Budget: $${budgetTargetPerMeal.toFixed(2)} per meal per person
- People: ${people} (household size: ${household})${cookTimeDesc ? `\n- ${cookTimeDesc}` : ""}${storeText ? `\n- ${storeText}` : ""}${budgetGuardText ? `\n- ${budgetGuardText}` : ""}
- ${fridgeText}
${ratingsText ? `\n${ratingsText}` : ""}

Rules:
- Max 6 ingredients per meal
- Max 4 instruction steps per meal, keep each step brief
- Short one-sentence description per meal
- Realistic nutrition per serving (no zeros)
- skillLevel must be one of: "quick & easy", "comfortable cook", "adventurous chef"
- ingredientAmounts must contain BOTH the amount AND the full ingredient name in every entry — never separate them
- Always put a space between number and unit: "400 g chicken breast", not "400g chicken breast"
- Example entries: "400 g chicken breast", "1 cup basmati rice", "2 tbsp olive oil", "3 garlic cloves", "500 ml chicken broth"

Return ONLY valid JSON, no markdown, no code fences:
{
  "meals": [
    {
      "day": 1,
      "mealType": "breakfast",
      "meal": "Meal Name",
      "description": "One sentence.",
      "cuisine": "Middle Eastern",
      "ingredientAmounts": ["400 g chicken breast", "1 cup basmati rice", "2 tbsp olive oil", "3 garlic cloves"],
      "instructions": ["Step 1", "Step 2"],
      "prepTime": "20 minutes",
      "servings": 2,
      "servingSize": "1 plate",
      "calories": 450,
      "protein": 30,
      "carbs": 35,
      "fat": 18,
      "tags": [],
      "costPerServing": 4.50,
      "skillLevel": "quick & easy"
    }
  ]
}`;

  const totalMeals = activeCookDays * slots.length;
  const tokensPerMeal = 600;
  const maxTokens = Math.min(Math.max(totalMeals * tokensPerMeal, 3000), 12000);

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: maxTokens,
    system: "You are a professional meal planner. Return only valid JSON with no extra text, no markdown, and no code fences. Keep responses concise.",
    messages: [
      { role: "user", content: prompt }
    ],
  });

  console.log("STOP REASON:", response.stop_reason);
  console.log("CONTENT LENGTH:", response.content?.[0]?.text?.length);

  const content = response.content?.[0]?.text;

  if (!content) {
    throw new Error("AI returned empty content");
  }

  // Strip any accidental markdown fences
  const cleaned = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error("Raw AI content that failed JSON.parse:", content);
    throw new Error("AI returned invalid JSON");
  }

  if (!parsed || !Array.isArray(parsed.meals)) {
    throw new Error("AI returned invalid meal structure");
  }

  const meals = parsed.meals.map((item) =>
    sanitizeMealObject(item, {
      slots,
      cuisines,
      cookingStyle,
      budgetTargetPerMeal,
      people,
      fridgeIngredients,
    })
  );

  return { meals };
}

async function generateSingleMealWithAI({
  day,
  mealType,
  cuisines,
  dietaryGoal,
  restrictions,
  cookingStyle,
  varietyLevel,
  budgetTargetPerMeal,
  people,
  mealsToAvoid = [],
  fridgeIngredients,
  fridgeModeType,
  ratings,
  cookTime,
}) {
  const restrictionText =
    restrictions.length > 0
      ? `Dietary restrictions: ${restrictions.join(", ")}.`
      : "No specific dietary restrictions.";

  const avoidText =
    mealsToAvoid.length > 0
      ? `Avoid these meal names: ${mealsToAvoid.join(", ")}.`
      : "Avoid obvious repetition.";

  const fridgeText =
    fridgeIngredients.length > 0
      ? fridgeModeType === "only"
        ? `STRICT FRIDGE MODE: Generate this meal using ONLY these ingredients: ${fridgeIngredients.join(", ")}. Do not introduce any ingredients not on this list under any circumstances. Tag the meal with "fridge mode".`
        : `FRIDGE MODE: The user has these ingredients available: ${fridgeIngredients.join(", ")}. Prioritize using these ingredients. You may add other common ingredients to complete the meal when necessary. Tag the meal with "fridge mode" if it uses fridge ingredients.`
      : "Fridge mode is not active.";

  const cookingStyleDesc = {
    "quick & easy": "very simple recipes, minimal steps, beginner-friendly",
    "comfortable cook": "intermediate recipes with moderate complexity",
    "adventurous chef": "advanced recipes, more technique allowed",
  }[String(cookingStyle || "").toLowerCase()] || "simple recipes";

  const cookTimeDesc = {
    "under 20 min": "All meals must take under 20 minutes total to prepare and cook.",
    "20–40 min": "Meals should take between 20 and 40 minutes to prepare and cook.",
    "no preference": "",
  }[String(cookTime || "no preference").toLowerCase()] || "";

  const ratingsText = buildRatingsText(ratings);

  const prompt = `Generate exactly one ${mealType} meal for day ${day}.

Requirements:
- Cuisines: ${cuisines.join(", ")}
- Dietary goal: ${dietaryGoal || "balanced"}
- ${restrictionText}
- Cooking skill: ${cookingStyleDesc}
- Budget: $${budgetTargetPerMeal.toFixed(2)} per person
- People: ${people}${cookTimeDesc ? `\n- ${cookTimeDesc}` : ""}
- ${avoidText}
- ${fridgeText}
${ratingsText ? `\n${ratingsText}` : ""}

Rules:
- Max 6 ingredients
- Max 4 instruction steps, keep each brief
- Short one-sentence description
- Realistic nutrition per serving (no zeros)
- skillLevel must be one of: "quick & easy", "comfortable cook", "adventurous chef"
- ingredientAmounts must contain BOTH the amount AND the full ingredient name in every entry — never separate them
- Always put a space between number and unit: "400 g chicken breast", not "400g chicken breast"
- Example entries: "400 g chicken breast", "1 cup basmati rice", "2 tbsp olive oil", "3 garlic cloves"

Return ONLY valid JSON, no markdown, no code fences:
{
  "meal": {
    "day": ${day},
    "mealType": "${mealType}",
    "meal": "Meal Name",
    "description": "One sentence.",
    "cuisine": "Middle Eastern",
    "ingredientAmounts": ["400 g chicken breast", "1 cup basmati rice", "2 tbsp olive oil", "3 garlic cloves"],
    "instructions": ["Step 1", "Step 2"],
    "prepTime": "20 minutes",
    "servings": 2,
    "servingSize": "1 plate",
    "calories": 450,
    "protein": 30,
    "carbs": 35,
    "fat": 18,
    "tags": [],
    "costPerServing": 4.50,
    "skillLevel": "quick & easy"
  }
}`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    system: "You are a professional meal planner. Return only valid JSON with no extra text, no markdown, and no code fences. Keep responses concise.",
    messages: [
      { role: "user", content: prompt }
    ],
  });

  const content = response.content?.[0]?.text;

  if (!content) {
    throw new Error("AI returned empty replacement meal");
  }

  // Strip any accidental markdown fences
  const cleaned = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error("Raw swap AI content that failed JSON.parse:", content);
    throw new Error("AI returned invalid replacement meal JSON");
  }

  if (!parsed?.meal) {
    throw new Error("AI returned invalid replacement meal structure");
  }

  return sanitizeMealObject(parsed.meal, {
    slots: [mealType],
    cuisines,
    cookingStyle,
    budgetTargetPerMeal,
    people,
    dayOverride: day,
    mealTypeOverride: mealType,
    fridgeIngredients,
  });
}

async function fillMissingSlotsWithAI({
  currentMeals,
  missingSlots,
  cuisines,
  dietaryGoal,
  restrictions,
  cookingStyle,
  varietyLevel,
  budgetTargetPerMeal,
  people,
  fridgeIngredients,
  fridgeModeType,
  ratings,
  cookTime,
}) {
  const filledMeals = [...currentMeals];

  for (const missing of missingSlots) {
    const mealsToAvoid = filledMeals.map((meal) => meal.meal).filter(Boolean);

    const replacement = await generateSingleMealWithAI({
      day: missing.day,
      mealType: missing.mealType,
      cuisines,
      dietaryGoal,
      restrictions,
      cookingStyle,
      varietyLevel,
      budgetTargetPerMeal,
      people,
      mealsToAvoid,
      fridgeIngredients,
      fridgeModeType,
      ratings,
      cookTime,
    });

    filledMeals.push(replacement);
  }

  return filledMeals;
}

function getNextSlot(day, mealType, slots, maxDays) {
  const idx = slots.indexOf(String(mealType).toLowerCase());
  if (idx === -1) return null;
  if (idx < slots.length - 1) return { day, mealType: slots[idx + 1] };
  if (day < maxDays) return { day: day + 1, mealType: slots[0] };
  return null;
}

async function generatePrepDayGuide(meals) {
  const mealNames = meals.map((m) => m.meal).filter(Boolean).slice(0, 15).join(", ");
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: "You are a meal prep assistant. Return only valid JSON with no extra text, no markdown, and no code fences.",
    messages: [{
      role: "user",
      content: `Given these meals for the week: ${mealNames}\n\nCreate a simple Sunday prep day guide. Group tasks into:\n1. Batch Cook - things to fully cook in advance (grains, proteins, roasted vegetables)\n2. Prep Ahead - things to chop, marinate, or prepare but not cook\n\nMax 5 items per group. Return JSON:\n{"batchCook":["Cook 3 cups rice","Roast chicken breasts"],"prepAhead":["Chop onions and peppers","Marinate beef overnight"]}`,
    }],
  });
  const content = response.content?.[0]?.text;
  if (!content) return null;
  const cleaned = content.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(cleaned);
  return {
    batchCook: Array.isArray(parsed.batchCook) ? parsed.batchCook.slice(0, 5) : [],
    prepAhead: Array.isArray(parsed.prepAhead) ? parsed.prepAhead.slice(0, 5) : [],
  };
}

app.get("/cuisines", (req, res) => {
  res.json({ cuisines: SUPPORTED_CUISINES });
});

app.post("/generate", async (req, res) => {
  try {
    const {
      budget,
      people,
      daysPerWeek,
      mealsPerDay,
      dietaryGoal,
      restrictions,
      cookingStyle,
      varietyLevel,
      cuisines,
      fridgeIngredients,
      fridgeModeType,
      ratings,
      cookTime,
      avoidFoods,
      preferredStore,
      householdSize,
    } = req.body;

    if (
      budget == null ||
      people == null ||
      daysPerWeek == null ||
      mealsPerDay == null
    ) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    if (!Array.isArray(cuisines) || cuisines.length === 0) {
      return res
        .status(400)
        .json({ error: "Please select at least one cuisine." });
    }

    if (!validateCuisines(cuisines)) {
      return res.status(400).json({
        error: `Invalid cuisine selected. Supported cuisines: ${SUPPORTED_CUISINES.join(", ")}`,
      });
    }

    const numericBudget = Number(budget);
    const numericPeople = Number(people);
    const numericDays = Number(daysPerWeek);
    const numericMealsPerDay = Number(mealsPerDay);

    if (
      [numericBudget, numericPeople, numericDays, numericMealsPerDay].some(
        (value) => Number.isNaN(value)
      )
    ) {
      return res
        .status(400)
        .json({ error: "Invalid numeric values provided." });
    }

    if (
      numericBudget <= 0 ||
      numericPeople <= 0 ||
      numericDays <= 0 ||
      numericMealsPerDay <= 0
    ) {
      return res.status(400).json({
        error:
          "Budget, people, days per week, and meals per day must all be greater than 0.",
      });
    }

    const normalizedFridgeModeType =
      fridgeModeType === "only" ? "only" : "supplement";

    const normalizedDietaryGoal = normalizeDietaryGoal(dietaryGoal);
    const normalizedCookingStyle = normalizeCookingStyle(cookingStyle);
    const normalizedVarietyLevel = normalizeVarietyLevel(varietyLevel);

    const slots = getMealSlots(numericMealsPerDay);
    const selectedRestrictions = normalizeRestrictions(restrictions);

    let selectedFridgeIngredients = normalizeFridgeIngredients(fridgeIngredients);
    if (fridgeIngredients && String(fridgeIngredients).trim()) {
      try {
        selectedFridgeIngredients = await extractFridgeIngredients(String(fridgeIngredients).trim());
      } catch {
        // already set to comma-split fallback above
      }
    }

    const activeCookDays = numericDays;
    const totalMealServings = activeCookDays * slots.length * numericPeople;
    const budgetTargetPerMeal = numericBudget / Math.max(1, totalMealServings);

    let aiResult;
    try {
      aiResult = await generateMealPlanWithAI({
        cuisines,
        activeCookDays,
        slots,
        dietaryGoal: normalizedDietaryGoal,
        restrictions: selectedRestrictions,
        cookingStyle: normalizedCookingStyle,
        varietyLevel: normalizedVarietyLevel,
        budgetTargetPerMeal,
        people: numericPeople,
        fridgeIngredients: selectedFridgeIngredients,
        fridgeModeType: normalizedFridgeModeType,
        ratings,
        cookTime,
        avoidFoods: avoidFoods || "",
        preferredStore: preferredStore || "",
        householdSize: Number(householdSize) || numericPeople,
        weeklyBudget: numericBudget,
      });
    } catch (aiError) {
      console.error("AI generation error:", aiError);
      return res.status(502).json({
        error:
          "Failed to generate meal plan from AI. Check your API key, model response, and request payload.",
      });
    }

    let meals = aiResult.meals
      .filter((meal) => meal.day >= 1 && meal.day <= activeCookDays)
      .filter((meal) => slots.includes(meal.mealType))
      .filter((meal) => String(meal.meal || "").trim().length > 0);

    meals = removeDuplicateSlotMeals(sortMeals(meals));
    meals = enforceRepeatLimit(meals, normalizedVarietyLevel);

    const missingSlots = findMissingSlots(meals, activeCookDays, slots);

    if (missingSlots.length > 0) {
      try {
        meals = await fillMissingSlotsWithAI({
          currentMeals: meals,
          missingSlots,
          cuisines,
          dietaryGoal: normalizedDietaryGoal,
          restrictions: selectedRestrictions,
          cookingStyle: normalizedCookingStyle,
          varietyLevel: normalizedVarietyLevel,
          budgetTargetPerMeal,
          people: numericPeople,
          fridgeIngredients: selectedFridgeIngredients,
          fridgeModeType: normalizedFridgeModeType,
          ratings,
          cookTime,
        });
      } catch (fillError) {
        console.error("AI missing-slot fill error:", fillError);
      }
    }

    meals = removeDuplicateSlotMeals(sortMeals(meals));

    const finalMissingSlots = findMissingSlots(meals, activeCookDays, slots);
    if (finalMissingSlots.length > 0) {
      return res.status(502).json({
        error: "The AI returned an incomplete meal plan. Please try again.",
      });
    }

    const clientMeals = meals.map((meal) =>
      toClientMeal(
        meal,
        numericPeople,
        normalizedCookingStyle,
        budgetTargetPerMeal
      )
    );

    let groceryList = [];
    let aiGroceryItems = null;
    let categorizedGroceryList = null;

    if (!(selectedFridgeIngredients.length > 0 && normalizedFridgeModeType === "only")) {
      try {
        aiGroceryItems = await buildAIGroceryList(meals, numericPeople, { preferredStore: preferredStore || "", householdSize: Number(householdSize) || numericPeople, weeklyBudget: numericBudget });
        groceryList = aiGroceryItems
          ? aiGroceryItems.map((item) => item.displayAmount ? `${item.displayAmount} ${item.name}` : item.name)
          : buildSimplifiedGroceryList(meals);
        if (aiGroceryItems) {
          const categoryRules = [
            { category: "Produce", keywords: ["onion","onions","garlic","tomato","lemon","lime","spinach","kale","cabbage","carrot","celery","broccoli","mushroom","pepper","zucchini","eggplant","potato","avocado","cucumber","ginger","herb","parsley","cilantro","basil","chive","bunch","scallion","lettuce","arugula","berry","berries","apple","banana","orange","squash","fennel","beet","radish","bok choy","chard","asparagus","corn","peas","green beans"] },
            { category: "Proteins", keywords: ["chicken","beef","pork","lamb","turkey","salmon","tuna","shrimp","fish","fillet","egg","eggs","tofu","tempeh","lentil","chickpea","black beans","kidney beans","cannellini","fava","edamame","steak","sausage","bacon","scallop","crab","lobster","clam","mussel","anchovy"] },
            { category: "Dairy", keywords: ["milk","cream","butter","cheese","parmesan","mozzarella","cheddar","feta","ricotta","brie","gouda","pecorino","romano","yogurt","sour cream","cream cheese","ghee"] },
            { category: "Grains & Bread", keywords: ["rice","pasta","spaghetti","penne","noodle","bread","baguette","ciabatta","pita","tortilla","flour","oat","barley","quinoa","couscous","polenta","panko","breadcrumb"] },
          ];

          const grouped = { "Produce": [], "Proteins": [], "Dairy": [], "Grains & Bread": [], "Pantry & Spices": [] };
          for (const item of aiGroceryItems) {
            const lower = item.name.toLowerCase();
            let matched = false;
            for (const rule of categoryRules) {
              if (rule.keywords.some((kw) => lower.includes(kw))) {
                grouped[rule.category].push(item);
                matched = true;
                break;
              }
            }
            if (!matched) grouped["Pantry & Spices"].push(item);
          }
          categorizedGroceryList = Object.entries(grouped)
            .filter(([, items]) => items.length > 0)
            .map(([category, items]) => ({ category, items }));
        }
      } catch (groceryError) {
        console.error("AI grocery list failed, falling back:", groceryError);
        groceryList = buildSimplifiedGroceryList(meals);
        categorizedGroceryList = categorizeGroceryList(groceryList);
      }
    }

    const estimatedTotalCost = clientMeals.reduce((sum, meal) => {
      return sum + Number(meal.totalMealCost || 0);
    }, 0);

    const remainingBudget = numericBudget - estimatedTotalCost;
    const repeatedMeals = buildRepeatedMealsSummary(meals);

    let prepDayGuide = null;
    try {
      prepDayGuide = await generatePrepDayGuide(meals);
    } catch (prepError) {
      console.error("Prep day guide generation failed, continuing without it:", prepError);
    }

    const groceryPriceEstimate = aiGroceryItems
      ? buildGroceryPriceContext(aiGroceryItems, { preferredStore: preferredStore || "", weeklyBudget: numericBudget })
      : null;

    return res.json({
      weeklyBudget: numericBudget.toFixed(2),
      estimatedTotalCost: estimatedTotalCost.toFixed(2),
      remainingBudget: remainingBudget.toFixed(2),
      daysPerWeek: numericDays,
      mealsPerDay: numericMealsPerDay,
      dietaryGoal: normalizedDietaryGoal,
      restrictions: selectedRestrictions,
      cookingStyle: normalizedCookingStyle,
      varietyLevel: normalizedVarietyLevel,
      cuisines,
      fridgeMode: selectedFridgeIngredients.length > 0,
      fridgeIngredients: selectedFridgeIngredients,
      budgetTargetPerMeal: budgetTargetPerMeal.toFixed(2),
      repeatedMeals,
      meals: clientMeals,
      groceryList,
      categorizedGroceryList,
      prepDayGuide,
      groceryPriceEstimate,
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Meal generation failed." });
  }
});

app.post("/swapMeal", async (req, res) => {
  try {
    const {
      budget,
      people,
      daysPerWeek,
      mealsPerDay,
      dietaryGoal,
      restrictions,
      cookingStyle,
      varietyLevel,
      cuisines,
      day,
      mealType,
      existingMeals,
      fridgeIngredients,
      fridgeModeType,
      ratings,
      cookTime,
    } = req.body;

    if (
      budget == null ||
      people == null ||
      daysPerWeek == null ||
      mealsPerDay == null ||
      day == null ||
      !mealType
    ) {
      return res
        .status(400)
        .json({ error: "Missing required fields for meal swap." });
    }

    if (!Array.isArray(cuisines) || cuisines.length === 0) {
      return res
        .status(400)
        .json({ error: "Please select at least one cuisine." });
    }

    if (!validateCuisines(cuisines)) {
      return res.status(400).json({
        error: `Invalid cuisine selected. Supported cuisines: ${SUPPORTED_CUISINES.join(", ")}`,
      });
    }

    const numericBudget = Number(budget);
    const numericPeople = Number(people);
    const numericDays = Number(daysPerWeek);
    const numericMealsPerDay = Number(mealsPerDay);
    const numericDay = Number(day);
    const normalizedMealType = String(mealType).trim().toLowerCase();

    if (
      [
        numericBudget,
        numericPeople,
        numericDays,
        numericMealsPerDay,
        numericDay,
      ].some((value) => Number.isNaN(value))
    ) {
      return res
        .status(400)
        .json({ error: "Invalid numeric values provided." });
    }

    if (
      numericBudget <= 0 ||
      numericPeople <= 0 ||
      numericDays <= 0 ||
      numericMealsPerDay <= 0 ||
      numericDay <= 0
    ) {
      return res.status(400).json({
        error: "Invalid numeric inputs for meal swap.",
      });
    }

    const slots = getMealSlots(numericMealsPerDay);

    if (!slots.includes(normalizedMealType)) {
      return res
        .status(400)
        .json({ error: "Invalid meal type for this plan." });
    }

    if (numericDay > numericDays) {
      return res.status(400).json({ error: "Invalid day for this plan." });
    }

    const normalizedDietaryGoal = normalizeDietaryGoal(dietaryGoal);
    const normalizedCookingStyle = normalizeCookingStyle(cookingStyle);
    const normalizedVarietyLevel = normalizeVarietyLevel(varietyLevel);
    const selectedRestrictions = normalizeRestrictions(restrictions);
    const selectedFridgeIngredients = normalizeFridgeIngredients(fridgeIngredients);

    const totalMealServings = numericDays * slots.length * numericPeople;
    const budgetTargetPerMeal = numericBudget / Math.max(1, totalMealServings);

    const mealsToAvoid = Array.isArray(existingMeals)
      ? existingMeals
          .map((meal) => String(meal?.meal || "").trim())
          .filter(Boolean)
      : [];

    let swappedMeal;
    try {
      swappedMeal = await generateSingleMealWithAI({
        day: numericDay,
        mealType: normalizedMealType,
        cuisines,
        dietaryGoal: normalizedDietaryGoal,
        restrictions: selectedRestrictions,
        cookingStyle: normalizedCookingStyle,
        varietyLevel: normalizedVarietyLevel,
        budgetTargetPerMeal,
        people: numericPeople,
        mealsToAvoid,
        fridgeIngredients: selectedFridgeIngredients,
        fridgeModeType: fridgeModeType === "only" ? "only" : "supplement",
        ratings,
        cookTime,
      });
    } catch (aiError) {
      console.error("AI swap error:", aiError);
      return res.status(502).json({
        error: "Failed to swap meal from AI. Please try again.",
      });
    }

    return res.json({
      meal: toClientMeal(
        swappedMeal,
        numericPeople,
        normalizedCookingStyle,
        budgetTargetPerMeal
      ),
    });
  } catch (error) {
    console.error("Swap meal server error:", error);
    res.status(500).json({ error: "Meal swap failed." });
  }
});

app.post("/regenerateWithLeftovers", async (req, res) => {
  try {
    const {
      budget, people, daysPerWeek, mealsPerDay, dietaryGoal, restrictions,
      cookingStyle, varietyLevel, cuisines, fridgeIngredients, fridgeModeType, ratings,
      existingMeals, leftovers, cookTime,
    } = req.body;

    if (budget == null || people == null || daysPerWeek == null || mealsPerDay == null) {
      return res.status(400).json({ error: "Missing required fields." });
    }
    if (!Array.isArray(cuisines) || cuisines.length === 0) {
      return res.status(400).json({ error: "Please select at least one cuisine." });
    }

    const numericBudget = Number(budget);
    const numericPeople = Number(people);
    const numericDays = Number(daysPerWeek);
    const numericMealsPerDay = Number(mealsPerDay);

    if ([numericBudget, numericPeople, numericDays, numericMealsPerDay].some(Number.isNaN) ||
        numericBudget <= 0 || numericPeople <= 0 || numericDays <= 0 || numericMealsPerDay <= 0) {
      return res.status(400).json({ error: "Invalid numeric values provided." });
    }

    const normalizedDietaryGoal = normalizeDietaryGoal(dietaryGoal);
    const normalizedCookingStyle = normalizeCookingStyle(cookingStyle);
    const normalizedVarietyLevel = normalizeVarietyLevel(varietyLevel);
    const slots = getMealSlots(numericMealsPerDay);
    const selectedRestrictions = normalizeRestrictions(restrictions);
    const selectedFridgeIngredients = normalizeFridgeIngredients(fridgeIngredients);
    const totalMealServings = numericDays * slots.length * numericPeople;
    const budgetTargetPerMeal = numericBudget / Math.max(1, totalMealServings);

    // Start with the existing plan
    let meals = Array.isArray(existingMeals) ? existingMeals.map((m) => ({ ...m })) : [];

    // Process leftover flags — copy each flagged meal to the next available slot
    const leftoverItems = Array.isArray(leftovers) ? leftovers : [];
    for (const { day: leftDay, mealType: leftMealType } of leftoverItems) {
      const numericDay = Number(leftDay);
      const sourceMeal = meals.find(
        (m) => Number(m.day) === numericDay &&
               String(m.mealType).toLowerCase() === String(leftMealType).toLowerCase()
      );
      if (!sourceMeal) continue;

      const nextSlot = getNextSlot(numericDay, String(leftMealType).toLowerCase(), slots, numericDays);
      if (!nextSlot) continue;

      const slotTaken = meals.some(
        (m) => Number(m.day) === nextSlot.day &&
               String(m.mealType).toLowerCase() === nextSlot.mealType
      );
      if (slotTaken) continue;

      meals.push({
        ...sourceMeal,
        day: nextSlot.day,
        mealType: nextSlot.mealType,
        tags: [...(Array.isArray(sourceMeal.tags) ? sourceMeal.tags : []), "leftover"],
      });
    }

    // Generate AI meals for any remaining missing slots
    const missingSlots = findMissingSlots(meals, numericDays, slots);
    if (missingSlots.length > 0) {
      try {
        meals = await fillMissingSlotsWithAI({
          currentMeals: meals,
          missingSlots,
          cuisines,
          dietaryGoal: normalizedDietaryGoal,
          restrictions: selectedRestrictions,
          cookingStyle: normalizedCookingStyle,
          varietyLevel: normalizedVarietyLevel,
          budgetTargetPerMeal,
          people: numericPeople,
          fridgeIngredients: selectedFridgeIngredients,
          fridgeModeType: fridgeModeType === "only" ? "only" : "supplement",
          ratings,
          cookTime,
        });
      } catch (fillError) {
        console.error("Leftover regeneration fill error:", fillError);
      }
    }

    meals = removeDuplicateSlotMeals(sortMeals(meals));

    // Call toClientMeal on any raw AI meals (already-client meals tolerate a second pass)
    const clientMeals = meals.map((meal) =>
      toClientMeal(meal, numericPeople, normalizedCookingStyle, budgetTargetPerMeal)
    );

    // Exclude leftover meals from grocery list (ingredients already counted in original)
    const nonLeftoverMeals = meals.filter((m) => !(m.tags || []).includes("leftover"));
    let groceryList = [];
    let aiGroceryItems = null;
    let categorizedGroceryList = null;

    if (!(selectedFridgeIngredients.length > 0 && fridgeModeType === "only")) {
      try {
        aiGroceryItems = await buildAIGroceryList(nonLeftoverMeals, numericPeople, { preferredStore: preferredStore || "", householdSize: Number(householdSize) || numericPeople, weeklyBudget: numericBudget });
        groceryList = aiGroceryItems
          ? aiGroceryItems.map((item) => item.displayAmount ? `${item.displayAmount} ${item.name}` : item.name)
          : buildSimplifiedGroceryList(nonLeftoverMeals);
        if (aiGroceryItems) {
          const categoryRules = [
            { category: "Produce", keywords: ["onion","onions","garlic","tomato","lemon","lime","spinach","kale","cabbage","carrot","celery","broccoli","mushroom","pepper","zucchini","eggplant","potato","avocado","cucumber","ginger","herb","parsley","cilantro","basil","chive","bunch","scallion","lettuce","arugula","berry","berries","apple","banana","orange","squash","fennel","beet","radish","bok choy","chard","asparagus","corn","peas","green beans"] },
            { category: "Proteins", keywords: ["chicken","beef","pork","lamb","turkey","salmon","tuna","shrimp","fish","fillet","egg","eggs","tofu","tempeh","lentil","chickpea","black beans","kidney beans","cannellini","fava","edamame","steak","sausage","bacon","scallop","crab","lobster","clam","mussel","anchovy"] },
            { category: "Dairy", keywords: ["milk","cream","butter","cheese","parmesan","mozzarella","cheddar","feta","ricotta","brie","gouda","pecorino","romano","yogurt","sour cream","cream cheese","ghee"] },
            { category: "Grains & Bread", keywords: ["rice","pasta","spaghetti","penne","noodle","bread","baguette","ciabatta","pita","tortilla","flour","oat","barley","quinoa","couscous","polenta","panko","breadcrumb"] },
          ];

          const grouped = { "Produce": [], "Proteins": [], "Dairy": [], "Grains & Bread": [], "Pantry & Spices": [] };
          for (const item of aiGroceryItems) {
            const lower = item.name.toLowerCase();
            let matched = false;
            for (const rule of categoryRules) {
              if (rule.keywords.some((kw) => lower.includes(kw))) {
                grouped[rule.category].push(item);
                matched = true;
                break;
              }
            }
            if (!matched) grouped["Pantry & Spices"].push(item);
          }
          categorizedGroceryList = Object.entries(grouped)
            .filter(([, items]) => items.length > 0)
            .map(([category, items]) => ({ category, items }));
        }
      } catch (groceryError) {
        console.error("AI grocery list failed, falling back:", groceryError);
        groceryList = buildSimplifiedGroceryList(nonLeftoverMeals);
        categorizedGroceryList = categorizeGroceryList(groceryList);
      }
    }

    const estimatedTotalCost = clientMeals.reduce((sum, m) => sum + Number(m.totalMealCost || 0), 0);
    const remainingBudget = numericBudget - estimatedTotalCost;
    const repeatedMeals = buildRepeatedMealsSummary(meals);

    let prepDayGuide = null;
    try {
      prepDayGuide = await generatePrepDayGuide(nonLeftoverMeals);
    } catch {}

    return res.json({
      weeklyBudget: numericBudget.toFixed(2),
      estimatedTotalCost: estimatedTotalCost.toFixed(2),
      remainingBudget: remainingBudget.toFixed(2),
      daysPerWeek: numericDays,
      mealsPerDay: numericMealsPerDay,
      dietaryGoal: normalizedDietaryGoal,
      restrictions: selectedRestrictions,
      cookingStyle: normalizedCookingStyle,
      varietyLevel: normalizedVarietyLevel,
      cuisines,
      fridgeMode: selectedFridgeIngredients.length > 0,
      fridgeIngredients: selectedFridgeIngredients,
      budgetTargetPerMeal: budgetTargetPerMeal.toFixed(2),
      repeatedMeals,
      meals: clientMeals,
      groceryList,
      categorizedGroceryList,
      prepDayGuide,
    });
  } catch (error) {
    console.error("Regenerate with leftovers error:", error);
    res.status(500).json({ error: "Regeneration failed." });
  }
});

app.listen(PORT, () => {
  console.log(`Platewell backend listening on http://localhost:${PORT}`);
});