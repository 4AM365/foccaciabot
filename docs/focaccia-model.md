---
title: Focaccia model — the equations
---

> [!abstract]
> The focaccia calculator is a small **multivariate system of coupled algebraic
> equations**, solved in two directions. Forward: a recipe flows through a layer of
> *constitutive* equations into a latent dough state, then through a layer of
> *observation* equations into six sensory qualities. Inverse: hold the **identity**
> fixed and coordinate-descend the **levers** until the qualities match a target.
>
> ```
> recipe ──(constitutive)──▶ latent dough state ──(observation)──▶ qualities
> ```

## Reading the graph

- **Identity** (dashed) is what makes a focaccia *what it is* — the ferment schedule,
  durum-semola share, boiled-potato share, the two-pan deep bake. The inverse never
  solves it away.
- **Levers** are the continuous dials tuned *within* an identity: hydration, folds,
  pan oil, dough oil, salt.
- Every arrow is a term in the equation written inside the node it points to. A node
  with many incoming arrows is where variables couple.

**Helpers.** `clamp(x, lo, hi)` clips `x` to `[lo, hi]`; `sat(x) = clamp(x, 0, 1)`;
`lin(x, lo, hi)` maps `x` from `[lo, hi]` onto the **0–100** quality scale (clipped).
Units are baker's % ÷ 100, so flour = 1.

## Forward model

```mermaid
graph LR
  subgraph ID["Identity — held fixed by the inverse"]
    sch["sch = schIdx  (0–3)"]
    SEM["SEM = semolina/100"]
    POT["POT = potato/100"]
    twoPans["twoPans  (method flag)"]
  end
  subgraph LV["Levers — tuned within an identity"]
    H["H = hydration/100"]
    folds["folds  (0–4)"]
    PO["PO = panOil/100"]
    DO["DO = doughOil/100"]
    S["S = salt/100"]
  end

  subgraph L1["Latent dough state — constitutive equations"]
    slack["slack = clamp(H − 0.60, 0, 0.40)"]
    gluten["gluten = clamp( (0.55 + 0.15·folds)<br/>· (1 + 0.10·sch) · (1 − 0.6·DO)<br/>· (1 − 0.4·SEM) · (1 − 0.5·POT), 0, 2 )"]
    gas["gas = 0.45 + 0.17·sch"]
    tangState["tangState = 0.05 + 0.30·sch"]
    ovenSpring["ovenSpring = gas · sat(gluten)<br/>· (0.55 + 0.45·sat(slack/0.25))"]
    blister["blister = sat((H − 0.76)/0.14)"]
    friedBase["friedBase = PO"]
  end

  subgraph L2["Sensory qualities — observation equations (0–100)"]
    openness["openness = lin( 1.5·slack + 0.6·gas<br/>+ 0.6·ovenSpring − 1.1·DO<br/>− 0.25·(1 − sat(gluten)), 0.05, 1.10 )"]
    tang["tang = lin(tangState, 0, 1)"]
    flake["flake = lin( folds·(0.45<br/>+ 0.55·sat(gluten)), 0, 4 )"]
    crust["crust = lin( 6.0·friedBase + 0.4·blister<br/>+ 1.2·SEM − 0.7·DO, 0.30, 0.95 )"]
    richness["richness = lin(DO + 0.30·PO, 0, 0.135)"]
    salt["salt = lin(S, 0.016, 0.028)"]
  end

  %% recipe → latent (constitutive)
  H --> slack
  folds --> gluten
  sch --> gluten
  DO --> gluten
  SEM --> gluten
  POT --> gluten
  sch --> gas
  sch --> tangState
  gas --> ovenSpring
  gluten --> ovenSpring
  slack --> ovenSpring
  H --> blister
  PO --> friedBase

  %% latent (+ direct recipe terms) → qualities (observation)
  slack --> openness
  gas --> openness
  ovenSpring --> openness
  DO --> openness
  gluten --> openness
  tangState --> tang
  folds --> flake
  gluten --> flake
  friedBase --> crust
  blister --> crust
  SEM --> crust
  DO --> crust
  DO --> richness
  PO --> richness
  S --> salt

  classDef identity stroke-dasharray:6 3,stroke-width:1.5px;
  class sch,SEM,twoPans,POT identity;
```

`twoPans` is an identity dimension that selects the bake *method/format* but does not
enter these algebraic equations — it carries no outgoing arrow.

## Inverse — solve levers, identity held

The UI drives the **qualities** (six sliders) and asks for a recipe. With the identity
fixed, the solver coordinate-descends the five levers to minimise a regularised
squared-error loss, so freestyle targets still land on a real style.

```mermaid
graph LR
  target["target qualities  q*<br/>(6 slider values)"]
  identity["identity held fixed<br/>(sch, SEM, twoPans)"]
  guess["lever guess  x<br/>(hydration, folds, panOil,<br/>doughOil, salt)"]
  fwd["forward model<br/>q = qualities(identity, x)"]
  loss["loss = Σₖ wₖ·(qₖ − q*ₖ)²<br/>+ 5·Σⱼ ((xⱼ − priorⱼ)/(hiⱼ − loⱼ))²"]
  step["coordinate descent<br/>8 passes × each lever × ±1…8 steps<br/>(keep a move only if loss drops)"]
  out["solved levers (rounded)<br/>+ residual = 'can this style get there?'"]

  target --> loss
  identity --> fwd
  guess --> fwd
  fwd --> loss
  loss --> step
  step -->|update x| guess
  step --> out
```

The second term in the loss is a **prior pull** toward each lever's default — it keeps
solutions plausible when the qualities under-determine the recipe. A high residual means
the held identity simply *can't* reach the requested qualities.

## Provenance

Coefficients are hand-set and cited to the corpus — gluten development and oven spring
from Cauvain's *Technology of Breadmaking*, fat-shortening and flour-gluten effects from
Bressanini's *Scienza della Pasticceria*. See `CITES` in
[`focaccia-model.js`](https://github.com/4AM365/foccaciabot/blob/master/src/focaccia-model.js).

Try it on the [Focaccia Calculator](/kitchen/focaccia-calculator).
