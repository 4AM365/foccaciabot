import React, { useState, useMemo } from "react";

// ============================================================================
// Focaccia Dashboard — drive the *qualities* (open crumb, tang, flake, fried
// crust…); the recipe and process regenerate live. Baker's percentages are all
// relative to total flour = 100%.
//
// The science behind each dial is drawn from the repo's reference corpus
// (Cauvain & Young, Technology of Breadmaking; McGee, On Food and Cooking;
// Bressanini, La scienza della pasticceria) — see data/chunks.jsonl.
// ============================================================================

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,800;9..144,900&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
@keyframes riseIn { from { opacity:0; transform: translateY(10px);} to {opacity:1; transform:none;} }
`;

const C = {
  paper: "#f4ece0",
  paperDeep: "#ebe0cf",
  ink: "#2b2218",
  inkSoft: "#5a4d3a",
  olive: "#5c6b2f",
  oliveDeep: "#404d1f",
  rust: "#a8431d",
  crust: "#c8801f",
  line: "#cdbfa6",
  card: "#fbf6ec",
};

// ---- Fixed (non-dialed) percentages --------------------------------------
const BRINE_WATER = 5;   // salamoia — poured into the dimples
const BRINE_OIL = 5;     // salamoia oil

// ---- Fermentation schedules: the "tang / yeastiness" axis -----------------
// Longer + colder = more organic acids and aroma, and less yeast needed
// because it works longer (Cauvain, Ch.2: fermentation → bread flavour).
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

const FLAKE_LABELS = ["Pillowy", "Faint shred", "Light flake", "Shreddy", "Max flake"];

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
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
      background: on ? C.olive : "transparent", color: on ? C.paper : C.ink,
      border: `1.5px solid ${on ? C.olive : C.line}`, borderRadius: 10, padding: "12px 14px",
      cursor: "pointer", transition: "all .18s ease", fontFamily: "'Fraunces', serif" }}>
      <span style={{ width: 34, height: 20, borderRadius: 20, background: on ? C.paper : C.line, position: "relative", flexShrink: 0, transition: "background .18s ease" }}>
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
      <button onClick={() => setOpen((o) => !o)} style={{ marginTop: 7, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: col, fontWeight: 600, letterSpacing: 0.5 }}>
        {open ? "− why" : "ⓘ why"}
      </button>
      {open && <div style={{ marginTop: 5, fontSize: 13, lineHeight: 1.5, color: C.inkSoft, animation: "riseIn .2s ease" }}>{why}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Process generator — steps adapt to schedule, lamination count, hydration
// ---------------------------------------------------------------------------
function buildSteps({ sch, schIdx, folds, hydration, panOilPct, doughOilPct, semolina }) {
  const express = schIdx === 0;
  const oilNote = doughOilPct > 0
    ? ` Once the dough is cohesive, drizzle in the ${round(doughOilPct, 1)}% dough oil and mix until it's fully absorbed and glossy again — adding it now, after the gluten has formed, keeps the oil from coating the proteins and blunting development.`
    : "";
  const handling = hydration >= 84 ? "very slack and glossy — wet hands"
    : hydration >= 76 ? "slack but cohesive" : "supple and easy to handle";
  const foldPhrase = folds === 0
    ? "2 plain stretch-&-folds for strength"
    : `${folds} stretch-&-fold${folds > 1 ? "s" : ""}, oil drizzled before each`;

  const steps = [];

  if (express) {
    steps.push({ title: "Fermentolyse — warm", spec: `ALL flour + all WARM water (95–100°F) + yeast (${sch.yeast}%) + sugar · rest 20 min · then salt`,
      why: `On a 2-hour clock you want fermentation from minute one. Mix everything but the salt with warm water and rest 20 min: the flour fully hydrates (free extensibility), and the warm water wakes the yeast immediately. Hold the salt — it tightens gluten and blunts the fast start you need here.` });
    steps.push({ title: "Mixer development", spec: "dough hook · low speed · 6–8 min",
      why: `Build a moderate, cohesive gluten net — enough to trap gas fast and hold the layers. At ${hydration}% the dough is ${handling}. Warm dough develops quickly; stop when glossy and clearing the bowl, before it overheats past ~78°F.${oilNote}` });
    steps.push({ title: "Warm bulk + folds — the 1 hr rise", spec: `${sch.temp} · ${foldPhrase} at 20 & 40 min`,
      why: `This one warm hour does the long ferment's job — heat plus the elevated yeast drive the gas fast. ${folds > 0 ? "Drizzling oil before each fold means the same folds also build the flaky layers — strength and lamination collapsed into the bulk." : "Plain folds just build strength for a classic pillowy crumb."} Not puffy at the hour? Give it 15–20 min more — readiness rules, not the clock.` });
  } else {
    steps.push({ title: "Autolyse", spec: "ALL flour + all dough water · rest 30–45 min · then yeast + salt",
      why: `Mix flour and water to a shaggy mass and walk away. Every bit of flour hydrates and the flour's own enzymes start reorganizing gluten — extensibility and structure for free, with far less mixing. Hold yeast and salt: salt tightens gluten and slows the enzymes; yeast would ferment before you've built structure.` });
    steps.push({ title: "Mixer development", spec: "dough hook · low speed · 6–8 min",
      why: `A moderate, well-organized gluten matrix — strong enough to trap gas and hold lamination, loose enough to stay extensible. At ${hydration}% it should pull off the hook ${handling}. Stop when cohesive and clearing the walls, not bone-dry.${oilNote}` });
    steps.push({ title: "Strength folds", spec: "3–4 sets · 30 min apart, during the warm start",
      why: `Folding builds strength in layers without overworking. Each set re-tensions the gluten and redistributes gas and yeast food, turning a slack puddle into a structured mass that survives the long cold ferment and still holds deep dimples.` });
    steps.push({ title: `Cold fermentation`, spec: `${sch.cold} in the fridge · ${sch.name}`,
      why: `The cold retard is where flavour and texture are won (Cauvain, Ch.2: fermentation drives bread flavour). Slow, cold fermentation builds organic acids and complex aroma — ${sch.tang} — while the gluten relaxes into a uniform, extensible, lamination-ready dough.` });
    if (folds > 0) {
      steps.push({ title: "Laminate — the flaky trick", spec: `stretch thin · drizzle oil · letter-fold ×${folds} · rest 15 between`,
        why: `After the cold ferment, stretch to a rectangle, drizzle oil, and letter-fold ${folds} time${folds > 1 ? "s" : ""}. The thin oil films become internal partitions that shred and tear when baked — light lamination, not croissant layers, just enough for a dramatic flaky pull. The 15-min rests let gluten relax so you can re-stretch without tearing.` });
    }
  }

  steps.push({ title: express ? "Pan + final proof — the 1 hr proof" : "Pan proof + final proof",
    spec: `dark metal pan · all the pan oil (${panOilPct}%) · ${sch.proof} · proof until bubbly & jiggly`,
    why: `Flood a dark metal pan with all the pan oil — the dough essentially shallow-fries from below into a crisp shell. Let it relax and spread on its own (don't force the corners cold, it'll spring back and tear). Proof until visibly alive — domed, blistered, wobbling. Err slightly past full proof; under-proofed focaccia bakes dense and tight.` });

  steps.push({ title: "Dimple + brine", spec: "oil fingers · press nearly to the pan bottom · spoon brine into the wells",
    why: `Drive oiled fingers straight down almost to the pan. Aggressive dimples make the lunar-landscape surface and set high ridges that crunch against soft valleys. Whisk the brine (water + oil + salt) and spoon it so it pools in the wells — the water steams off and concentrates salt and oil into crisp, seasoned, caramelized pockets. Shy dimples bake out and won't hold brine; commit.` });

  const hot = panOilPct >= 10;
  steps.push({ title: "Bake", spec: `500°F / 260°C · 8 min  →  450°F / 232°C · ${hot ? "13–16" : "12–15"} min`,
    why: `The initial blast maximizes oven spring and sears the oiled base while the crust sets fast; controlled, uniform spring is the goal (Cauvain, Ch.1). Drop to 450°F to finish the interior and deepen colour without scorching the oil${hot ? " — at this much pan oil, watch the base and pull the moment it's mahogany, not past it" : ""}. ${semolina ? "The semolina pushes the crust toward a sandy, fracturing crunch. " : ""}Pull it deep golden-brown, edges crackling.` });

  return steps.map((s, i) => ({ ...s, n: String(i + 1).padStart(2, "0") }));
}

