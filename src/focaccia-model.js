// ============================================================================
// focaccia-model.js — the multivariate focaccia model
//
// Same shape as cookiebot's cookie-model.js: drive the *qualities* (open crumb,
// tang, flake, crust, richness, salt) and the model tells you the *formula &
// method*. Two layers of coupled algebraic equations:
//
//   recipe ──(constitutive)──▶ latent dough state ──(observation)──▶ qualities
//
// plus an identity-fixed inverse. A focaccia's IDENTITY (its fermentation
// schedule, whether it's durum-semola, whether it's a two-pan deep bake) is what
// makes it what it is — never solved away. The LEVERS (hydration, lamination,
// oils, salt) tune the qualities within that identity. Changing an identity
// value is a *deviation* (see deviations()).
//
// Coefficients are hand-set and cited to the corpus (option a) — see CITES.
// Units: baker's % / 100 (flour = 1).
// ============================================================================

export const CITES = {
  hydration_open_crumb:    ["cauvain-technology-of-breadmaking:0001:07:67f488bd"],
  gluten_development_folds:["cauvain-technology-of-breadmaking:0004:00:a821d86e"],
  fermentation_gas_tang:   ["cauvain-technology-of-breadmaking:0002:01:e403ea0e"],
  oven_spring:             ["cauvain-technology-of-breadmaking:0005:00:bdefa94d"],
  fat_shortens_gluten:     ["bressanini-scienza-della-pasticceria:0067:00:36da9e91"],
  flour_gluten:            ["bressanini-scienza-della-pasticceria:0075:00:7d1dcdb1"],
  salt_in_dough:           ["cauvain-technology-of-breadmaking:0001:06:4a593f33"],
};

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const sat = (x) => clamp(x, 0, 1);
const lin = (x, lo, hi) => clamp(((x - lo) / (hi - lo)) * 100, 0, 100);

// ============================================================================
// LAYER 1 — recipe → latent dough state (constitutive equations)
// ============================================================================
export function state(r) {
  const H = r.hydration / 100;       // dough water
  const S = r.saltPct / 100;
  const PO = r.panOilPct / 100;      // pan oil — fries the base
  const DO = r.doughOilPct / 100;    // oil worked into the dough
  const SEM = r.semolinaPct / 100;   // durum semola share
  const POT = (r.potatoPct || 0) / 100; // boiled, riced potato worked into the dough
  const BLEND = (r.pinsaBlendPct || 0) / 100; // rice + soy flour blend (pinsa) — ~no gluten
  const folds = r.folds;             // lamination letter-folds (0–4)
  const sch = r.schIdx;              // ferment schedule 0=same-day … 3=3-day cold

  // Free water above what the flour needs to be a workable dough → the slack
  // that becomes open holes. [hydration_open_crumb]
  const slack = clamp(H - 0.60, 0, 0.40);

  // Gluten network: lamination folds and a long ferment develop it; oil shortens
  // it; durum semola's gluten is weaker/shorter; boiled potato starch tenderises
  // it further (the soft, moist barese/pugliese crumb); the pinsa rice/soy blend
  // carries almost no gluten at all. [gluten_development_folds],
  // [fat_shortens_gluten], [flour_gluten]
  const gluten = clamp((0.55 + 0.15 * folds) * (1 + 0.10 * sch) * (1 - 0.6 * DO) * (1 - 0.4 * SEM) * (1 - 0.5 * POT) * (1 - 0.6 * BLEND), 0, 2);

  // Fermentation: a longer/colder schedule builds more gas and more acidity
  // (tang), even though the yeast dose drops. [fermentation_gas_tang]
  const gas = 0.45 + 0.17 * sch;
  const tangState = 0.05 + 0.30 * sch;

  // Oven spring: gas held by a strong-enough gluten net, helped by steam from a
  // wet dough. [oven_spring]
  const ovenSpring = gas * sat(gluten) * (0.55 + 0.45 * sat(slack / 0.25));

  // A very wet dough blisters into a crisp, bubbled top.
  const blister = sat((H - 0.76) / 0.14);
  const friedBase = PO;

  return { H, S, PO, DO, SEM, POT, BLEND, folds, sch, slack, gluten, gas, tangState, ovenSpring, blister, friedBase };
}

