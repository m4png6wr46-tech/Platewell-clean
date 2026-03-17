import React, { useEffect, useMemo, useState } from "react";

export default function PlatewellApp() {
  const [cuisineOptions, setCuisineOptions] = useState([]);
  const [loadingCuisines, setLoadingCuisines] = useState(true);

  const [form, setForm] = useState({
    budget: "75",
    people: "1",
    daysPerWeek: "5",
    mealsPerDay: "3",
    dietaryGoal: "balanced",
    restrictions: [],
    cookingStyle: "keep it easy",
    varietyLevel: "keep it fresh",
    cuisines: [],
    fridgeMode: false,
    fridgeIngredients: "",
  });

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [swapLoadingKey, setSwapLoadingKey] = useState("");
  const [error, setError] = useState("");
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 900 : false
  );

  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

  const restrictionOptions = [
    "Halal",
    "Vegetarian",
    "Vegan",
    "Gluten-Free",
    "Dairy-Free",
    "Nut-Free",
    "Kosher",
    "Pescatarian",
  ];

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 900);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    async function loadCuisines() {
      try {
        setLoadingCuisines(true);
        const res = await fetch(`${API_BASE_URL}/cuisines`);
        const data = await res.json();
        const cuisines = Array.isArray(data.cuisines) ? data.cuisines : [];

        setCuisineOptions(cuisines);

        setForm((prev) => ({
          ...prev,
          cuisines:
            prev.cuisines.length > 0 ? prev.cuisines : cuisines.slice(0, 2),
        }));
      } catch (err) {
        setError("Could not load cuisines.");
      } finally {
        setLoadingCuisines(false);
      }
    }

    loadCuisines();
  }, [API_BASE_URL]);

  function normalizeWholeNumberInput(value, fallback = "") {
    const digitsOnly = String(value).replace(/\D/g, "");
    if (!digitsOnly) return fallback;
    return String(parseInt(digitsOnly, 10));
  }

  function normalizeMoneyInput(value, fallback = "") {
    let cleaned = String(value).replace(/[^\d.]/g, "");
    const firstDot = cleaned.indexOf(".");

    if (firstDot !== -1) {
      cleaned =
        cleaned.slice(0, firstDot + 1) +
        cleaned.slice(firstDot + 1).replace(/\./g, "");
    }

    if (!cleaned) return fallback;

    if (cleaned.startsWith(".")) {
      cleaned = `0${cleaned}`;
    }

    const parts = cleaned.split(".");
    let whole = parts[0] || "0";
    const decimal = parts[1] ?? null;

    whole = String(parseInt(whole, 10) || 0);

    if (decimal !== null) {
      return `${whole}.${decimal.slice(0, 2)}`;
    }

    return whole;
  }

  function setTextField(name, value) {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function setWholeNumberField(name, value) {
    setForm((prev) => ({
      ...prev,
      [name]: normalizeWholeNumberInput(value, ""),
    }));
  }

  function setMoneyField(name, value) {
    setForm((prev) => ({
      ...prev,
      [name]: normalizeMoneyInput(value, ""),
    }));
  }

  function toggleRestriction(restriction) {
    setForm((prev) => {
      const exists = prev.restrictions.includes(restriction);
      return {
        ...prev,
        restrictions: exists
          ? prev.restrictions.filter((r) => r !== restriction)
          : [...prev.restrictions, restriction],
      };
    });
  }

  function toggleCuisine(cuisine) {
    setForm((prev) => {
      const exists = prev.cuisines.includes(cuisine);
      return {
        ...prev,
        cuisines: exists
          ? prev.cuisines.filter((c) => c !== cuisine)
          : [...prev.cuisines, cuisine],
      };
    });
  }

  function toggleFridgeMode() {
    setForm((prev) => {
      const nextValue = !prev.fridgeMode;
      return {
        ...prev,
        fridgeMode: nextValue,
        fridgeIngredients: nextValue ? prev.fridgeIngredients : "",
      };
    });
  }

  function validateForm() {
    if (!Number(form.budget)) return "Please enter a weekly budget.";
    if (!Number(form.people)) return "Please enter how many people you're feeding.";
    if (!Number(form.daysPerWeek)) return "Please enter how many days you're eating at home.";
    if (!Number(form.mealsPerDay)) return "Please enter how many meals per day.";
    if (!form.cuisines.length) return "Pick at least one cuisine.";
    if (form.fridgeMode && !form.fridgeIngredients.trim()) {
      return "Turn off Fridge Mode or list the ingredients you already have.";
    }
    return "";
  }

  function buildPayload() {
    return {
      ...form,
      budget: Number(form.budget || 0),
      people: Number(form.people || 0),
      daysPerWeek: Number(form.daysPerWeek || 0),
      mealsPerDay: Number(form.mealsPerDay || 0),
      fridgeIngredients: form.fridgeMode ? form.fridgeIngredients : "",
    };
  }

  async function generatePlan(e) {
    e.preventDefault();
    setError("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const payload = buildPayload();

      const res = await fetch(`${API_BASE_URL}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate meal plan.");
      }

      setResult(data);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function swapMeal(mealToSwap) {
    if (!result) return;

    const swapKey = `${mealToSwap.day}-${mealToSwap.mealType}`;
    setSwapLoadingKey(swapKey);
    setError("");

    try {
      const payload = {
        ...buildPayload(),
        day: mealToSwap.day,
        mealType: mealToSwap.mealType,
        existingMeals: Array.isArray(result.meals) ? result.meals : [],
      };

      const res = await fetch(`${API_BASE_URL}/swapMeal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to swap meal.");
      }

      setResult((prev) => {
        if (!prev) return prev;

        const updatedMeals = (prev.meals || []).map((meal) => {
          if (
            meal.day === mealToSwap.day &&
            meal.mealType === mealToSwap.mealType
          ) {
            return data.meal;
          }
          return meal;
        });

        return {
          ...prev,
          meals: updatedMeals,
        };
      });
    } catch (err) {
      setError(err.message || "Failed to swap meal.");
    } finally {
      setSwapLoadingKey("");
    }
  }

  const totalMeals =
    Number(form.daysPerWeek || 0) * Number(form.mealsPerDay || 0);

  const groupedMeals = useMemo(() => {
    const meals = Array.isArray(result?.meals) ? result.meals : [];
    const grouped = {};

    meals.forEach((meal) => {
      const dayKey = meal.day || "Day";
      if (!grouped[dayKey]) grouped[dayKey] = [];
      grouped[dayKey].push(meal);
    });

    return grouped;
  }, [result]);

  const styles = {
    page: {
      minHeight: "100vh",
      background: "#f7fbf8",
      color: "#163126",
      fontFamily:
        'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding: isMobile ? "20px 12px 36px" : "32px 20px 48px",
    },
    shell: {
      maxWidth: "1280px",
      margin: "0 auto",
    },
    hero: {
      marginBottom: "24px",
    },
    eyebrow: {
      margin: "0 0 10px",
      color: "#1f8a5b",
      letterSpacing: "0.14em",
      fontSize: "12px",
      fontWeight: 800,
      textTransform: "uppercase",
    },
    title: {
      margin: 0,
      fontSize: isMobile ? "2.2rem" : "3.4rem",
      lineHeight: 1.02,
      letterSpacing: "-0.03em",
      color: "#124734",
    },
    subtitle: {
      marginTop: "14px",
      maxWidth: "760px",
      color: "#587166",
      fontSize: "1rem",
      lineHeight: 1.6,
    },
    layout: {
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr" : "380px 1fr",
      gap: "20px",
      alignItems: "start",
    },
    panel: {
      background: "#ffffff",
      border: "1px solid #dceee3",
      borderRadius: "24px",
      boxShadow: "0 16px 40px rgba(23, 64, 45, 0.08)",
    },
    formPanel: {
      padding: "20px",
      position: isMobile ? "static" : "sticky",
      top: "16px",
    },
    resultPanel: {
      padding: "20px",
      minHeight: "680px",
    },
    section: {
      marginBottom: "24px",
    },
    sectionTitle: {
      margin: "0 0 12px",
      fontSize: "1.05rem",
      fontWeight: 700,
      color: "#124734",
    },
    label: {
      display: "block",
      marginBottom: "14px",
      color: "#234536",
      fontSize: "0.95rem",
    },
    input: {
      width: "100%",
      marginTop: "8px",
      padding: "13px 14px",
      borderRadius: "14px",
      border: "1px solid #cfe5d7",
      background: "#ffffff",
      color: "#17362a",
      outline: "none",
      fontSize: "0.95rem",
      boxSizing: "border-box",
    },
    textarea: {
      width: "100%",
      marginTop: "8px",
      padding: "13px 14px",
      borderRadius: "14px",
      border: "1px solid #cfe5d7",
      background: "#ffffff",
      color: "#17362a",
      outline: "none",
      fontSize: "0.95rem",
      boxSizing: "border-box",
      minHeight: "96px",
      resize: "vertical",
    },
    select: {
      width: "100%",
      marginTop: "8px",
      padding: "13px 14px",
      borderRadius: "14px",
      border: "1px solid #cfe5d7",
      background: "#ffffff",
      color: "#17362a",
      outline: "none",
      fontSize: "0.95rem",
      boxSizing: "border-box",
    },
    chipGrid: {
      display: "flex",
      flexWrap: "wrap",
      gap: "10px",
    },
    chip: {
      border: "1px solid #cfe5d7",
      background: "#f8fcf9",
      color: "#295240",
      padding: "10px 14px",
      borderRadius: "999px",
      cursor: "pointer",
      fontSize: "0.92rem",
    },
    chipActive: {
      background: "#1f8a5b",
      border: "1px solid #1f8a5b",
      color: "#ffffff",
    },
    helper: {
      margin: "10px 0 0",
      color: "#6b8578",
      fontSize: "0.9rem",
      lineHeight: 1.5,
    },
    summaryBox: {
      background: "#f4fbf6",
      border: "1px solid #dceee3",
      padding: "14px 16px",
      borderRadius: "16px",
      color: "#234536",
      lineHeight: 1.5,
    },
    primaryBtn: {
      width: "100%",
      padding: "15px 16px",
      border: "none",
      borderRadius: "16px",
      cursor: "pointer",
      background: "#1f8a5b",
      color: "white",
      fontWeight: 700,
      fontSize: "0.96rem",
      boxShadow: "0 10px 24px rgba(31, 138, 91, 0.18)",
      opacity: loading || loadingCuisines ? 0.8 : 1,
    },
    secondaryToggle: {
      width: "100%",
      padding: "12px 14px",
      borderRadius: "14px",
      border: "1px solid #cfe5d7",
      background: "#f8fcf9",
      color: "#295240",
      cursor: "pointer",
      fontWeight: 700,
      fontSize: "0.92rem",
      textAlign: "left",
    },
    errorText: {
      color: "#c0392b",
      marginTop: "12px",
      lineHeight: 1.5,
    },
    emptyState: {
      minHeight: "560px",
      display: "grid",
      placeItems: "center",
      textAlign: "center",
      color: "#587166",
      lineHeight: 1.7,
    },
    topStats: {
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
      gap: "12px",
      marginBottom: "16px",
    },
    statCard: {
      background: "#f9fdf9",
      border: "1px solid #dceee3",
      borderRadius: "18px",
      padding: "14px 16px",
    },
    statLabel: {
      display: "block",
      color: "#6b8578",
      fontSize: "0.82rem",
      marginBottom: "6px",
    },
    statValue: {
      fontSize: "1.15rem",
      fontWeight: 700,
      color: "#124734",
    },
    metaCard: {
      background: "#f9fdf9",
      border: "1px solid #dceee3",
      borderRadius: "18px",
      padding: "16px",
      marginBottom: "16px",
      lineHeight: 1.7,
    },
    fridgeBadge: {
      display: "inline-block",
      marginTop: "8px",
      padding: "8px 12px",
      borderRadius: "999px",
      background: "#e9f7ef",
      color: "#1f8a5b",
      border: "1px solid #cfe5d7",
      fontSize: "0.88rem",
      fontWeight: 600,
    },
    groceryList: {
      margin: 0,
      paddingLeft: "18px",
      columns: isMobile ? 1 : 2,
    },
    mealDaySection: {
      marginBottom: "24px",
    },
    dayHeading: {
      margin: "0 0 12px",
      color: "#124734",
      fontSize: "1.25rem",
    },
    mealList: {
      display: "grid",
      gap: "16px",
    },
    mealCard: {
      background: "#ffffff",
      border: "1px solid #dceee3",
      borderRadius: "20px",
      padding: "18px",
      boxShadow: "0 10px 24px rgba(23, 64, 45, 0.04)",
    },
    mealHeader: {
      display: "flex",
      justifyContent: "space-between",
      gap: "16px",
      alignItems: "flex-start",
      flexWrap: "wrap",
    },
    mealLabel: {
      margin: "0 0 6px",
      color: "#1f8a5b",
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      fontSize: "0.78rem",
      fontWeight: 700,
    },
    mealTitle: {
      margin: "0 0 6px",
      fontSize: "1.4rem",
      lineHeight: 1.2,
      color: "#124734",
    },
    mealSubtext: {
      margin: 0,
      color: "#6b8578",
      lineHeight: 1.5,
    },
    swapBtn: {
      background: "#e9f7ef",
      color: "#1f8a5b",
      padding: "10px 14px",
      fontWeight: 600,
      borderRadius: "14px",
      border: "1px solid #cfe5d7",
      cursor: "pointer",
      whiteSpace: "nowrap",
    },
    pillRow: {
      display: "flex",
      flexWrap: "wrap",
      gap: "10px",
      marginTop: "14px",
    },
    macroPill: {
      padding: "8px 10px",
      borderRadius: "999px",
      fontSize: "0.85rem",
      background: "#edf8f1",
      color: "#1a5c3f",
      border: "1px solid #d4eadb",
    },
    costPill: {
      padding: "8px 10px",
      borderRadius: "999px",
      fontSize: "0.85rem",
      background: "#f1fbf4",
      color: "#1f8a5b",
      border: "1px solid #dceee3",
    },
    tagPill: {
      padding: "8px 10px",
      borderRadius: "999px",
      fontSize: "0.85rem",
      background: "#f4f7f5",
      color: "#4f695d",
      border: "1px solid #dce7e0",
    },
    fridgeTagPill: {
      padding: "8px 10px",
      borderRadius: "999px",
      fontSize: "0.85rem",
      background: "#e9f7ef",
      color: "#1f8a5b",
      border: "1px solid #cfe5d7",
      fontWeight: 700,
    },
    mealColumns: {
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
      gap: "16px",
      marginTop: "16px",
    },
    mealBlockTitle: {
      margin: "0 0 10px",
      fontSize: "1rem",
      fontWeight: 700,
      color: "#124734",
    },
    list: {
      margin: 0,
      paddingLeft: "18px",
      color: "#234536",
      lineHeight: 1.7,
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.hero}>
          <p style={styles.eyebrow}>PLATEWELL</p>
          <h1 style={styles.title}>Fresh meal plans that feel real</h1>
          <p style={styles.subtitle}>
            Build weekly meal plans by budget, cuisines, dietary needs, cooking
            style, and variety — now with Fridge Mode so Platewell can build
            meals around ingredients you already have.
          </p>
        </header>

        <main style={styles.layout}>
          <section style={{ ...styles.panel, ...styles.formPanel }}>
            <form onSubmit={generatePlan}>
              <div style={styles.section}>
                <h2 style={styles.sectionTitle}>Plan settings</h2>

                <label style={styles.label}>
                  Weekly budget
                  <input
                    style={styles.input}
                    type="text"
                    inputMode="decimal"
                    value={form.budget}
                    onChange={(e) => setMoneyField("budget", e.target.value)}
                  />
                </label>

                <label style={styles.label}>
                  Number of people
                  <input
                    style={styles.input}
                    type="text"
                    inputMode="numeric"
                    value={form.people}
                    onChange={(e) => setWholeNumberField("people", e.target.value)}
                  />
                </label>

                <label style={styles.label}>
                  Days eating at home
                  <input
                    style={styles.input}
                    type="text"
                    inputMode="numeric"
                    value={form.daysPerWeek}
                    onChange={(e) =>
                      setWholeNumberField("daysPerWeek", e.target.value)
                    }
                  />
                </label>

                <label style={styles.label}>
                  Meals per day
                  <input
                    style={styles.input}
                    type="text"
                    inputMode="numeric"
                    value={form.mealsPerDay}
                    onChange={(e) =>
                      setWholeNumberField("mealsPerDay", e.target.value)
                    }
                  />
                </label>

                <label style={styles.label}>
                  Dietary goal
                  <select
                    style={styles.select}
                    value={form.dietaryGoal}
                    onChange={(e) => setTextField("dietaryGoal", e.target.value)}
                  >
                    <option value="balanced">Balanced</option>
                    <option value="high protein">High Protein</option>
                    <option value="vegetarian">Vegetarian</option>
                    <option value="vegan">Vegan</option>
                    <option value="pescatarian">Pescatarian</option>
                  </select>
                </label>

                <label style={styles.label}>
                  Cooking style
                  <select
                    style={styles.select}
                    value={form.cookingStyle}
                    onChange={(e) => setTextField("cookingStyle", e.target.value)}
                  >
                    <option value="keep it easy">Keep it easy</option>
                    <option value="i know my way around">
                      I know my way around
                    </option>
                    <option value="chef mode">Chef mode</option>
                  </select>
                </label>

                <label style={styles.label}>
                  Variety level
                  <select
                    style={styles.select}
                    value={form.varietyLevel}
                    onChange={(e) => setTextField("varietyLevel", e.target.value)}
                  >
                    <option value="keep it fresh">Keep it fresh</option>
                    <option value="mix it up a little">Mix it up a little</option>
                  </select>
                </label>
              </div>

              <div style={styles.section}>
                <h2 style={styles.sectionTitle}>Fridge Mode</h2>

                <button
                  type="button"
                  style={{
                    ...styles.secondaryToggle,
                    ...(form.fridgeMode ? styles.chipActive : {}),
                  }}
                  onClick={toggleFridgeMode}
                >
                  {form.fridgeMode ? "Fridge Mode is on" : "Turn on Fridge Mode"}
                </button>

                {form.fridgeMode && (
                  <>
                    <label style={{ ...styles.label, marginTop: "14px" }}>
                      What do you already have?
                      <textarea
                        style={styles.textarea}
                        value={form.fridgeIngredients}
                        onChange={(e) =>
                          setTextField("fridgeIngredients", e.target.value)
                        }
                        placeholder="chicken, eggs, spinach, rice, yogurt..."
                      />
                    </label>
                    <p style={styles.helper}>
                      List ingredients separated by commas and Platewell will
                      try to build around them first.
                    </p>
                  </>
                )}

                {!form.fridgeMode && (
                  <p style={styles.helper}>
                    Leave this off for normal planning, or turn it on to use
                    ingredients you already have.
                  </p>
                )}
              </div>

              <div style={styles.section}>
                <h2 style={styles.sectionTitle}>Restrictions</h2>
                <div style={styles.chipGrid}>
                  {restrictionOptions.map((restriction) => {
                    const active = form.restrictions.includes(restriction);
                    return (
                      <button
                        key={restriction}
                        type="button"
                        style={{
                          ...styles.chip,
                          ...(active ? styles.chipActive : {}),
                        }}
                        onClick={() => toggleRestriction(restriction)}
                      >
                        {restriction}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={styles.section}>
                <h2 style={styles.sectionTitle}>Cuisines</h2>
                {loadingCuisines ? (
                  <p style={styles.helper}>Loading cuisines...</p>
                ) : (
                  <div style={styles.chipGrid}>
                    {cuisineOptions.map((cuisine) => {
                      const active = form.cuisines.includes(cuisine);
                      return (
                        <button
                          key={cuisine}
                          type="button"
                          style={{
                            ...styles.chip,
                            ...(active ? styles.chipActive : {}),
                          }}
                          onClick={() => toggleCuisine(cuisine)}
                        >
                          {cuisine}
                        </button>
                      );
                    })}
                  </div>
                )}
                <p style={styles.helper}>
                  Pick at least one cuisine. Choosing 2–3 usually gives the best
                  mix.
                </p>
              </div>

              <div style={styles.section}>
                <div style={styles.summaryBox}>
                  <strong>{totalMeals}</strong> meals planned across{" "}
                  <strong>{Number(form.daysPerWeek || 0)}</strong> day
                  {Number(form.daysPerWeek || 0) === 1 ? "" : "s"}.
                </div>
              </div>

              <button
                style={styles.primaryBtn}
                type="submit"
                disabled={loading || loadingCuisines}
              >
                {loading ? "Generating..." : "Generate my meal plan"}
              </button>

              {error && <p style={styles.errorText}>{error}</p>}
            </form>
          </section>

          <section style={{ ...styles.panel, ...styles.resultPanel }}>
            {!result && !loading && (
              <div style={styles.emptyState}>
                <div>
                  <h2 style={{ marginBottom: "10px", color: "#124734" }}>
                    Your Platewell plan will show here
                  </h2>
                  <p>
                    Generate a plan to see meals, grocery list, budget math,
                    macros, Fridge Mode results, and swap options.
                  </p>
                </div>
              </div>
            )}

            {loading && (
              <div style={styles.emptyState}>
                <div>
                  <h2 style={{ marginBottom: "10px", color: "#124734" }}>
                    Building your plan...
                  </h2>
                  <p>Putting your fridge ingredients to work.</p>
                </div>
              </div>
            )}

            {result && (
              <div>
                <div style={styles.topStats}>
                  <div style={styles.statCard}>
                    <span style={styles.statLabel}>Weekly Budget</span>
                    <strong style={styles.statValue}>
                      ${result.weeklyBudget ?? 0}
                    </strong>
                  </div>
                  <div style={styles.statCard}>
                    <span style={styles.statLabel}>Estimated Cost</span>
                    <strong style={styles.statValue}>
                      ${result.estimatedTotalCost ?? 0}
                    </strong>
                  </div>
                  <div style={styles.statCard}>
                    <span style={styles.statLabel}>Remaining Budget</span>
                    <strong style={styles.statValue}>
                      ${result.remainingBudget ?? 0}
                    </strong>
                  </div>
                  <div style={styles.statCard}>
                    <span style={styles.statLabel}>Target / Meal</span>
                    <strong style={styles.statValue}>
                      ${result.budgetTargetPerMeal ?? 0}
                    </strong>
                  </div>
                </div>

                <div style={styles.metaCard}>
                  <p>
                    <strong>Goal:</strong> {result.dietaryGoal || form.dietaryGoal}
                  </p>
                  <p>
                    <strong>Cooking style:</strong>{" "}
                    {result.cookingStyle || form.cookingStyle}
                  </p>
                  <p>
                    <strong>Variety:</strong>{" "}
                    {result.varietyLevel || form.varietyLevel}
                  </p>
                  <p>
                    <strong>Cuisines:</strong>{" "}
                    {Array.isArray(result.cuisines) && result.cuisines.length > 0
                      ? result.cuisines.join(", ")
                      : form.cuisines.join(", ")}
                  </p>
                  <p>
                    <strong>Restrictions:</strong>{" "}
                    {Array.isArray(result.restrictions) &&
                    result.restrictions.length > 0
                      ? result.restrictions.join(", ")
                      : "None"}
                  </p>

                  {result.fridgeMode && (
                    <div style={styles.fridgeBadge}>
                      Fridge Mode on:{" "}
                      {Array.isArray(result.fridgeIngredients)
                        ? result.fridgeIngredients.join(", ")
                        : form.fridgeIngredients}
                    </div>
                  )}
                </div>

                {Array.isArray(result.repeatedMeals) &&
                  result.repeatedMeals.length > 0 && (
                    <div style={styles.metaCard}>
                      <h3 style={{ margin: "0 0 10px", color: "#124734" }}>
                        Repeated meals
                      </h3>
                      <ul style={styles.list}>
                        {result.repeatedMeals.map((item) => (
                          <li key={item.meal}>
                            {item.meal} — {item.timesUsed} times
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                <div style={styles.metaCard}>
                  <h3 style={{ margin: "0 0 10px", color: "#124734" }}>
                    Grocery list
                  </h3>
                  <ul style={styles.groceryList}>
                    {(result.groceryList || []).map((item, index) => (
                      <li key={`${item}-${index}`} style={{ marginBottom: "6px" }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {Object.entries(groupedMeals).map(([day, meals]) => (
                  <div key={day} style={styles.mealDaySection}>
                    <h2 style={styles.dayHeading}>{day}</h2>

                    <div style={styles.mealList}>
                      {meals.map((meal, index) => {
                        const swapKey = `${meal.day}-${meal.mealType}`;
                        const swapping = swapLoadingKey === swapKey;
                        const tags = Array.isArray(meal.tags) ? meal.tags : [];
                        const fridgeModeTag = tags.includes("fridge mode");

                        return (
                          <article
                            key={`${meal.day}-${meal.mealType}-${index}`}
                            style={styles.mealCard}
                          >
                            <div style={styles.mealHeader}>
                              <div>
                                <p style={styles.mealLabel}>
                                  {meal.label || meal.mealType || "Meal"}
                                </p>
                                <h3 style={styles.mealTitle}>
                                  {meal.meal || "Untitled meal"}
                                </h3>
                                <p style={styles.mealSubtext}>
                                  {meal.cuisine || "Mixed cuisine"} •{" "}
                                  {meal.prepTime || "Quick prep"} •{" "}
                                  {meal.servingSize || "Standard serving"}
                                </p>
                              </div>

                              <button
                                style={styles.swapBtn}
                                type="button"
                                onClick={() => swapMeal(meal)}
                                disabled={swapping}
                              >
                                {swapping ? "Swapping..." : "Swap meal"}
                              </button>
                            </div>

                            <div style={styles.pillRow}>
                              <span style={styles.macroPill}>
                                {meal.calories ?? 0} cal
                              </span>
                              <span style={styles.macroPill}>
                                {meal.protein ?? 0}g protein
                              </span>
                              <span style={styles.macroPill}>
                                {meal.carbs ?? 0}g carbs
                              </span>
                              <span style={styles.macroPill}>
                                {meal.fat ?? 0}g fat
                              </span>
                            </div>

                            <div style={styles.pillRow}>
                              <span style={styles.costPill}>
                                ${meal.costPerServing ?? 0} / serving
                              </span>
                              <span style={styles.costPill}>
                                ${meal.totalMealCost ?? 0} total
                              </span>
                              <span style={styles.costPill}>
                                {meal.servings ?? 1} servings
                              </span>
                              <span style={styles.costPill}>
                                {meal.skillLabel || "Flexible skill"}
                              </span>
                            </div>

                            {tags.length > 0 && (
                              <div style={styles.pillRow}>
                                {fridgeModeTag && (
                                  <span style={styles.fridgeTagPill}>
                                    Fridge Mode
                                  </span>
                                )}
                                {tags
                                  .filter((tag) => tag !== "fridge mode")
                                  .map((tag) => (
                                    <span key={tag} style={styles.tagPill}>
                                      {tag}
                                    </span>
                                  ))}
                              </div>
                            )}

                            <div style={styles.mealColumns}>
                              <div>
                                <h4 style={styles.mealBlockTitle}>Ingredients</h4>
                                <ul style={styles.list}>
                                  {(meal.ingredientAmounts || []).map((item, i) => (
                                    <li key={i}>{item}</li>
                                  ))}
                                </ul>
                              </div>

                              <div>
                                <h4 style={styles.mealBlockTitle}>Instructions</h4>
                                <ol style={styles.list}>
                                  {(meal.instructions || []).map((step, i) => (
                                    <li key={i}>{step}</li>
                                  ))}
                                </ol>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
