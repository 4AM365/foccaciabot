import React, { useState, useMemo } from "react";

// ---- Baker's percentages (relative to total flour = 100%) ----
const BP = {
  water: 85,   // dough hydration
  salt: 2.4,   // dough salt
};
const YEAST = { long: 0.6, express: 2.0 };
const SUGAR_EXPRESS = 0.5;
const SEMOLINA_PCT = 5;
const FOLD_OIL = 2;      // drizzled between folds (lamination)
const BRINE_WATER = 5;   // salamoia — poured into the dimples
const BRINE_OIL = 5;     // salamoia oil

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

function round(n, dp = 0) {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}

function Num({ children }) {
  return (
    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>{children}</span>
  );
}

function Toggle({ on, onClick, label, sub }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
        background: on ? C.olive : "transparent", color: on ? C.paper : C.ink,
        border: `1.5px solid ${on ? C.olive : C.line}`, borderRadius: 10, padding: "12px 14px",
        cursor: "pointer", transition: "all .18s ease", fontFamily: "'Fraunces', serif",
      }}
    >
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

const STEPS_LONG = [
  { n: "01", title: "Autolyse", spec: "ALL flour + all dough water · rest 30–45 min · then add yeast + salt",
    why: "Mix all the flour with all the dough water to a shaggy mass and walk away. Every bit of flour hydrates fully, and the flour's own enzymes start cleaving and re-linking gluten on their own — you get extensibility and structure for free, and need far less mixing afterward. Hold the yeast and salt until after the rest: salt tightens gluten and slows the enzymes, and yeast would start fermenting before you've built structure. (Holding back half the flour would only autolyse half of it and force more mixing on the rest — no upside unless you're actually building a yeasted preferment.)" },
  { n: "02", title: "Mixer development", spec: "dough hook · low speed · 6–8 min",
    why: "You want a moderate, well-organized gluten matrix — not max strength. Enough structure to trap gas and hold the lamination layers, but loose enough to stay extensible. At 85% hydration the dough should pull off the hook in a slack, glossy sheet. Stop when it's cohesive and starting to clear the bowl walls, not bone-dry." },
  { n: "03", title: "Stretch & folds", spec: "4 sets · 30 min apart",
    why: "Folding builds strength in layers without overworking the dough. Each set realigns and tensions the gluten and redistributes the yeast's gas and food. Four sets over two hours turns a slack puddle into a billowy, structured mass that can survive a long cold ferment and still hold deep dimples." },
  { n: "04", title: "Cold fermentation", spec: "48–72 hr · 72 hr preferred",
    why: "The cold retard is where flavor and texture are won. Slow fermentation produces organic acids and deep, complex flavor while the gluten relaxes and the structure becomes uniform and extensible. 72 hours gives the most developed taste and the most workable, lamination-ready dough." },
  { n: "05", title: "Layering — the flaky trick", spec: "stretch · drizzle fold oil · letter-fold · rest 15 · repeat",
    why: "This is the move that pushes it past classic focaccia. After the cold ferment, stretch to a rectangle, drizzle the fold oil, and do a letter fold — then rest and repeat. The thin oil films between folds create subtle internal partitions that shred and tear when baked. It's a light touch of lamination: not croissant layers, just enough to get that dramatic, flaky pull. The 15-min rests let the gluten relax so you can re-stretch without tearing." },
  { n: "06", title: "Pan proof", spec: "dark metal pan · all the pan oil · relax before stretching to corners",
    why: "A dark metal pan absorbs and transfers heat aggressively — that's what fries the bottom into a crisp shell. Pour in all the pan oil; the dough essentially shallow-fries from below. Don't force it into the corners cold — let it relax and spread on its own over the proof, or it'll just spring back and tear." },
  { n: "07", title: "Final proof", spec: "until extremely bubbly & jiggly · err over- not under-proof",
    why: "You want it visibly alive — domed, bubbly, wobbling when nudged. Under-proofed focaccia bakes dense and tight. For this texture-forward target, leaning slightly past full proof gives the lightest, most shred-prone crumb. When the surface is blistered and it jiggles, it's ready." },
  { n: "08", title: "Dimple + brine", spec: "oil fingers · press nearly to pan bottom · spoon brine into the wells",
    why: "Oil your fingers, then drive them straight down almost to the pan. Aggressive dimples create the lunar-landscape surface and define the high ridges that crunch against soft valleys. Now whisk the brine (water + oil + salt) and spoon it over so it pools in the wells — the water steams off and concentrates the salt and oil into crisp, seasoned, caramelized pockets. Shy dimples bake out and won't hold the brine; commit fully." },
  { n: "09", title: "Bake", spec: "500°F / 260°C · 8 min  →  450°F / 232°C · 12–15 min",
    why: "The blast of initial heat maximizes oven spring and sets the crust fast while the oil sears the base. Dropping to 450°F afterward finishes the interior and deepens color without scorching the oil — pushed too hot too long, it turns acrid. Pull it deep golden-brown, edges crackling." },
];

