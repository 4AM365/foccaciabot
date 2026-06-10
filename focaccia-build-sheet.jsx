import React, { useState, useMemo, useContext } from "react";

// ============================================================================
// Focaccia Dashboard — drive the *qualities* (open crumb, tang, flake, fried
// crust…) and the *style*; the recipe and process regenerate live. Baker's
// percentages are all relative to total flour = 100%.
//
// The science behind each dial is drawn from the repo's reference corpus
// (Cauvain & Young, Technology of Breadmaking; McGee, On Food and Cooking;
// Bressanini, La scienza della pasticceria) — see data/chunks.jsonl. Styles and
// traditional toppings are baking-tradition knowledge, not from the corpus.
// ============================================================================

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,800;9..144,900&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
@keyframes riseIn { from { opacity:0; transform: translateY(10px);} to {opacity:1; transform:none;} }
`;

// ---- Theming ---------------------------------------------------------------
// Same keys in both palettes. `onAccent` is light in BOTH themes — it's the
// text/icon colour placed on olive/oliveDeep/rust accent surfaces.
const THEMES = {
  light: {
    paper: "#f4ece0", paperDeep: "#ebe0cf", ink: "#2b2218", inkSoft: "#5a4d3a",
    olive: "#5c6b2f", oliveDeep: "#404d1f", rust: "#a8431d", crust: "#c8801f",
    line: "#cdbfa6", card: "#fbf6ec", onAccent: "#f7efe2",
    glow: "radial-gradient(circle at 20% 10%, rgba(168,67,29,0.05), transparent 40%), radial-gradient(circle at 85% 0%, rgba(92,107,47,0.06), transparent 45%)",
    brineBg: "rgba(168,67,29,0.07)",
  },
  dark: {
    paper: "#17130e", paperDeep: "#211b14", ink: "#efe6d6", inkSoft: "#a99a82",
    olive: "#94a557", oliveDeep: "#2d3717", rust: "#e27d47", crust: "#e0a647",
    line: "#3a322a", card: "#221c16", onAccent: "#f7efe2",
    glow: "radial-gradient(circle at 20% 10%, rgba(226,125,71,0.10), transparent 42%), radial-gradient(circle at 85% 0%, rgba(148,165,87,0.10), transparent 45%)",
    brineBg: "rgba(226,125,71,0.10)",
  },
};
const ThemeCtx = React.createContext(THEMES.light);
const useC = () => useContext(ThemeCtx);

// ---- Fixed (non-dialed) percentages --------------------------------------
const BRINE_WATER = 5;   // salamoia — poured into the dimples
const BRINE_OIL = 5;     // salamoia oil
const BRINE_SALT = 0.8;  // fine salt dissolved into the salamoia

// Yeast forms and their dosing relative to instant (IDY).
const YEAST_TYPES = {
  instant: { label: "Instant yeast (IDY)", factor: 1, note: "added dry, straight into the flour" },
  active:  { label: "Active dry yeast", factor: 1.25, note: "bloom 5–10 min in a little warm water first" },
  fresh:   { label: "Fresh (cake) yeast", factor: 3, note: "crumble & dissolve in the water first" },
};

// ---- Fermentation schedules: the "tang / yeastiness" axis -----------------
const SCHEDULES = [
  { name: "Same-day", clock: "~2.5 hr", yeast: 2.0, sugar: 0.5,
    tang: "clean & fresh-yeasty", temp: "warm 80–85°F / 27–29°C",
    bulk: "1 hr warm", cold: null, proof: "~1 hr warm" },
  { name: "Overnight", clock: "~16 hr", yeast: 1.0, sugar: 0,
    tang: "gently sour", temp: "1 hr warm, then cold",
    bulk: "1 hr warm → fridge", cold: "12–16 hr", proof: "1–1.5 hr from cold" },
  { name: "Two-day cold", clock: "~48 hr", yeast: 0.6, sugar: 0,
    tang: "pronounced tang", temp: "fridge ferment",
    bulk: "30 min warm → fridge", cold: "36–48 hr", proof: "1.5–2 hr from cold" },
  { name: "Three-day cold", clock: "~72 hr", yeast: 0.4, sugar: 0,
    tang: "deep, sour-edged", temp: "fridge ferment",
    bulk: "30 min warm → fridge", cold: "60–72 hr", proof: "~2 hr from cold" },
];

// ---- Styles: curated presets that drive every dial at once -----------------
// `cat` groups the buttons. Every style here is one the dial model can render
// faithfully (yeasted, oil-based). Famous focacce that need a *different*
// method — unleavened, sweet, enriched — live in OFF_MODEL below, described
// honestly rather than faked with the dials.
const STYLES = [
  // ---- The house ----
  { id: "flaky", cat: "The house", name: "Flaky (hot-rod)", tag: "laminated · fried",
    blurb: "The house build: a 3-day cold ferment, oiled lamination folds for a shreddy pull, and a deep pan-fry. Dough kept lean so the fat works the layers and the base, not the crumb.",
    set: { hydration: 82, schIdx: 3, folds: 3, panOilPct: 10, doughOilPct: 0, saltPct: 2.4, semolinaPct: 5, twoPans: true } },
  { id: "sameday", cat: "The house", name: "Same-day", tag: "weeknight",
    blurb: "Two hours, start to bake. Balanced and lightly enriched, leaning on warmth and a touch more yeast — no long ferment, no fuss.",
    set: { hydration: 78, schIdx: 0, folds: 1, panOilPct: 8, doughOilPct: 4, saltPct: 2.3, semolinaPct: 0, twoPans: false } },

  // ---- Classic Italian ----
  { id: "genovese", cat: "Classic Italian", name: "Genovese", tag: "classic Ligurian",
    blurb: "The archetype. Thinner and oily, with ~6% oil worked into a tender crumb and a briny salamoia pooled in the dimples. Pillowy, not flaky; made same-day.",
    set: { hydration: 72, schIdx: 0, folds: 0, panOilPct: 9, doughOilPct: 6, saltPct: 2.0, semolinaPct: 0, twoPans: false } },
  { id: "romana", cat: "Classic Italian", name: "Romana alla pala", tag: "light · airy",
    blurb: "Long, cold-fermented and very wet — a tall, wildly open, custardy crumb with a crisp, blistered top. Lean and restrained; the ferment does the flavour.",
    set: { hydration: 85, schIdx: 3, folds: 0, panOilPct: 7, doughOilPct: 3, saltPct: 2.4, semolinaPct: 5, twoPans: false } },
  { id: "barese", cat: "Classic Italian", name: "Pugliese · Barese", tag: "semola · tomato",
    blurb: "Durum-semolina dough (golden, sandy crust), high hydration, classically studded with cherry tomatoes, olives and oregano. A southern, rustic loaf.",
    set: { hydration: 80, schIdx: 1, folds: 0, panOilPct: 9, doughOilPct: 4, saltPct: 2.2, semolinaPct: 15, twoPans: true } },

  // ---- Regional & obscure ----
  { id: "sardenaira", cat: "Regional & obscure", name: "Sardenaira", tag: "Sanremo · anchovy",
    blurb: "Sanremo's tomato focaccia — a.k.a. pizza all'Andrea. A leavened flatbread spread with a garlicky tomato sauce, then studded with Taggiasca olives, salt-packed anchovies, capers and oregano. The Ligurian western-Riviera answer to pizza.",
    set: { hydration: 70, schIdx: 1, folds: 0, panOilPct: 8, doughOilPct: 3, saltPct: 2.2, semolinaPct: 0, twoPans: false } },
  { id: "sfincione", cat: "Regional & obscure", name: "Sfincione", tag: "Palermo · spongy",
    blurb: "Palermo's thick, spongy street focaccia. A soft, high-hydration crumb under a sauce of onion, tomato and anchovy with caciocavallo — finished with toasted breadcrumbs (pangrattato) on top instead of cheese. Pillowy and savoury, sold by the slab.",
    set: { hydration: 80, schIdx: 1, folds: 0, panOilPct: 9, doughOilPct: 5, saltPct: 2.2, semolinaPct: 0, twoPans: false } },
  { id: "messinese", cat: "Regional & obscure", name: "Focaccia messinese", tag: "Messina · escarole",
    blurb: "From Messina: a Sicilian focaccia layered with tuma cheese, curly endive (scarola), anchovies and a little tomato. Rich and green-bitter, a cousin of the sfincione baked soft and deep.",
    set: { hydration: 75, schIdx: 1, folds: 0, panOilPct: 8, doughOilPct: 4, saltPct: 2.2, semolinaPct: 0, twoPans: false } },
  { id: "schiacciata", cat: "Regional & obscure", name: "Schiacciata toscana", tag: "Tuscan · thin",
    blurb: "Tuscany's 'squashed' bread. Thinner, crisper and leaner than its northern cousins: rolled low, dimpled, heavily oiled and salted, usually just rosemary. The savoury sibling of the sweet schiacciata all'uva.",
    set: { hydration: 66, schIdx: 0, folds: 0, panOilPct: 8, doughOilPct: 3, saltPct: 2.0, semolinaPct: 0, twoPans: false } },
  { id: "pizzabianca", cat: "Regional & obscure", name: "Pizza bianca romana", tag: "Rome · blistered",
    blurb: "Roman pizza bianca — a long, wildly blistered, very wet dough stretched on the peel, slicked with oil and salt and torn warm. Lean and long-fermented; the bakery staple that becomes pizza rossa with a swipe of tomato.",
    set: { hydration: 85, schIdx: 2, folds: 0, panOilPct: 7, doughOilPct: 2, saltPct: 2.3, semolinaPct: 0, twoPans: false } },
  { id: "pinsa", cat: "Regional & obscure", name: "Pinsa romana", tag: "oval · airy",
    blurb: "The modern Roman pinsa: an oval, ultra-light flatbread from a blend of wheat, rice and soy flours at very high hydration and a 48–72 hr cold rise — crisp shell, cloud crumb, famously digestible. The dials model the method; the rice/soy blend (~20%) you'd swap in yourself.",
    set: { hydration: 85, schIdx: 3, folds: 0, panOilPct: 6, doughOilPct: 3, saltPct: 2.4, semolinaPct: 0, twoPans: false } },
  { id: "fougasse", cat: "Regional & obscure", name: "Fougasse provençale", tag: "France · leaf",
    blurb: "Provence's fougasse — the French focaccia, slashed into a leaf or ladder so it's nearly all crust. Olive oil, herbes de Provence, often olives or lardons. Lower hydration so the open lattice holds its shape.",
    set: { hydration: 70, schIdx: 1, folds: 0, panOilPct: 7, doughOilPct: 4, saltPct: 2.2, semolinaPct: 0, twoPans: false } },
];
const STYLE_CATS = ["The house", "Classic Italian", "Regional & obscure"];
const STYLE_BY_ID = Object.fromEntries(STYLES.map((s) => [s.id, s]));
const DEFAULT_STYLE = "flaky";
const STYLE_KEYS = ["hydration", "schIdx", "folds", "panOilPct", "doughOilPct", "saltPct", "semolinaPct", "twoPans"];

// Famous focacce the dial model can't represent honestly — they need a wholly
// different method (no yeast, or enriched/sweet). Listed, not faked.
const OFF_MODEL = [
  { name: "Focaccia di Recco (col formaggio)",
    note: "Unleavened: two paper-thin sheets of bare oil-and-flour dough around molten stracchino/crescenza, blistered in a screaming oven. No yeast, no rise — the ferment dials simply don't apply." },
  { name: "Schiacciata all'uva",
    note: "Tuscan harvest sweet: wine grapes, sugar and oil pressed into a lightly sweetened dough and baked into a jammy, seedy slab. A dessert focaccia." },
  { name: "Fugassa veneta",
    note: "Venetian Easter focaccia enriched with eggs, butter, sugar and citrus and proofed tall — closer to panettone than to a salt-and-oil slab." },
];

function matchStyle(cur) {
  const hit = STYLES.find((s) => STYLE_KEYS.every((k) => s.set[k] === cur[k]));
  return hit ? hit.id : "custom";
}

// ---- Traditional toppings & herbs ------------------------------------------
// `styles` = which traditions a topping is classic for (drives the badge).
// `short` = one-line prep (always shown in the table). `prep` = full method
// (shown in the process step at Detailed verbosity). `prepSteps` = the tickable
// mise-en-place checklist. `water:true` flags a topping that weeps moisture into
// the crumb (cherry tomatoes) so it can be folded into effective hydration.
const TOPPINGS = [
  { id: "rosemary", icon: "🌿", label: "Rosemary", styles: ["flaky", "genovese", "romana", "barese", "sameday", "schiacciata", "pizzabianca", "fougasse"],
    short: "needles pressed in & oiled at dimpling",
    prep: "Strip the needles (or keep small sprigs). Press them into the dough at dimpling and coat with the brine oil so they don't scorch — woody herbs burn fast on top of a 230–260°C bake.",
    prepSteps: ["Strip needles or keep small sprigs", "Press into the dough at dimpling", "Coat with brine oil so they don't scorch"] },
  { id: "tomato", icon: "🍅", label: "Cherry tomatoes", styles: ["flaky", "barese", "sameday", "sardenaira", "sfincione", "messinese"],
    short: "halved, cut-side up in the wells", water: true,
    prep: "Halve and press cut-side up into the wells at dimpling so they roast in the oil rather than steam. For deeper flavour, smash & roast them first — that concentrates the glutamate and sugars and builds Maillard browning — then add for the 450°F phase, slicked with brine oil so the already-caramelised sugars don't scorch. Either way they're ~95% water and weep into the crumb, so account for that in your hydration (see the tomato panel).",
    prepSteps: ["Halve the tomatoes", "Press cut-side up into the oiled wells", "Slick with brine oil before baking"] },
  { id: "olives", icon: "🫒", label: "Olives", styles: ["genovese", "barese", "sardenaira", "fougasse"],
    short: "pitted, patted dry, pressed in",
    prep: "Use good brined olives (Taggiasca, Cerignola), pitted and patted dry so surface brine doesn't make wet spots. Press them into the dough at dimpling.",
    prepSteps: ["Pit good brined olives (Taggiasca / Cerignola)", "Pat dry so brine doesn't wet the dough", "Press in at dimpling"] },
  { id: "anchovy", icon: "🐟", label: "Anchovies", styles: ["sardenaira", "sfincione", "messinese"],
    short: "rinsed, boned, laid in the sauce",
    prep: "Salt-packed anchovies are best: rinse off the salt, fillet and bone them (oil-packed work too — just pat off the excess). Lay them into the tomato/onion sauce or straight onto the oiled dough, where they dissolve and season the whole slab rather than sitting as fish on top.",
    prepSteps: ["Rinse salt-packed fillets (or pat oil-packed dry)", "Bone and split into fillets", "Lay into the sauce / on the dough before baking"] },
  { id: "capers", icon: "🧂", label: "Capers", styles: ["sardenaira"],
    short: "rinsed, scattered before baking",
    prep: "Rinse salt- or brine-packed capers to tame the punch, pat them dry, and scatter over the sauce before baking — classic in sardenaira alongside the olives and anchovy.",
    prepSteps: ["Rinse off the packing salt / brine", "Pat dry", "Scatter over the sauce before baking"] },
  { id: "onion", icon: "🧅", label: "Red onion", styles: ["barese", "sameday", "sfincione"],
    short: "thin, oiled, scattered at dimpling",
    prep: "Slice thin, then toss with a little oil and a pinch of salt to soften and shield from burning (a 10-min cold-water soak tames the bite). Scatter at dimpling — thin slices crisp, thick ones steam. For sfincione, slow-cook them down into the sauce first.",
    prepSteps: ["Slice thin", "(optional) 10-min cold-water soak to tame the bite", "Toss with oil + a pinch of salt", "Scatter at dimpling"] },
  { id: "cheese", icon: "🧀", label: "Soft cheese", styles: ["sfincione", "messinese"],
    short: "cubed/torn, tucked in late",
    prep: "Caciocavallo or tuma for the Sicilian styles (stracchino if you're chasing a Recco-style ooze). Cube or tear it and tuck it in toward the end of the bake so it melts through without weeping oil and scorching.",
    prepSteps: ["Cube or tear the cheese", "Add for the cooler second bake phase", "Let it melt — don't let it brown hard"] },
  { id: "breadcrumbs", icon: "🍞", label: "Toasted breadcrumbs", styles: ["sfincione"],
    short: "pangrattato showered on top",
    prep: "The sfincione signature: toast coarse breadcrumbs in olive oil until golden, then shower them over the sauced top (and again after baking) for a savoury, crunchy crust in place of cheese on top.",
    prepSteps: ["Toast coarse crumbs in olive oil till golden", "Shower over the sauced top before baking", "Add a second handful after the bake"] },
  { id: "escarole", icon: "🥬", label: "Escarole / endive", styles: ["messinese"],
    short: "wilted, squeezed dry, layered",
    prep: "Curly endive or escarole (scarola) for focaccia messinese: blanch or wilt it, squeeze it very dry, and layer it with the cheese and anchovy. Wet greens steam the crumb, so the squeeze is the whole game.",
    prepSteps: ["Wilt or blanch the greens", "Squeeze very dry", "Layer with cheese and anchovy"] },
  { id: "garlic", icon: "🧄", label: "Garlic (in the oil)", styles: ["flaky", "genovese", "romana", "barese", "sameday", "sardenaira", "sfincione"],
    short: "infused into the oil, never raw on top",
    prep: "Don't scatter raw garlic on top — it burns bitter. Warm crushed cloves gently in the pan/brine oil to infuse, then lift them out; brush the infused oil over before baking and again, warm, after.",
    prepSteps: ["Crush the cloves", "Warm gently in the pan/brine oil to infuse", "Lift the cloves out", "Brush the infused oil on before and after baking"] },
  { id: "oregano", icon: "🌱", label: "Oregano (dried)", styles: ["barese", "sardenaira", "sfincione"],
    short: "dried, scattered with the tomatoes",
    prep: "Dried oregano scattered with the tomatoes at dimpling — classic Barese and Sicilian. Dried stands up to oven heat; fresh oregano scorches.",
    prepSteps: ["Use dried, not fresh", "Scatter with the tomatoes at dimpling"] },
];
const VERBOSITY = ["Terse", "Standard", "Detailed"];

// Cherry tomatoes are ~95% water. These are the fractions of their weight that
// realistically weep into the crumb during the bake — raw halves dump more;
// smashing & roasting first drives off some water but you spread the concentrated
// pulp right onto the dough, so it still meaningfully wets it.
const TOMATO_WATER = { raw: 0.5, roast: 0.3 };
const TOMATO_MODES = { raw: "Halved, raw", roast: "Smash & roast" };

function round(n, dp = 0) {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------
function Num({ children, color }) {
  return <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color }}>{children}</span>;
}

function Toggle({ on, onClick, label, sub }) {
  const C = useC();
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
      background: on ? C.olive : "transparent", color: on ? C.onAccent : C.ink,
      border: `1.5px solid ${on ? C.olive : C.line}`, borderRadius: 10, padding: "12px 14px",
      cursor: "pointer", transition: "all .18s ease", fontFamily: "'Fraunces', serif" }}>
      <span style={{ width: 34, height: 20, borderRadius: 20, background: on ? C.onAccent : C.line, position: "relative", flexShrink: 0, transition: "background .18s ease" }}>
        <span style={{ position: "absolute", top: 2, left: on ? 16 : 2, width: 16, height: 16, borderRadius: "50%", background: on ? C.olive : C.card, transition: "left .18s ease" }} />
      </span>
      <span style={{ lineHeight: 1.2 }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{label}</span>
        {sub && <span style={{ display: "block", fontSize: 12, opacity: 0.75, fontFamily: "'IBM Plex Mono', monospace" }}>{sub}</span>}
      </span>
    </button>
  );
}

// A labelled slider with a live readout, lo↔hi captions, and an expandable
// "why" science note. `stops` (optional) renders discrete tick labels.
function Dial({ label, value, min, max, step, onChange, readout, lo, hi, stops, why, accent }) {
  const C = useC();
  const [open, setOpen] = useState(false);
  const col = accent ? C.rust : C.olive;
  return (
    <div style={{ background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: "13px 15px 11px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{label}</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: col, fontWeight: 600, whiteSpace: "nowrap" }}>{readout}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: col, margin: "9px 0 2px" }} />
      {stops ? (
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkSoft }}>
          {stops.map((s, i) => (
            <span key={s} style={{ color: i === value ? col : C.inkSoft, fontWeight: i === value ? 600 : 400, textAlign: "center", flex: 1 }}>{s}</span>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.inkSoft }}>
          <span>{lo}</span><span>{hi}</span>
        </div>
      )}
      {why && (
        <>
          <button onClick={() => setOpen((o) => !o)} style={{ marginTop: 7, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: col, fontWeight: 600, letterSpacing: 0.5 }}>
            {open ? "− why" : "ⓘ why"}
          </button>
          {open && <div style={{ marginTop: 5, fontSize: 13, lineHeight: 1.5, color: C.inkSoft, animation: "riseIn .2s ease" }}>{why}</div>}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Process generator — steps adapt to schedule, lamination, hydration, yeast,
// toppings and verbosity. `more` is extra detail surfaced only at Detailed.
// ---------------------------------------------------------------------------
function buildSteps({ sch, schIdx, folds, hydration, panOilPct, doughOilPct, semolina, yeastType, toppings, verbosity, tomato }) {
  const express = schIdx === 0;
  const ddt = express ? "26–27°C / 79–81°F" : "24–25°C / 75–77°F";
  const yt = YEAST_TYPES[yeastType] || YEAST_TYPES.instant;
  const bloom = yeastType === "instant"
    ? ""
    : ` You're on ${yt.label.toLowerCase()}, so first ${yt.note} (take it from the recipe water) until it's foamy — then carry on.`;
  const oilNote = doughOilPct > 0
    ? ` Once the dough is cohesive, drizzle in the ${round(doughOilPct, 1)}% dough oil and mix until it's fully absorbed and glossy again — adding it after the gluten has formed keeps the oil from coating the proteins and blunting development.`
    : "";
  const handling = hydration >= 84 ? "very slack and glossy — work it with wet hands"
    : hydration >= 76 ? "slack but cohesive" : "supple and easy to handle";
  const hot = panOilPct >= 10;

  const steps = [];

  if (express) {
    steps.push({ title: "Fermentolyse — warm", spec: `ALL flour + all WARM water (95–100°F / 35–38°C) + yeast (${round(sch.yeast * yt.factor, 2)}%) + sugar · rest 20 min · then salt`,
      why: `On a 2-hour clock you want fermentation from minute one. Mix everything but the salt with warm water and rest 20 min, covered: the flour fully hydrates (free extensibility) and the warm water wakes the yeast immediately. Hold the salt — it tightens gluten and slows yeast, blunting the fast start you need here.${bloom}`,
      more: `Aim to finish the dough around ${ddt} — warm, so it drives.` });
    steps.push({ title: "Mix & develop", spec: `dough hook · low speed · 6–8 min · target dough temp ${ddt}`,
      why: `Add the salt now, then develop a moderate, cohesive gluten net — enough to trap gas fast and hold the layers. At ${hydration}% the dough is ${handling}.${oilNote}`,
      more: `Watch the temperature: glossy and clearing the bowl, not over-beaten past ~28°C/82°F. Friction heats a fast dough quickly.` });
    steps.push({ title: "Warm bulk + oiled folds — the 1 hr rise", spec: `${sch.temp} · ${folds > 0 ? `${folds} oiled letter-fold${folds > 1 ? "s" : ""}` : "2 plain folds"} at 20 & 40 min · keep it covered`,
      why: `This one warm hour does the long ferment's job — heat plus the elevated yeast drive the gas fast. Keep the bowl covered between folds so the surface doesn't skin. ${folds > 0 ? "Drizzling oil before each fold means the same folds also build the flaky layers — strength and lamination collapsed into the bulk." : "Plain folds just build strength for a classic pillowy crumb."}`,
      more: `Pull it when it's puffy and jiggly with a bubble or two showing — readiness rules, not the clock; give it 15–20 min more if it's sluggish.` });
  } else {
    steps.push({ title: "Autolyse", spec: "ALL flour + all dough water · mix to shaggy · cover · rest 30–45 min",
      why: `Mix flour and water to a shaggy mass with no dry flour, cover, and walk away. Every bit of flour hydrates and the flour's own enzymes start reorganizing gluten — extensibility and structure for free, with far less mixing. Cover it so the top can't dry. Hold yeast and salt for now.${bloom}` });
    steps.push({ title: "Mix in yeast + salt; develop", spec: `add yeast, then salt · dough hook · low · 6–8 min · target dough temp ${ddt}`,
      why: `Work in the yeast first, then the salt (added last so it doesn't fight the yeast or over-tighten early). Build a moderate, well-organized matrix — strong enough to trap gas and hold lamination, loose enough to stay extensible. At ${hydration}% it pulls off the hook ${handling}; stop when cohesive, not bone-dry.${oilNote}`,
      more: `Finishing near ${ddt} sets a controlled, even cold ferment rather than a runaway one.` });
    steps.push({ title: "Bulk start + strength folds", spec: "3–4 coil/letter folds · 30 min apart · ~2 hr warm, covered",
      why: `With wet hands, fold every 30 min over the first couple of warm hours, keeping the bowl covered between sets. Each fold re-tensions the gluten and redistributes gas and yeast food, turning a slack puddle into a structured mass.`,
      more: `Build it to roughly 30–50% risen before it goes cold — enough life to carry the long retard without exhausting.` });
    steps.push({ title: "Cold fermentation", spec: `cover airtight · ${sch.cold} in the fridge · ${sch.name}`,
      why: `The cold retard is where flavour and texture are won (Cauvain, Ch.2: fermentation drives bread flavour). Slow, cold fermentation builds organic acids and complex aroma — ${sch.tang} — while the gluten relaxes into a uniform, extensible, lamination-ready dough.`,
      more: `Cover it airtight: cold fridge air skins the surface and the dough picks up off-flavours otherwise. Leave headroom; it keeps rising for the first hour before it chills.` });
    if (folds > 0) {
      steps.push({ title: "Laminate — the flaky trick", spec: `stretch thin · drizzle oil · letter-fold ×${folds} · rest 15 between`,
        why: `Straight from the fridge (cold dough stretches thinnest without tearing), gently stretch to a large rectangle, drizzle oil, and letter-fold ${folds} time${folds > 1 ? "s" : ""}. The thin oil films become internal partitions that shred and tear when baked — light lamination, not croissant layers, just enough for a dramatic flaky pull.`,
        more: `The 15-min covered rests let the gluten relax so you can re-stretch without tearing.` });
    }
  }

  steps.push({ title: "Pan it · let it relax", spec: `dark metal pan · all the pan oil (${panOilPct}%) · ease toward the corners, don't force`,
    why: `Flood a dark metal pan (it absorbs heat hard and fries the base into a crisp shell — glass or shiny pans won't) with all the pan oil, and turn the dough in to coat top and bottom. Don't fight it into the corners while it's tight or cold — let it relax 20–30 min and spread on its own, then coax it out; forced now, it springs back and tears.` });

  steps.push({ title: "Final proof — covered", spec: `${sch.proof} · proof until very bubbly, domed & jiggly · cover, no skin`,
    why: `Proof until visibly alive — domed, blistered, wobbling when nudged, a slow-springing poke. Keep it covered so the surface can't skin over: a dry skin resists your dimples, blunts oven spring and bakes leathery (Cauvain, Ch.4/5: prevent skinning; provers run high humidity). Err slightly past full proof; under-proofed focaccia bakes dense and tight.`,
    more: `The pan oil films the top and buys you slack, but once it's puffy use a cover that doesn't touch the dough — an inverted tub, box or second pan — so it won't stick and deflate the bubbles.` });

  steps.push({ title: "Dimple + brine", spec: `oil fingers · press nearly to the pan bottom · brine (≈1:1 water:oil + ${BRINE_SALT}% salt) into the wells`,
    why: `Oil your fingers and drive them straight down almost to the pan — aggressive dimples make the lunar-landscape surface and set high ridges that crunch against soft valleys (shy dimples just bake out). Whisk the salamoia — roughly equal parts water and oil with the fine salt dissolved in — and spoon it so it pools in the wells; the water steams off and concentrates salt and oil into crisp, seasoned pockets.${toppings.length ? " Add your toppings now — see the next step." : ""}` });

  if (tomato && tomato.on && tomato.mode === "roast") {
    steps.push({ title: "Smash & roast the tomatoes — ahead of time", spec: `${round(tomato.load)}g cherry tomatoes · halved · 200°C/400°F until collapsed & jammy`,
      why: `Halve the tomatoes, toss with oil and salt, and roast until they collapse and caramelise — this concentrates their glutamate and sugars and builds Maillard depth you can't get from raw fruit in a 20-minute bake. Do it while the dough cold-ferments; cool before they touch the dough.`,
      more: `Roasting drives off a lot of water, but you then spread the concentrated pulp straight onto the dough — so it still wets the crumb. That's already folded into the effective-hydration figure below.` });
  }

  if (toppings.length) {
    const lines = toppings.map((t) => `${t.icon} ${t.label} — ${verbosity >= 2 ? t.prep : t.short}`).join("\n");
    const tomatoNote = tomato && tomato.on
      ? `\n\nNote on the tomatoes: at ${tomato.pct}% of flour (${round(tomato.load)}g), ${tomato.mode === "roast" ? "smashed & roasted" : "raw halves"} weep ≈${round(tomato.water)}g of water into the crumb — that pushes effective hydration from ${hydration}% to ≈${round(tomato.eff)}%. If you want to hold the ${hydration}% crumb, pull the dough water back to ≈${round(tomato.suggested)}% (the tomato panel up top does the math live).`
      : "";
    steps.push({ title: "Top it", spec: toppings.map((t) => t.label).join(" · "),
      why: lines + tomatoNote,
      more: "Hardy aromatics (rosemary) go on pressed-in and oiled so they don't scorch; finish everything with flaky salt. Anything sugary or already-roasted is happiest added for the cooler second phase." });
  }

  steps.push({ title: "Bake — hot, dry, low rack", spec: `fully preheated · lower third (or on a steel) · 500°F/260°C · 8 min → 450°F/232°C · ${hot ? "13–16" : "12–15"} min`,
    why: `Bake in a fully preheated oven on a low rack — or straight onto a preheated steel/stone — to drive the base. The opening blast maximizes oven spring and sears the oiled bottom while the crust sets; controlled, uniform spring is the goal (Cauvain, Ch.1). No steam here — focaccia wants a crisp, fried surface, not a lean crackly crust.`,
    more: `Drop to 450°F to finish the inside and deepen colour without scorching the oil${hot ? "; at this much pan oil, watch the base and pull the moment it's mahogany" : ""}. Rotate halfway for even colour.${semolina ? " The semolina pushes the crust toward a sandy, fracturing crunch." : ""} Done at deep golden-brown with crackling edges — about 96–99°C / 205–210°F inside.` });

  steps.push({ title: "Cool — out of the pan", spec: "lift onto a wire rack within a few minutes · rest ~10 min · serve warm",
    why: `Get it out of the pan and onto a rack within a couple of minutes. Left sitting in the hot pan, steam condenses under the loaf and the crisp, fried base you just built turns soft and soggy. A wire rack lets air circulate so the bottom stays shatter-crisp.`,
    more: `Rest ~10 minutes so the crumb sets, then eat it warm — focaccia is best the day it's baked.` });

  return steps.map((s, i) => ({ ...s, n: String(i + 1).padStart(2, "0") }));
}