// ============================================================================
// LAYER 2 — latent state → sensory qualities (observation equations), 0..100
// ============================================================================
export function qualities(r) {
  const s = state(r);

  // OPEN CRUMB: slack water + fermentation gas + oven spring blow it open; oil
  // tightens it, and too-weak gluten can't hold the holes so it collapses denser.
  const openness = lin(
    1.5 * s.slack + 0.6 * s.gas + 0.6 * s.ovenSpring - 1.1 * s.DO - 0.25 * (1 - sat(s.gluten)),
    0.05, 1.10);

  // TANG: set by the ferment schedule. [fermentation_gas_tang]
  const tang = lin(s.tangState, 0.0, 1.0);

  // FLAKE / shred: lamination folds — but they only layer if there's gluten to
  // build the sheets.
  const flake = lin(s.folds * (0.45 + 0.55 * sat(s.gluten)), 0.0, 4.0);

  // CRUST: pan oil fries it hard, a wet dough blisters crisp, durum bakes a sandy
  // fracturing crust, the pinsa rice/soy blend crisps a light shell; dough oil softens it.
  const crust = lin(6.0 * s.friedBase + 0.4 * s.blister + 1.2 * s.SEM + 0.5 * s.BLEND - 0.7 * s.DO, 0.30, 0.95);

  // RICHNESS: oil — dough oil dominates the crumb, pan oil adds some.
  const richness = lin(s.DO + 0.30 * s.PO, 0.0, 0.135);

  // SALT: the salt load. [salt_in_dough]
  const salt = lin(s.S, 0.016, 0.028);

  return { openness, tang, flake, crust, richness, salt };
}

// ---- Quality axes the UI exposes as sliders --------------------------------
export const QUALITY_AXES = [
  { key: "openness", label: "Open crumb", lo: "tight & bread-y", hi: "wildly open",   def: 55 },
  { key: "tang",     label: "Tang",       lo: "clean & fresh",   hi: "deep & sour",   def: 35 },
  { key: "flake",    label: "Flake",      lo: "pillowy",         hi: "deeply shreddy", def: 25 },
  { key: "crust",    label: "Crust",      lo: "soft",            hi: "hard & fried",  def: 55 },
  { key: "richness", label: "Richness",   lo: "lean",            hi: "oily & rich",   def: 45 },
  { key: "salt",     label: "Salt",       lo: "restrained",      hi: "bold",          def: 50 },
];

// ============================================================================
// INVERSE — identity vs levers
// ============================================================================
const CONT = [
  { key: "hydration",   lo: 66, hi: 88, prior: 78, step: 1 },
  { key: "folds",       lo: 0,  hi: 4,  prior: 1,  step: 1 },
  { key: "panOilPct",   lo: 6,  hi: 12, prior: 8,  step: 1 },
  { key: "doughOilPct", lo: 0,  hi: 8,  prior: 3,  step: 0.5 },
  { key: "saltPct",     lo: 1.6, hi: 2.8, prior: 2.2, step: 0.1 },
];
const PRIOR = Object.fromEntries(CONT.map((c) => [c.key, c.prior]));

// IDENTITY — what makes a focaccia what it is (held fixed by the inverse):
//   schIdx       the ferment schedule (defines tang & method character)
//   semolinaPct  durum-semola vs plain wheat
//   twoPans      the two-pan / deep-fry bake
// LEVERS — the continuous dials tuned within an identity.
export const IDENTITY_KEYS = ["schIdx", "semolinaPct", "twoPans", "potatoPct", "pinsaBlendPct"];
export const LEVER_KEYS = CONT.map((c) => c.key);