const STEPS_EXPRESS = [
  { n: "01", title: "Fermentolyse — warm", spec: "ALL flour + all WARM water (95–100°F) + yeast + sugar · rest 20 min · then add salt",
    why: "On a two-hour clock you want fermentation starting immediately, so this is a fermentolyse: mix all the flour with all the warm water plus the yeast and sugar, and let it sit 20 min. The warm water primes hydration and wakes the yeast from minute one, while the short rest still hydrates all the flour and hands you extensibility for free. Hold only the salt until after — it tightens gluten and would blunt the fast start you're after. (No reason to hold back flour here either; you'd just autolyse half of it and have to mix the rest in dry.)" },
  { n: "02", title: "Mixer development", spec: "dough hook · low speed · 6–8 min",
    why: "Build a moderate, cohesive gluten matrix — enough to trap gas fast and hold the quick layers. Warm dough develops quickly, so watch it: glossy and clearing the bowl, not over-beaten and hot. Keep mixer time to the lower end if the dough warms past ~78°F." },
  { n: "03", title: "Warm bulk + oiled folds — the 1 hr rise", spec: "warm spot ~80–85°F · 2 oiled letter-folds at 20 & 40 min",
    why: "This single warm hour does the job the long ferment normally would — heat drives the gas and the elevated yeast makes it happen fast. Fold for strength, but here's the efficiency: drizzle the fold oil before each letter-fold so the same two folds also build your flaky layers. You're collapsing strength-building and the lamination trick into the bulk. Find real warmth — oven with the light on, or near the stove. Not visibly puffy at the hour? Give it another 15–20 min; the clock is a target, dough readiness is the rule." },
  { n: "04", title: "Pan + final proof — the 1 hr proof", spec: "dark metal pan · all the pan oil · proof warm until bubbly & jiggly · err over- not under",
    why: "Pour all the pan oil into a dark metal pan — that's what shallow-fries the base into a crisp shell. Transfer the dough, let it relax (don't fight it into the corners), and proof warm. A short proof leans on warmth, so keep it in that 80–85°F spot. Push slightly past full proof rather than under: domed, bubbly, wobbling. Sluggish at an hour? Wait it out — underproofed express dough bakes tight and bready." },
  { n: "05", title: "Dimple + brine", spec: "oil fingers · press nearly to pan bottom · spoon brine into the wells",
    why: "Oil your fingers and drive them straight down almost to the pan. Aggressive dimples give the lunar-landscape surface and set the ridges that crunch against the soft valleys — on a same-day dough they help even more, the deeper structure compensating for the shorter ferment. Then whisk the brine (water + oil + salt) and spoon it over so it pools in the wells; the water flashes off and concentrates salt and oil into crisp, seasoned pockets. Commit fully — shy dimples bake out and won't hold the brine." },
  { n: "06", title: "Bake", spec: "500°F / 260°C · 8 min  →  450°F / 232°C · 12–15 min",
    why: "The initial blast maximizes oven spring and sears the oiled base while the crust sets. Drop to 450°F to finish the interior and deepen color without scorching the oil. Pull it deep golden-brown with crackling edges — a same-day loaf especially wants that hard crust to carry the texture, since you didn't bank the long-ferment flavor." },
];

