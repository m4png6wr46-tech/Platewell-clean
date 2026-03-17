import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = 3001;

if (!process.env.OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY in your .env file");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.send("Platewell backend is running");
});

const SUPPORTED_CUISINES = [
  "Middle Eastern",
  "Asian",
  "Mediterranean",
  "South Asian",
  "Latin/Mexican",
  "Italian",
  "Modern/Western",
  "African",
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
  "keep it easy",
  "i know my way around",
  "chef mode",
];

const ALLOWED_VARIETY_LEVELS = [
  "keep it fresh",
  "mix it up a little",
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

function normalizeDietaryGoal(goal) {
  const normalized = String(goal || "balanced").trim().toLowerCase();
  return ALLOWED_DIETARY_GOALS.includes(normalized) ? normalized : "balanced";
}

function normalizeCookingStyle(style) {
  const normalized = String(style || "keep it easy").trim().toLowerCase();
  return ALLOWED_SKILL_LEVELS.includes(normalized)
    ? normalized
    : "keep it easy";
}

function normalizeVarietyLevel(level) {
  const normalized = String(level || "mix it up a little").trim().toLowerCase();
  return ALLOWED_VARIETY_LEVELS.includes(normalized)
    ? normalized
    : "mix it up a little";
}

function titleCase(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function validateCuisines(cuisines) {
  if (!Array.isArray(cuisines) || cuisines.length === 0) return false;
  return cuisines.every((c) => SUPPORTED_CUISINES.includes(c));
}

function sanitizeMealType(mealType, allowedSlots) {
  const normalized = String(mealType || "").trim().toLowerCase();
  return allowedSlots.includes(normalized) ? normalized : allowedSlots[0];
}

function sanitizeCuisine(cuisine, selectedCuisines) {
  return selectedCuisines.includes(cuisine) ? cuisine : selectedCuisines[0];
}

function sanitizeIngredients(ingredients) {
  if (!Array.isArray(ingredients)) return [];
  return ingredients
    .map((i) => String(i).trim())
    .filter(Boolean)
    .slice(0, 10);
}

function sanitizeIngredientAmounts(ingredientAmounts) {
  if (!Array.isArray(ingredientAmounts)) return [];
  return ingredientAmounts
    .map((i) => String(i).trim())
    .filter(Boolean)
    .slice(0, 10);
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
    : fallback || "keep it easy";
}

function sanitizeInstructions(instructions) {
  if (!Array.isArray(instructions)) return [];
  return instructions
    .map((step) => String(step).trim())
    .filter(Boolean)
    .slice(0, 6);
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

function mealTypeLabel(mealType) {
  return titleCase(mealType);
}

function buildMealLabel(day, mealType) {
  return `Day ${day} - ${mealTypeLabel(mealType)}`;
}

function getMealTypeOrderValue(mealType) {
  const mealTypeOrder = ["breakfast", "lunch", "dinner", "snack"];
  const index = mealTypeOrder.indexOf(mealType);
  return index === -1 ? 999 : index;
}

function dedupeStrings(items) {
  return Array.from(
    new Set(
      (items || [])
        .map((item) => String(item).trim())
        .filter(Boolean)
    )
  );
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
  const ingredients = Array.isArray(meal.ingredients) ? meal.ingredients : [];

  return [...ingredientAmounts, ...ingredients].some((item) =>
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
    cuisine: sanitizeCuisine(item.cuisine, cuisines),
    ingredients: sanitizeIngredients(item.ingredients),
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
    protein: clampNumber(
      positiveNumberOrFallback(item.protein, 30),
      1,
      120
    ),
    carbs: clampNumber(
      positiveNumberOrFallback(item.carbs, 35),
      1,
      250
    ),
    fat: clampNumber(
      positiveNumberOrFallback(item.fat, 18),
      1,
      120
    ),
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
    cuisine: meal.cuisine,
    costPerServing: costPerServing.toFixed(2),
    totalMealCost: mealTotal.toFixed(2),
    ingredients: meal.ingredients || [],
    ingredientAmounts: meal.ingredientAmounts || [],
    instructions: meal.instructions || [],
    prepTime: meal.prepTime || "20 minutes",
    servings: wholeNumberOrFallback(meal.servings, numericPeople),
    servingSize: meal.servingSize || "1 serving",
    calories: positiveNumberOrFallback(meal.calories, 450),
    protein: positiveNumberOrFallback(meal.protein, 30),
    carbs: positiveNumberOrFallback(meal.carbs, 35),
    fat: positiveNumberOrFallback(meal.fat, 18),
    skillLabel: meal.skillLevel || cookingStyle || "keep it easy",
    tags: meal.tags || [],
  };
}

function buildRequiredSlotMap(activeCookDays, slots) {
  const required = [];

  for (let day = 1; day <= activeCookDays; day += 1) {
    for (const mealType of slots) {
      required.push({ day, mealType });
    }
  }

  return required;
}

function uniqueMealLimit(varietyLevel) {
  return String(varietyLevel).toLowerCase() === "keep it fresh" ? 1 : 2;
}

function sortMeals(meals) {
  return meals.sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    return getMealTypeOrderValue(a.mealType) - getMealTypeOrderValue(b.mealType);
  });
}

function findMissingSlots(meals, activeCookDays, slots) {
  const required = buildRequiredSlotMap(activeCookDays, slots);

  return required.filter(({ day, mealType }) => {
    return !meals.some(
      (meal) => Number(meal.day) === day && String(meal.mealType) === mealType
    );
  });
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

function buildGroceryList(meals) {
  const groceryItems = [];

  for (const meal of meals) {
    const ingredientAmounts = Array.isArray(meal.ingredientAmounts)
      ? meal.ingredientAmounts
      : [];

    const ingredients = Array.isArray(meal.ingredients) ? meal.ingredients : [];

    const source = ingredientAmounts.length > 0 ? ingredientAmounts : ingredients;

    for (const item of source) {
      groceryItems.push(String(item).trim());
    }
  }

  return dedupeStrings(groceryItems).sort((a, b) => a.localeCompare(b));
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
}) {
  const expectedMealCount = activeCookDays * slots.length;

  const restrictionText =
    restrictions.length > 0
      ? `Dietary restrictions: ${restrictions.join(", ")}.`
      : "No specific dietary restrictions.";

  const fridgeText =
    fridgeIngredients.length > 0
      ? `Fridge mode ingredients available: ${fridgeIngredients.join(", ")}. Prioritize using these ingredients whenever possible. You may add supporting ingredients to complete meals, but the listed fridge ingredients should clearly shape the plan. If a meal actually uses them, include the tag "fridge mode".`
      : "Fridge mode is not active.";

  const cookingStyleDesc = {
    "keep it easy": "very simple recipes, minimal steps, beginner-friendly",
    "i know my way around": "intermediate recipes with moderate complexity",
    "chef mode": "advanced recipes, more technique allowed",
  }[String(cookingStyle || "").toLowerCase()] || "simple recipes";

  const varietyDesc =
    String(varietyLevel || "").toLowerCase() === "keep it fresh"
      ? "Every meal should be unique. Avoid repeating meal titles."
      : "Meals can repeat, but no meal title should appear more than twice across the week.";

  const prompt = `Generate a ${activeCookDays}-day meal plan.

Requirements:
- Allowed cuisines across the week: ${cuisines.join(", ")}
- Meal slots per day: ${slots.join(", ")}
- Dietary goal: ${dietaryGoal || "balanced"}
- ${restrictionText}
- Cooking skill level: ${cookingStyleDesc}
- Variety rule: ${varietyDesc}
- Budget target: approximately $${budgetTargetPerMeal.toFixed(
    2
  )} per meal per person
- Number of people: ${people}
- ${fridgeText}

Rules:
1. Return exactly ${expectedMealCount} meal objects total
2. Each day must have exactly these meal types: ${slots.join(", ")}
3. Breakfast must be breakfast food, lunch must be lunch food, dinner must be dinner food, snack must be snack food
4. No salmon and asparagus for breakfast-type nonsense
5. Keep ingredients realistic and commonly available in a normal supermarket
6. Respect all dietary restrictions
7. Include concise, practical instructions that a normal person can follow
8. Prep time should be realistic like "15 minutes" or "35 minutes"
9. Include realistic nutrition estimates PER SERVING for calories, protein, carbs, and fat
10. Do not use 0 for calories, protein, carbs, or fat
11. Include servings and servingSize
12. Include ingredientAmounts with realistic quantities like "2 eggs" or "1 cup cooked rice"
13. The full recipe should make practical sense for the household size
14. Make the meals feel exciting and real, not bland generic fitness meals
15. Use different cuisines naturally across the week
16. Avoid repeating the same meal title unless variety rules allow it`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.8,
    messages: [
      {
        role: "system",
        content:
          "You are a professional meal planner. Return only valid structured data.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "meal_plan",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            meals: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  day: {
                    type: "integer",
                    minimum: 1,
                    maximum: activeCookDays,
                  },
                  mealType: {
                    type: "string",
                    enum: ["breakfast", "lunch", "dinner", "snack"],
                  },
                  meal: { type: "string" },
                  cuisine: {
                    type: "string",
                    enum: cuisines,
                  },
                  ingredients: {
                    type: "array",
                    minItems: 4,
                    maxItems: 10,
                    items: { type: "string" },
                  },
                  ingredientAmounts: {
                    type: "array",
                    minItems: 4,
                    maxItems: 10,
                    items: { type: "string" },
                  },
                  instructions: {
                    type: "array",
                    minItems: 3,
                    maxItems: 6,
                    items: { type: "string" },
                  },
                  prepTime: { type: "string" },
                  servings: {
                    type: "integer",
                    minimum: 1,
                  },
                  servingSize: { type: "string" },
                  calories: {
                    type: "number",
                    minimum: 50,
                  },
                  protein: {
                    type: "number",
                    minimum: 1,
                  },
                  carbs: {
                    type: "number",
                    minimum: 1,
                  },
                  fat: {
                    type: "number",
                    minimum: 1,
                  },
                  tags: {
                    type: "array",
                    items: {
                      type: "string",
                      enum: ALLOWED_TAGS,
                    },
                  },
                  costPerServing: {
                    type: "number",
                    minimum: 0.5,
                  },
                  skillLevel: {
                    type: "string",
                    enum: ALLOWED_SKILL_LEVELS,
                  },
                },
                required: [
                  "day",
                  "mealType",
                  "meal",
                  "cuisine",
                  "ingredients",
                  "ingredientAmounts",
                  "instructions",
                  "prepTime",
                  "servings",
                  "servingSize",
                  "calories",
                  "protein",
                  "carbs",
                  "fat",
                  "tags",
                  "costPerServing",
                  "skillLevel",
                ],
              },
            },
          },
          required: ["meals"],
        },
      },
    },
    max_completion_tokens: 5000,
  });

  const content = completion.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("AI returned empty content");
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    console.error("Raw AI content that failed JSON.parse:", content);
    throw new Error("AI returned invalid JSON");
  }

  if (!parsed || !Array.isArray(parsed.meals)) {
    throw new Error("AI returned invalid meal structure");
  }

  return parsed.meals.map((item) =>
    sanitizeMealObject(item, {
      slots,
      cuisines,
      cookingStyle,
      budgetTargetPerMeal,
      people,
      fridgeIngredients,
    })
  );
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
}) {
  const restrictionText =
    restrictions.length > 0
      ? `Dietary restrictions: ${restrictions.join(", ")}.`
      : "No specific dietary restrictions.";

  const avoidText =
    mealsToAvoid.length > 0
      ? `Avoid generating these meal names or very close repeats: ${mealsToAvoid.join(
          ", "
        )}.`
      : "Avoid obvious repetition if possible.";

  const fridgeText =
    fridgeIngredients.length > 0
      ? `Fridge mode ingredients available: ${fridgeIngredients.join(", ")}. Prefer using them if it fits naturally. If the meal truly uses them, include the tag "fridge mode".`
      : "Fridge mode is not active.";

  const cookingStyleDesc = {
    "keep it easy": "very simple recipes, minimal steps, beginner-friendly",
    "i know my way around": "intermediate recipes with moderate complexity",
    "chef mode": "advanced recipes, more technique allowed",
  }[String(cookingStyle || "").toLowerCase()] || "simple recipes";

  const varietyDesc =
    String(varietyLevel || "").toLowerCase() === "keep it fresh"
      ? "Make this meal completely distinct from the rest of the week."
      : "Keep this meal meaningfully different from the rest of the plan.";

  const prompt = `Generate exactly one replacement meal.

Requirements:
- Day: ${day}
- Meal type: ${mealType}
- Allowed cuisines: ${cuisines.join(", ")}
- Dietary goal: ${dietaryGoal || "balanced"}
- ${restrictionText}
- Cooking skill level: ${cookingStyleDesc}
- Variety rule: ${varietyDesc}
- Budget target: approximately $${budgetTargetPerMeal.toFixed(
    2
  )} per meal per person
- Number of people: ${people}
- ${avoidText}
- ${fridgeText}

Rules:
1. Generate exactly one ${mealType} meal for day ${day}
2. It must naturally fit the requested meal type
3. Keep ingredients realistic and commonly available in normal supermarkets
4. Respect all dietary restrictions
5. Include realistic nutrition estimates per serving for calories, protein, carbs, and fat
6. Do not use 0 for calories, protein, carbs, or fat
7. Include short practical instructions
8. Include servings, servingSize, and ingredientAmounts
9. The macros must be for ONE serving
10. Make the meal interesting and believable, not generic
11. Return one meal object only`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.95,
    messages: [
      {
        role: "system",
        content:
          "You are a professional meal planner. Return only valid structured data.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "single_meal",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            meal: {
              type: "object",
              additionalProperties: false,
              properties: {
                day: {
                  type: "integer",
                  minimum: 1,
                },
                mealType: {
                  type: "string",
                  enum: ["breakfast", "lunch", "dinner", "snack"],
                },
                meal: { type: "string" },
                cuisine: {
                  type: "string",
                  enum: cuisines,
                },
                ingredients: {
                  type: "array",
                  minItems: 4,
                  maxItems: 10,
                  items: { type: "string" },
                },
                ingredientAmounts: {
                  type: "array",
                  minItems: 4,
                  maxItems: 10,
                  items: { type: "string" },
                },
                instructions: {
                  type: "array",
                  minItems: 3,
                  maxItems: 6,
                  items: { type: "string" },
                },
                prepTime: { type: "string" },
                servings: {
                  type: "integer",
                  minimum: 1,
                },
                servingSize: { type: "string" },
                calories: {
                  type: "number",
                  minimum: 50,
                },
                protein: {
                  type: "number",
                  minimum: 1,
                },
                carbs: {
                  type: "number",
                  minimum: 1,
                },
                fat: {
                  type: "number",
                  minimum: 1,
                },
                tags: {
                  type: "array",
                  items: {
                    type: "string",
                    enum: ALLOWED_TAGS,
                  },
                },
                costPerServing: {
                  type: "number",
                  minimum: 0.5,
                },
                skillLevel: {
                  type: "string",
                  enum: ALLOWED_SKILL_LEVELS,
                },
              },
              required: [
                "day",
                "mealType",
                "meal",
                "cuisine",
                "ingredients",
                "ingredientAmounts",
                "instructions",
                "prepTime",
                "servings",
                "servingSize",
                "calories",
                "protein",
                "carbs",
                "fat",
                "tags",
                "costPerServing",
                "skillLevel",
              ],
            },
          },
          required: ["meal"],
        },
      },
    },
    max_completion_tokens: 2500,
  });

  const content = completion.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("AI returned empty content");
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    console.error("Raw AI content that failed JSON.parse:", content);
    throw new Error("AI returned invalid JSON");
  }

  if (!parsed || !parsed.meal) {
    throw new Error("AI returned invalid single meal structure");
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
    });

    filledMeals.push(replacement);
  }

  return filledMeals;
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
        error: `Invalid cuisine selected. Supported cuisines: ${SUPPORTED_CUISINES.join(
          ", "
        )}`,
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
      return res.status(400).json({ error: "Invalid numeric values provided." });
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

    const normalizedDietaryGoal = normalizeDietaryGoal(dietaryGoal);
    const normalizedCookingStyle = normalizeCookingStyle(cookingStyle);
    const normalizedVarietyLevel = normalizeVarietyLevel(varietyLevel);

    const slots = getMealSlots(numericMealsPerDay);
    const selectedRestrictions = normalizeRestrictions(restrictions);
    const selectedFridgeIngredients = normalizeFridgeIngredients(fridgeIngredients);

    const activeCookDays = numericDays;
    const totalMealServings = activeCookDays * slots.length * numericPeople;
    const budgetTargetPerMeal = numericBudget / Math.max(1, totalMealServings);

    let aiMeals;
    try {
      aiMeals = await generateMealPlanWithAI({
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
      });
    } catch (aiError) {
      console.error("AI generation error:", aiError);
      return res.status(502).json({
        error:
          "Failed to generate meal plan from AI. Check your API key, model response, and request payload.",
      });
    }

    let meals = aiMeals
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
        });
      } catch (fillError) {
        console.error("AI missing-slot fill error:", fillError);
      }
    }

    meals = removeDuplicateSlotMeals(sortMeals(meals));

    const finalMissingSlots = findMissingSlots(meals, activeCookDays, slots);
    if (finalMissingSlots.length > 0) {
      return res.status(502).json({
        error:
          "The AI returned an incomplete meal plan. Please try again.",
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

    const groceryList = buildGroceryList(meals);

    const estimatedTotalCost = clientMeals.reduce((sum, meal) => {
      return sum + Number(meal.totalMealCost || 0);
    }, 0);

    const remainingBudget = numericBudget - estimatedTotalCost;
    const repeatedMeals = buildRepeatedMealsSummary(meals);

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
        error: `Invalid cuisine selected. Supported cuisines: ${SUPPORTED_CUISINES.join(
          ", "
        )}`,
      });
    }

    const numericBudget = Number(budget);
    const numericPeople = Number(people);
    const numericDays = Number(daysPerWeek);
    const numericMealsPerDay = Number(mealsPerDay);
    const numericDay = Number(day);
    const normalizedMealType = String(mealType).trim().toLowerCase();

    if (
      [numericBudget, numericPeople, numericDays, numericMealsPerDay, numericDay].some(
        (value) => Number.isNaN(value)
      )
    ) {
      return res.status(400).json({ error: "Invalid numeric values provided." });
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
      return res.status(400).json({ error: "Invalid meal type for this plan." });
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});