const DISCRETE = {
  schIdx:      [0, 1, 2, 3],
  semolinaPct: [0, 5, 15],
  twoPans:     [false, true],
};

function loss(recipe, target, weights) {
  const q = qualities(recipe);
  let e = 0;
  for (const k of Object.keys(target)) {
    const w = (weights && weights[k] != null) ? weights[k] : 1;
    e += w * (q[k] - target[k]) ** 2;
  }
  for (const c of CONT) e += 5 * ((recipe[c.key] - c.prior) / (c.hi - c.lo)) ** 2;
  return e;
}

function descend(start, target, weights) {
  const r = { ...start };
  for (let pass = 0; pass < 8; pass++) {
    for (const c of CONT) {
      let best = r[c.key], bestL = loss(r, target, weights);
      for (const dir of [-1, 1]) {
        for (let k = 1; k <= 8; k++) {
          const cand = clamp(r[c.key] + dir * c.step * k, c.lo, c.hi);
          const L = loss({ ...r, [c.key]: cand }, target, weights);
          if (L < bestL - 1e-9) { bestL = L; best = cand; }
        }
      }
      r[c.key] = best;
    }
  }
  return r;
}

function roundRecipe(r) {
  const o = { ...r };
  o.hydration = Math.round(o.hydration);
  o.folds = Math.round(o.folds);
  o.panOilPct = Math.round(o.panOilPct);
  o.doughOilPct = Math.round(o.doughOilPct * 2) / 2;
  o.saltPct = Math.round(o.saltPct * 10) / 10;
  return o;
}

// Solve LEVERS only, IDENTITY held. High residual = "this style can't get there".
export function solveWithin(target, identity, opts = {}) {
  const start = { ...PRIOR, ...identity };
  const r = roundRecipe(descend(start, target, opts.weights));
  return { recipe: r, qualities: qualities(r), residual: loss(r, target, opts.weights) };
}

// Nearest real archetype to a target (by forward-quality distance).
export function classify(target, recipes) {
  let best = null, bestD = Infinity;
  for (const rec of recipes) {
    const q = qualities(rec.set || rec);
    let e = 0;
    for (const k of Object.keys(target)) e += (q[k] - target[k]) ** 2;
    if (e < bestD) { bestD = e; best = rec; }
  }
  return { recipe: best, distance: Math.sqrt(bestD) };
}

// Differences from a base recipe, flagging identity deviations vs lever tweaks.
export function deviations(recipe, base) {
  const out = [];
  for (const key of [...IDENTITY_KEYS, ...LEVER_KEYS]) {
    if (recipe[key] !== base[key]) {
      out.push({ key, base: base[key], now: recipe[key], identity: IDENTITY_KEYS.includes(key) });
    }
  }
  return out;
}

// Freestyle WITH style conformity: adopt the nearest archetype's identity, then
// tune levers within it — so freestyle always conforms to a real style.
export function solveConforming(target, recipes, opts = {}) {
  const near = classify(target, recipes).recipe;
  const identity = Object.fromEntries(IDENTITY_KEYS.map((k) => [k, (near.set || near)[k]]));
  return { ...solveWithin(target, identity, opts), style: near };
}

// ---- LEGACY free search (identity is free; kept for reference) -------------
export function solve(target, opts = {}) {
  let bestL = Infinity, bestRecipe = null;
  for (const schIdx of DISCRETE.schIdx) {
    for (const semolinaPct of DISCRETE.semolinaPct) {
      for (const twoPans of DISCRETE.twoPans) {
        const r = descend({ ...PRIOR, schIdx, semolinaPct, twoPans }, target, opts.weights);
        const L = loss(r, target, opts.weights);
        if (L < bestL) { bestL = L; bestRecipe = r; }
      }
    }
  }
  const r = roundRecipe(bestRecipe);
  return { recipe: r, qualities: qualities(r), residual: loss(r, target, opts.weights) };
}
