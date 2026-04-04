import React, { useEffect, useMemo, useState } from "react";

export default function PlatewellApp() {
  const [cuisineOptions, setCuisineOptions] = useState([]);
  const [loadingCuisines, setLoadingCuisines] = useState(true);
  const [otherCuisine, setOtherCuisine] = useState("");

  const [form, setForm] = useState(() => {
    try {
      const saved = localStorage.getItem("platewell_profile");
      if (saved) {
        const p = JSON.parse(saved);
        return {
          budget: p.budget || "75",
          people: p.people || "1",
          daysPerWeek: p.daysPerWeek || "5",
          mealsPerDay: p.mealsPerDay || "3",
          dietaryGoal: p.dietaryGoal || "balanced",
          restrictions: Array.isArray(p.restrictions) ? p.restrictions : [],
          cookingStyle: p.cookingStyle || "quick & easy",
          cookTime: p.cookTime || "no preference",
          varietyLevel: "same favorites, different days",
          cuisines: Array.isArray(p.cuisines) ? p.cuisines : [],
          fridgeMode: false,
          fridgeIngredients: "",
          fridgeModeType: "supplement",
        };
      }
    } catch {}
    return {
      budget: "75",
      people: "1",
      daysPerWeek: "5",
      mealsPerDay: "3",
      dietaryGoal: "balanced",
      restrictions: [],
      cookingStyle: "quick & easy",
      cookTime: "no preference",
      varietyLevel: "same favorites, different days",
      cuisines: [],
      fridgeMode: false,
      fridgeIngredients: "",
      fridgeModeType: "supplement",
    };
  });

  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem("platewell_profile")
  );
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem("platewell_profile");
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      name: "",
      people: "",
      dietaryGoal: "balanced",
      cookingStyle: "quick & easy",
      cookTime: "",
      cuisines: [],
      restrictions: [],
      budget: "",
      daysPerWeek: "",
      mealsPerDay: "",
    };
  });
  const [stepVisible, setStepVisible] = useState(true);

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [swapLoadingKey, setSwapLoadingKey] = useState("");
  const [error, setError] = useState("");
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 900 : false
  );

  const [ratings, setRatings] = useState(() => {
    try {
      const saved = localStorage.getItem("platewell_ratings");
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [ratingConfirm, setRatingConfirm] = useState({});

  const [leftovers, setLeftovers] = useState({});
  const [regenerateLoading, setRegenerateLoading] = useState(false);
  const [showPrepGuide, setShowPrepGuide] = useState(false);

  const [zipCode, setZipCode] = useState(() => {
    try {
      const saved = localStorage.getItem("platewell_profile");
      if (saved) return JSON.parse(saved).zipCode || "";
    } catch {}
    return "";
  });
  const [locationBanner, setLocationBanner] = useState(null);
  const [showZipInput, setShowZipInput] = useState(false);
  const [zipInputValue, setZipInputValue] = useState("");

  const [checkedItems, setCheckedItems] = useState({});
  const [activeGroceryItem, setActiveGroceryItem] = useState(null);

  function toggleCheckedItem(item) {
    setCheckedItems((prev) => ({ ...prev, [item]: !prev[item] }));
  }

  const [planUsedThisWeek, setPlanUsedThisWeek] = useState(() => {
    try {
      const saved = localStorage.getItem("platewell_usage");
      if (!saved) return false;
      const { weekStart } = JSON.parse(saved);
      const now = new Date();
      const start = new Date(weekStart);
      const diffDays = (now - start) / (1000 * 60 * 60 * 24);
      return diffDays < 7;
    } catch { return false; }
  });

  const [swapsUsed, setSwapsUsed] = useState(() => {
    try {
      const saved = localStorage.getItem("platewell_usage");
      if (!saved) return 0;
      const { weekStart, swapsUsed } = JSON.parse(saved);
      const now = new Date();
      const start = new Date(weekStart);
      const diffDays = (now - start) / (1000 * 60 * 60 * 24);
      return diffDays < 7 ? (swapsUsed || 0) : 0;
    } catch { return 0; }
  });

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState("");

  const FREE_LIMITS = {
    maxDays: 3,
    maxMealsPerDay: 3,
    maxSwaps: 2,
    fridgeMode: false,
    groceryExport: false,
  };

  function saveUsage(swaps) {
    try {
      const saved = localStorage.getItem("platewell_usage");
      const existing = saved ? JSON.parse(saved) : {};
      const weekStart = existing.weekStart && (new Date() - new Date(existing.weekStart)) / (1000 * 60 * 60 * 24) < 7
        ? existing.weekStart
        : new Date().toISOString();
      localStorage.setItem("platewell_usage", JSON.stringify({ weekStart, swapsUsed: swaps }));
    } catch {}
  }

  const isDevMode = new URLSearchParams(window.location.search).get("dev") === "true";

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

  useEffect(() => {
    if (zipCode) return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );
          const data = await res.json();
          const zip = String(data.postcode || "").trim();
          if (zip) {
            setZipCode(zip);
            setLocationBanner({ zip });
            try {
              const saved = localStorage.getItem("platewell_profile");
              const profile = saved ? JSON.parse(saved) : {};
              localStorage.setItem("platewell_profile", JSON.stringify({ ...profile, zipCode: zip }));
            } catch {}
          }
        } catch {}
      },
      () => setShowZipInput(true)
    );
  }, []);

  function saveZipCode(zip) {
    setZipCode(zip);
    setShowZipInput(false);
    setLocationBanner(null);
    try {
      const saved = localStorage.getItem("platewell_profile");
      const profile = saved ? JSON.parse(saved) : {};
      localStorage.setItem("platewell_profile", JSON.stringify({ ...profile, zipCode: zip }));
    } catch {}
  }

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

  function toggleLeftover(meal) {
    const key = `${meal.day}-${meal.mealType}`;
    setLeftovers((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function regenerateWithLeftovers() {
    setRegenerateLoading(true);
    setError("");
    try {
      const leftoverItems = Object.entries(leftovers)
        .filter(([, on]) => on)
        .map(([key]) => {
          const dashIdx = key.indexOf("-");
          const dayStr = key.slice(0, dashIdx);
          const mealType = key.slice(dashIdx + 1);
          const meal = (result.meals || []).find(
            (m) => String(m.day) === dayStr && m.mealType === mealType
          );
          return meal ? { day: Number(dayStr), mealType, meal: meal.meal } : null;
        })
        .filter(Boolean);

      const res = await fetch(`${API_BASE_URL}/regenerateWithLeftovers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buildPayload(),
          existingMeals: result.meals || [],
          leftovers: leftoverItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to regenerate plan.");
      setResult(data);
      setLeftovers({});
      setShowPrepGuide(false);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setRegenerateLoading(false);
    }
  }

  function rateMeal(mealName, rating) {
    setRatings((prev) => {
      const updated = { ...prev, [mealName]: rating };
      localStorage.setItem("platewell_ratings", JSON.stringify(updated));
      return updated;
    });
    setRatingConfirm((prev) => ({ ...prev, [mealName]: true }));
    setTimeout(() => {
      setRatingConfirm((prev) => ({ ...prev, [mealName]: false }));
    }, 1000);
  }

  function toggleFridgeMode() {
    setForm((prev) => {
      const nextValue = !prev.fridgeMode;
      return {
        ...prev,
        fridgeMode: nextValue,
        fridgeIngredients: nextValue ? prev.fridgeIngredients : "",
        fridgeModeType: nextValue ? "supplement" : "supplement",
      };
    });
  }

  function updateProfile(updates) {
    setProfile((prev) => ({ ...prev, ...updates }));
  }

  function goToStep(next) {
    setStepVisible(false);
    setTimeout(() => {
      setOnboardingStep(next);
      setStepVisible(true);
    }, 180);
  }

  function applyProfileToForm(p) {
    setForm((prev) => ({
      ...prev,
      ...(p.budget && { budget: p.budget }),
      ...(p.people && { people: p.people }),
      ...(p.daysPerWeek && { daysPerWeek: p.daysPerWeek }),
      ...(p.mealsPerDay && { mealsPerDay: p.mealsPerDay }),
      ...(p.dietaryGoal && { dietaryGoal: p.dietaryGoal }),
      ...(p.cookingStyle && { cookingStyle: p.cookingStyle }),
      ...(p.cookTime && { cookTime: p.cookTime }),
      ...(Array.isArray(p.restrictions) && p.restrictions.length && { restrictions: p.restrictions }),
      ...(Array.isArray(p.cuisines) && p.cuisines.length && { cuisines: p.cuisines }),
    }));
  }

  function completeOnboarding() {
    localStorage.setItem("platewell_profile", JSON.stringify(profile));
    applyProfileToForm(profile);
    setStepVisible(false);
    setTimeout(() => setShowOnboarding(false), 180);
  }

  function skipOnboarding() {
    localStorage.setItem("platewell_profile", JSON.stringify(profile));
    applyProfileToForm(profile);
    setStepVisible(false);
    setTimeout(() => setShowOnboarding(false), 180);
  }

  function editProfile() {
    try {
      const saved = localStorage.getItem("platewell_profile");
      if (saved) setProfile(JSON.parse(saved));
    } catch {}
    setOnboardingStep(1);
    setStepVisible(true);
    setShowOnboarding(true);
  }

  const heroHeading = (() => {
    try {
      const saved = localStorage.getItem("platewell_profile");
      const name = saved ? JSON.parse(saved).name : "";
      const displayName = name ? name.charAt(0).toUpperCase() + name.slice(1) : "";
      if (!name) return "Real food. Real budget. Real life.";
      const visited = localStorage.getItem("platewell_visited");
      if (!visited) {
        localStorage.setItem("platewell_visited", "true");
        return `Welcome to Platewell, ${displayName} 🌿`;
      }
      return `Welcome back, ${displayName}. Ready to plan your week?`;
    } catch {
      return "Real food. Real budget. Real life.";
    }
  })();

  function validateForm() {
    if (!Number(form.budget)) return "Please enter a weekly budget.";
    if (!Number(form.people)) return "Please enter how many people you're feeding.";
    if (!Number(form.daysPerWeek)) return "Please enter how many days you're eating at home.";
    if (!Number(form.mealsPerDay)) return "Please enter how many meals per day.";
    if (!form.cuisines.length) return "Pick at least one cuisine.";
    if (form.cuisines.includes("Other") && !otherCuisine.trim()) {
      return "Please describe your cuisine under \"Other\".";
    }
    if (form.fridgeMode && !form.fridgeIngredients.trim()) {
      return "Please list your fridge ingredients or turn off Fridge Mode.";
    }
    return "";
  }

  function buildPayload() {
    const cuisines = form.cuisines
      .map((c) => (c === "Other" && otherCuisine.trim() ? otherCuisine.trim() : c))
      .filter((c) => c !== "Other");
    return {
      ...form,
      cuisines,
      budget: Number(form.budget || 0),
      people: Number(form.people || 0),
      daysPerWeek: Number(form.daysPerWeek || 0),
      mealsPerDay: Number(form.mealsPerDay || 0),
      fridgeIngredients: form.fridgeMode ? form.fridgeIngredients : "",
      ratings,
      zipCode,
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

    if (!isDevMode) {
      if (planUsedThisWeek) {
        setUpgradeReason("plan");
        setShowUpgradeModal(true);
        return;
      }
      if (Number(form.daysPerWeek) > FREE_LIMITS.maxDays) {
        setUpgradeReason("days");
        setShowUpgradeModal(true);
        return;
      }
      if (Number(form.mealsPerDay) > FREE_LIMITS.maxMealsPerDay) {
        setUpgradeReason("meals");
        setShowUpgradeModal(true);
        return;
      }
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
      setCheckedItems({});
      setPlanUsedThisWeek(true);
      saveUsage(swapsUsed);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function swapMeal(mealToSwap) {
    if (!result) return;

    if (!isDevMode && swapsUsed >= FREE_LIMITS.maxSwaps) {
      setUpgradeReason("swaps");
      setShowUpgradeModal(true);
      return;
    }

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
      const newSwaps = swapsUsed + 1;
      setSwapsUsed(newSwaps);
      saveUsage(newSwaps);
    } catch (err) {
      setError(err.message || "Failed to swap meal.");
    } finally {
      setSwapLoadingKey("");
    }
  }

  const totalMeals =
    Number(form.daysPerWeek || 0) * Number(form.mealsPerDay || 0);

  const nutritionSummary = useMemo(() => {
    if (!result) return null;
    const meals = Array.isArray(result.meals) ? result.meals : [];
    if (!meals.length) return null;
    const days = Number(result.daysPerWeek) || Number(form.daysPerWeek) || 1;
    const totalCalories = meals.reduce((sum, m) => sum + (Number(m.calories) || 0), 0);
    const totalProtein = meals.reduce((sum, m) => sum + (Number(m.protein) || 0), 0);
    const totalCarbs = meals.reduce((sum, m) => sum + (Number(m.carbs) || 0), 0);
    const totalFat = meals.reduce((sum, m) => sum + (Number(m.fat) || 0), 0);
    return {
      avgCalories: Math.round(totalCalories / days),
      avgProtein: Math.round(totalProtein / days),
      avgCarbs: Math.round(totalCarbs / days),
      avgFat: Math.round(totalFat / days),
      totalCalories: Math.round(totalCalories),
    };
  }, [result, form.daysPerWeek]);

  const budgetFeedback = useMemo(() => {
    if (!result) return null;
    const remaining = Number(result.remainingBudget);
    const budget = Number(result.weeklyBudget);
    if (!budget) return null;
    if (remaining >= 20) {
      return { type: "under", message: `Great news — you're $${remaining.toFixed(2)} under budget this week 🎉` };
    } else if (remaining > 0 && remaining < 20) {
      return { type: "on", message: "You're right on budget this week 👌" };
    } else if (remaining < 0) {
      return { type: "over", message: `You're $${Math.abs(remaining).toFixed(2)} over budget. Try swapping a meal or two to bring it down.` };
    }
    return null;
  }, [result]);

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
      fontWeight: 600,
    },
    input: {
      width: "100%",
      marginTop: "6px",
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
    mealDescription: {
      margin: "0 0 6px",
      color: "#587166",
      fontSize: "0.95rem",
      lineHeight: 1.5,
      fontStyle: "italic",
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
    nutritionBar: {
      display: "grid",
      gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(5, 1fr)",
      gap: "12px",
      marginBottom: "16px",
    },
    nutritionCard: {
      background: "#f9fdf9",
      border: "1px solid #dceee3",
      borderRadius: "18px",
      padding: "14px 16px",
    },
    budgetBanner: {
      padding: "14px 16px",
      borderRadius: "16px",
      marginBottom: "16px",
      fontSize: "0.92rem",
      lineHeight: 1.5,
    },
    ratingRow: {
      display: "flex",
      justifyContent: "flex-end",
      alignItems: "center",
      gap: "6px",
      marginTop: "12px",
    },
    ratingBtn: {
      background: "none",
      border: "1px solid #dceee3",
      borderRadius: "999px",
      cursor: "pointer",
      padding: "4px 10px",
      fontSize: "0.85rem",
      color: "#6b8578",
    },
    leftoverBtn: {
      background: "none",
      border: "1px solid #dceee3",
      borderRadius: "999px",
      cursor: "pointer",
      padding: "6px 12px",
      fontSize: "0.82rem",
      color: "#6b8578",
      marginTop: "10px",
    },
    leftoverBadge: {
      padding: "8px 10px",
      borderRadius: "999px",
      fontSize: "0.85rem",
      background: "#fff8e6",
      color: "#8a6400",
      border: "1px solid #f0d88a",
      fontWeight: 600,
    },
    prepGuideCard: {
      background: "#f9fdf9",
      border: "1px solid #dceee3",
      borderRadius: "18px",
      padding: "16px",
      marginBottom: "16px",
    },
    regenerateBtn: {
      width: "100%",
      padding: "12px 16px",
      border: "1px solid #1f8a5b",
      borderRadius: "14px",
      cursor: "pointer",
      background: "#f0faf4",
      color: "#1f8a5b",
      fontWeight: 700,
      fontSize: "0.92rem",
      marginBottom: "16px",
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
    locationBanner: {
      background: "#f0faf4",
      border: "1px solid #c3e6d0",
      borderRadius: "14px",
      padding: "12px 14px",
      marginTop: "12px",
      fontSize: "0.88rem",
      color: "#1a5c3f",
    },
    locationBannerBtn: {
      padding: "5px 12px",
      borderRadius: "999px",
      border: "1px solid #c3e6d0",
      background: "#fff",
      color: "#1f8a5b",
      cursor: "pointer",
      fontSize: "0.82rem",
      fontFamily: "inherit",
      fontWeight: 600,
    },
    zipInputRow: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      marginTop: "10px",
      flexWrap: "wrap",
    },
    zipInput: {
      padding: "8px 12px",
      borderRadius: "10px",
      border: "1px solid #c3e6d0",
      fontSize: "0.9rem",
      fontFamily: "inherit",
      width: "140px",
      outline: "none",
    },
    zipSaveBtn: {
      padding: "8px 16px",
      borderRadius: "10px",
      border: "none",
      background: "#1f8a5b",
      color: "#fff",
      fontWeight: 700,
      cursor: "pointer",
      fontSize: "0.9rem",
      fontFamily: "inherit",
    },
    priceEstimateSection: {
      marginTop: "16px",
      paddingTop: "14px",
      borderTop: "1px solid #dceee3",
    },
    storeGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      gap: "8px",
      marginBottom: "8px",
    },
    storeCard: {
      background: "#f9fdf9",
      border: "1px solid #dceee3",
      borderRadius: "12px",
      padding: "10px 12px",
      textAlign: "center",
    },
  };

  if (showOnboarding) {
    const ob = {
      page: {
        minHeight: "100vh",
        display: "flex",
        fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      },
      leftPanel: {
        flex: 1,
        background: "#ffffff",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: isMobile ? "32px 24px" : "60px 72px",
        overflowY: "auto",
      },
      rightPanel: {
        width: isMobile ? "0" : "340px",
        background: "#1a5c3f",
        display: isMobile ? "none" : "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 32px",
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
      },
      rightBg1: {
        position: "absolute",
        width: "300px",
        height: "300px",
        borderRadius: "50%",
        background: "rgba(255,255,255,0.04)",
        top: "-80px",
        right: "-80px",
      },
      rightBg2: {
        position: "absolute",
        width: "200px",
        height: "200px",
        borderRadius: "50%",
        background: "rgba(255,255,255,0.04)",
        bottom: "-60px",
        left: "-60px",
      },
      dotsRow: {
        display: "flex",
        gap: "8px",
        marginBottom: "32px",
      },
      rightHeading: {
        color: "#ffffff",
        fontSize: "1rem",
        fontWeight: 700,
        textAlign: "center",
        margin: "0 0 8px",
      },
      rightBody: {
        color: "rgba(255,255,255,0.65)",
        fontSize: "0.82rem",
        textAlign: "center",
        lineHeight: 1.6,
        margin: "0 0 20px",
      },
      previewCard: {
        background: "rgba(255,255,255,0.1)",
        border: "1px solid rgba(255,255,255,0.18)",
        borderRadius: "14px",
        padding: "12px 14px",
        width: "100%",
        marginBottom: "8px",
        boxSizing: "border-box",
      },
      previewCardTitle: {
        color: "#ffffff",
        fontSize: "0.88rem",
        fontWeight: 700,
        margin: "0 0 3px",
      },
      previewCardSub: {
        color: "rgba(255,255,255,0.55)",
        fontSize: "0.75rem",
        margin: "0 0 8px",
      },
      previewPill: {
        display: "inline-block",
        background: "rgba(255,255,255,0.14)",
        color: "rgba(255,255,255,0.88)",
        borderRadius: "999px",
        padding: "3px 9px",
        fontSize: "0.72rem",
        marginRight: "5px",
      },
      eyebrow: {
        margin: "0 0 28px",
        color: "#1f8a5b",
        letterSpacing: "0.14em",
        fontSize: "12px",
        fontWeight: 800,
        textTransform: "uppercase",
      },
      backBtn: {
        background: "none",
        border: "none",
        color: "#6b8578",
        cursor: "pointer",
        fontSize: "0.9rem",
        padding: "0 0 20px 0",
        display: "block",
        fontFamily: "inherit",
      },
      heading: {
        margin: "0 0 12px",
        fontSize: isMobile ? "1.45rem" : "1.75rem",
        lineHeight: 1.2,
        letterSpacing: "-0.02em",
        color: "#124734",
      },
      subheading: {
        margin: "0 0 10px",
        color: "#1f8a5b",
        fontSize: "1.05rem",
        fontWeight: 600,
      },
      body: {
        margin: "0 0 28px",
        color: "#587166",
        fontSize: "0.95rem",
        lineHeight: 1.65,
      },
      label: {
        display: "block",
        marginBottom: "16px",
        color: "#234536",
        fontSize: "0.95rem",
        fontWeight: 500,
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
        fontFamily: "inherit",
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
        fontFamily: "inherit",
      },
      chipGrid: {
        display: "flex",
        flexWrap: "wrap",
        gap: "10px",
        marginBottom: "16px",
      },
      chip: {
        border: "1px solid #cfe5d7",
        background: "#f8fcf9",
        color: "#295240",
        padding: "10px 14px",
        borderRadius: "999px",
        cursor: "pointer",
        fontSize: "0.92rem",
        fontFamily: "inherit",
      },
      chipActive: {
        background: "#1f8a5b",
        border: "1px solid #1f8a5b",
        color: "#ffffff",
      },
      sectionLabel: {
        display: "block",
        margin: "0 0 10px",
        color: "#234536",
        fontSize: "0.95rem",
        fontWeight: 600,
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
        marginTop: "8px",
        fontFamily: "inherit",
      },
      skipLink: {
        background: "none",
        border: "none",
        color: "#6b8578",
        cursor: "pointer",
        fontSize: "0.9rem",
        marginTop: "14px",
        padding: "8px",
        textDecoration: "underline",
        display: "block",
        width: "100%",
        textAlign: "center",
        fontFamily: "inherit",
      },
    };

    function renderDots(activeIndex) {
      return (
        <div style={ob.dotsRow}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                width: i === activeIndex ? "24px" : "8px",
                height: "8px",
                borderRadius: i === activeIndex ? "4px" : "50%",
                background: i === activeIndex ? "#ffffff" : "rgba(255,255,255,0.3)",
                transition: "all 0.3s ease",
              }}
            />
          ))}
        </div>
      );
    }

    return (
      <div style={ob.page}>
        <div style={ob.leftPanel}>
          <p style={ob.eyebrow}>PLATEWELL</p>

          <div style={{
            opacity: stepVisible ? 1 : 0,
            transform: stepVisible ? "translateY(0)" : "translateY(8px)",
            transition: "opacity 0.18s ease, transform 0.18s ease",
          }}>

            {/* Step 0: Welcome */}
            {onboardingStep === 0 && (
              <>
                <h1 style={{ ...ob.heading, fontSize: isMobile ? "1.8rem" : "2.4rem" }}>
                  Hey there, welcome to Platewell 🌿
                </h1>
                <p style={ob.subheading}>Real food. Real budget. Real life.</p>
                <p style={ob.body}>
                  We'll help you plan a full week of meals that actually fit your life — in under 60 seconds.
                </p>
                <button style={ob.primaryBtn} type="button" onClick={() => goToStep(1)}>
                  Let's go →
                </button>
              </>
            )}

            {/* Step 1: Tastes */}
            {onboardingStep === 1 && (
              <>
                <button style={ob.backBtn} type="button" onClick={() => goToStep(0)}>← Back</button>
                <h2 style={ob.heading}>What do you love to eat?</h2>
                <p style={{ ...ob.body, marginBottom: "14px" }}>
                  Pick your favorite cuisines — we'll rotate through them all week.
                </p>
                <span style={ob.sectionLabel}>Cuisine preferences</span>
                {loadingCuisines ? (
                  <p style={{ color: "#6b8578", fontSize: "0.9rem", marginBottom: "16px" }}>Loading cuisines...</p>
                ) : (
                  <div style={ob.chipGrid}>
                    {cuisineOptions.map((cuisine) => {
                      const active = profile.cuisines.includes(cuisine);
                      return (
                        <button
                          key={cuisine}
                          type="button"
                          style={{ ...ob.chip, ...(active ? ob.chipActive : {}) }}
                          onClick={() =>
                            updateProfile({
                              cuisines: active
                                ? profile.cuisines.filter((c) => c !== cuisine)
                                : [...profile.cuisines, cuisine],
                            })
                          }
                        >
                          {cuisine}
                        </button>
                      );
                    })}
                  </div>
                )}
                <span style={{ ...ob.sectionLabel, marginTop: "8px" }}>Any dietary restrictions?</span>
                <div style={ob.chipGrid}>
                  {restrictionOptions.map((r) => {
                    const active = profile.restrictions.includes(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        style={{ ...ob.chip, ...(active ? ob.chipActive : {}) }}
                        onClick={() =>
                          updateProfile({
                            restrictions: active
                              ? profile.restrictions.filter((x) => x !== r)
                              : [...profile.restrictions, r],
                          })
                        }
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
                <button style={ob.primaryBtn} type="button" onClick={() => goToStep(2)}>
                  Continue →
                </button>
                <button style={ob.skipLink} type="button" onClick={skipOnboarding}>
                  I'll set this up later
                </button>
              </>
            )}

            {/* Step 2: Goals */}
            {onboardingStep === 2 && (
              <>
                <button style={ob.backBtn} type="button" onClick={() => goToStep(1)}>← Back</button>
                <h2 style={ob.heading}>How do you like to eat and cook?</h2>
                <label style={ob.label}>
                  What's your eating goal?
                  <select style={ob.select} value={profile.dietaryGoal} onChange={(e) => updateProfile({ dietaryGoal: e.target.value })}>
                    <option value="balanced">Balanced</option>
                    <option value="high protein">High Protein</option>
                    <option value="vegetarian">Vegetarian</option>
                    <option value="vegan">Vegan</option>
                    <option value="pescatarian">Pescatarian</option>
                  </select>
                </label>
                <label style={ob.label}>
                  How confident are you in the kitchen?
                  <select style={ob.select} value={profile.cookingStyle} onChange={(e) => updateProfile({ cookingStyle: e.target.value })}>
                    <option value="quick & easy">Quick & easy</option>
                    <option value="comfortable cook">Comfortable cook</option>
                    <option value="adventurous chef">Adventurous chef</option>
                  </select>
                </label>
                <label style={ob.label}>
                  How long do you want to spend cooking?
                  <select style={ob.select} value={profile.cookTime || "no preference"} onChange={(e) => updateProfile({ cookTime: e.target.value })}>
                    <option value="under 20 min">Under 20 min</option>
                    <option value="20–40 min">20–40 min</option>
                    <option value="no preference">No preference</option>
                  </select>
                </label>
                <button style={ob.primaryBtn} type="button" onClick={() => goToStep(3)}>
                  Continue →
                </button>
                <button style={ob.skipLink} type="button" onClick={skipOnboarding}>
                  I'll set this up later
                </button>
              </>
            )}

            {/* Step 3: Basics */}
            {onboardingStep === 3 && (
              <>
                <button style={ob.backBtn} type="button" onClick={() => goToStep(2)}>← Back</button>
                <h2 style={ob.heading}>Nice to meet you — what should we call you?</h2>
                <label style={ob.label}>
                  Your name
                  <input
                    style={ob.input}
                    type="text"
                    value={profile.name}
                    onChange={(e) => updateProfile({ name: e.target.value })}
                    placeholder="e.g. Fadi"
                    autoFocus
                  />
                </label>
                <label style={ob.label}>
                  How many people are you feeding?
                  <input
                    style={ob.input}
                    type="text"
                    inputMode="numeric"
                    value={profile.people}
                    onChange={(e) => updateProfile({ people: normalizeWholeNumberInput(e.target.value, "") })}
                    placeholder="e.g. 2"
                  />
                </label>
                <button style={ob.primaryBtn} type="button" onClick={() => goToStep(4)}>
                  Continue →
                </button>
                <button style={ob.skipLink} type="button" onClick={skipOnboarding}>
                  I'll set this up later
                </button>
              </>
            )}

            {/* Step 4: Budget */}
            {onboardingStep === 4 && (
              <>
                <button style={ob.backBtn} type="button" onClick={() => goToStep(3)}>← Back</button>
                <h2 style={ob.heading}>Last thing — what's your weekly food budget?</h2>
                <p style={{ ...ob.body, marginBottom: "18px" }}>
                  No judgment here. Every budget builds a great plan.
                </p>
                <label style={ob.label}>
                  Weekly food budget
                  <div style={{ position: "relative", marginTop: "8px" }}>
                    <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#587166", fontSize: "0.95rem", pointerEvents: "none" }}>$</span>
                    <input
                      style={{ ...ob.input, marginTop: 0, paddingLeft: "26px" }}
                      type="text"
                      inputMode="decimal"
                      value={profile.budget}
                      onChange={(e) => updateProfile({ budget: normalizeMoneyInput(e.target.value, "") })}
                      placeholder="75"
                    />
                  </div>
                </label>
                <label style={ob.label}>
                  Days cooking at home
                  <input
                    style={ob.input}
                    type="text"
                    inputMode="numeric"
                    value={profile.daysPerWeek}
                    onChange={(e) => updateProfile({ daysPerWeek: normalizeWholeNumberInput(e.target.value, "") })}
                    placeholder="e.g. 5"
                  />
                </label>
                <label style={ob.label}>
                  Meals per day
                  <input
                    style={ob.input}
                    type="text"
                    inputMode="numeric"
                    value={profile.mealsPerDay}
                    onChange={(e) => updateProfile({ mealsPerDay: normalizeWholeNumberInput(e.target.value, "") })}
                    placeholder="e.g. 3"
                  />
                </label>
                <button style={ob.primaryBtn} type="button" onClick={() => goToStep(5)}>
                  Build my plan →
                </button>
                <button style={ob.skipLink} type="button" onClick={skipOnboarding}>
                  I'll set this up later
                </button>
              </>
            )}

            {/* Step 5: Done */}
            {onboardingStep === 5 && (
              <>
                <h2 style={ob.heading}>
                  You're all set{profile.name ? `, ${profile.name.charAt(0).toUpperCase() + profile.name.slice(1)}` : ""}! 🎉
                </h2>
                <p style={ob.body}>
                  Your preferences are saved. Every plan we build will feel made for you. Let's make your first one.
                </p>
                <button style={ob.primaryBtn} type="button" onClick={completeOnboarding}>
                  Build my first plan →
                </button>
              </>
            )}

          </div>
        </div>

        {/* Right panel */}
        <div style={ob.rightPanel}>
          <div style={ob.rightBg1} />
          <div style={ob.rightBg2} />

          {renderDots(onboardingStep - 1)}

          {onboardingStep === 0 && (
            <>
              <p style={ob.rightHeading}>Your week, planned for you</p>
              <p style={ob.rightBody}>Meals, grocery list, and budget — all in one place.</p>
              <div style={ob.previewCard}>
                <p style={ob.previewCardTitle}>Mediterranean Chicken Bowl</p>
                <p style={ob.previewCardSub}>Day 1 · Lunch · 25 min</p>
                <span style={ob.previewPill}>$4.20/serving</span>
                <span style={ob.previewPill}>420 cal</span>
              </div>
              <div style={ob.previewCard}>
                <p style={ob.previewCardTitle}>Garlic Butter Salmon</p>
                <p style={ob.previewCardSub}>Day 1 · Dinner · 20 min</p>
                <span style={ob.previewPill}>$6.80/serving</span>
                <span style={ob.previewPill}>510 cal</span>
              </div>
            </>
          )}

          {onboardingStep === 1 && (
            <>
              <p style={ob.rightHeading}>Mix it up all week</p>
              <p style={ob.rightBody}>We rotate your favorites so every meal feels different.</p>
              <div style={ob.previewCard}>
                <p style={ob.previewCardTitle}>Mediterranean + Italian</p>
                <p style={ob.previewCardSub}>Your selected cuisines</p>
                <span style={ob.previewPill}>Rotating daily</span>
              </div>
              <div style={ob.previewCard}>
                <p style={ob.previewCardTitle}>No restrictions</p>
                <p style={ob.previewCardSub}>Full ingredient flexibility</p>
                <span style={ob.previewPill}>Max variety</span>
              </div>
            </>
          )}

          {onboardingStep === 2 && (
            <>
              <p style={ob.rightHeading}>Meals that fit your life</p>
              <p style={ob.rightBody}>Quick weeknights or weekend cooking — your call.</p>
              <div style={ob.previewCard}>
                <p style={ob.previewCardTitle}>Quick & easy</p>
                <p style={ob.previewCardSub}>Under 20 min · Balanced</p>
                <span style={ob.previewPill}>Simple steps</span>
                <span style={ob.previewPill}>Beginner friendly</span>
              </div>
            </>
          )}

          {onboardingStep === 3 && (
            <>
              <p style={ob.rightHeading}>Personalized for you</p>
              <p style={ob.rightBody}>Every plan we build will feel made for your household.</p>
              <div style={ob.previewCard}>
                <p style={ob.previewCardTitle}>
                  {profile.name ? `Hey, ${profile.name.charAt(0).toUpperCase() + profile.name.slice(1)}!` : "Hey there!"}
                </p>
                <p style={ob.previewCardSub}>
                  {profile.people ? `${profile.people} ${Number(profile.people) === 1 ? "person" : "people"} · Your personalized plan` : "Your personalized plan"}
                </p>
                <span style={ob.previewPill}>Welcome</span>
              </div>
            </>
          )}

          {onboardingStep === 4 && (
            <>
              <p style={ob.rightHeading}>Your budget goes further</p>
              <p style={ob.rightBody}>We stretch every dollar without sacrificing taste.</p>
              <div style={ob.previewCard}>
                <p style={ob.previewCardTitle}>{profile.budget ? `$${profile.budget} / week` : "Your budget"}</p>
                <p style={ob.previewCardSub}>
                  {profile.daysPerWeek && profile.mealsPerDay
                    ? `${Number(profile.daysPerWeek) * Number(profile.mealsPerDay)} meals planned`
                    : "Full week planned"}
                </p>
                <span style={ob.previewPill}>Under budget</span>
              </div>
              <div style={ob.previewCard}>
                <p style={ob.previewCardTitle}>Grocery list included</p>
                <p style={ob.previewCardSub}>Everything you need, nothing you don't</p>
              </div>
            </>
          )}

          {onboardingStep === 5 && (
            <>
              <p style={ob.rightHeading}>Ready to go</p>
              <p style={ob.rightBody}>Your personalized meal engine is warmed up and ready.</p>
              <div style={ob.previewCard}>
                <p style={ob.previewCardTitle}>Week 1 ready</p>
                <p style={ob.previewCardSub}>
                  {profile.daysPerWeek && profile.mealsPerDay
                    ? `${Number(profile.daysPerWeek) * Number(profile.mealsPerDay)} meals planned`
                    : "Full week planned"}
                </p>
                {profile.cuisines.slice(0, 2).map((c) => (
                  <span key={c} style={ob.previewPill}>{c}</span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.hero}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={styles.eyebrow}>PLATEWELL</p>
            <button
              type="button"
              onClick={editProfile}
              style={{
                background: "none",
                border: "none",
                color: "#6b8578",
                cursor: "pointer",
                fontSize: "0.85rem",
                padding: 0,
                textDecoration: "underline",
                fontFamily: "inherit",
              }}
            >
              Edit profile
            </button>
          </div>
          <h1 style={styles.title}>{heroHeading}</h1>
          <p style={styles.subtitle}>Create your plan in 60 seconds.</p>

          {locationBanner && (
            <div style={styles.locationBanner}>
              <span>📍 Detected location: <strong>{locationBanner.zip}</strong> — is this right?</span>
              <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                <button
                  type="button"
                  style={styles.locationBannerBtn}
                  onClick={() => { setShowZipInput(true); setLocationBanner(null); }}
                >
                  Change
                </button>
                <button
                  type="button"
                  style={{ ...styles.locationBannerBtn, background: "none", border: "none", color: "#6b8578" }}
                  onClick={() => setLocationBanner(null)}
                >
                  ✕ Dismiss
                </button>
              </div>
            </div>
          )}

          {showZipInput && (
            <div style={styles.zipInputRow}>
              <input
                type="text"
                placeholder="Enter ZIP code (e.g. 90210)"
                value={zipInputValue}
                onChange={(e) => setZipInputValue(e.target.value.replace(/\D/g, "").slice(0, 5))}
                style={styles.zipInput}
                maxLength={5}
              />
              <button
                type="button"
                style={styles.zipSaveBtn}
                onClick={() => {
                  if (zipInputValue.length >= 3) saveZipCode(zipInputValue);
                }}
              >
                Save
              </button>
              <button
                type="button"
                style={{ ...styles.locationBannerBtn, background: "none", border: "none", color: "#6b8578" }}
                onClick={() => setShowZipInput(false)}
              >
                Skip
              </button>
            </div>
          )}

          {zipCode && !locationBanner && !showZipInput && (
            <p style={{ fontSize: "0.8rem", color: "#6b8578", marginTop: "8px" }}>
              📍 {zipCode}{" "}
              <button
                type="button"
                onClick={() => { setShowZipInput(true); setZipInputValue(zipCode); }}
                style={{ background: "none", border: "none", color: "#1f8a5b", cursor: "pointer", fontSize: "0.8rem", padding: 0, textDecoration: "underline", fontFamily: "inherit" }}
              >
                Change
              </button>
            </p>
          )}
        </header>

        <main style={styles.layout}>
          <section style={{ ...styles.panel, ...styles.formPanel }}>
            <form onSubmit={generatePlan}>
              <div style={styles.section}>
                <h2 style={styles.sectionTitle}>Plan settings</h2>

                <label style={styles.label}>
                  What's your weekly food budget?
                  <input
                    style={styles.input}
                    type="text"
                    inputMode="decimal"
                    value={form.budget}
                    onChange={(e) => setMoneyField("budget", e.target.value)}
                  />
                </label>

                <label style={styles.label}>
                  How many people are you feeding?
                  <input
                    style={styles.input}
                    type="text"
                    inputMode="numeric"
                    value={form.people}
                    onChange={(e) => setWholeNumberField("people", e.target.value)}
                  />
                </label>

                <label style={styles.label}>
                  How many days will you cook at home?
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
                  How many meals per day?
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
                  What's your eating goal?
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
                  How confident are you in the kitchen?
                  <select
                    style={styles.select}
                    value={form.cookingStyle}
                    onChange={(e) => setTextField("cookingStyle", e.target.value)}
                  >
                    <option value="quick & easy">Quick & easy</option>
                    <option value="comfortable cook">Comfortable cook</option>
                    <option value="adventurous chef">Adventurous chef</option>
                  </select>
                </label>

                <label style={styles.label}>
                  How long do you want to spend cooking?
                  <select
                    style={styles.select}
                    value={form.cookTime}
                    onChange={(e) => setTextField("cookTime", e.target.value)}
                  >
                    <option value="under 20 min">Under 20 min</option>
                    <option value="20–40 min">20–40 min</option>
                    <option value="no preference">No preference</option>
                  </select>
                </label>

                <label style={styles.label}>
                  How much variety do you want?
                  <select
                    style={styles.select}
                    value={form.varietyLevel}
                    onChange={(e) => setTextField("varietyLevel", e.target.value)}
                  >
                    <option value="same favorites, different days">Same favorites, different days</option>
                    <option value="a little of everything">A little of everything</option>
                    <option value="surprise me every meal">Surprise me every meal</option>
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
                  onClick={() => {
                    if (!form.fridgeMode && !isDevMode) {
                      setUpgradeReason("fridge");
                      setShowUpgradeModal(true);
                      return;
                    }
                    toggleFridgeMode();
                  }}
                >
                  {form.fridgeMode ? "Fridge Mode is on" : "🔒 Fridge Mode — Pro feature"}
                </button>

                {!form.fridgeMode && (
                  <p style={styles.helper}>
                    Tell us what's in your fridge and we'll build meals around what you already have.
                  </p>
                )}

                {form.fridgeMode && (
                  <>
                    <p style={{ ...styles.helper, marginTop: "12px", marginBottom: "6px" }}>
                      Tell us what's in your fridge — however you want.
                    </p>
                    <textarea
                      style={{ ...styles.textarea, marginTop: "4px" }}
                      value={form.fridgeIngredients}
                      onChange={(e) =>
                        setTextField("fridgeIngredients", e.target.value)
                      }
                      placeholder="e.g. I've got chicken, half a bag of spinach, some eggs and leftover rice..."
                    />
                    <div style={{ ...styles.chipGrid, marginTop: "12px" }}>
                      <button
                        type="button"
                        style={{
                          ...styles.chip,
                          ...(form.fridgeModeType === "only" ? styles.chipActive : {}),
                          flex: 1,
                          borderRadius: "14px",
                          padding: "12px 14px",
                          textAlign: "left",
                        }}
                        onClick={() => setTextField("fridgeModeType", "only")}
                      >
                        <div style={{ fontWeight: 700, marginBottom: "2px" }}>🔒 Use only these ingredients</div>
                        <div style={{ fontSize: "0.82rem", opacity: 0.85 }}>Build my entire plan from only what I have — no extras.</div>
                      </button>
                      <button
                        type="button"
                        style={{
                          ...styles.chip,
                          ...(form.fridgeModeType === "supplement" ? styles.chipActive : {}),
                          flex: 1,
                          borderRadius: "14px",
                          padding: "12px 14px",
                          textAlign: "left",
                        }}
                        onClick={() => setTextField("fridgeModeType", "supplement")}
                      >
                        <div style={{ fontWeight: 700, marginBottom: "2px" }}>➕ Use these + add what's needed</div>
                        <div style={{ fontSize: "0.82rem", opacity: 0.85 }}>Prioritize what I have but fill gaps with other ingredients.</div>
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div style={styles.section}>
                <h2 style={styles.sectionTitle}>Any dietary restrictions?</h2>
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
                <h2 style={styles.sectionTitle}>Cuisine preferences</h2>
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
                {form.cuisines.includes("Other") && (
                  <input
                    style={{ ...styles.input, marginTop: "12px" }}
                    type="text"
                    placeholder="Describe your cuisine..."
                    value={otherCuisine}
                    onChange={(e) => setOtherCuisine(e.target.value)}
                  />
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
                  <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>🍽️</div>
                  <h2 style={{ marginBottom: "10px", color: "#124734" }}>
                    Your plan is one click away
                  </h2>
                  <p style={{ maxWidth: "340px", margin: "0 auto 24px" }}>
                    Fill in your settings and hit generate — we'll build a full week of meals, a grocery list, and budget breakdown in seconds.
                  </p>
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    maxWidth: "280px",
                    margin: "0 auto",
                    textAlign: "left",
                  }}>
                    {["Personalized meals for your budget", "Auto-generated grocery list", "Nutrition & macro breakdown", "Swap any meal you don't like"].map((item) => (
                      <div key={item} style={{ display: "flex", alignItems: "center", gap: "10px", color: "#587166", fontSize: "0.9rem" }}>
                        <span style={{ color: "#1f8a5b", fontWeight: 700 }}>✓</span>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {loading && (
              <div style={styles.emptyState}>
                <div>
                  <h2 style={{ marginBottom: "10px", color: "#124734" }}>
                    Building your plan...
                  </h2>
                  <p>Putting your preferences to work.</p>
                </div>
              </div>
            )}

            {result && (
              <div>
                {Object.values(leftovers).some(Boolean) && (
                  <button
                    type="button"
                    style={styles.regenerateBtn}
                    onClick={regenerateWithLeftovers}
                    disabled={regenerateLoading}
                  >
                    {regenerateLoading ? "Regenerating..." : "🍱 Regenerate plan with leftovers"}
                  </button>
                )}

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

                {budgetFeedback && (
                  <div style={{
                    ...styles.budgetBanner,
                    background: budgetFeedback.type === "under" ? "#f0faf4" : budgetFeedback.type === "on" ? "#f0f7ff" : "#fffbf0",
                    border: `1px solid ${budgetFeedback.type === "under" ? "#c3e6d0" : budgetFeedback.type === "on" ? "#c3d9f0" : "#f0e0a0"}`,
                    color: budgetFeedback.type === "under" ? "#1a5c3f" : budgetFeedback.type === "on" ? "#1a3a5c" : "#7a5a10",
                  }}>
                    {budgetFeedback.message}
                  </div>
                )}

                {nutritionSummary && (
                  <>
                    <p style={{ ...styles.statLabel, marginBottom: "8px", fontWeight: 600, color: "#124734" }}>Weekly Nutrition Overview</p>
                    <div style={styles.nutritionBar}>
                      <div style={styles.nutritionCard}>
                        <span style={styles.statLabel}>Avg Daily Calories</span>
                        <strong style={styles.statValue}>{nutritionSummary.avgCalories}</strong>
                      </div>
                      <div style={styles.nutritionCard}>
                        <span style={styles.statLabel}>Avg Protein / day</span>
                        <strong style={styles.statValue}>{nutritionSummary.avgProtein}g</strong>
                      </div>
                      <div style={styles.nutritionCard}>
                        <span style={styles.statLabel}>Avg Carbs / day</span>
                        <strong style={styles.statValue}>{nutritionSummary.avgCarbs}g</strong>
                      </div>
                      <div style={styles.nutritionCard}>
                        <span style={styles.statLabel}>Avg Fat / day</span>
                        <strong style={styles.statValue}>{nutritionSummary.avgFat}g</strong>
                      </div>
                      <div style={styles.nutritionCard}>
                        <span style={styles.statLabel}>Total Weekly Cal</span>
                        <strong style={styles.statValue}>{nutritionSummary.totalCalories.toLocaleString()}</strong>
                      </div>
                    </div>
                  </>
                )}

                <div style={styles.metaCard}>
                  <p>
                    <strong>Goal:</strong> {result.dietaryGoal || form.dietaryGoal}
                  </p>
                  <p>
                    <strong>Cooking style:</strong>{" "}
                    {(() => {
                      const style = result.cookingStyle || form.cookingStyle || "";
                      return style.charAt(0).toUpperCase() + style.slice(1);
                    })()}
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <h3 style={{ margin: 0, color: "#124734" }}>Grocery list</h3>
                    {Object.values(checkedItems).some(Boolean) && (
                      <button
                        type="button"
                        onClick={() => setCheckedItems({})}
                        style={{ background: "none", border: "none", color: "#6b8578", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}
                      >
                        Clear checks
                      </button>
                    )}
                  </div>

                  {Array.isArray(result.categorizedGroceryList) && result.categorizedGroceryList.length > 0 ? (
                    result.categorizedGroceryList.map(({ category, items }) => (
                      <div key={category} style={{ marginBottom: "20px" }}>
                        <p style={{
                          margin: "0 0 10px",
                          fontSize: "0.72rem",
                          fontWeight: 800,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "#1f8a5b",
                        }}>
                          {category}
                        </p>
                        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "4px" }}>
                          {items.map((item) => {
                            const itemKey = typeof item === "string" ? item : item.name;
                            const itemName = typeof item === "string" ? item : item.name;
                            const itemDisplayAmount = typeof item === "string" ? null : item.displayAmount;
                            const itemExactTotal = typeof item === "string" ? null : item.exactTotal;
                            const itemIsStaple = typeof item === "string" ? false : item.isStaple;
                            const checked = !!checkedItems[itemKey];
                            const isActive = activeGroceryItem === itemKey;
                            return (
                              <div key={itemKey} style={{ position: "relative" }}>
                                <div
                                  onClick={() => toggleCheckedItem(itemKey)}
                                  onMouseEnter={() => setActiveGroceryItem(itemKey)}
                                  onMouseLeave={() => setActiveGroceryItem(null)}
                                  onTouchStart={() => setActiveGroceryItem(itemKey)}
                                  onTouchEnd={() => setTimeout(() => setActiveGroceryItem(null), 1200)}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "10px",
                                    padding: "8px 10px",
                                    borderRadius: "10px",
                                    cursor: "pointer",
                                    background: checked ? "#f0faf4" : isActive ? "#f4fbf6" : "transparent",
                                    transition: "background 0.15s ease",
                                    position: "relative",
                                  }}
                                >
                                  <div style={{
                                    width: "18px",
                                    height: "18px",
                                    borderRadius: "5px",
                                    border: checked ? "none" : "1.5px solid #cfe5d7",
                                    background: checked ? "#1f8a5b" : "transparent",
                                    flexShrink: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}>
                                    {checked && (
                                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                    )}
                                  </div>
                                  <span style={{
                                    fontSize: "0.88rem",
                                    color: checked ? "#6b8578" : "#234536",
                                    textDecoration: checked ? "line-through" : "none",
                                    flex: 1,
                                    transition: "color 0.15s ease",
                                  }}>
                                    {itemDisplayAmount ? `${itemDisplayAmount} ` : ""}
                                    <strong style={{ fontWeight: 600 }}>{itemName}</strong>
                                  </span>
                                  {itemIsStaple && (
                                    <span style={{ fontSize: "0.7rem", color: "#aab4af" }}>staple</span>
                                  )}
                                </div>
                                {isActive && itemExactTotal && (
                                  <div style={{
                                    position: "absolute",
                                    bottom: "calc(100% + 4px)",
                                    left: "10px",
                                    background: "#124734",
                                    color: "#ffffff",
                                    fontSize: "0.78rem",
                                    padding: "6px 10px",
                                    borderRadius: "8px",
                                    whiteSpace: "nowrap",
                                    zIndex: 10,
                                    pointerEvents: "none",
                                  }}>
                                    {itemExactTotal}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  ) : (
                    <ul style={{ ...styles.groceryList, listStyle: "none", paddingLeft: 0 }}>
                      {(result.groceryList || []).map((item, index) => (
                        <li key={`${item}-${index}`} style={{ marginBottom: "6px", color: "#234536", fontSize: "0.88rem" }}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}

                  {result.groceryPriceEstimate && (
                    <div style={styles.priceEstimateSection}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                        <span style={{ fontWeight: 700, color: "#124734" }}>Estimated grocery total</span>
                        <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "#1f8a5b" }}>
                          ~${Number(result.groceryPriceEstimate.estimatedTotal).toFixed(2)}
                        </span>
                      </div>
                      <p style={{ fontSize: "0.75rem", color: "#aab4af", margin: "4px 0 0" }}>
                        {result.groceryPriceEstimate.disclaimer}
                      </p>
                    </div>
                  )}
                </div>

                {result.prepDayGuide && (
                  <div style={styles.prepGuideCard}>
                    <button
                      type="button"
                      onClick={() => setShowPrepGuide((v) => !v)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        width: "100%",
                        textAlign: "left",
                        padding: 0,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontFamily: "inherit",
                      }}
                    >
                      <h3 style={{ margin: 0, color: "#124734", fontSize: "1rem" }}>
                        🥣 Prep Day Guide
                      </h3>
                      <span style={{ color: "#6b8578", fontSize: "0.85rem" }}>
                        {showPrepGuide ? "▲ Collapse" : "▼ Expand"}
                      </span>
                    </button>

                    {showPrepGuide && (
                      <div style={styles.mealColumns}>
                        <div>
                          <h4 style={{ ...styles.mealBlockTitle, marginTop: "14px" }}>🔥 Batch Cook</h4>
                          <ul style={styles.list}>
                            {(result.prepDayGuide.batchCook || []).map((item, i) => (
                              <li key={i} style={{ marginBottom: "4px" }}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 style={{ ...styles.mealBlockTitle, marginTop: "14px" }}>🔪 Prep Ahead</h4>
                          <ul style={styles.list}>
                            {(result.prepDayGuide.prepAhead || []).map((item, i) => (
                              <li key={i} style={{ marginBottom: "4px" }}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {Object.entries(groupedMeals).map(([day, meals]) => (
                  <div key={day} style={styles.mealDaySection}>
                    <h2 style={styles.dayHeading}>Day {day}</h2>

                    <div style={styles.mealList}>
                      {meals.map((meal, index) => {
                        const swapKey = `${meal.day}-${meal.mealType}`;
                        const swapping = swapLoadingKey === swapKey;
                        const tags = Array.isArray(meal.tags) ? meal.tags : [];
                        const fridgeModeTag = tags.includes("fridge mode");
                        const isLeftover = tags.includes("leftover");
                        const leftoverKey = `${meal.day}-${meal.mealType}`;
                        const leftoverOn = !!leftovers[leftoverKey];

                        return (
                          <article
                            key={`${meal.day}-${meal.mealType}-${index}`}
                            style={styles.mealCard}
                          >
                            <div style={styles.mealHeader}>
                              <div>
                                <p style={styles.mealLabel}>
                                  {meal.mealType ? meal.mealType.charAt(0).toUpperCase() + meal.mealType.slice(1) : "Meal"}
                                </p>
                                <h3 style={styles.mealTitle}>
                                  {meal.meal || "Untitled meal"}
                                </h3>
                                {meal.description && (
                                  <p style={styles.mealDescription}>
                                    {meal.description}
                                  </p>
                                )}
                                <p style={styles.mealSubtext}>
                                  {meal.cuisine || "Mixed cuisine"} •{" "}
                                  {meal.prepTime || "Quick prep"} •{" "}
                                  {meal.servingSize || "Standard serving"}
                                </p>
                              </div>

                              {!isLeftover && (
                                <button
                                  style={styles.swapBtn}
                                  type="button"
                                  onClick={() => swapMeal(meal)}
                                  disabled={swapping}
                                >
                                  {swapping ? "Swapping..." : "Swap meal"}
                                </button>
                              )}
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

                            {(tags.length > 0 || isLeftover) && (
                              <div style={styles.pillRow}>
                                {fridgeModeTag && (
                                  <span style={styles.fridgeTagPill}>
                                    Fridge Mode
                                  </span>
                                )}
                                {isLeftover && (
                                  <span style={styles.leftoverBadge}>
                                    🍱 Leftover
                                  </span>
                                )}
                                {tags
                                  .filter((tag) => tag !== "fridge mode" && tag !== "leftover")
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

                            {!isLeftover && (
                              <div>
                                <button
                                  type="button"
                                  style={{
                                    ...styles.leftoverBtn,
                                    ...(leftoverOn ? { background: "#e9f7ef", borderColor: "#1f8a5b", color: "#1f8a5b" } : {}),
                                  }}
                                  onClick={() => toggleLeftover(meal)}
                                >
                                  {leftoverOn ? "Leftovers planned ✓" : "🍱 Make double & use as leftovers"}
                                </button>
                              </div>
                            )}

                            <div style={styles.ratingRow}>
                              {ratingConfirm[meal.meal] ? (
                                <span style={{ fontSize: "0.82rem", color: "#6b8578" }}>Got it!</span>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    style={{
                                      ...styles.ratingBtn,
                                      ...(ratings[meal.meal] === "up" ? { background: "#e9f7ef", borderColor: "#1f8a5b", color: "#1f8a5b" } : {}),
                                    }}
                                    onClick={() => rateMeal(meal.meal, "up")}
                                    title="Like this meal"
                                  >
                                    👍
                                  </button>
                                  <button
                                    type="button"
                                    style={{
                                      ...styles.ratingBtn,
                                      ...(ratings[meal.meal] === "down" ? { background: "#fdf0f0", borderColor: "#e07070", color: "#c0392b" } : {}),
                                    }}
                                    onClick={() => rateMeal(meal.meal, "down")}
                                    title="Dislike this meal"
                                  >
                                    👎
                                  </button>
                                </>
                              )}
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

      {showUpgradeModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(18, 71, 52, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "20px",
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: "24px",
            padding: "36px 32px",
            maxWidth: "420px",
            width: "100%",
            textAlign: "center",
            boxShadow: "0 24px 60px rgba(18, 71, 52, 0.18)",
          }}>
            <div style={{ fontSize: "2rem", marginBottom: "12px" }}>🌿</div>
            <h2 style={{ margin: "0 0 10px", color: "#124734", fontSize: "1.4rem" }}>
              {upgradeReason === "plan" && "You've used your free plan this week"}
              {upgradeReason === "days" && "Free plan supports up to 3 days"}
              {upgradeReason === "meals" && "Free plan supports up to 3 meals per day"}
              {upgradeReason === "swaps" && "You've used your 2 free swaps"}
              {upgradeReason === "fridge" && "Fridge Mode is a Pro feature"}
              {upgradeReason === "grocery" && "Grocery export is a Pro feature"}
            </h2>
            <p style={{ color: "#587166", fontSize: "0.95rem", lineHeight: 1.6, margin: "0 0 24px" }}>
              Platewell Pro is coming soon — unlimited plans, 7-day meal plans, unlimited swaps, Fridge Mode, and grocery export.
            </p>
            <button
              type="button"
              style={{
                width: "100%",
                padding: "14px",
                background: "#1f8a5b",
                color: "#fff",
                border: "none",
                borderRadius: "14px",
                fontWeight: 700,
                fontSize: "0.95rem",
                cursor: "pointer",
                marginBottom: "10px",
                fontFamily: "inherit",
              }}
              onClick={() => setShowUpgradeModal(false)}
            >
              Got it — coming soon!
            </button>
            <button
              type="button"
              style={{
                background: "none",
                border: "none",
                color: "#6b8578",
                cursor: "pointer",
                fontSize: "0.88rem",
                fontFamily: "inherit",
              }}
              onClick={() => setShowUpgradeModal(false)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}