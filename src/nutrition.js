// ============================================================================
// nutrition.js — per-100g macros for the focaccia formula
//
// A straight mass-balance, not a model: each ingredient carries a fixed macro
// density (kcal / carb / fat / protein / sugar per 100 g), so the dough's
// macros are the gram-weighted sum of its parts, normalised to a 100 g serving:
//
//   macro_per_100g = ( Σ_i  grams_i · density_i / 100 )  ·  100 / Σ_i grams_i
//
// Densities are USDA FoodData Central reference values — each cites its FDC id
// in FDC_IDS. Per-100g, unit-consistent with the recipe (grams).
//
// Note: figures are for the dough *as mixed*. Baking drives off water, so baked
// focaccia runs more energy-dense per 100 g; this also does not count the pan
// oil, which the bread only partly absorbs.
// ============================================================================

// kcal, carbohydrate (g), fat (g), protein (g), sugars (g) — all per 100 g.
export const MACROS = {
  flour:      { kcal: 364, carb: 76.3, fat: 1.0,  protein: 10.3, sugar: 0.3 },
  // Base-flour variants — the grind/strength selector picks one. Protein (and the
  // carbohydrate it displaces) move with the flour; energy is ~flat.
  flourAP:     { kcal: 364, carb: 76.3, fat: 1.0, protein: 10.3, sugar: 0.3 }, // = `flour` (USDA AP)
  flourBread:  { kcal: 361, carb: 72.5, fat: 1.4, protein: 12.5, sugar: 0.3 },
  flourStrong: { kcal: 362, carb: 71.0, fat: 1.5, protein: 14.0, sugar: 0.3 },
  flourDurum:  { kcal: 360, carb: 72.8, fat: 1.4, protein: 13.5, sugar: 0 },
  semolina:   { kcal: 360, carb: 72.8, fat: 1.1,  protein: 12.7, sugar: 0 },
  pinsaBlend: { kcal: 366, carb: 76.0, fat: 1.2,  protein: 8.0,  sugar: 0.5 }, // rice+soy blend, approx
  water:      { kcal: 0,   carb: 0,    fat: 0,    protein: 0,    sugar: 0 },
  oliveOil:   { kcal: 884, carb: 0,    fat: 100,  protein: 0,    sugar: 0 },
  salt:       { kcal: 0,   carb: 0,    fat: 0,    protein: 0,    sugar: 0 },
  yeast:      { kcal: 325, carb: 41.2, fat: 7.6,  protein: 40.4, sugar: 0 },
  whiteSugar: { kcal: 387, carb: 100,  fat: 0,    protein: 0,    sugar: 99.8 },
  butter:     { kcal: 717, carb: 0.1,  fat: 81.1, protein: 0.9,  sugar: 0.1 },
  eggWhole:   { kcal: 143, carb: 0.7,  fat: 9.5,  protein: 12.6, sugar: 0.4 },
  eggYolk:    { kcal: 322, carb: 3.6,  fat: 26.5, protein: 15.9, sugar: 0.6 },
  milk:       { kcal: 61,  carb: 4.8,  fat: 3.3,  protein: 3.2,  sugar: 5.1 },
  honey:      { kcal: 304, carb: 82.4, fat: 0,    protein: 0.3,  sugar: 82.1 },
  potato:     { kcal: 87,  carb: 20.1, fat: 0.1,  protein: 1.9,  sugar: 0.9 },
  cheese:     { kcal: 290, carb: 2.0,  fat: 24.0, protein: 18.0, sugar: 1.0 }, // soft fresh cheese (crescenza/stracchino)
  grapes:     { kcal: 69,  carb: 18.1, fat: 0.2,  protein: 0.7,  sugar: 15.5 },
  almond:     { kcal: 579, carb: 21.6, fat: 49.9, protein: 21.2, sugar: 4.4 },
};

// USDA FoodData Central ids backing each density.
export const FDC_IDS = {
  flour: "169761",       // Wheat flour, white, all-purpose, enriched
  flourAP: "169761",     // Wheat flour, white, all-purpose, enriched
  flourBread: "168894",  // Wheat flour, white, bread, enriched
  flourStrong: "168894", // strong/high-gluten — bread-flour density, protein bumped
  flourDurum: "169740",  // Durum (00 grano duro ≈ durum density)
  semolina: "169740",    // Semolina, enriched
  water: "174158",       // Water, bottled, generic
  oliveOil: "171413",    // Oil, olive, salad or cooking
  yeast: "175039",       // Leavening agents, yeast, baker's, active dry
  whiteSugar: "169655",  // Sugars, granulated
  butter: "173410",      // Butter, salted
  eggWhole: "748967",    // Egg, whole, raw, fresh
  eggYolk: "172183",     // Egg, yolk, raw, fresh
  milk: "746782",        // Milk, whole, 3.25% milkfat
  honey: "169640",       // Honey
  potato: "170443",      // Potatoes, boiled, flesh, without salt
  cheese: "173420",      // Cheese, cream/soft (proxy for crescenza)
  grapes: "174683",      // Grapes, red or green, raw
  almond: "170567",      // Nuts, almonds, raw
};

// Map a free-text ingredient name (the `k` field) to a macro key. Ordered:
// specific names win over generic ones (e.g. "almond" before "flour", "yolk"
// before "egg", "semola/durum" before plain flour).
const RULES = [
  [/\balmond/i,            "almond"],
  [/yolk/i,                "eggYolk"],
  [/\begg/i,               "eggWhole"],
  [/semol|durum/i,         "semolina"],
  [/rice|soy|pinsa/i,      "pinsaBlend"],
  [/olive oil|\boil\b/i,   "oliveOil"],
  [/yeast/i,               "yeast"],
  [/sugar|granella/i,      "whiteSugar"],
  [/butter/i,              "butter"],
  [/milk/i,                "milk"],
  [/honey|malt/i,          "honey"],
  [/potato/i,              "potato"],
  [/crescenza|stracchino|cheese|crema/i, "cheese"],
  [/grape|uva/i,           "grapes"],
  [/salt/i,                "salt"],
  [/water/i,               "water"],
  [/flour|semola|\b00\b/i, "flour"],
];

export function resolveMacroKey(name) {
  if (!name) return null;
  for (const [re, key] of RULES) if (re.test(name)) return key;
  return null;
}

// items: [{ key?, k?, g }]. `key` (a macro key) wins; otherwise `k` (free text)
// is resolved. Items without a numeric, positive weight are ignored. Returns
// macros normalised to a 100 g serving plus total weighed mass, or null.
export function macrosPer100g(items) {
  const tot = { kcal: 0, carb: 0, fat: 0, protein: 0, sugar: 0 };
  let mass = 0;
  for (const it of items || []) {
    const g = Number(it.g);
    if (!Number.isFinite(g) || g <= 0) continue;
    const key = it.key || resolveMacroKey(it.k);
    const m = MACROS[key];
    if (!m) continue;
    const f = g / 100;
    tot.kcal += m.kcal * f; tot.carb += m.carb * f; tot.fat += m.fat * f;
    tot.protein += m.protein * f; tot.sugar += m.sugar * f;
    mass += g;
  }
  if (mass <= 0) return null;
  const k = 100 / mass;
  const r1 = (x) => Math.round(x * k * 10) / 10;
  return {
    kcal: Math.round(tot.kcal * k),
    carb: r1(tot.carb), fat: r1(tot.fat), protein: r1(tot.protein), sugar: r1(tot.sugar),
    mass: Math.round(mass),
  };
}