export default function FocacciaBuildSheet() {
  const [flour, setFlour] = useState(500);
  const [semolina, setSemolina] = useState(false);
  const [panOilPct, setPanOilPct] = useState(8);
  const [twoPans, setTwoPans] = useState(true);
  const [mode, setMode] = useState("express");
  const [openStep, setOpenStep] = useState("01");

  const f = Math.max(0, Number(flour) || 0);
  const express = mode === "express";
  const yeastPct = YEAST[mode];

  const v = useMemo(() => {
    const breadFlour = semolina ? f * (1 - SEMOLINA_PCT / 100) : f;
    const sem = semolina ? f * (SEMOLINA_PCT / 100) : 0;
    const water = f * (BP.water / 100);
    const salt = f * (BP.salt / 100);
    const yeast = f * (yeastPct / 100);
    const sugar = express ? f * (SUGAR_EXPRESS / 100) : 0;
    const panOil = f * (panOilPct / 100);
    const foldOil = f * (FOLD_OIL / 100);
    const brineWater = f * (BRINE_WATER / 100);
    const brineOil = f * (BRINE_OIL / 100);
    const doughWeight = f + water + salt + yeast + sugar;
    const totalOil = panOil + foldOil + brineOil;
    return { breadFlour, sem, water, salt, yeast, sugar, panOil, foldOil, brineWater, brineOil, doughWeight, totalOil };
  }, [f, semolina, panOilPct, yeastPct, express]);

  const groups = [
    {
      title: "Dough",
      items: [
        { k: "Bread flour", g: round(v.breadFlour), pct: semolina ? 95 : 100 },
        ...(semolina ? [{ k: "Semolina", g: round(v.sem), pct: SEMOLINA_PCT, accent: true }] : []),
        { k: express ? "Water — warm, 95–100°F" : "Water", g: round(v.water), pct: BP.water },
        { k: "Salt", g: round(v.salt, 1), pct: BP.salt },
        { k: "Instant yeast", g: round(v.yeast, 1), pct: yeastPct, accent: express, note: express ? "bumped for the short clock" : undefined },
        ...(express ? [{ k: "Sugar or honey", g: round(v.sugar, 1), pct: SUGAR_EXPRESS, note: "jump-starts yeast" }] : []),
      ],
    },
    {
      title: "Pan & folds",
      caption: "the oil that fries the base + laminates the layers",
      items: [
        { k: "Olive oil — pan", g: round(v.panOil), pct: panOilPct, note: "floods the dark pan" },
        { k: "Olive oil — folds", g: round(v.foldOil), pct: FOLD_OIL, note: "drizzled between letter-folds" },
      ],
    },
    {
      title: "Brine — salamoia",
      caption: "whisk together, spoon into the dimples right before baking",
      brine: true,
      items: [
        { k: "Water", g: round(v.brineWater), pct: BRINE_WATER, accent: true },
        { k: "Olive oil", g: round(v.brineOil), pct: BRINE_OIL, accent: true },
        { k: "Flaky salt", g: null, pct: null, note: "to finish, over the top" },
      ],
    },
  ];

  const perPan = twoPans ? v.doughWeight / 2 : v.doughWeight;
  const STEPS = express ? STEPS_EXPRESS : STEPS_LONG;

  return (
    <div style={{ background: C.paper, minHeight: "100vh", padding: "28px 16px 60px", fontFamily: "'Fraunces', serif", color: C.ink,
      backgroundImage: "radial-gradient(circle at 20% 10%, rgba(168,67,29,0.05), transparent 40%), radial-gradient(circle at 85% 0%, rgba(92,107,47,0.06), transparent 45%)" }}>
      <style>{FONTS}</style>
      <div style={{ maxWidth: 720, margin: "0 auto", animation: "riseIn .5s ease" }}>
        {/* Header */}
        <div style={{ borderBottom: `2px solid ${C.ink}`, paddingBottom: 14, marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: C.rust, fontWeight: 600 }}>
              Build Sheet · v5 · hot-rodded
            </div>
            <h1 style={{ margin: "4px 0 0", fontSize: 40, fontWeight: 900, letterSpacing: -1, lineHeight: 0.95 }}>Flaky Focaccia</h1>
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, textAlign: "right", color: C.inkSoft, lineHeight: 1.5 }}>
            85% hydration<br />crisp shell · shred crumb
          </div>
        </div>

        {/* Mode switch */}
        <div style={{ display: "flex", gap: 6, background: C.paperDeep, padding: 6, borderRadius: 12, marginBottom: 16 }}>
          {[{ id: "express", label: "Same-day express", sub: "1 hr rise · 1 hr proof" }, { id: "long", label: "Long ferment", sub: "48–72 hr cold" }].map((m) => {
            const active = mode === m.id;
            return (
              <button key={m.id} onClick={() => setMode(m.id)} style={{ flex: 1, border: "none", borderRadius: 9, padding: "10px 8px", cursor: "pointer", background: active ? C.ink : "transparent", color: active ? C.paper : C.inkSoft, fontFamily: "'Fraunces', serif", transition: "all .18s ease" }}>
                <span style={{ display: "block", fontWeight: 600, fontSize: 15 }}>{m.label}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, opacity: 0.8 }}>{m.sub}</span>
              </button>
            );
          })}
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

        {/* Options */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <Toggle on={semolina} onClick={() => setSemolina((s) => !s)} label="5% semolina swap" sub="more crust fracture" />
          <Toggle on={twoPans} onClick={() => setTwoPans((s) => !s)} label="Split 2 pans" sub="cherry tomato + plain" />
        </div>

        {/* Pan oil slider */}
        <div style={{ background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 10, padding: "14px 16px", marginBottom: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>Pan oil — the fry</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.rust, fontWeight: 600 }}>{panOilPct}% · {round(v.panOil)}g</span>
          </div>
          <input type="range" min={6} max={11} step={1} value={panOilPct} onChange={(e) => setPanOilPct(Number(e.target.value))} style={{ width: "100%", accentColor: C.olive }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.inkSoft, marginTop: 2 }}>
            <span>light fry</span><span>full shallow-fry</span>
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
                {grp.caption && (
                  <div style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 2, fontStyle: "italic" }}>{grp.caption}</div>
                )}
              </div>
              {grp.items.map((r, i) => (
                <div key={r.k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", borderTop: i === 0 ? "none" : `1px solid ${C.paperDeep}` }}>
                  <span style={{ fontSize: 16, fontWeight: 500 }}>
                    {r.k}
                    {r.note && <span style={{ display: "block", fontSize: 11, color: C.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>{r.note}</span>}
                  </span>
                  <span style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {r.pct != null && (
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: r.accent ? C.rust : C.inkSoft, marginRight: 10 }}>{r.pct}%</span>
                    )}
                    {r.g != null ? (
                      <>
                        <Num><span style={{ fontSize: 19, color: r.accent ? C.rust : C.ink }}>{r.g}</span></Num>
                        <span style={{ fontSize: 13, color: C.inkSoft }}> g</span>
                      </>
                    ) : (
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: C.inkSoft }}>to taste</span>
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
          <span style={{ color: C.inkSoft, letterSpacing: 1 }}>{express ? "~2.5 hr + bake" : "~3 days"}</span>
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
        <div style={{ marginTop: 22, background: C.card, border: `1.5px dashed ${C.rust}`, borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 4 }}>🍅 Cherry-tomato pan</div>
          <div style={{ fontSize: 15, lineHeight: 1.55, color: C.inkSoft }}>
            Halve the tomatoes and press the cut faces up into the dough <em>at dimpling time</em>, alongside the brine — they
            should sit in the oily wells so they roast and blister rather than steam. Rosemary needles after they're seated.
            Keep the plain pan austere: just the brine, deep dimples, and flaky salt so you can taste the crust work.
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 26, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.inkSoft, letterSpacing: 1 }}>
          baker's % locked to flour mass · everything above scales live
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
