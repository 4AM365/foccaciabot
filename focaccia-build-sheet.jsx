import React, { useState, useMemo, useContext, useEffect } from "react";
import { QUALITY_AXES, qualities, solveWithin, solveConforming, IDENTITY_KEYS } from "./src/focaccia-model.js";

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

// GeoCities skin stylesheet — injected only when the retro skin is on. Forced
// with !important so it overrides the hardcoded inline fonts/borders without
// rewriting every styled element. `.geo-dark`/`.geo-light` pick the tiled
// background to match the mode toggle.
const GEO_CSS = `
@keyframes geoBlink { 50% { opacity: 0; } }
@keyframes geoRainbow { 0%{color:#ff0040} 20%{color:#ff8c00} 40%{color:#ffe000} 60%{color:#00c853} 80%{color:#2962ff} 100%{color:#aa00ff} }
.geocities, .geocities * { font-family: "Comic Sans MS","Comic Sans","Chalkboard SE",cursive !important; }
.geocities .geo-counter, .geocities .geo-counter * { font-family: "Courier New", monospace !important; }
.geocities button { border-style: outset !important; }
.geocities { background-repeat: repeat !important; }
.geocities.geo-dark { background-image:
  radial-gradient(1.5px 1.5px at 20px 24px,#ffffff,transparent),
  radial-gradient(1px 1px at 64px 52px,#aaeeff,transparent),
  radial-gradient(1.5px 1.5px at 120px 88px,#ffffff,transparent),
  radial-gradient(1px 1px at 150px 30px,#ffd0d0,transparent) !important;
  background-size: 180px 130px !important; }
.geocities.geo-light { background-image:
  radial-gradient(3px 3px at 22px 24px,rgba(255,0,255,0.20),transparent),
  radial-gradient(3px 3px at 92px 70px,rgba(0,0,238,0.16),transparent),
  radial-gradient(3px 3px at 150px 34px,rgba(255,140,0,0.18),transparent) !important;
  background-size: 175px 120px !important; }
.geo-blink { animation: geoBlink 1.1s steps(1) infinite; }
.geo-rainbow { animation: geoRainbow 5s linear infinite; font-weight: 900; }
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
  // GeoCities skin — 1998 palette mapped onto the focaccia accent keys.
  geoLight: {
    paper: "#cfcfee", paperDeep: "#bcbce4", ink: "#000000", inkSoft: "#000080",
    olive: "#ff00ff", oliveDeep: "#c800c8", rust: "#0000ee", crust: "#ff6a00",
    line: "#808080", card: "#ffffcc", onAccent: "#ffffff",
    glow: "none",
    brineBg: "rgba(255,0,255,0.10)",
  },
  geoDark: {
    paper: "#000018", paperDeep: "#000010", ink: "#00ff66", inkSoft: "#33ccff",
    olive: "#ff00ff", oliveDeep: "#aa00aa", rust: "#ffe000", crust: "#ff8c00",
    line: "#5454aa", card: "#0a0a30", onAccent: "#ffffff",
    glow: "none",
    brineBg: "rgba(255,224,0,0.10)",
  },
  // JDM — the blog's default vibe (white / purple), so the widget stays coherent.
  jdmLight: {
    paper: "#ffffff", paperDeep: "#ece9f5", ink: "#1a1730", inkSoft: "#6b6688",
    olive: "#6d28d9", oliveDeep: "#5b21b6", rust: "#7c3aed", crust: "#a78bfa",
    line: "#d8d3ea", card: "#faf9fd", onAccent: "#ffffff",
    glow: "radial-gradient(circle at 20% 10%, rgba(109,40,217,0.05), transparent 40%), radial-gradient(circle at 85% 0%, rgba(167,139,250,0.06), transparent 45%)",
    brineBg: "rgba(109,40,217,0.07)",
  },
  jdmDark: {
    paper: "#14101e", paperDeep: "#26213a", ink: "#f5f3fc", inkSoft: "#9b95b5",
    olive: "#a78bfa", oliveDeep: "#7c3aed", rust: "#c084fc", crust: "#c084fc",
    line: "#3a3358", card: "#1e1830", onAccent: "#14101e",
    glow: "radial-gradient(circle at 20% 10%, rgba(167,139,250,0.10), transparent 42%), radial-gradient(circle at 85% 0%, rgba(192,132,252,0.10), transparent 45%)",
    brineBg: "rgba(167,139,250,0.10)",
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
  { id: "flaky", cat: "The house", name: "Flaky (thatsch a keeper)", tag: "laminated · fried",
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
    blurb: "Durum-semolina dough enriched with boiled potato for a soft, moist crumb; high hydration, classically studded with cherry tomatoes, olives and oregano. A southern, rustic loaf.",
    set: { hydration: 80, schIdx: 1, folds: 0, panOilPct: 9, doughOilPct: 4, saltPct: 2.2, semolinaPct: 15, twoPans: true, potatoPct: 25 } },

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
    blurb: "The modern Roman pinsa: an oval, ultra-light flatbread from a blend of wheat, rice and soy flours at very high hydration and a 48–72 hr cold rise — crisp shell, cloud crumb, famously digestible. The ~20% rice/soy blend is folded into the recipe below.",
    set: { hydration: 85, schIdx: 3, folds: 0, panOilPct: 6, doughOilPct: 3, saltPct: 2.4, semolinaPct: 0, twoPans: false, pinsaBlendPct: 20 } },
  { id: "fougasse", cat: "Regional & obscure", name: "Fougasse provençale", tag: "France · leaf",
    blurb: "Provence's fougasse — the French focaccia, slashed into a leaf or ladder so it's nearly all crust. Olive oil, herbes de Provence, often olives or lardons. Lower hydration so the open lattice holds its shape.",
    set: { hydration: 70, schIdx: 1, folds: 0, panOilPct: 7, doughOilPct: 4, saltPct: 2.2, semolinaPct: 0, twoPans: false } },
];
const STYLE_CATS = ["The house", "Classic Italian", "Regional & obscure"];
const STYLE_BY_ID = Object.fromEntries(STYLES.map((s) => [s.id, s]));
const DEFAULT_STYLE = "flaky";
// Each preset is now a *quality target* (its hand-authored recipe's forward
// qualities); selecting a style drives the sliders and the inverse re-derives a
// matching formula within that style's identity.
STYLES.forEach((s) => { const qq = qualities(s.set); s.q = Object.fromEntries(QUALITY_AXES.map((a) => [a.key, Math.round(qq[a.key])])); });
const identityOf = (set) => Object.fromEntries(IDENTITY_KEYS.map((k) => [k, set[k]]));

// Short, corpus-grounded notes for each quality slider (src/focaccia-model.js CITES).
const QUALITY_WHY = {
  openness: "How open the crumb is. Slack high-hydration water, fermentation gas and oven spring blow big irregular holes; oil tightens it and weak gluten collapses it (Cauvain — mixing & proving).",
  tang: "Clean & fresh vs. deep & sour — set by the ferment schedule. A long cold rise builds organic acids and aroma (Cauvain — breadmaking processes).",
  flake: "Pillowy vs. shreddy. Oiled letter-folds laminate thin fat films into tearing layers — they need gluten to build the sheets.",
  crust: "Soft vs. hard & fried. Pan oil shallow-fries the base crisp, a wet dough blisters, durum bakes a sandy crust; dough oil softens it.",
  richness: "Olive oil — dough oil tenderises the crumb, pan oil enriches the base (Cauvain lists fat as a softening improver).",
  salt: "The salt load — seasons, tightens the gluten and slows the yeast (Cauvain, Ch.2).",
};

// ---- Beyond the dials: fixed recipes -------------------------------------
// These focacce break the dial model — unleavened, or enriched/sweet with eggs,
// butter, sugar and fruit the sliders don't cover. So instead of faking them
// with dials, each carries its own full recipe + method, scaled by the flour
// master input. `bp(f, pct)` is a baker's-percentage gram weight.
const bp = (f, pct, dp = 0) => round(f * pct / 100, dp);
const num = (steps) => steps.map((s, i) => ({ ...s, n: String(i + 1).padStart(2, "0") }));

const SPECIAL_STYLES = [
  { id: "recco", name: "Focaccia di Recco", tag: "unleavened · cheese",
    blurb: "From Recco on the Ligurian coast: NO yeast, no rise. Two paper-thin sheets of bare oil-and-flour dough are stretched translucent around lumps of molten crescenza, sealed, torn for vents, and blistered in a screaming oven. Cracker-crisp and oozing — eaten the instant it leaves the oven.",
    recipe: (f) => ({
      clock: "~45 min",
      profile: ["unleavened", "cracker-thin sheets", "molten crescenza", "blistered & crisp", "ready in ~45 min"],
      groups: [
        { title: "Dough — no yeast", caption: "knead firm & elastic, rest, then stretch paper-thin", items: [
          { k: "Flour (00 or bread)", g: bp(f, 100), pct: 100 },
          { k: "Water", g: bp(f, 50), pct: 50 },
          { k: "Olive oil", g: bp(f, 8), pct: 8, note: "into the dough + more for the surface" },
          { k: "Salt", g: bp(f, 2, 1), pct: 2 },
        ] },
        { title: "Filling — the whole point", caption: "soft, tangy, melts to a pool", brine: true, items: [
          { k: "Crescenza / stracchino", g: bp(f, 130), pct: 130, accent: true, note: "or another young, soft, tangy cheese" },
        ] },
        { title: "Finish", items: [
          { k: "Olive oil", g: null, pct: null, note: "brushed over the top sheet" },
          { k: "Flaky salt", g: null, pct: null, note: "scattered before baking" },
        ] },
      ],
      summary: [
        { label: "Dough (2 sheets)", val: `${round(f + bp(f, 50) + bp(f, 8) + bp(f, 2))}g` },
        { label: "Cheese filling", val: `${bp(f, 130)}g` },
        { label: "Oven", val: "as hot as it goes" },
        { label: "Bake", val: "6–8 min" },
      ],
      steps: num([
        { title: "Make the dough", spec: "flour + water + oil + salt · knead 8–10 min to smooth & elastic",
          why: "No yeast at all — Recco is unleavened. Knead a firm, smooth, strongly elastic dough; you need well-developed gluten so it can later be pulled translucent without tearing.",
          more: "A little oil in the dough helps it stretch; keep the rest for the surface." },
        { title: "Rest — 30 min, covered", spec: "let the gluten relax fully",
          why: "Cover and rest at least 30 minutes. Resting lets the gluten relax so the dough stretches paper-thin instead of snapping back.",
          more: "An hour is even better; the dough should feel slack and yielding before you pull it." },
        { title: "Stretch two paper-thin sheets", spec: "divide ~45/55 · stretch over your knuckles until translucent",
          why: "Divide in two, the top piece slightly larger. Stretch each over the backs of your hands (like strudel or filo) until you can almost read through it — each sheet bigger than your pan.",
          more: "Work on lightly oiled hands; a few small holes are fine, you'll cover them." },
        { title: "Lay the base & dot the cheese", spec: "oiled pan · bottom sheet · walnut-size lumps of crescenza",
          why: "Drape the bottom sheet into a well-oiled pan (or onto an oiled tray), letting it overhang the rim. Dot walnut-size pieces of crescenza in rows a couple of centimetres apart.",
          more: "Don't spread the cheese — leave gaps so the two sheets can weld together between the lumps." },
        { title: "Cap, seal & tear vents", spec: "top sheet over · press around each lump · pinch off the rim · tear holes",
          why: "Lay the top sheet over, press it down around each lump of cheese, then run a finger around the rim to seal and tear off the overhang. Pinch or tear a few holes across the top so steam escapes and the surface blisters instead of ballooning.",
          more: "The torn holes are where the cheese caramelises and the sheet crisps — be generous with them." },
        { title: "Bake — as hot as it goes", spec: "270–300°C / 520–570°F · preheated steel/stone · 6–8 min",
          why: "Brush with oil, scatter flaky salt, and bake in the hottest oven you have, ideally onto a preheated steel or stone. It's done in minutes — blistered and golden-brown in patches, the cheese molten beneath.",
          more: "Restaurants use 300°C+ wood ovens; give a home oven its full preheat and the top rack near the element." },
        { title: "Serve at once", spec: "cut in squares · eat hot",
          why: "Recco waits for no one — cut and eat while the cheese is still molten and the sheets shatter-crisp. It turns leathery as it cools, so it's never made ahead." },
      ]),
    }) },

  { id: "uva", name: "Schiacciata all'uva", tag: "Tuscan · sweet",
    blurb: "A Tuscan harvest (vendemmia) sweet: a lightly sweetened, lightly leavened dough layered with wine grapes — uva fragola or Canaiolo, used whole, seeds and all — sugar and oil, baked until the fruit collapses into jammy, must-stained pockets. A rustic dessert focaccia.",
    recipe: (f) => ({
      clock: "~3 hr",
      profile: ["lightly leavened", "sweet & jammy", "wine-grape must", "two grape layers", "harvest dessert"],
      groups: [
        { title: "Dough — sweet, lightly leavened", caption: "soft and just sweet — the grapes do the rest", items: [
          { k: "Flour (bread or 00)", g: bp(f, 100), pct: 100 },
          { k: "Water", g: bp(f, 58), pct: 58 },
          { k: "Olive oil", g: bp(f, 10), pct: 10, note: "in the dough + to drizzle" },
          { k: "Sugar", g: bp(f, 8, 1), pct: 8, note: "in the dough" },
          { k: "Instant yeast", g: bp(f, 1, 2), pct: 1 },
          { k: "Salt", g: bp(f, 1.2, 1), pct: 1.2, note: "kept low — it's a sweet" },
        ] },
        { title: "Grapes & sugar — the topping", caption: "half hidden in the middle, half on top", brine: true, items: [
          { k: "Wine grapes", g: bp(f, 90), pct: 90, accent: true, note: "uva fragola / Canaiolo / Concord — whole, seeds & all" },
          { k: "Sugar — to scatter", g: bp(f, 12, 1), pct: 12, accent: true, note: "between the layers and over the top" },
        ] },
        { title: "Finish", items: [
          { k: "Olive oil", g: null, pct: null, note: "drizzled over before baking" },
          { k: "Rosemary or anise seeds", g: null, pct: null, note: "optional, traditional" },
        ] },
      ],
      summary: [
        { label: "Total dough", val: `${round(f + bp(f, 58) + bp(f, 10) + bp(f, 8) + bp(f, 1) + bp(f, 1.2))}g` },
        { label: "Grapes", val: `${bp(f, 90)}g` },
        { label: "Oven", val: "190–200°C / 375–400°F" },
        { label: "Bake", val: "35–45 min" },
      ],
      steps: num([
        { title: "Mix & first rise", spec: "flour + water + yeast + sugar + salt + oil · knead · rise 1.5–2 hr",
          why: "A lightly sweetened bread dough. Mix everything, knead to a soft, smooth dough, and let it rise warm until doubled — about 1.5–2 hours. Keep the salt low; the grapes and sugar carry the flavour.",
          more: "A little more sugar feeds the yeast; don't overdo it or the rise drags." },
        { title: "Prep the grapes", spec: "wash & de-stem · classically seeded wine grapes, used whole",
          why: "Traditionally uva fragola ('strawberry grape') or Canaiolo — small, intense wine grapes used whole, seeds and all; the seeds are part of the rustic character. Concord grapes are the closest supermarket stand-in.",
          more: "If you'd rather not eat seeds, halve and seed them — you'll lose a little of the jammy structure but it's still good." },
        { title: "Base layer", spec: "half the dough in an oiled pan · half the grapes · sugar + oil",
          why: "Press half the dough into a well-oiled pan. Scatter half the grapes over it, then some of the sugar and a drizzle of oil — this hidden middle layer bleeds must through the crumb as it bakes." },
        { title: "Top layer & remaining grapes", spec: "second half over · press the rest of the grapes in · sugar + oil",
          why: "Roll or press the second piece of dough over the top, press the remaining grapes into the surface, and scatter the rest of the sugar and a little more oil (a few rosemary needles or a pinch of anise, if you like)." },
        { title: "Second rise — 30–45 min", spec: "let it puff again under the fruit",
          why: "A short second rise so the dough bakes up light, not dense, under the weight of the grapes." },
        { title: "Bake", spec: "190–200°C / 375–400°F · 35–45 min",
          why: "Bake until deep golden and the grapes have collapsed into jammy, bubbling pockets, their juice caramelising into the crumb.",
          more: "Set a tray underneath — the grape juice loves to run over." },
        { title: "Cool & set", spec: "let the juices set · serve warm or at room temp",
          why: "Let it cool enough for the grape must to set into the crumb. It's eaten as a snack or dessert through the autumn grape harvest." },
      ]),
    }) },

  { id: "veneta", name: "Fugassa veneta", tag: "enriched · Easter",
    blurb: "The Venetian Easter focaccia — an enriched, multi-stage sweet dough built like a panettone: eggs and yolks, butter, sugar, citrus zest and vanilla (often a splash of grappa), proofed tall in a mold and crowned with pearl sugar and almonds. Soft, airy, fragrant; it matures over a day.",
    recipe: (f) => ({
      clock: "~10–12 hr",
      profile: ["enriched & sweet", "eggs · butter · sugar", "citrus & vanilla", "panettone cousin", "Venetian Easter"],
      groups: [
        { title: "Enriched dough", caption: "built in stages so the gluten survives the fat & sugar", items: [
          { k: "Flour (strong / bread)", g: bp(f, 100), pct: 100 },
          { k: "Butter — soft", g: bp(f, 28), pct: 28, note: "added last, a little at a time" },
          { k: "Sugar", g: bp(f, 25), pct: 25 },
          { k: "Eggs + yolks", g: bp(f, 30), pct: 30, note: "yolk-rich for colour & tenderness" },
          { k: "Milk or water", g: bp(f, 25), pct: 25 },
          { k: "Fresh yeast", g: bp(f, 3, 1), pct: 3, note: "≈1% if instant · worked across the builds" },
          { k: "Honey or malt", g: bp(f, 3, 1), pct: 3, note: "optional — feeds yeast, keeps it moist" },
          { k: "Salt", g: bp(f, 1, 1), pct: 1 },
        ] },
        { title: "Aromatics & crown", caption: "the unmistakable fugassa perfume", brine: true, items: [
          { k: "Vanilla + orange & lemon zest", g: null, pct: null, accent: true, note: "a splash of grappa or marsala, traditionally" },
          { k: "Pearl sugar (granella)", g: null, pct: null, accent: true, note: "scattered on top" },
          { k: "Almonds", g: null, pct: null, accent: true, note: "whole or sliced, with the sugar" },
        ] },
      ],
      summary: [
        { label: "Total dough", val: `${round(f + bp(f, 28) + bp(f, 25) + bp(f, 30) + bp(f, 25) + bp(f, 3) + bp(f, 3) + bp(f, 1))}g` },
        { label: "Build", val: "3-stage, like panettone" },
        { label: "Oven", val: "170–180°C / 340–355°F" },
        { label: "Bake", val: "35–45 min" },
      ],
      steps: num([
        { title: "Sponge — build the yeast", spec: "¼ of the flour + the yeast + the milk · ferment until tripled (2–4 hr or overnight)",
          why: "Fugassa is an enriched, multi-stage dough like panettone. Start a soft sponge — about a quarter of the flour, the yeast and the milk — and let it triple. The pre-ferment builds the strength and aroma to carry all the fat and sugar to come.",
          more: "An overnight sponge in the fridge deepens the flavour and fits the long process into two days." },
        { title: "Second dough", spec: "add half the remaining flour + some sugar + the eggs · develop · rest 1–2 hr",
          why: "Add flour, part of the sugar and the eggs, and work it to a strong, elastic dough; rest until risen again. Building the enrichment in stages keeps the gluten from being swamped by fat and sugar all at once." },
        { title: "Final dough + butter", spec: "rest of flour, sugar, yolks, salt, aromatics · then soft butter a little at a time",
          why: "Add the last of the flour, sugar, yolks, salt and the aromatics (vanilla, citrus zest, a splash of grappa). Develop to a smooth windowpane, then beat in the soft butter a little at a time until the dough is glossy and elastic again.",
          more: "Keep the dough cool (~24°C/75°F); too warm and the butter greases out. This is the longest mixing stage." },
        { title: "Bulk proof", spec: "warm · until doubled (2–4 hr)",
          why: "A long, warm bulk rise — enriched doughs are slow because the sugar and fat hold the yeast back." },
        { title: "Shape & mold", spec: "round it tight · into a star/panettone mold",
          why: "Shape into a tight ball to build surface tension, then drop it into a paper panettone mold or a star-shaped fugassa tin (or dome it on a tray)." },
        { title: "Final proof", spec: "warm · until risen to the rim (3–5 hr)",
          why: "Proof until it has risen to the top of the mold and wobbles — enriched doughs need a long, patient final proof to bake up tall and airy." },
        { title: "Top & bake", spec: "egg wash · pearl sugar + almonds · 170–180°C / 340–355°F · 35–45 min",
          why: "Brush with egg, scatter the pearl sugar and almonds (the classic granella crown), and bake low-and-slow so the rich crumb cooks through without scorching the sugar.",
          more: "Tent with foil if it colours too fast; it's done at about 92°C/198°F inside." },
        { title: "Cool fully — or hang", spec: "like panettone · cool before cutting · matures overnight",
          why: "Cool completely before cutting — ideally inverted or hung like panettone so the tall, airy crumb doesn't collapse. The flavour deepens over a day, and it keeps well wrapped." },
      ]),
    }) },
];
const SPECIAL_BY_ID = Object.fromEntries(SPECIAL_STYLES.map((s) => [s.id, s]));

// (a style is an explicit binding now — see boundStyle; freestyle conforms to
// the nearest style via the model's classify().)

// ---- Traditional toppings & herbs ------------------------------------------
// `styles` = which traditions a topping is classic for (drives the badge).
// `short` = one-line prep (always shown in the table). `prep` = full method
// (shown in the process step at Detailed verbosity). `prepSteps` = per-topping
// prep detail; the Prep timeline gets its *ordering* and dependencies from
// TOPPING_PLAN below. `water:true` flags a topping that weeps moisture into
// the crumb (cherry tomatoes) so it can be folded into effective hydration.
const TOPPINGS = [
  { id: "rosemary", icon: "🌿", label: "Rosemary", styles: ["flaky", "genovese", "romana", "barese", "sameday", "schiacciata", "pizzabianca", "fougasse"],
    short: "needles pressed in & oiled at dimpling",
    prep: "Strip the needles (or keep small sprigs). Press them into the dough at dimpling and coat with the brine oil so they don't scorch — woody herbs burn fast on top of a 230–260°C bake.",
    prepSteps: ["Strip needles or keep small sprigs", "Press into the dough at dimpling", "Coat with brine oil so they don't scorch"] },
  { id: "tomato", icon: "🍅", label: "Cherry tomatoes", styles: ["flaky", "barese", "sameday"],
    short: "halved, cut-side up in the wells", water: true,
    prep: "Halve and press cut-side up into the wells at dimpling so they roast in the oil rather than steam. For deeper flavour, smash & roast them first — that concentrates the glutamate and sugars and builds Maillard browning — then add for the 450°F phase, slicked with brine oil so the already-caramelised sugars don't scorch. Either way they're ~95% water and weep into the crumb, so account for that in your hydration (see the tomato panel).",
    prepSteps: ["Halve the tomatoes", "Press cut-side up into the oiled wells", "Slick with brine oil before baking"] },
  { id: "passata", icon: "🥫", label: "Tomato sauce (passata)", styles: ["sardenaira", "sfincione", "messinese"],
    short: "cooked sauce spread over the top",
    prep: "The defining layer of the sauce focacce: simmer passata with garlic and good oil (slow-cook sliced onion into it for sfincione) until thick and jammy, season, and cool. Spread it over the dimpled dough before the olives, anchovy, capers and cheese — it's the base everything sits in, not a garnish.",
    prepSteps: ["Simmer passata with garlic + oil (onion for sfincione) until thick", "Season and cool", "Spread over the dimpled dough before the other toppings"] },
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

// When each topping's prep happens on the bake timeline, and what it has to
// wait on. `phase` keys into the backbone built by buildTimeline(); the special
// key `"wait"` means "the long ferment" (the cold retard, or the warm bulk on a
// same-day bake) — that's when you roast tomatoes, toast crumbs, infuse garlic
// and wilt greens, so they're cool/dry and ready by dimpling time. `dur` flags
// a step that takes real time; `dep` is the call-out that makes the order
// non-obvious. Drives the prep time-graph and the ordered checklist.
const TOPPING_PLAN = {
  rosemary:    { phase: "dimple", do: "Strip needles / keep small sprigs; press in & oil" },
  tomato:      { phase: "dimple", do: "Halve; press cut-side up in the oiled wells" }, // roast mode overridden in buildTimeline
  passata:     { phase: "wait",   do: "Simmer passata with garlic/onion till thick; cool", dur: "~20 min", dep: "make ahead — it's the base layer, spread before the rest" },
  olives:      { phase: "dimple", do: "Pit & pat dry; press in", dep: "pat dry or the brine makes wet spots" },
  anchovy:     { phase: "dimple", do: "Rinse & bone; lay into the sauce / on the dough" },
  capers:      { phase: "dimple", do: "Rinse & pat dry; scatter on" },
  onion:       { phase: "dimple", do: "Slice thin; toss with oil + salt", dur: "10-min soak tames the bite" },
  cheese:      { phase: "bake",   do: "Cube or tear; add for the cooler second phase", dep: "go in late so it melts through, not scorches" },
  breadcrumbs: { phase: "wait",   do: "Toast coarse crumbs in oil till golden", dur: "~10 min", dep: "toast ahead; shower on before the bake" },
  escarole:    { phase: "wait",   do: "Wilt or blanch, then squeeze very dry", dep: "bone-dry or it steams the crumb" },
  garlic:      { phase: "wait",   do: "Warm crushed cloves in oil to infuse; lift out", dur: "~10 min", dep: "never raw on top — it burns bitter" },
  oregano:     { phase: "dimple", do: "Scatter dried with the tomatoes" },
};

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
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// ---------------------------------------------------------------------------
// Kitchen environment — altitude, humidity & room temperature recalibration
// ---------------------------------------------------------------------------
// Three things about *where and when* you bake change a yeasted dough, and each
// maps to one lever by a distinct, well-understood mechanism:
//   • Ambient humidity → hydration. Flour equilibrates with the air's moisture
//     and the dough surface evaporates faster in dry air, so a dry day wants a
//     little more water and a humid day a little less.
//   • Altitude → yeast (+ a small hydration bump). Lower air pressure lets the
//     same fermentation gas expand more, so dough proofs faster and over-proofs
//     easily — trim the yeast. The thinner, drier air also evaporates faster,
//     so add a touch of water and bake hotter/shorter (standard high-altitude
//     baking guidance, which kicks in around 3000 ft).
//   • Room temperature → mixing-water temperature and real ferment speed. The
//     baker's desired-dough-temperature (DDT) method sets water temp from the
//     room; and yeast activity roughly doubles per ~18°F (a Q10 of ≈2), so a
//     warm kitchen runs faster than the schedule's nominal clock.
const ENV_BASE_RH = 60;             // % RH the base formula assumes
const ENV_ALT_THRESHOLD_FT = 3000;  // high-altitude adjustments begin here
const ENV_DDT_F = 78;               // target dough temperature after mixing
const ENV_FRICTION_F = 5;           // hand-mix friction factor for DDT
const ENV_FERMENT_REF_F = 75;       // room temp the schedule clocks assume

function computeEnvAdjust({ elevFt, humidityPct, roomTempF }) {
  const ftAbove = Math.max(0, elevFt - ENV_ALT_THRESHOLD_FT);
  // Humidity → hydration: ±0.05% water per 1% RH away from baseline, gently capped.
  const hydrationFromRH = clamp((ENV_BASE_RH - humidityPct) * 0.05, -2.5, 2.5);
  // Altitude → hydration: +0.5% water per 1000 ft above the threshold, capped.
  const hydrationFromAlt = clamp((ftAbove / 1000) * 0.5, 0, 4);
  const hydrationDelta = round(hydrationFromRH + hydrationFromAlt, 1);
  // Altitude → yeast: trim ~0.5% of the dose per 100 ft above the threshold.
  const yeastFactor = clamp(1 - (ftAbove / 100) * 0.005, 0.7, 1);
  // Altitude → hotter, shorter bake.
  const bakeTempBumpF = elevFt > 6000 ? 25 : elevFt > ENV_ALT_THRESHOLD_FT ? 15 : 0;
  // Room temp → mixing-water temp (DDT, three factors: flour≈room, room, friction).
  const waterTempF = clamp(Math.round(3 * ENV_DDT_F - (2 * roomTempF + ENV_FRICTION_F)), 50, 120);
  // Room temp → ferment-speed multiplier vs. the schedule's reference temp (Q10≈2).
  const fermentFactor = Math.pow(2, (ENV_FERMENT_REF_F - roomTempF) / 18);
  return { elevFt, humidityPct, roomTempF, ftAbove, hydrationFromRH, hydrationFromAlt,
    hydrationDelta, yeastFactor, bakeTempBumpF, waterTempF, fermentFactor };
}

// ZIP → lat/lon (Zippopotam.us) → elevation + that day's mean humidity
// (Open-Meteo). All three are free, key-less, CORS-enabled browser APIs.
async function fetchKitchenEnv(zip, dateISO) {
  const z = String(zip).trim();
  if (!/^\d{5}$/.test(z)) throw new Error("Enter a 5-digit US ZIP code.");
  const geoR = await fetch(`https://api.zippopotam.us/us/${z}`);
  if (!geoR.ok) throw new Error(`No US location found for ZIP ${z}.`);
  const geo = await geoR.json();
  const place = geo.places && geo.places[0];
  if (!place) throw new Error(`No US location found for ZIP ${z}.`);
  const lat = Number(place.latitude), lon = Number(place.longitude);
  const placeName = `${place["place name"]}, ${place["state abbreviation"] || place.state}`;
  const day = 864e5;
  const today = new Date().toISOString().slice(0, 10);
  const earliest = new Date(Date.now() - 90 * day).toISOString().slice(0, 10);
  const latest = new Date(Date.now() + 16 * day).toISOString().slice(0, 10);
  // Open-Meteo's forecast model serves ~90 days back to 16 days ahead; older
  // dates come from the historical archive instead.
  const wxBase = (dateISO >= earliest && dateISO <= latest)
    ? "https://api.open-meteo.com/v1/forecast"
    : "https://archive-api.open-meteo.com/v1/archive";
  const [elevR, wxR] = await Promise.all([
    fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`),
    fetch(`${wxBase}?latitude=${lat}&longitude=${lon}&hourly=relative_humidity_2m&start_date=${dateISO}&end_date=${dateISO}&timezone=auto`),
  ]);
  if (!elevR.ok) throw new Error("Couldn't fetch elevation for that location.");
  if (!wxR.ok) throw new Error("Couldn't fetch the weather for that date.");
  const elevJ = await elevR.json();
  const wxJ = await wxR.json();
  const elevM = Array.isArray(elevJ.elevation) ? elevJ.elevation[0] : elevJ.elevation;
  const rh = ((wxJ.hourly && wxJ.hourly.relative_humidity_2m) || []).filter((x) => x != null);
  if (elevM == null) throw new Error("Couldn't read elevation for that location.");
  if (!rh.length) throw new Error("No humidity data for that date — try one within ~2 weeks.");
  const humidityPct = Math.round(rh.reduce((a, b) => a + b, 0) / rh.length);
  return { place: placeName, elevM: Math.round(elevM), elevFt: Math.round(elevM * 3.28084),
    humidityPct, date: dateISO };
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
// Prep timeline — lays the topping prep out on the dough's own clock so you can
// see, at a glance, what to start first and what has to finish (cool, dry…)
// before it can go on. The numbered Process steps are unchanged; this only
// re-orders the *prep* into a single dependency-aware line. The long ferment is
// the key insight here: that's the window to roast, toast, infuse and wilt.
// ---------------------------------------------------------------------------
const PHASE_ORDER = ["mix", "bulk", "cold", "laminate", "pan", "proof", "dimple", "bake", "cool"];

function buildTimeline({ sch, schIdx, folds, yeastType, toppings, tomato }) {
  const express = schIdx === 0;
  const yt = YEAST_TYPES[yeastType] || YEAST_TYPES.instant;
  const waitPhase = express ? "bulk" : "cold"; // where make-ahead prep lives

  const phases = express
    ? [
        { key: "mix",    label: "Mix",        clock: "~25 min",   weight: 2 },
        { key: "bulk",   label: "Warm rise",  clock: "~1 hr",     weight: 3 },
        { key: "pan",    label: "Pan",        clock: "20–30 min", weight: 1.4 },
        { key: "proof",  label: "Proof",      clock: sch.proof,   weight: 2.4 },
        { key: "dimple", label: "Dimple+top", clock: "~10 min",   weight: 1.8 },
        { key: "bake",   label: "Bake",       clock: "~22 min",   weight: 1.8 },
        { key: "cool",   label: "Cool",       clock: "~10 min",   weight: 1.3 },
      ]
    : [
        { key: "mix",    label: "Mix",        clock: "~25 min",   weight: 2 },
        { key: "bulk",   label: "Bulk+folds", clock: "~2 hr",     weight: 2.6 },
        { key: "cold",   label: "Cold ferment", clock: sch.cold,  weight: 5 },
        ...(folds > 0 ? [{ key: "laminate", label: "Laminate", clock: "~20 min", weight: 1.5 }] : []),
        { key: "pan",    label: "Pan",        clock: "20–30 min", weight: 1.4 },
        { key: "proof",  label: "Proof",      clock: sch.proof,   weight: 2.4 },
        { key: "dimple", label: "Dimple+top", clock: "~10 min",   weight: 1.8 },
        { key: "bake",   label: "Bake",       clock: "~22 min",   weight: 1.8 },
        { key: "cool",   label: "Cool",       clock: "~10 min",   weight: 1.3 },
      ];

  // The dough's own backbone, one label per phase.
  const spine = {
    mix:      express ? "Fermentolyse · develop" : "Autolyse · develop",
    bulk:     express ? "Warm rise + folds" : "Bulk + strength folds",
    cold:     "Cold ferment",
    laminate: "Laminate",
    pan:      "Pan · relax",
    proof:    "Final proof",
    dimple:   "Dimple + brine",
    bake:     "Bake hot",
    cool:     "Onto a rack",
  };

  const tracks = [];
  // Non-instant yeast must be bloomed before it can go in — a real "do first".
  if (yeastType !== "instant") {
    tracks.push({ id: "_yeast", icon: "🫧", label: "Yeast", plan: { phase: "mix", do: `Bloom the ${yt.label.toLowerCase()} in warm water`, dep: "must foam before it goes in — proves it's alive" } });
  }
  toppings.forEach((t) => {
    let plan = TOPPING_PLAN[t.id];
    if (t.id === "tomato" && tomato && tomato.on && tomato.mode === "roast") {
      plan = { phase: waitPhase, do: "Smash & roast until jammy, then cool", dur: "~30 min", dep: "cool before it touches the dough" };
    }
    if (plan && plan.phase === "wait") plan = { ...plan, phase: waitPhase };
    if (plan) tracks.push({ id: t.id, icon: t.icon, label: t.label, plan });
  });

  // Linearised: same prep, sorted into one do-this-then-that order (stable, so
  // ties keep registry order). This is the explicit "linear order" view.
  const ordered = tracks
    .map((t, i) => ({ t, i }))
    .sort((a, b) => (PHASE_ORDER.indexOf(a.t.plan.phase) - PHASE_ORDER.indexOf(b.t.plan.phase)) || (a.i - b.i))
    .map((x) => x.t);

  return { phases, spine, tracks, ordered };
}

// A horizontal Gantt of the prep: phases run left→right across the x-axis of
// time; the dough spine is the top band; each topping sits under the moment its
// prep happens, with its icon on the axis. Scrolls sideways on narrow screens.
// Purely presentational — state (ticking) lives in the ordered list below it.
function TimeGraph({ phases, spine, tracks, phaseIng, C, accent }) {
  const cols = `96px ${phases.map((p) => `minmax(74px, ${p.weight}fr)`).join(" ")}`;
  const line = (i) => (i === 0 ? "none" : `1px solid ${C.line}`);

  const chip = (t) => (
    <div style={{ background: C.paperDeep, border: `1px solid ${C.line}`, borderLeft: `3px solid ${accent}`, borderRadius: 8, padding: "5px 7px", width: "100%" }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.25, color: C.ink }}>{t.icon} {t.plan.do}</div>
      {t.plan.dur && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: accent, fontWeight: 600, marginTop: 2 }}>⏱ {t.plan.dur}</div>}
      {t.plan.dep && <div style={{ fontSize: 10.5, fontStyle: "italic", color: C.inkSoft, lineHeight: 1.3, marginTop: 2 }}>↳ {t.plan.dep}</div>}
    </div>
  );

  return (
    <div style={{ overflowX: "auto", paddingBottom: 4 }}>
      <div style={{ minWidth: 96 + phases.length * 92, display: "grid", gridTemplateColumns: cols, rowGap: 6, alignItems: "stretch" }}>
        {/* x-axis: phase labels + clocks */}
        <div />
        {phases.map((p, i) => (
          <div key={p.key} style={{ borderLeft: line(i), padding: "0 6px 4px" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: C.inkSoft, fontWeight: 600 }}>{p.label}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, color: accent, fontWeight: 600 }}>{p.clock}</div>
          </div>
        ))}

        {/* the dough's own timeline */}
        <div style={{ display: "flex", alignItems: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: C.inkSoft }}>Dough</div>
        {phases.map((p, i) => (
          <div key={p.key} style={{ borderLeft: line(i), padding: "0 4px", display: "flex", alignItems: "center" }}>
            {spine[p.key] && (
              <div style={{ background: accent, color: C.onAccent, borderRadius: 7, padding: "6px 8px", fontSize: 11.5, fontWeight: 600, lineHeight: 1.2, width: "100%" }}>{spine[p.key]}</div>
            )}
          </div>
        ))}

        {/* what to add at each block — ingredients + grams under their phase */}
        <div style={{ display: "flex", alignItems: "flex-start", paddingTop: 5, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: C.inkSoft }}>Add</div>
        {phases.map((p, i) => (
          <div key={p.key} style={{ borderLeft: line(i), padding: "5px 5px 0", display: "flex", alignItems: "flex-start" }}>
            {phaseIng && phaseIng[p.key] && phaseIng[p.key].length > 0 && (
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 2 }}>
                {phaseIng[p.key].map((it) => (
                  <div key={it.k} style={{ display: "flex", justifyContent: "space-between", gap: 5, fontSize: 11, lineHeight: 1.25 }}>
                    <span style={{ color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.k}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: accent, whiteSpace: "nowrap" }}>{it.g != null ? `${it.g}g` : "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* one lane per topping — icon rides the axis at its prep time */}
        {tracks.map((t) => (
          <React.Fragment key={t.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: C.ink }}>
              <span style={{ fontSize: 15 }}>{t.icon}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.label}</span>
            </div>
            {phases.map((p, i) => (
              <div key={p.key} style={{ borderLeft: line(i), padding: "0 4px", display: "flex", alignItems: "center" }}>
                {t.plan.phase === p.key ? chip(t) : null}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// goldmemberSrc: the "Flaky" easter-egg tile background. Defaults to a host-served
// path (the blog serves it from quartz/static); pass a prop to override standalone.
export default function FocacciaBuildSheet({ goldmemberSrc = "/static/goldmember.png" } = {}) {
  const D0 = STYLE_BY_ID[DEFAULT_STYLE];
  // master scale
  const [flour, setFlour] = useState(500);
  // The six quality sliders — what you drive. The recipe (hydration, lamination,
  // oils, salt + the style's locked schedule/semola/two-pan identity) is *solved*
  // from them. Binary mode: bound to a style (identity locked) or freestyle
  // (conforms to the nearest style). See src/focaccia-model.js.
  const [q, setQ] = useState(D0.q);
  const [boundStyle, setBoundStyle] = useState(DEFAULT_STYLE);
  const solved = useMemo(() => boundStyle
    ? solveWithin(q, identityOf(STYLE_BY_ID[boundStyle].set), {})
    : solveConforming(q, STYLES, {}), [q, boundStyle]);
  const recipe = solved.recipe;
  const { hydration, schIdx, folds, panOilPct, doughOilPct, saltPct, semolinaPct, twoPans, potatoPct, pinsaBlendPct } = recipe;
  const [yeastType, setYeastType] = useState("instant");
  const [toppingSel, setToppingSel] = useState({ rosemary: true });
  const [tomatoMode, setTomatoMode] = useState("raw"); // raw | roast
  const [tomatoPct, setTomatoPct] = useState(20);       // cherry tomatoes as % of flour
  const [prepDone, setPrepDone] = useState({});         // mise-en-place checklist
  const verbosity = 1; // steps are always succinct — the verbosity control was dropped
  // Light/dark + vibe inherit from the host Quartz blog (`saved-theme` /
  // `saved-vibe` on <html>); standalone → light + jdm.
  const [dark, setDark] = useState(() => {
    try { return document.documentElement.getAttribute("saved-theme") === "dark"; } catch { return false; }
  });
  const [vibe, setVibe] = useState(() => {
    try { return document.documentElement.getAttribute("saved-vibe") || "jdm"; } catch { return "jdm"; }
  });
  useEffect(() => {
    const onTheme = (e) => { if (e && e.detail && e.detail.theme) setDark(e.detail.theme === "dark"); };
    const onVibe = (e) => { if (e && e.detail && e.detail.vibe) setVibe(e.detail.vibe); };
    document.addEventListener("themechange", onTheme);
    document.addEventListener("vibechange", onVibe);
    return () => { document.removeEventListener("themechange", onTheme); document.removeEventListener("vibechange", onVibe); };
  }, []);
  const [openStep, setOpenStep] = useState("01");
  const [special, setSpecial] = useState(null); // a "beyond the dials" fixed recipe, or null
  // kitchen environment (altitude + humidity for a ZIP/day, plus room temp)
  const [zip, setZip] = useState("");
  const [envDate, setEnvDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [roomTempInput, setRoomTempInput] = useState("72"); // value as typed, in `tempUnit`
  const [tempUnit, setTempUnit] = useState("F");            // 'F' | 'C'
  const [humidityManual, setHumidityManual] = useState(""); // blank = use the fetched value
  const [envData, setEnvData] = useState(null);     // { place, elevFt, elevM, humidityPct, date }
  const [envLoading, setEnvLoading] = useState(false);
  const [envError, setEnvError] = useState("");
  const [envApplied, setEnvApplied] = useState(true); // fold the recalibration into the recipe

  // Inherit the page's vibe + brightness → palette (standalone defaults to jdm).
  // `geocities` also drives the retro className + GEO_CSS injection below.
  const geocities = vibe === "geocities";
  const C = vibe === "geocities" ? (dark ? THEMES.geoDark : THEMES.geoLight)
          : vibe === "modern"    ? (dark ? THEMES.dark : THEMES.light)
          : (dark ? THEMES.jdmDark : THEMES.jdmLight);

  function applyStyle(id) {
    const s = STYLE_BY_ID[id];
    if (!s) return;
    setSpecial(null);
    setBoundStyle(id);   // bind to this style — its identity is now locked
    setQ(s.q);           // drive the sliders to this style's quality profile
  }
  function goFreestyle() {
    setSpecial(null);
    setBoundStyle(null); // unbind — the model conforms to the nearest style
  }
  function applySpecial(id) { setSpecial(id); setOpenStep("01"); }
  const toggleTopping = (id) => setToppingSel((t) => ({ ...t, [id]: !t[id] }));
  const togglePrep = (key) => setPrepDone((p) => ({ ...p, [key]: !p[key] }));
  const activeStyle = boundStyle || "custom";
  const freestyleNearest = (!boundStyle && !special) ? solved.style : null;
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

  // Kitchen-environment recalibration. Room temperature is entered in °F or °C
  // (converted to °F for the science). Humidity comes from the ZIP/day fetch but
  // a manual entry overrides it — useful when a humidifier or HVAC makes the
  // indoor air differ from outdoors. The altitude + humidity deltas only fold
  // into the live recipe once we have a humidity figure and "apply" is on (and
  // never over a fixed recipe, which carries its own formula). Altitude needs a
  // fetched elevation; without one it's treated as sea level.
  const rtRaw = Number(roomTempInput);
  const rtF = tempUnit === "C" ? rtRaw * 9 / 5 + 32 : rtRaw;
  const rt = clamp(Number.isFinite(rtF) ? rtF : ENV_FERMENT_REF_F, 40, 110);
  const rtAltUnit = tempUnit === "F" ? round((rt - 32) * 5 / 9, 1) : round(rt, 1); // the other-unit readout
  const humidityUsed = humidityManual.trim() !== "" ? clamp(Number(humidityManual) || 0, 0, 100)
    : (envData ? envData.humidityPct : null);
  const humidityIsManual = humidityManual.trim() !== "";
  const elevFtUsed = envData ? envData.elevFt : 0;
  const condReady = humidityUsed != null;
  const envAdj = useMemo(
    () => (condReady ? computeEnvAdjust({ elevFt: elevFtUsed, humidityPct: humidityUsed, roomTempF: rt }) : null),
    [condReady, elevFtUsed, humidityUsed, rt]
  );
  const envOn = !!(condReady && envApplied && !special);
  const hydrationAdj = round(clamp(hydration + (envOn ? envAdj.hydrationDelta : 0), 55, 100), 1);
  const yeastEnvFactor = envOn ? envAdj.yeastFactor : 1;

  async function runEnvFetch() {
    setEnvLoading(true);
    setEnvError("");
    try {
      setEnvData(await fetchKitchenEnv(zip, envDate));
    } catch (e) {
      setEnvData(null);
      setEnvError(e.message || "Couldn't fetch conditions.");
    } finally {
      setEnvLoading(false);
    }
  }
  // Switch the room-temp unit, converting the entered value so it stays the
  // same physical temperature.
  function switchTempUnit(u) {
    if (u === tempUnit) return;
    const n = Number(roomTempInput);
    if (Number.isFinite(n) && roomTempInput.trim() !== "") {
      const conv = u === "C" ? (n - 32) * 5 / 9 : n * 9 / 5 + 32;
      setRoomTempInput(String(round(conv, 1)));
    }
    setTempUnit(u);
  }

  const v = useMemo(() => {
    const sem = f * (semolinaPct / 100);
    const potato = f * ((potatoPct || 0) / 100);
    const blend = f * ((pinsaBlendPct || 0) / 100);
    const breadFlour = f - sem - blend;
    const water = f * (hydrationAdj / 100);
    const salt = f * (saltPct / 100);
    const yFactor = (YEAST_TYPES[yeastType] || YEAST_TYPES.instant).factor;
    const yeastPctEff = sch.yeast * yFactor * yeastEnvFactor;
    const yeast = f * (yeastPctEff / 100);
    const sugar = f * (sch.sugar / 100);
    const panOil = f * (panOilPct / 100);
    const doughOil = f * (doughOilPct / 100);
    const foldOilPct = folds;
    const foldOil = f * (foldOilPct / 100);
    const brineWater = f * (BRINE_WATER / 100);
    const brineOil = f * (BRINE_OIL / 100);
    const brineSalt = f * (BRINE_SALT / 100);
    const doughWeight = f + water + salt + yeast + sugar + doughOil + potato;
    const totalOil = panOil + doughOil + foldOil + brineOil;
    return { sem, potato, blend, breadFlour, water, salt, yeast, yeastPctEff, sugar, panOil, doughOil, foldOil, foldOilPct, brineWater, brineOil, brineSalt, doughWeight, totalOil };
  }, [f, hydrationAdj, saltPct, semolinaPct, potatoPct, pinsaBlendPct, panOilPct, doughOilPct, folds, sch, yeastType, yeastEnvFactor]);

  const specialDef = special ? SPECIAL_BY_ID[special] : null;
  const specialRecipe = useMemo(() => specialDef ? specialDef.recipe(f) : null, [special, f]);

  // Ingredients to add at each TIMELINE BLOCK — rendered under the matching gantt
  // column (the "Add" lane in TimeGraph) so the timeline doubles as "what to pull
  // out, and when". Toppings ride their own gantt lanes, so they're not repeated
  // here. Special recipes don't use the gantt; they keep their own table below.
  const ing = (k, g) => ({ k, g });
  const phaseIng = {
    mix: [
      ing("Bread flour", round(v.breadFlour)),
      ...(semolinaPct > 0 ? [ing("Semolina", round(v.sem))] : []),
      ...(v.blend > 0 ? [ing("Rice + soy", round(v.blend))] : []),
      ...(v.potato > 0 ? [ing("Potato, riced", round(v.potato))] : []),
      ing(express ? "Water, warm" : "Water", round(v.water)),
      ing(YEAST_TYPES[yeastType].label, round(v.yeast, 2)),
      ...(v.sugar > 0 ? [ing("Sugar/honey", round(v.sugar, 1))] : []),
      ing("Salt", round(v.salt, 1)),
      ...(doughOilPct > 0 ? [ing("Dough oil", round(v.doughOil))] : []),
    ],
    ...(v.foldOil > 0 ? { [express ? "bulk" : "laminate"]: [ing("Fold oil", round(v.foldOil))] } : {}),
    pan: [ing("Pan oil", round(v.panOil))],
    dimple: [
      ing("Brine water", round(v.brineWater)),
      ing("Brine oil", round(v.brineOil)),
      ing("Brine salt", round(v.brineSalt, 1)),
      ing("Flaky salt", null),
    ],
  };

  const perPan = twoPans ? v.doughWeight / 2 : v.doughWeight;
  const dialSteps = useMemo(() => buildSteps({ sch, schIdx, folds, hydration, panOilPct, doughOilPct, semolina: semolinaPct > 0, yeastType, toppings: selectedToppings, verbosity, tomato }),
    [sch, schIdx, folds, hydration, panOilPct, doughOilPct, semolinaPct, yeastType, toppingSel, verbosity, tomatoOn, tomatoMode, tomatoPct, f]);
  const timeline = useMemo(() => buildTimeline({ sch, schIdx, folds, yeastType, toppings: selectedToppings, tomato }),
    [schIdx, folds, yeastType, toppingSel, tomatoOn, tomatoMode]);

  const dialProfile = [
    hydration >= 84 ? "open, custardy crumb" : hydration >= 76 ? "airy, balanced crumb" : "tight, bread-y crumb",
    sch.tang,
    folds === 0 ? "pillowy, no shred" : folds <= 2 ? "light flaky shred" : "deeply flaky, shreddy",
    doughOilPct === 0 ? "lean dough" : doughOilPct >= 6 ? "rich & tender" : "lightly enriched",
    panOilPct >= 10 ? "hard fried base" : panOilPct >= 8 ? "crisp fried base" : "lightly crisp base",
    ...(semolinaPct >= 8 ? ["sandy fracturing crust"] : []),
    saltPct >= 2.6 ? "boldly salted" : saltPct <= 2.0 ? "restrained salt" : "well salted",
    ...(tomatoWater > 0 ? [`≈${round(effHydration)}% effective hydration w/ tomato`] : []),
  ];

  // A fixed recipe (Recco / uva / veneta) overrides the dial-driven output.
  const groups = specialRecipe ? specialRecipe.groups : null; // dial recipes list ingredients on the gantt
  const STEPS = specialRecipe ? specialRecipe.steps : dialSteps;
  const profile = specialRecipe ? specialRecipe.profile : dialProfile;

  // (verbosity/showWhy removed — steps always show the why on tap)

  const mono = "'IBM Plex Mono', monospace";
  const envFieldLabel = { display: "flex", flexDirection: "column", gap: 5, fontFamily: mono, fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: C.inkSoft, fontWeight: 600 };
  const envFieldInput = { fontFamily: mono, fontSize: 15, padding: "9px 11px", borderRadius: 9, border: `1.5px solid ${C.line}`, background: C.paperDeep, color: C.ink, outline: "none" };
  const envStat = (label, value) => (
    <div key={label} style={{ flex: "1 1 120px", background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 10, padding: "9px 12px" }}>
      <div style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: 1, textTransform: "uppercase", color: C.inkSoft, fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 600, color: C.olive }}>{value}</div>
    </div>
  );

  return (
    <ThemeCtx.Provider value={C}>
    <div className={geocities ? `geocities ${dark ? "geo-dark" : "geo-light"}` : undefined} style={{ background: C.paper, minHeight: "100vh", padding: "28px 16px 60px", fontFamily: "'Fraunces', serif", color: C.ink, colorScheme: dark ? "dark" : "light", backgroundImage: C.glow, transition: "background .25s ease, color .25s ease" }}>
      <style>{FONTS}</style>
      {geocities && <style>{GEO_CSS}</style>}
      <div style={{ width: "100%", maxWidth: 880, margin: "0 auto", animation: "riseIn .5s ease" }}>
        {/* Header */}
        <div style={{ borderBottom: `2px solid ${C.ink}`, paddingBottom: 14, marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 8 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 40, fontWeight: 900, letterSpacing: -1, lineHeight: 0.95 }}>Focaccia</h1>
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, textAlign: "right", color: C.inkSoft, lineHeight: 1.5 }}>
            <span style={{ color: C.rust, fontWeight: 600 }}>{specialDef ? specialDef.name : !boundStyle ? "Freestyle" : STYLE_BY_ID[boundStyle].name}</span><br />
            {specialRecipe ? `fixed recipe · ${specialRecipe.clock}` : `${hydration}% hydration · ${sch.clock}`}
          </div>
        </div>

        {/* Style selector */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: C.rust, fontWeight: 600, margin: "2px 2px 10px" }}>
            <span>Style</span>
            <span style={{ color: C.inkSoft, letterSpacing: 1 }}>{special ? "fixed recipe" : boundStyle ? "bound · adjusting within" : "freestyle"}</span>
          </div>
          <button onClick={goFreestyle} style={{
            display: "flex", gap: 9, alignItems: "flex-start", textAlign: "left", cursor: "pointer", width: "100%",
            borderRadius: 11, padding: "11px 12px", marginBottom: 10, transition: "all .15s ease", fontFamily: "'Fraunces', serif",
            border: `1.5px solid ${!special && !boundStyle ? C.olive : C.line}`, background: !special && !boundStyle ? C.olive : C.card, color: !special && !boundStyle ? C.onAccent : C.ink }}>
            <span style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${!special && !boundStyle ? C.onAccent : C.line}`, flexShrink: 0, marginTop: 2, position: "relative" }}>
              {!special && !boundStyle && <span style={{ position: "absolute", inset: 2.5, borderRadius: "50%", background: C.onAccent }} />}
            </span>
            <span style={{ lineHeight: 1.25 }}>
              <span style={{ display: "block", fontWeight: 600, fontSize: 15 }}>Freestyle</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, opacity: 0.8 }}>no style — conforms to the nearest tradition{freestyleNearest ? ` · closest: ${freestyleNearest.name}` : ""}</span>
            </span>
          </button>
          {STYLE_CATS.map((cat) => (
            <div key={cat} style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: C.inkSoft, fontWeight: 600, margin: "0 2px 6px" }}>{cat}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
                {STYLES.filter((s) => s.cat === cat).map((s) => {
                  const on = !special && boundStyle === s.id;
                  // Easter egg: the house "Flaky" tile, when selected, fills with
                  // Goldmember (a dark wash keeps the label legible). That'sch a keeper.
                  const goldOn = s.id === "flaky" && on;
                  return (
                    <button key={s.id} onClick={() => applyStyle(s.id)} style={{
                      display: "flex", gap: 9, alignItems: "flex-start", textAlign: "left", cursor: "pointer",
                      borderRadius: 11, padding: "11px 12px", transition: "all .15s ease", fontFamily: "'Fraunces', serif",
                      border: `1.5px solid ${on ? C.olive : C.line}`,
                      background: goldOn
                        ? `linear-gradient(rgba(0,0,0,0.32), rgba(0,0,0,0.42)), ${C.olive} url(${goldmemberSrc}) center / cover no-repeat`
                        : on ? C.olive : C.card,
                      color: on ? C.onAccent : C.ink,
                      textShadow: goldOn ? "0 1px 3px rgba(0,0,0,0.9)" : "none" }}>
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
          {/* Beyond the dials — fixed recipes that don't run off the sliders */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: C.inkSoft, fontWeight: 600, margin: "0 2px 6px" }}>
              Beyond the dials · fixed recipes
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
              {SPECIAL_STYLES.map((s) => {
                const on = special === s.id;
                return (
                  <button key={s.id} onClick={() => applySpecial(s.id)} style={{
                    display: "flex", gap: 9, alignItems: "flex-start", textAlign: "left", cursor: "pointer",
                    borderRadius: 11, padding: "11px 12px", transition: "all .15s ease", fontFamily: "'Fraunces', serif",
                    border: `1.5px solid ${on ? C.rust : C.line}`, background: on ? C.rust : C.card, color: on ? C.onAccent : C.ink }}>
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

          <div style={{ marginTop: 4, fontSize: 14, lineHeight: 1.5, color: C.inkSoft, fontStyle: "italic", borderLeft: `3px solid ${special ? C.rust : !boundStyle ? C.line : C.crust}`, paddingLeft: 12 }}>
            {specialDef
              ? specialDef.blurb
              : !boundStyle
              ? `Freestyle — no style selected, so the model adopts the nearest tradition's identity (schedule, semola, pan) and tunes the rest.${freestyleNearest ? ` Closest: ${freestyleNearest.name}.` : ""}`
              : STYLE_BY_ID[boundStyle].blurb}
          </div>
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

        {/* Kitchen environment — altitude + humidity (by ZIP/day) + room temp */}
        <div style={{ background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 14, padding: "16px 18px", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 16, fontWeight: 600 }}>Kitchen environment</span>
            <span style={{ fontFamily: mono, fontSize: 11, color: C.inkSoft }}>altitude · humidity · room temp</span>
          </div>
          <div style={{ fontSize: 13, color: C.inkSoft, fontStyle: "italic", marginBottom: 13 }}>
            Pull your elevation and the day's humidity from a US ZIP code (or type your own indoor humidity), set the room temperature in °F or °C, and the formula recalibrates — dough water, yeast, mixing-water temperature and the bake.
          </div>

          {/* Location → fetch */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ ...envFieldLabel, flex: "2 1 130px" }}>
              ZIP code
              <input value={zip} inputMode="numeric" placeholder="e.g. 80401"
                onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                onKeyDown={(e) => { if (e.key === "Enter") runEnvFetch(); }}
                style={envFieldInput} />
            </label>
            <label style={{ ...envFieldLabel, flex: "2 1 150px" }}>
              Date
              <input type="date" value={envDate} onChange={(e) => setEnvDate(e.target.value)} style={envFieldInput} />
            </label>
            <button onClick={runEnvFetch} disabled={envLoading}
              style={{ fontFamily: mono, fontSize: 13, fontWeight: 600, padding: "10px 16px", borderRadius: 9, border: "none", cursor: envLoading ? "default" : "pointer", background: C.oliveDeep, color: C.onAccent, opacity: envLoading ? 0.6 : 1, whiteSpace: "nowrap" }}>
              {envLoading ? "Fetching…" : "Fetch conditions"}
            </button>
          </div>

          {/* Manual conditions: room temperature (°F/°C) + humidity override */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginTop: 10 }}>
            <label style={{ ...envFieldLabel, flex: "3 1 280px" }}>
              Room temperature
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="number" value={roomTempInput} inputMode="decimal"
                  onChange={(e) => setRoomTempInput(e.target.value)}
                  style={{ ...envFieldInput, flex: 1, minWidth: 90 }} />
                <div style={{ display: "flex", gap: 3, background: C.paperDeep, borderRadius: 8, padding: 3 }}>
                  {["F", "C"].map((u) => {
                    const on = tempUnit === u;
                    return (
                      <button key={u} type="button" onClick={() => switchTempUnit(u)}
                        style={{ border: "none", borderRadius: 6, padding: "7px 11px", cursor: "pointer", fontFamily: mono, fontSize: 12, fontWeight: 600, background: on ? C.olive : "transparent", color: on ? C.onAccent : C.inkSoft, transition: "all .15s ease" }}>°{u}</button>
                    );
                  })}
                </div>
                <span style={{ fontFamily: mono, fontSize: 12, color: C.inkSoft, whiteSpace: "nowrap" }}>≈ {rtAltUnit}°{tempUnit === "F" ? "C" : "F"}</span>
              </span>
            </label>
            <label style={{ ...envFieldLabel, flex: "2 1 160px" }}>
              Humidity %
              <input type="number" value={humidityManual} min={0} max={100} inputMode="decimal"
                placeholder={envData ? `${envData.humidityPct} (fetched)` : "optional"}
                onChange={(e) => setHumidityManual(e.target.value)} style={envFieldInput} />
            </label>
          </div>

          <div style={{ marginTop: 9, fontSize: 12, color: C.inkSoft, fontStyle: "italic" }}>
            Humidity uses the ZIP/day reading unless you enter your own — set it to your hygrometer value if a humidifier or HVAC makes your kitchen differ.{!envData ? " Add a ZIP and fetch for altitude effects." : ""}
          </div>

          {envError && (
            <div style={{ marginTop: 11, fontSize: 13, color: C.rust, fontWeight: 600 }}>⚠ {envError}</div>
          )}

          {condReady && envAdj && (
            <div style={{ marginTop: 14, background: C.brineBg, border: `1.5px solid ${C.rust}`, borderRadius: 12, padding: "13px 15px", animation: "riseIn .2s ease" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 11 }}>
                <span style={{ fontSize: 14.5, fontWeight: 600 }}>📍 {envData ? `${envData.place} · ${envData.date}` : "Your kitchen · manual conditions"}</span>
                <button onClick={() => setEnvApplied((a) => !a)} disabled={!!special}
                  style={{ display: "flex", alignItems: "center", gap: 8, background: envOn ? C.rust : "transparent", color: envOn ? C.onAccent : C.rust, border: `1.5px solid ${C.rust}`, borderRadius: 20, padding: "6px 13px", cursor: special ? "default" : "pointer", opacity: special ? 0.5 : 1, fontFamily: mono, fontSize: 12, fontWeight: 600 }}>
                  {envOn ? "✓ applied to recipe" : envApplied && special ? "n/a for fixed recipe" : "apply to recipe"}
                </button>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                {envStat("Elevation", envData ? `${envData.elevFt.toLocaleString()} ft` : "— add ZIP")}
                {envStat(humidityIsManual ? "Humidity · yours" : "Humidity", `${humidityUsed}%`)}
                {envStat("Room", `${round(rt)}°F · ${round((rt - 32) * 5 / 9)}°C`)}
              </div>

              <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: 1.2, textTransform: "uppercase", color: C.rust, fontWeight: 600, marginBottom: 9 }}>
                Scientific recalibration
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {[
                  ...(envAdj.hydrationDelta !== 0 ? [{
                    label: "Hydration",
                    value: `${hydration}% → ${round(clamp(hydration + envAdj.hydrationDelta, 55, 100), 1)}%`,
                    on: envOn,
                    why: `${humidityUsed < ENV_BASE_RH ? "Dry air" : "Humid air"} (${humidityUsed}% RH${humidityIsManual ? ", your reading" : ""} vs ${ENV_BASE_RH}% baseline) shifts water ${envAdj.hydrationFromRH >= 0 ? "+" : ""}${round(envAdj.hydrationFromRH, 1)}%${envAdj.hydrationFromAlt > 0 ? `, altitude adds +${round(envAdj.hydrationFromAlt, 1)}% (drier, faster-evaporating air)` : ""}.`,
                  }] : []),
                  ...(envAdj.yeastFactor < 1 ? [{
                    label: "Yeast",
                    value: `×${envAdj.yeastFactor.toFixed(2)} (−${round((1 - envAdj.yeastFactor) * 100)}%)`,
                    on: envOn,
                    why: `At ${elevFtUsed.toLocaleString()} ft the lower air pressure lets fermentation gas expand more, so dough over-proofs — trim the yeast and watch the dough, not the clock.`,
                  }] : []),
                  {
                    label: "Mixing-water temp",
                    value: `${envAdj.waterTempF}°F`,
                    on: true,
                    why: `Desired-dough-temperature method: to hit ~${ENV_DDT_F}°F dough at a ${round(rt)}°F room (hand-mixed), start with water near this temperature.`,
                  },
                  ...(envAdj.bakeTempBumpF > 0 ? [{
                    label: "Bake",
                    value: `+${envAdj.bakeTempBumpF}°F, shorter`,
                    on: true,
                    why: "Standard high-altitude move: a hotter, shorter bake sets the crust before the fast-expanding crumb collapses.",
                  }] : []),
                  {
                    label: "Ferment pace",
                    value: envAdj.fermentFactor < 1 ? `~${round((1 - envAdj.fermentFactor) * 100)}% faster` : envAdj.fermentFactor > 1 ? `~${round((envAdj.fermentFactor - 1) * 100)}% longer` : "as scheduled",
                    on: true,
                    why: `Yeast activity roughly doubles per ~18°F (Q10≈2). Your ${round(rt)}°F room runs ${envAdj.fermentFactor < 1 ? "warmer than" : envAdj.fermentFactor > 1 ? "cooler than" : "right at"} the schedule's ${ENV_FERMENT_REF_F}°F assumption, so expect the bulk and proof to take ${envAdj.fermentFactor < 1 ? "less" : "more"} time.`,
                  },
                ].map((ln) => (
                  <div key={ln.label} style={{ opacity: ln.on ? 1 : 0.5 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{ln.label}{!ln.on && <span style={{ fontFamily: mono, fontSize: 10.5, color: C.inkSoft, fontWeight: 400 }}> · toggle on to apply</span>}</span>
                      <span style={{ fontFamily: mono, fontSize: 13.5, color: C.rust, fontWeight: 600, whiteSpace: "nowrap" }}>{ln.value}</span>
                    </div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.45, color: C.inkSoft, marginTop: 2 }}>{ln.why}</div>
                  </div>
                ))}
              </div>
              {special && (
                <div style={{ marginTop: 11, fontSize: 12.5, color: C.inkSoft, fontStyle: "italic" }}>
                  The water, bake and timing guidance still applies, but the hydration/yeast recalibration only folds into the dial-driven recipes — {specialDef.name} runs its own fixed formula.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fixed-recipe banner — the dials don't apply here */}
        {special && (
          <div style={{ background: C.brineBg, border: `1.5px solid ${C.rust}`, borderRadius: 12, padding: "12px 15px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, lineHeight: 1.45, color: C.ink }}>
              <strong>{specialDef.name}</strong> is a fixed recipe — it doesn't run off the sliders. Only the flour scale, detail and theme apply. The full method is below.
            </span>
            <button onClick={() => applyStyle(DEFAULT_STYLE)} style={{ flexShrink: 0, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 600, padding: "7px 13px", borderRadius: 20, border: `1.5px solid ${C.rust}`, background: "transparent", color: C.rust, cursor: "pointer" }}>
              ← back to the dials
            </button>
          </div>
        )}

        {/* The dials (dial-driven styles only) */}
        {!special && <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: C.rust, fontWeight: 600, margin: "4px 2px 10px" }}>
          <span>Drive the qualities</span>
          <span style={{ color: C.inkSoft, letterSpacing: 1 }}>the formula is solved from these</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 10, marginBottom: 12 }}>
          {QUALITY_AXES.map((a) => (
            <Dial key={a.key} label={a.label} value={q[a.key]} min={0} max={100} step={1}
              onChange={(val) => setQ((prev) => ({ ...prev, [a.key]: val }))}
              readout={`${q[a.key]} / 100`} lo={a.lo} hi={a.hi}
              accent={a.key === "tang" || a.key === "crust"} why={QUALITY_WHY[a.key]} />
          ))}
        </div>

        {/* Yeast form — a baker's choice, not a quality the model solves */}
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
        </div>

        {/* Calculated variables — the levers solved from your qualities (the "how") */}
        <div style={{ background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: "13px 15px", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 9, flexWrap: "wrap", gap: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Calculated variables</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.inkSoft }}>{boundStyle ? `within ${STYLE_BY_ID[boundStyle].name}` : "freestyle"} · {Math.round(100 * Math.exp(-solved.residual / 500))}% match</span>
          </div>
          <div style={{ border: `1px solid ${C.line}`, borderRadius: 9, overflow: "hidden" }}>
            {[
              ["Ferment", sch.name, sch.tang],
              ["Hydration", `${hydration}%`, hydration >= 84 ? "open & custardy" : hydration >= 76 ? "airy & balanced" : "tight & bread-y"],
              ["Lamination", folds === 0 ? "none" : `${folds} oiled fold${folds > 1 ? "s" : ""}`, folds === 0 ? "pillowy" : "flaky shred"],
              ["Grain", semolinaPct > 0 ? `${semolinaPct}% durum` : "all bread flour", semolinaPct > 0 ? "sandy crust" : "smooth crumb"],
              ["Oil", `${round(doughOilPct, 1)}% dough · ${panOilPct}% pan`, "tender vs. fried base"],
              ["Bake", twoPans ? "two pans" : "one pan", `${round(saltPct, 1)}% salt`],
            ].map(([k, val, sub], i) => (
              <div key={k} style={{ display: "grid", gridTemplateColumns: "84px 1fr auto", alignItems: "baseline", gap: 10, padding: "6px 11px", borderTop: i === 0 ? "none" : `1px solid ${C.line}`, background: i % 2 ? C.paperDeep : "transparent" }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, letterSpacing: 1, textTransform: "uppercase", color: C.inkSoft, fontWeight: 600 }}>{k}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.olive }}>{val}</span>
                <span style={{ fontSize: 11, color: C.inkSoft, textAlign: "right" }}>{sub}</span>
              </div>
            ))}
          </div>
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

        {/* Prep timeline — the topping prep, laid out on the dough's own clock */}
        <div style={{ background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: "13px 15px", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, flexWrap: "wrap", gap: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Prep timeline — what to do when</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.inkSoft }}>left → right = first → last</span>
          </div>
          <div style={{ fontSize: 12.5, color: C.inkSoft, fontStyle: "italic", marginBottom: 11 }}>
            The top band is the dough's own clock; each topping sits under the moment its prep happens. <span style={{ fontStyle: "normal" }}>⏱</span> marks a step that takes time — the long ferment is your window to roast, toast and infuse. <span style={{ fontStyle: "normal" }}>↳</span> is what it has to finish (cool, dry…) before it can go on.
          </div>

          <TimeGraph phases={timeline.phases} spine={timeline.spine} tracks={timeline.tracks} phaseIng={phaseIng} C={C} accent={C.olive} />

          {/* Same prep, linearised into one order — tick as you go */}
          <div style={{ borderTop: `1.5px solid ${C.line}`, marginTop: 12, paddingTop: 11 }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: 1.2, textTransform: "uppercase", color: C.inkSoft, fontWeight: 600, marginBottom: 9 }}>In order · tick as you go</div>
            {timeline.ordered.length === 0 ? (
              <div style={{ fontSize: 13, color: C.inkSoft, fontStyle: "italic" }}>Nothing to prep ahead — instant yeast goes straight in, and your toppings go on at dimpling.</div>
            ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {timeline.ordered.map((t, i) => {
                const key = `plan:${t.id}`;
                const done = !!prepDone[key];
                return (
                  <button key={key} onClick={() => togglePrep(key)} style={{
                    display: "flex", gap: 10, alignItems: "flex-start", textAlign: "left", cursor: "pointer",
                    background: "transparent", border: "none", padding: "1px 0", fontFamily: "'Fraunces', serif", color: C.ink }}>
                    <span style={{ width: 17, height: 17, borderRadius: 5, border: `2px solid ${done ? C.olive : C.line}`, background: done ? C.olive : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: C.onAccent, lineHeight: 1, marginTop: 2 }}>{done ? "✓" : ""}</span>
                    <span style={{ flex: 1, lineHeight: 1.4 }}>
                      <span style={{ fontSize: 14, color: done ? C.inkSoft : C.ink, textDecoration: done ? "line-through" : "none", opacity: done ? 0.7 : 1 }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: C.crust, marginRight: 7 }}>{String(i + 1).padStart(2, "0")}</span>
                        {t.icon} {t.plan.do}
                        {t.plan.dur && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: C.olive, fontWeight: 600 }}> · ⏱ {t.plan.dur}</span>}
                      </span>
                      {t.plan.dep && <span style={{ display: "block", fontSize: 12, fontStyle: "italic", color: C.inkSoft, marginTop: 1 }}>↳ {t.plan.dep}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
            )}
          </div>
        </div>
        </>}

        {/* (verbosity + dark-mode toggle removed — theme inherits from the blog) */}

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

        {/* Ingredient table — special recipes only; dial recipes list ingredients on the gantt */}
        {groups && (
        <div style={{ borderRadius: 14, border: `1.5px solid ${C.line}`, overflow: "hidden", marginBottom: 14, background: C.card }}>
          {groups.map((grp, gi) => (
            <div key={grp.title}>
              <div style={{ padding: "11px 18px 9px", background: grp.brine ? C.brineBg : C.paperDeep, borderTop: gi === 0 ? "none" : `1.5px solid ${C.line}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, letterSpacing: 1.5, textTransform: "uppercase", color: grp.brine ? C.rust : C.inkSoft, fontWeight: 600 }}>
                  <span>▸ {grp.title}</span>
                  {grp.clock && <span style={{ color: C.olive, letterSpacing: 0.5 }}>{grp.clock}</span>}
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
        )}

        {/* Yield summary */}
        <div style={{ display: "flex", gap: 10, marginBottom: 28, flexWrap: "wrap" }}>
          {specialRecipe
            ? specialRecipe.summary.map((c) => (
                <div key={c.label} style={summaryCard(C)}><div style={summaryLabel(C)}>{c.label}</div><div style={{ ...summaryVal(C), fontSize: /\d/.test(c.val) && c.val.length <= 6 ? 22 : 15 }}>{c.val}</div></div>
              ))
            : <>
                <div style={summaryCard(C)}><div style={summaryLabel(C)}>Total dough</div><div style={summaryVal(C)}>{round(v.doughWeight)}g</div></div>
                <div style={summaryCard(C)}><div style={summaryLabel(C)}>{twoPans ? "Per pan (×2)" : "Single pan"}</div><div style={summaryVal(C)}>{round(perPan)}g</div></div>
                <div style={summaryCard(C)}><div style={summaryLabel(C)}>Total olive oil</div><div style={summaryVal(C)}>{round(v.totalOil)}g</div></div>
                <div style={summaryCard(C)}><div style={summaryLabel(C)}>Suggested pan</div><div style={{ ...summaryVal(C), fontSize: 17 }}>{panHint(perPan)}</div></div>
              </>}
        </div>

        {/* Process — succinct bullet steps; tap any step for the why */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: C.rust, fontWeight: 600, marginBottom: 12 }}>
          <span>Process — tap any step for the why</span>
          <span style={{ color: C.inkSoft, letterSpacing: 1 }}>{specialRecipe ? specialRecipe.clock : `${sch.clock}${express ? " + bake" : ""}`}</span>
        </div>

        {STEPS.map((s) => {
          const open = openStep === s.n;
          return (
            <div key={s.n} style={{ border: `1.5px solid ${open ? C.olive : C.line}`, borderRadius: 12, marginBottom: 9, overflow: "hidden", background: open ? C.card : "transparent", transition: "border-color .18s ease" }}>
              <button onClick={() => setOpenStep(open ? "" : s.n)} style={{ width: "100%", display: "flex", gap: 14, alignItems: "flex-start", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", padding: "14px 16px", fontFamily: "'Fraunces', serif", color: C.ink }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600, color: open ? C.olive : C.crust, paddingTop: 3 }}>{s.n}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ fontSize: 19, fontWeight: 600, display: "block" }}>{s.title}</span>
                  <span style={{ display: "block", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.inkSoft, marginTop: 5 }}>
                    {s.spec.split(" · ").map((seg, i) => (
                      <span key={i} style={{ display: "block", paddingLeft: 13, textIndent: -11, lineHeight: 1.5 }}>• {seg}</span>
                    ))}
                  </span>
                </span>
                <span style={{ fontSize: 20, color: C.olive, transform: open ? "rotate(45deg)" : "none", transition: "transform .2s ease", lineHeight: 1, paddingTop: 2 }}>+</span>
              </button>
              {open && (
                <div style={{ padding: "0 16px 16px 44px", fontSize: 15.5, lineHeight: 1.55, color: C.inkSoft, whiteSpace: "pre-line", animation: "riseIn .25s ease" }}>
                  {s.why}{s.more ? `\n\n${s.more}` : ""}
                </div>
              )}
            </div>
          );
        })}

        {/* Cherry-tomato pan note */}
        {!special && twoPans && toppingSel.tomato && (
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