// ---------------------------------------------------------------------------
export default function FocacciaBuildSheet() {
  // master scale
  const [flour, setFlour] = useState(500);
  // quality dials
  const [hydration, setHydration] = useState(80);   // %  open ↔ tight crumb
  const [schIdx, setSchIdx] = useState(0);           // 0–3 ferment / tang
  const [folds, setFolds] = useState(2);             // 0–4 flakiness
  const [panOilPct, setPanOilPct] = useState(8);     // %  fried base
  const [doughOilPct, setDoughOilPct] = useState(5); // %  EVOO worked into the dough
  const [saltPct, setSaltPct] = useState(2.4);       // %  seasoning + structure
  const [semolinaPct, setSemolinaPct] = useState(5); // %  crust fracture
  // options
  const [twoPans, setTwoPans] = useState(true);
  const [openStep, setOpenStep] = useState("01");

  const f = Math.max(0, Number(flour) || 0);
  const sch = SCHEDULES[schIdx];
  const express = schIdx === 0;

  const v = useMemo(() => {
    const sem = f * (semolinaPct / 100);
    const breadFlour = f - sem;
    const water = f * (hydration / 100);
    const salt = f * (saltPct / 100);
    const yeast = f * (sch.yeast / 100);
    const sugar = f * (sch.sugar / 100);
    const panOil = f * (panOilPct / 100);
    const doughOil = f * (doughOilPct / 100);
    const foldOilPct = folds; // ~1% oil per laminating fold
    const foldOil = f * (foldOilPct / 100);
    const brineWater = f * (BRINE_WATER / 100);
    const brineOil = f * (BRINE_OIL / 100);
    const doughWeight = f + water + salt + yeast + sugar + doughOil;
    const totalOil = panOil + doughOil + foldOil + brineOil;
    return { sem, breadFlour, water, salt, yeast, sugar, panOil, doughOil, foldOil, foldOilPct, brineWater, brineOil, doughWeight, totalOil };
  }, [f, hydration, saltPct, semolinaPct, panOilPct, doughOilPct, folds, sch]);

  const groups = [
    { title: "Dough", items: [
      { k: "Bread flour", g: round(v.breadFlour), pct: round(100 - semolinaPct, 1) },
      ...(semolinaPct > 0 ? [{ k: "Semolina", g: round(v.sem), pct: round(semolinaPct, 1), accent: true }] : []),
      { k: express ? "Water — warm, 95–100°F" : "Water", g: round(v.water), pct: hydration },
      { k: "Salt", g: round(v.salt, 1), pct: round(saltPct, 1) },
      { k: "Instant yeast", g: round(v.yeast, 2), pct: sch.yeast, accent: express, note: express ? "bumped for the short clock" : "low — the ferment does the work" },
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
      { k: "Flaky salt", g: null, pct: null, note: "to finish, over the top" },
    ] },
  ];

  const perPan = twoPans ? v.doughWeight / 2 : v.doughWeight;
  const STEPS = useMemo(() => buildSteps({ sch, schIdx, folds, hydration, panOilPct, doughOilPct, semolina: semolinaPct > 0 }),
    [sch, schIdx, folds, hydration, panOilPct, doughOilPct, semolinaPct]);

  // live texture/flavour profile chips
  const profile = [
    hydration >= 84 ? "open, custardy crumb" : hydration >= 76 ? "airy, balanced crumb" : "tight, bread-y crumb",
    sch.tang,
    folds === 0 ? "pillowy, no shred" : folds <= 2 ? "light flaky shred" : "deeply flaky, shreddy",
    doughOilPct === 0 ? "lean dough" : doughOilPct >= 6 ? "rich & tender" : "lightly enriched",
    panOilPct >= 10 ? "hard fried base" : panOilPct >= 8 ? "crisp fried base" : "lightly crisp base",
    ...(semolinaPct >= 8 ? ["sandy fracturing crust"] : []),
    saltPct >= 2.6 ? "boldly salted" : saltPct <= 2.0 ? "restrained salt" : "well salted",
  ];

  return (
    <div style={{ background: C.paper, minHeight: "100vh", padding: "28px 16px 60px", fontFamily: "'Fraunces', serif", color: C.ink,
      backgroundImage: "radial-gradient(circle at 20% 10%, rgba(168,67,29,0.05), transparent 40%), radial-gradient(circle at 85% 0%, rgba(92,107,47,0.06), transparent 45%)" }}>
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
            {hydration}% hydration<br />{sch.clock} · {sch.name.toLowerCase()}
          </div>
        </div>

        {/* Flour master input */}
        <div style={{ background: C.oliveDeep, borderRadius: 14, padding: "20px 22px", color: C.paper, marginBottom: 16, boxShadow: "0 8px 24px rgba(43,34,24,0.18)" }}>
          <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", opacity: 0.8 }}>
            Total flour — master scale
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
            <input type="number" value={flour} min={0} onChange={(e) => setFlour(e.target.value)}
              style={{ width: 150, fontFamily: "'IBM Plex Mono', monospace", fontSize: 38, fontWeight: 600, background: "transparent", border: "none", borderBottom: `2px solid ${C.crust}`, color: C.paper, outline: "none", padding: "2px 0" }} />
            <span style={{ fontSize: 24, opacity: 0.7 }}>grams</span>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            {[400, 500, 700, 1000].map((val) => (
              <button key={val} onClick={() => setFlour(val)}
                style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, padding: "6px 14px", borderRadius: 20, border: `1px solid ${f === val ? C.crust : "rgba(244,236,224,0.35)"}`, background: f === val ? C.crust : "transparent", color: C.paper, cursor: "pointer", fontWeight: 600 }}>
                {val}g
              </button>
            ))}
          </div>
        </div>

        {/* ---- THE DIALS ---- */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: C.rust, fontWeight: 600, margin: "4px 2px 10px" }}>
          <span>The dials — tune the loaf</span>
          <span style={{ color: C.inkSoft, letterSpacing: 1 }}>recipe recomputes live</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <Dial label="Crumb — hydration" value={hydration} min={65} max={90} step={1}
            onChange={setHydration} readout={`${hydration}% · ${round(v.water)}g`} lo="tight / bread-y" hi="open / custardy"
            why="Water as a % of flour. Gluten forms from hydration plus kneading energy (Cauvain, Ch.2), and more water gives larger, more irregular holes and a moist, custardy crumb — at the cost of a slacker, wetter-to-handle dough. Below ~70% it bakes tighter and more sandwich-bread-like." />
          <Dial label="Ferment & tang" value={schIdx} min={0} max={3} step={1}
            onChange={setSchIdx} readout={`${sch.name} · ${sch.yeast}% yeast`} stops={["same-day", "night", "2-day", "3-day"]}
            accent
            why={`The yeastiness/flavour axis. Long, cold fermentation builds organic acids and deep aroma while relaxing the gluten — so it needs less yeast because it works longer (Cauvain, Ch.2: fermentation → bread flavour). Right now: ${sch.temp}, ${sch.clock} total, ${sch.tang}.`} />
          <Dial label="Flakiness — lamination" value={folds} min={0} max={4} step={1}
            onChange={setFolds} readout={folds === 0 ? "none" : `${folds} oiled fold${folds > 1 ? "s" : ""}`} stops={["0", "1", "2", "3", "4"]}
            why="Letter-folds with oil drizzled between them lay down thin fat films that shred into flaky layers when baked — light lamination, not croissant layers. Zero folds is classic pillowy focaccia; more folds trade some height for a dramatic, tearing pull." />
          <Dial label="Fried base — pan oil" value={panOilPct} min={6} max={12} step={1}
            onChange={setPanOilPct} readout={`${panOilPct}% · ${round(v.panOil)}g`} lo="light fry" hi="deep shallow-fry" accent
            why="Olive oil flooded into a dark metal pan shallow-fries the base into a crisp, blistered shell as it bakes. More oil = a deeper fry and a crunchier, more savoury bottom — push it too far and the very edges can turn greasy, so pair high oil with the longer bake." />
          <Dial label="Dough oil — richness" value={doughOilPct} min={0} max={10} step={0.5}
            onChange={setDoughOilPct} readout={doughOilPct === 0 ? "none" : `${round(doughOilPct, 1)}% · ${round(v.doughOil)}g`} lo="lean / Ligurian" hi="rich / tender"
            why="Olive oil worked into the dough itself. Cauvain (Ch.2, Table 2.2) lists fat at 1–2% of flour as an optional improver that raises gas retention and crumb softness; the fat lubricates and shortens the gluten for a more tender, finer crumb and longer keeping. Focaccia genovese typically runs ~5%. Fat also softens the dough (Cauvain, Ch.9), so at high oil pull the water back a couple of points. Add it after the gluten has started forming — oil early in the mix coats the proteins and slows development." />
          <Dial label="Salt" value={saltPct} min={1.6} max={2.8} step={0.1}
            onChange={setSaltPct} readout={`${round(saltPct, 1)}% · ${round(v.salt, 1)}g`} lo="lean" hi="bold"
            why="Salt seasons, but it also tightens the gluten network and slows the yeast — bakers even delay adding it to speed early fermentation (Cauvain, Ch.2). Higher salt = stronger structure and a slower rise; 2.2–2.5% is the usual focaccia window." />
          <Dial label="Semolina swap" value={semolinaPct} min={0} max={15} step={1}
            onChange={setSemolinaPct} readout={semolinaPct === 0 ? "none" : `${semolinaPct}% · ${round(v.sem)}g`} lo="all bread flour" hi="15% durum"
            why="Swapping in durum semolina adds golden colour and a sandy, fracturing crust. It dilutes the gluten, though, so too much (beyond ~15%) dulls the rise and toughens the crumb." />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginBottom: 12 }}>
          <Toggle on={twoPans} onClick={() => setTwoPans((s) => !s)} label="Split into 2 pans" sub="e.g. cherry-tomato + plain" />
        </div>

        {/* Live profile chips */}
        <div style={{ background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: "13px 15px", marginBottom: 22 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: 1.5, textTransform: "uppercase", color: C.inkSoft, fontWeight: 600, marginBottom: 9 }}>
            This build tastes like
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {profile.map((p, i) => (
              <span key={i} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, padding: "5px 11px", borderRadius: 20, background: C.paperDeep, color: C.oliveDeep, fontWeight: 600, border: `1px solid ${C.line}` }}>{p}</span>
            ))}
          </div>
        </div>

        {/* Grouped ingredient table */}
        <div style={{ borderRadius: 14, border: `1.5px solid ${C.line}`, overflow: "hidden", marginBottom: 14, background: C.card }}>
          {groups.map((grp, gi) => (
            <div key={grp.title}>
              <div style={{ padding: "11px 18px 9px", background: grp.brine ? "rgba(168,67,29,0.07)" : C.paperDeep, borderTop: gi === 0 ? "none" : `1.5px solid ${C.line}` }}>
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
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: C.inkSoft }}>{r.note ? "—" : "to taste"}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Yield summary */}
        <div style={{ display: "flex", gap: 10, marginBottom: 28, flexWrap: "wrap" }}>
          <div style={summaryCard}><div style={summaryLabel}>Total dough</div><div style={summaryVal}>{round(v.doughWeight)}g</div></div>
          <div style={summaryCard}><div style={summaryLabel}>{twoPans ? "Per pan (×2)" : "Single pan"}</div><div style={summaryVal}>{round(perPan)}g</div></div>
          <div style={summaryCard}><div style={summaryLabel}>Total olive oil</div><div style={summaryVal}>{round(v.totalOil)}g</div></div>
          <div style={summaryCard}><div style={summaryLabel}>Suggested pan</div><div style={{ ...summaryVal, fontSize: 17 }}>{panHint(perPan)}</div></div>
        </div>

        {/* Process */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: C.rust, fontWeight: 600, marginBottom: 12 }}>
          <span>Process — tap for the why</span>
          <span style={{ color: C.inkSoft, letterSpacing: 1 }}>{sch.clock}{express ? " + bake" : ""}</span>
        </div>

        {STEPS.map((s) => {
          const open = openStep === s.n;
          return (
            <div key={s.n} style={{ border: `1.5px solid ${open ? C.olive : C.line}`, borderRadius: 12, marginBottom: 9, overflow: "hidden", background: open ? C.card : "transparent", transition: "border-color .18s ease" }}>
              <button onClick={() => setOpenStep(open ? "" : s.n)} style={{ width: "100%", display: "flex", gap: 14, alignItems: "flex-start", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", padding: "14px 16px", fontFamily: "'Fraunces', serif", color: C.ink }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600, color: open ? C.olive : C.crust, paddingTop: 3 }}>{s.n}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ fontSize: 19, fontWeight: 600, display: "block" }}>{s.title}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.inkSoft }}>{s.spec}</span>
                </span>
                <span style={{ fontSize: 20, color: C.olive, transform: open ? "rotate(45deg)" : "none", transition: "transform .2s ease", lineHeight: 1, paddingTop: 2 }}>+</span>
              </button>
              {open && <div style={{ padding: "0 16px 16px 44px", fontSize: 15.5, lineHeight: 1.55, color: C.inkSoft, animation: "riseIn .25s ease" }}>{s.why}</div>}
            </div>
          );
        })}

        {/* Tomato note */}
        {twoPans && (
          <div style={{ marginTop: 22, background: C.card, border: `1.5px dashed ${C.rust}`, borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 4 }}>🍅 Cherry-tomato pan</div>
            <div style={{ fontSize: 15, lineHeight: 1.55, color: C.inkSoft }}>
              Halve the tomatoes and press the cut faces up into the dough <em>at dimpling time</em>, alongside the brine — they
              should sit in the oily wells so they roast and blister rather than steam. Rosemary needles after they're seated.
              Keep the plain pan austere: just the brine, deep dimples, and flaky salt so you can taste the crust work.
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 26, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.inkSoft, letterSpacing: 1, lineHeight: 1.6 }}>
          baker's % locked to flour mass · everything scales live<br />
          science notes drawn from the repo reference corpus
        </div>
      </div>
    </div>
  );
}

const summaryCard = { flex: "1 1 130px", background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: "13px 16px" };
const summaryLabel = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: 1.2, textTransform: "uppercase", color: C.inkSoft, marginBottom: 4 };
const summaryVal = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 600, color: C.oliveDeep };

function panHint(g) {
  if (g <= 0) return "—";
  if (g < 700) return '8×8"';
  if (g < 1100) return '9×13"';
  if (g < 1700) return "quarter sheet";
  return "half sheet";
}