// ---------------------------------------------------------------------------
export default function FocacciaBuildSheet() {
  const D0 = STYLE_BY_ID[DEFAULT_STYLE].set;
  // master scale
  const [flour, setFlour] = useState(500);
  // quality dials (initialised from the default style)
  const [hydration, setHydration] = useState(D0.hydration);
  const [schIdx, setSchIdx] = useState(D0.schIdx);
  const [folds, setFolds] = useState(D0.folds);
  const [panOilPct, setPanOilPct] = useState(D0.panOilPct);
  const [doughOilPct, setDoughOilPct] = useState(D0.doughOilPct);
  const [saltPct, setSaltPct] = useState(D0.saltPct);
  const [semolinaPct, setSemolinaPct] = useState(D0.semolinaPct);
  // options
  const [twoPans, setTwoPans] = useState(D0.twoPans);
  const [yeastType, setYeastType] = useState("instant");
  const [toppingSel, setToppingSel] = useState({ rosemary: true });
  const [tomatoMode, setTomatoMode] = useState("raw"); // raw | roast
  const [tomatoPct, setTomatoPct] = useState(20);       // cherry tomatoes as % of flour
  const [prepDone, setPrepDone] = useState({});         // mise-en-place checklist
  const [verbosity, setVerbosity] = useState(1);
  const [dark, setDark] = useState(false);
  const [openStep, setOpenStep] = useState("01");

  const C = dark ? THEMES.dark : THEMES.light;

  function applyStyle(id) {
    const s = STYLE_BY_ID[id];
    if (!s) return;
    const k = s.set;
    setHydration(k.hydration); setSchIdx(k.schIdx); setFolds(k.folds);
    setPanOilPct(k.panOilPct); setDoughOilPct(k.doughOilPct);
    setSaltPct(k.saltPct); setSemolinaPct(k.semolinaPct); setTwoPans(k.twoPans);
  }
  const toggleTopping = (id) => setToppingSel((t) => ({ ...t, [id]: !t[id] }));
  const togglePrep = (key) => setPrepDone((p) => ({ ...p, [key]: !p[key] }));
  const activeStyle = matchStyle({ hydration, schIdx, folds, panOilPct, doughOilPct, saltPct, semolinaPct, twoPans });
  const selectedToppings = TOPPINGS.filter((t) => toppingSel[t.id]);

  const f = Math.max(0, Number(flour) || 0);
  const sch = SCHEDULES[schIdx];
  const express = schIdx === 0;

  // Cherry tomatoes weep water into the crumb — fold it into effective hydration.
  const tomatoOn = !!toppingSel.tomato;
  const tomatoLoad = f * (tomatoPct / 100);
  const tomatoWater = tomatoOn ? tomatoLoad * TOMATO_WATER[tomatoMode] : 0;
  const tomatoWaterPct = f > 0 ? (tomatoWater / f) * 100 : 0;
  const effHydration = hydration + tomatoWaterPct;          // crumb sees this much water
  const suggestedHyd = Math.max(0, hydration - tomatoWaterPct); // dial here to hold target
  const tomato = { on: tomatoOn, mode: tomatoMode, pct: tomatoPct, load: tomatoLoad,
    water: tomatoWater, eff: effHydration, suggested: suggestedHyd };

  const v = useMemo(() => {
    const sem = f * (semolinaPct / 100);
    const breadFlour = f - sem;
    const water = f * (hydration / 100);
    const salt = f * (saltPct / 100);
    const yFactor = (YEAST_TYPES[yeastType] || YEAST_TYPES.instant).factor;
    const yeastPctEff = sch.yeast * yFactor;
    const yeast = f * (yeastPctEff / 100);
    const sugar = f * (sch.sugar / 100);
    const panOil = f * (panOilPct / 100);
    const doughOil = f * (doughOilPct / 100);
    const foldOilPct = folds;
    const foldOil = f * (foldOilPct / 100);
    const brineWater = f * (BRINE_WATER / 100);
    const brineOil = f * (BRINE_OIL / 100);
    const brineSalt = f * (BRINE_SALT / 100);
    const doughWeight = f + water + salt + yeast + sugar + doughOil;
    const totalOil = panOil + doughOil + foldOil + brineOil;
    return { sem, breadFlour, water, salt, yeast, yeastPctEff, sugar, panOil, doughOil, foldOil, foldOilPct, brineWater, brineOil, brineSalt, doughWeight, totalOil };
  }, [f, hydration, saltPct, semolinaPct, panOilPct, doughOilPct, folds, sch, yeastType]);

  const groups = [
    { title: "Dough", items: [
      { k: "Bread flour", g: round(v.breadFlour), pct: round(100 - semolinaPct, 1) },
      ...(semolinaPct > 0 ? [{ k: "Semolina", g: round(v.sem), pct: round(semolinaPct, 1), accent: true }] : []),
      { k: express ? "Water — warm, 95–100°F" : "Water", g: round(v.water), pct: hydration },
      { k: "Salt", g: round(v.salt, 1), pct: round(saltPct, 1) },
      { k: YEAST_TYPES[yeastType].label, g: round(v.yeast, 2), pct: round(v.yeastPctEff, 2), accent: express,
        note: yeastType === "instant" ? (express ? "bumped for the short clock" : "low — the ferment does the work") : YEAST_TYPES[yeastType].note },
      ...(v.sugar > 0 ? [{ k: "Sugar or honey", g: round(v.sugar, 1), pct: sch.sugar, note: "jump-starts the yeast" }] : []),
      { k: "Olive oil — in the dough", g: round(v.doughOil), pct: round(doughOilPct, 1),
        note: doughOilPct === 0 ? "none — Ligurian-style, oil stays outside the dough" : "softens crumb · tenderises gluten · added after mixing" },
    ] },
    { title: "Pan & folds", caption: "the oil that fries the base + laminates the layers", items: [
      { k: "Olive oil — pan", g: round(v.panOil), pct: panOilPct, note: "floods the dark pan" },
      ...(v.foldOil > 0 ? [{ k: "Olive oil — folds", g: round(v.foldOil), pct: round(v.foldOilPct, 1), note: `drizzled across ${folds} letter-fold${folds > 1 ? "s" : ""}` }]
        : [{ k: "Olive oil — folds", g: null, pct: null, note: "no lamination at this setting" }]),
    ] },
    { title: "Brine — salamoia", caption: "whisk together, spoon into the dimples right before baking", brine: true, items: [
      { k: "Water", g: round(v.brineWater), pct: BRINE_WATER, accent: true },
      { k: "Olive oil", g: round(v.brineOil), pct: BRINE_OIL, accent: true },
      { k: "Fine salt — dissolved in", g: round(v.brineSalt, 1), pct: BRINE_SALT, accent: true, note: "whisk in until it disappears" },
      { k: "Flaky salt", g: null, pct: null, note: "to finish, over the top" },
    ] },
    ...(selectedToppings.length ? [{ title: "Toppings & herbs", caption: "to taste · added at dimpling", items: selectedToppings.map((t) => (
      t.id === "tomato"
        ? { k: `${t.icon} ${t.label}`, g: round(tomatoLoad), pct: tomatoPct, accent: true, note: `${TOMATO_MODES[tomatoMode].toLowerCase()} · ≈${round(tomatoWater)}g water into the crumb` }
        : { k: `${t.icon} ${t.label}`, g: null, pct: null, note: t.short }
    )) }] : []),
  ];

  const perPan = twoPans ? v.doughWeight / 2 : v.doughWeight;
  const STEPS = useMemo(() => buildSteps({ sch, schIdx, folds, hydration, panOilPct, doughOilPct, semolina: semolinaPct > 0, yeastType, toppings: selectedToppings, verbosity, tomato }),
    [sch, schIdx, folds, hydration, panOilPct, doughOilPct, semolinaPct, yeastType, toppingSel, verbosity, tomatoOn, tomatoMode, tomatoPct, f]);

  const profile = [
    hydration >= 84 ? "open, custardy crumb" : hydration >= 76 ? "airy, balanced crumb" : "tight, bread-y crumb",
    sch.tang,
    folds === 0 ? "pillowy, no shred" : folds <= 2 ? "light flaky shred" : "deeply flaky, shreddy",
    doughOilPct === 0 ? "lean dough" : doughOilPct >= 6 ? "rich & tender" : "lightly enriched",
    panOilPct >= 10 ? "hard fried base" : panOilPct >= 8 ? "crisp fried base" : "lightly crisp base",
    ...(semolinaPct >= 8 ? ["sandy fracturing crust"] : []),
    saltPct >= 2.6 ? "boldly salted" : saltPct <= 2.0 ? "restrained salt" : "well salted",
    ...(tomatoWater > 0 ? [`≈${round(effHydration)}% effective hydration w/ tomato`] : []),
  ];

  const showWhy = verbosity >= 1;

  return (
    <ThemeCtx.Provider value={C}>
    <div style={{ background: C.paper, minHeight: "100vh", padding: "28px 16px 60px", fontFamily: "'Fraunces', serif", color: C.ink, backgroundImage: C.glow, transition: "background .25s ease, color .25s ease" }}>
      <style>{FONTS}</style>
      <div style={{ maxWidth: 720, margin: "0 auto", animation: "riseIn .5s ease" }}>
        {/* Header */}
        <div style={{ borderBottom: `2px solid ${C.ink}`, paddingBottom: 14, marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: C.rust, fontWeight: 600 }}>
              Focaccia Studio · dial it in
            </div>
            <h1 style={{ margin: "4px 0 0", fontSize: 40, fontWeight: 900, letterSpacing: -1, lineHeight: 0.95 }}>Build Your Focaccia</h1>
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, textAlign: "right", color: C.inkSoft, lineHeight: 1.5 }}>
            <span style={{ color: C.rust, fontWeight: 600 }}>{activeStyle === "custom" ? "Custom build" : STYLE_BY_ID[activeStyle].name}</span><br />
            {hydration}% hydration · {sch.clock}
          </div>
        </div>

        {/* Style selector */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: C.rust, fontWeight: 600, margin: "2px 2px 10px" }}>
            <span>What are we making?</span>
            <span style={{ color: C.inkSoft, letterSpacing: 1 }}>{activeStyle === "custom" ? "custom · off-preset" : "tap to preset every dial"}</span>
          </div>
          {STYLE_CATS.map((cat) => (
            <div key={cat} style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: C.inkSoft, fontWeight: 600, margin: "0 2px 6px" }}>{cat}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
                {STYLES.filter((s) => s.cat === cat).map((s) => {
                  const on = activeStyle === s.id;
                  return (
                    <button key={s.id} onClick={() => applyStyle(s.id)} style={{
                      display: "flex", gap: 9, alignItems: "flex-start", textAlign: "left", cursor: "pointer",
                      borderRadius: 11, padding: "11px 12px", transition: "all .15s ease", fontFamily: "'Fraunces', serif",
                      border: `1.5px solid ${on ? C.olive : C.line}`, background: on ? C.olive : C.card, color: on ? C.onAccent : C.ink }}>
                      <span style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${on ? C.onAccent : C.line}`, flexShrink: 0, marginTop: 2, position: "relative" }}>
                        {on && <span style={{ position: "absolute", inset: 2.5, borderRadius: "50%", background: C.onAccent }} />}
                      </span>
                      <span style={{ lineHeight: 1.25 }}>
                        <span style={{ display: "block", fontWeight: 600, fontSize: 15 }}>{s.name}</span>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, opacity: 0.8 }}>{s.tag}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div style={{ marginTop: 4, fontSize: 14, lineHeight: 1.5, color: C.inkSoft, fontStyle: "italic", borderLeft: `3px solid ${activeStyle === "custom" ? C.line : C.crust}`, paddingLeft: 12 }}>
            {activeStyle === "custom"
              ? "Custom — you've tuned the dials off any single tradition. Pick a style above to snap back to a preset."
              : STYLE_BY_ID[activeStyle].blurb}
          </div>

          {/* Beyond the dials — honest about what this model can't fake */}
          <details style={{ marginTop: 12, background: C.card, border: `1.5px dashed ${C.line}`, borderRadius: 11, padding: "10px 14px" }}>
            <summary style={{ cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, letterSpacing: 0.5, color: C.inkSoft, fontWeight: 600 }}>
              ▸ Beyond the dials — focacce that need a different method
            </summary>
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
              {OFF_MODEL.map((o) => (
                <div key={o.name} style={{ fontSize: 13.5, lineHeight: 1.45, color: C.inkSoft }}>
                  <span style={{ fontWeight: 600, color: C.ink, fontFamily: "'Fraunces', serif" }}>{o.name}</span> — {o.note}
                </div>
              ))}
            </div>
          </details>
        </div>

        {/* Flour master input */}
        <div style={{ background: C.oliveDeep, borderRadius: 14, padding: "20px 22px", color: C.onAccent, marginBottom: 16, boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}>
          <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", opacity: 0.8 }}>
            Total flour — master scale
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
            <input type="number" value={flour} min={0} onChange={(e) => setFlour(e.target.value)}
              style={{ width: 150, fontFamily: "'IBM Plex Mono', monospace", fontSize: 38, fontWeight: 600, background: "transparent", border: "none", borderBottom: `2px solid ${C.crust}`, color: C.onAccent, outline: "none", padding: "2px 0" }} />
            <span style={{ fontSize: 24, opacity: 0.7 }}>grams</span>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            {[400, 500, 700, 1000].map((val) => (
              <button key={val} onClick={() => setFlour(val)}
                style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, padding: "6px 14px", borderRadius: 20, border: `1px solid ${f === val ? C.crust : "rgba(247,239,226,0.35)"}`, background: f === val ? C.crust : "transparent", color: C.onAccent, cursor: "pointer", fontWeight: 600 }}>
                {val}g
              </button>
            ))}
          </div>
        </div>

        {/* The dials */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: C.rust, fontWeight: 600, margin: "4px 2px 10px" }}>
          <span>The dials — tune the loaf</span>
          <span style={{ color: C.inkSoft, letterSpacing: 1 }}>recipe recomputes live</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <Dial label="Crumb — hydration" value={hydration} min={65} max={90} step={1}
            onChange={setHydration} readout={`${hydration}% · ${round(v.water)}g`} lo="tight / bread-y" hi="open / custardy"
            why="Water as a % of flour. Gluten forms from hydration plus kneading energy (Cauvain, Ch.2), and more water gives larger, more irregular holes and a moist, custardy crumb — at the cost of a slacker, wetter-to-handle dough. Below ~70% it bakes tighter and more sandwich-bread-like." />
          <Dial label="Ferment & tang" value={schIdx} min={0} max={3} step={1}
            onChange={setSchIdx} readout={`${sch.name} · ${sch.yeast}% yeast`} stops={["same-day", "night", "2-day", "3-day"]} accent
            why={`The yeastiness/flavour axis. Long, cold fermentation builds organic acids and deep aroma while relaxing the gluten — so it needs less yeast because it works longer (Cauvain, Ch.2). Right now: ${sch.temp}, ${sch.clock} total, ${sch.tang}.`} />
          <Dial label="Flakiness — lamination" value={folds} min={0} max={4} step={1}
            onChange={setFolds} readout={folds === 0 ? "none" : `${folds} oiled fold${folds > 1 ? "s" : ""}`} stops={["0", "1", "2", "3", "4"]}
            why="Letter-folds with oil drizzled between them lay down thin fat films that shred into flaky layers when baked — light lamination, not croissant layers. Zero folds is classic pillowy focaccia; more folds trade some height for a dramatic, tearing pull." />
          <Dial label="Fried base — pan oil" value={panOilPct} min={6} max={12} step={1}
            onChange={setPanOilPct} readout={`${panOilPct}% · ${round(v.panOil)}g`} lo="light fry" hi="deep shallow-fry" accent
            why="Olive oil flooded into a dark metal pan shallow-fries the base into a crisp, blistered shell as it bakes. More oil = a deeper fry and a crunchier, more savoury bottom — push it too far and the very edges can turn greasy, so pair high oil with the longer bake." />
          <Dial label="Dough oil — richness" value={doughOilPct} min={0} max={10} step={0.5}
            onChange={setDoughOilPct} readout={doughOilPct === 0 ? "none" : `${round(doughOilPct, 1)}% · ${round(v.doughOil)}g`} lo="lean / Ligurian" hi="rich / tender"
            why="Olive oil worked into the dough itself. Cauvain (Ch.2, Table 2.2) lists fat at 1–2% of flour as an optional improver that raises gas retention and crumb softness; the fat lubricates and shortens the gluten for a more tender, finer crumb. Focaccia genovese runs ~5%. Add it after the gluten has started forming so it doesn't blunt development." />
          <Dial label="Salt" value={saltPct} min={1.6} max={2.8} step={0.1}
            onChange={setSaltPct} readout={`${round(saltPct, 1)}% · ${round(v.salt, 1)}g`} lo="lean" hi="bold"
            why="Salt seasons, but it also tightens the gluten network and slows the yeast — bakers even delay adding it to speed early fermentation (Cauvain, Ch.2). Higher salt = stronger structure and a slower rise; 2.2–2.5% is the usual focaccia window." />
          <Dial label="Semolina swap" value={semolinaPct} min={0} max={15} step={1}
            onChange={setSemolinaPct} readout={semolinaPct === 0 ? "none" : `${semolinaPct}% · ${round(v.sem)}g`} lo="all bread flour" hi="15% durum"
            why="Swapping in durum semolina adds golden colour and a sandy, fracturing crust. It dilutes the gluten, though, so too much (beyond ~15%) dulls the rise and toughens the crumb." />
        </div>

        {/* Yeast form + two pans */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginBottom: 12 }}>
          <div style={{ background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: "11px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>Yeast form</span>
              <div style={{ display: "flex", gap: 4, background: C.paperDeep, borderRadius: 9, padding: 4 }}>
                {[["instant", "Instant"], ["active", "Active dry"], ["fresh", "Fresh"]].map(([id, label]) => {
                  const on = yeastType === id;
                  return (
                    <button key={id} onClick={() => setYeastType(id)} style={{ border: "none", borderRadius: 7, padding: "6px 11px", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 600, background: on ? C.olive : "transparent", color: on ? C.onAccent : C.inkSoft, transition: "all .15s ease" }}>{label}</button>
                  );
                })}
              </div>
            </div>
            <div style={{ fontSize: 12, color: C.inkSoft, fontFamily: "'IBM Plex Mono', monospace", marginTop: 7 }}>
              {round(v.yeast, 2)}g · {round(v.yeastPctEff, 2)}% — {YEAST_TYPES[yeastType].note}
            </div>
          </div>
          <Toggle on={twoPans} onClick={() => setTwoPans((s) => !s)} label="Split into 2 pans" sub="e.g. cherry-tomato + plain" />
        </div>

        {/* Toppings & herbs */}
        <div style={{ background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: "13px 15px", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 9, flexWrap: "wrap", gap: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Toppings & herbs</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.inkSoft }}>
              {activeStyle === "custom" ? "pick a style to see what's traditional" : `✓ traditional for ${STYLE_BY_ID[activeStyle].name}`}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
            {TOPPINGS.map((t) => {
              const on = !!toppingSel[t.id];
              const trad = activeStyle !== "custom" && t.styles.includes(activeStyle);
              const badge = activeStyle === "custom" ? `classic in ${t.styles.length}` : trad ? "traditional" : "modern twist";
              const badgeCol = trad ? C.olive : C.inkSoft;
              return (
                <button key={t.id} onClick={() => toggleTopping(t.id)} style={{
                  display: "flex", gap: 9, alignItems: "center", textAlign: "left", cursor: "pointer",
                  borderRadius: 10, padding: "9px 11px", transition: "all .15s ease", fontFamily: "'Fraunces', serif",
                  border: `1.5px solid ${on ? C.olive : C.line}`, background: on ? C.olive : "transparent", color: on ? C.onAccent : C.ink }}>
                  <span style={{ width: 17, height: 17, borderRadius: 5, border: `2px solid ${on ? C.onAccent : C.line}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: C.onAccent, lineHeight: 1 }}>
                    {on ? "✓" : ""}
                  </span>
                  <span style={{ lineHeight: 1.2, flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: 14.5 }}>{t.icon} {t.label}</span>
                    <span style={{ display: "block", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, fontWeight: 600, color: on ? C.onAccent : badgeCol, opacity: on ? 0.85 : 1, letterSpacing: 0.3 }}>
                      {trad ? "✓ " : ""}{badge}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Cherry-tomato water → effective hydration */}
          {tomatoOn && (
            <div style={{ marginTop: 11, background: C.brineBg, border: `1.5px solid ${C.rust}`, borderRadius: 11, padding: "12px 14px", animation: "riseIn .2s ease" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{ fontSize: 14.5, fontWeight: 600 }}>🍅 Cherry-tomato water</span>
                <div style={{ display: "flex", gap: 4, background: C.paperDeep, borderRadius: 9, padding: 4 }}>
                  {Object.entries(TOMATO_MODES).map(([id, label]) => {
                    const on = tomatoMode === id;
                    return (
                      <button key={id} onClick={() => setTomatoMode(id)} style={{ border: "none", borderRadius: 7, padding: "6px 11px", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 600, background: on ? C.rust : "transparent", color: on ? C.onAccent : C.inkSoft, transition: "all .15s ease" }}>{label}</button>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.inkSoft, marginBottom: 2 }}>
                <span>tomato load</span>
                <span style={{ color: C.rust, fontWeight: 600 }}>{tomatoPct}% · {round(tomatoLoad)}g</span>
              </div>
              <input type="range" min={0} max={50} step={1} value={tomatoPct} onChange={(e) => setTomatoPct(Number(e.target.value))} style={{ width: "100%", accentColor: C.rust, margin: "4px 0 8px" }} />
              <div style={{ fontSize: 13, lineHeight: 1.5, color: C.inkSoft }}>
                {tomatoMode === "roast"
                  ? "Smashing & roasting drives off some water, but you spread the concentrated pulp straight onto the dough — so it still wets the crumb."
                  : "Raw halves are ~95% water and weep freely into the wells as they bake."}
                {" "}At this load that's ≈<Num color={C.rust}>{round(tomatoWater)}g</Num> of extra water, pushing effective hydration to <Num color={C.rust}>{round(effHydration)}%</Num>.
                {tomatoWater > 0 && <> To hold your <Num color={C.ink}>{hydration}%</Num> crumb, dial the hydration down to <Num color={C.rust}>{round(suggestedHyd)}%</Num> (≈{round(f * suggestedHyd / 100)}g dough water).</>}
              </div>
            </div>
          )}
        </div>

        {/* Mise en place — tickable prep checklist */}
        {selectedToppings.length > 0 && (
          <div style={{ background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: "13px 15px", marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, flexWrap: "wrap", gap: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>Mise en place — topping prep</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.inkSoft }}>tick as you go</span>
            </div>
            <div style={{ fontSize: 12.5, color: C.inkSoft, fontStyle: "italic", marginBottom: 10 }}>Get these done before you dimple — wet or unprepped toppings steam the crumb.</div>
            {selectedToppings.map((t) => {
              const steps = t.id === "tomato" && tomatoMode === "roast"
                ? ["Smash & roast first (200°C/400°F until jammy), then cool", ...t.prepSteps.slice(1)]
                : t.prepSteps;
              return (
                <div key={t.id} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 5 }}>{t.icon} {t.label}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {steps.map((step, i) => {
                      const key = `${t.id}:${i}`;
                      const done = !!prepDone[key];
                      return (
                        <button key={key} onClick={() => togglePrep(key)} style={{
                          display: "flex", gap: 9, alignItems: "flex-start", textAlign: "left", cursor: "pointer",
                          background: "transparent", border: "none", padding: "1px 0", fontFamily: "'Fraunces', serif", color: C.ink }}>
                          <span style={{ width: 16, height: 16, borderRadius: 5, border: `2px solid ${done ? C.olive : C.line}`, background: done ? C.olive : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: C.onAccent, lineHeight: 1, marginTop: 2 }}>{done ? "✓" : ""}</span>
                          <span style={{ fontSize: 13.5, lineHeight: 1.4, color: done ? C.inkSoft : C.ink, textDecoration: done ? "line-through" : "none", opacity: done ? 0.7 : 1 }}>{step}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Display options: verbosity + dark mode */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div style={{ background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: "13px 15px 11px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>Recipe detail</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: C.olive, fontWeight: 600 }}>{VERBOSITY[verbosity]}</span>
            </div>
            <input type="range" min={0} max={2} step={1} value={verbosity} onChange={(e) => setVerbosity(Number(e.target.value))} style={{ width: "100%", accentColor: C.olive, margin: "9px 0 2px" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkSoft }}>
              {VERBOSITY.map((lbl, i) => <span key={lbl} style={{ color: i === verbosity ? C.olive : C.inkSoft, fontWeight: i === verbosity ? 600 : 400, flex: 1, textAlign: "center" }}>{lbl.toLowerCase()}</span>)}
            </div>
          </div>
          <Toggle on={dark} onClick={() => setDark((d) => !d)} label={dark ? "Dark mode" : "Light mode"} sub={dark ? "warm charcoal" : "warm paper"} />
        </div>

        {/* Live profile chips */}
        <div style={{ background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: "13px 15px", marginBottom: 22 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: 1.5, textTransform: "uppercase", color: C.inkSoft, fontWeight: 600, marginBottom: 9 }}>
            This build tastes like
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {profile.map((p, i) => (
              <span key={i} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, padding: "5px 11px", borderRadius: 20, background: C.paperDeep, color: C.olive, fontWeight: 600, border: `1px solid ${C.line}` }}>{p}</span>
            ))}
          </div>
        </div>

        {/* Grouped ingredient table */}
        <div style={{ borderRadius: 14, border: `1.5px solid ${C.line}`, overflow: "hidden", marginBottom: 14, background: C.card }}>
          {groups.map((grp, gi) => (
            <div key={grp.title}>
              <div style={{ padding: "11px 18px 9px", background: grp.brine ? C.brineBg : C.paperDeep, borderTop: gi === 0 ? "none" : `1.5px solid ${C.line}` }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, letterSpacing: 1.5, textTransform: "uppercase", color: grp.brine ? C.rust : C.inkSoft, fontWeight: 600 }}>
                  ▸ {grp.title}
                </div>
                {grp.caption && <div style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 2, fontStyle: "italic" }}>{grp.caption}</div>}
              </div>
              {grp.items.map((r, i) => (
                <div key={r.k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", borderTop: i === 0 ? "none" : `1px solid ${C.paperDeep}` }}>
                  <span style={{ fontSize: 16, fontWeight: 500 }}>
                    {r.k}
                    {r.note && <span style={{ display: "block", fontSize: 11, color: C.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>{r.note}</span>}
                  </span>
                  <span style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {r.pct != null && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: r.accent ? C.rust : C.inkSoft, marginRight: 10 }}>{r.pct}%</span>}
                    {r.g != null ? (
                      <>
                        <Num color={r.accent ? C.rust : C.ink}><span style={{ fontSize: 19 }}>{r.g}</span></Num>
                        <span style={{ fontSize: 13, color: C.inkSoft }}> g</span>
                      </>
                    ) : (
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: C.inkSoft }}>{r.note ? "to taste" : "—"}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Yield summary */}
        <div style={{ display: "flex", gap: 10, marginBottom: 28, flexWrap: "wrap" }}>
          <div style={summaryCard(C)}><div style={summaryLabel(C)}>Total dough</div><div style={summaryVal(C)}>{round(v.doughWeight)}g</div></div>
          <div style={summaryCard(C)}><div style={summaryLabel(C)}>{twoPans ? "Per pan (×2)" : "Single pan"}</div><div style={summaryVal(C)}>{round(perPan)}g</div></div>
          <div style={summaryCard(C)}><div style={summaryLabel(C)}>Total olive oil</div><div style={summaryVal(C)}>{round(v.totalOil)}g</div></div>
          <div style={summaryCard(C)}><div style={summaryLabel(C)}>Suggested pan</div><div style={{ ...summaryVal(C), fontSize: 17 }}>{panHint(perPan)}</div></div>
        </div>

        {/* Process */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: C.rust, fontWeight: 600, marginBottom: 12 }}>
          <span>Process{showWhy ? " — tap for the why" : ""}</span>
          <span style={{ color: C.inkSoft, letterSpacing: 1 }}>{sch.clock}{express ? " + bake" : ""}</span>
        </div>

        {STEPS.map((s) => {
          const open = openStep === s.n;
          return (
            <div key={s.n} style={{ border: `1.5px solid ${open && showWhy ? C.olive : C.line}`, borderRadius: 12, marginBottom: 9, overflow: "hidden", background: open && showWhy ? C.card : "transparent", transition: "border-color .18s ease" }}>
              <button onClick={() => setOpenStep(open ? "" : s.n)} style={{ width: "100%", display: "flex", gap: 14, alignItems: "flex-start", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", padding: "14px 16px", fontFamily: "'Fraunces', serif", color: C.ink }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600, color: open && showWhy ? C.olive : C.crust, paddingTop: 3 }}>{s.n}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ fontSize: 19, fontWeight: 600, display: "block" }}>{s.title}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.inkSoft }}>{s.spec}</span>
                </span>
                {showWhy && <span style={{ fontSize: 20, color: C.olive, transform: open ? "rotate(45deg)" : "none", transition: "transform .2s ease", lineHeight: 1, paddingTop: 2 }}>+</span>}
              </button>
              {open && showWhy && (
                <div style={{ padding: "0 16px 16px 44px", fontSize: 15.5, lineHeight: 1.55, color: C.inkSoft, whiteSpace: "pre-line", animation: "riseIn .25s ease" }}>
                  {s.why}{verbosity >= 2 && s.more ? `\n\n${s.more}` : ""}
                </div>
              )}
            </div>
          );
        })}

        {/* Cherry-tomato pan note */}
        {twoPans && toppingSel.tomato && (
          <div style={{ marginTop: 22, background: C.card, border: `1.5px dashed ${C.rust}`, borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 4 }}>🍅 Cherry-tomato pan</div>
            <div style={{ fontSize: 15, lineHeight: 1.55, color: C.inkSoft }}>
              Press the tomatoes into <em>one</em> pan at dimpling, alongside the brine, so they sit in the oily wells and roast rather than steam.
              Keep the second pan austere — just brine, deep dimples, and flaky salt — so you can taste the crust work against the loaded one.
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 26, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.inkSoft, letterSpacing: 1, lineHeight: 1.6 }}>
          baker's % locked to flour mass · everything scales live<br />
          science notes drawn from the repo reference corpus
        </div>
      </div>
    </div>
    </ThemeCtx.Provider>
  );
}

const summaryCard = (C) => ({ flex: "1 1 130px", background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: "13px 16px" });
const summaryLabel = (C) => ({ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: 1.2, textTransform: "uppercase", color: C.inkSoft, marginBottom: 4 });
const summaryVal = (C) => ({ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 600, color: C.olive });

function panHint(g) {
  if (g <= 0) return "—";
  if (g < 700) return '8×8"';
  if (g < 1100) return '9×13"';
  if (g < 1700) return "quarter sheet";
  return "half sheet";
}
