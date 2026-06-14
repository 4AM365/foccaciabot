# foccaciabot

Two things live here, and they're connected:

1. **An interactive focaccia calculator** — a quality-driven dashboard. You drive
   the *qualities* you want (open crumb, tang, flake, crust, richness, salt) and
   pick a *style*; an inverse model solves back to a full baker's-percentage
   formula and method, live.
2. **A RAG reference corpus** — cleaned notes distilled from three baking-science
   books, used to *ground* the calculator's coefficients (and any downstream
   focaccia assistant) in **why** a formula behaves the way it does — hydration,
   fermentation, gluten development, oven dynamics — rather than just recipes.

The calculator's dial-science is cited straight to the corpus: every coefficient
in the model traces to a chunk (see `CITES` in `src/focaccia-model.js`).

## The calculator

| File | What it is |
|------|------------|
| `src/focaccia-model.js` | **The model — the meat.** A two-layer system (recipe → latent dough state → sensory qualities) plus an identity-fixed inverse that solves *qualities → recipe* by gradient descent. Exports `qualities()`, `solveWithin()`, `solveConforming()`, `classify()`, `deviations()`, `QUALITY_AXES`, `IDENTITY_KEYS`. |
| `focaccia-build-sheet.jsx` | The React UI — a slider per quality axis, style picker, live recipe + step-by-step method, theming (light / dark / a GeoCities skin), and toppings. |
| `src/main.jsx` + `index.html` | Vite harness that mounts the build sheet for standalone local dev. |

The model's central idea: a focaccia's **identity** (ferment schedule, durum-semola
vs. plain wheat, two-pan deep bake) is never solved away — it's what makes a style
what it is. The continuous **levers** (hydration, lamination folds, oils, salt) are
tuned *within* that identity to hit your target qualities.

### Run it

```bash
npm install
npm run dev        # Vite dev server on http://localhost:5173
npm run build      # production bundle → dist/
```

### Used by the blog

This repo is the **single source of truth** for the focaccia widget on the 4AM365
blog. It's consumed as a git dependency (`github:4AM365/foccaciabot`, package name
`focaccia-widget`) — the blog holds only a one-line re-export shim, **not a copy**.
The blog bundles it with esbuild, aliasing React → `preact/compat` at its own build
step, so the component imports plain `react` here and stays portable across both
build systems.

To ship a change to the live widget, run the integration pipeline from this repo.
It commits + pushes here, then in the blog pulls the new commit, rebuilds the widget
bundle, syncs the model doc, and commits + pushes (which auto-deploys):

```bash
npm run publish:blog -- "your change description"
# equivalently: node scripts/publish.mjs "your change description"
```

`docs/focaccia-model.md` is the **canonical** model-equations explainer; the pipeline
publishes a copy to the blog at `/kitchen/focaccia-model`. Keep this repo all-inclusive
— the model code, the calculator, and the model docs all live here.

## The reference corpus

RAG-ready notes distilled from three baking-science references, for grounding the
calculator (and any focaccia assistant) in *why* a formula behaves the way it does.

## What's tracked vs. ignored

| Path | In git? | What it is |
|------|:-------:|------------|
| `*.epub`, `*.pdf` | ❌ ignored | The **purchased source books** (binaries). Never committed. |
| `notes/` | ✅ committed | Cleaned, per-section Markdown extracted from the books (human-reviewable). |
| `data/chunks.jsonl` | ✅ committed | The embeddable RAG corpus — one chunk per line, with metadata. |
| `data/manifest.json` | ✅ committed | Corpus stats + per-book index. |
| `scripts/` | ✅ committed | The reproducible extraction + chunking pipeline. |

The source books are licensed/purchased copies kept locally; only the derived
notes are version-controlled.

## Sources

| Slug | Book | Lang | Role |
|------|------|:----:|------|
| `cauvain-technology-of-breadmaking` | Cauvain & Young, *Technology of Breadmaking* (Springer, 1998) | en | **core** — the academic reference; dough rheology, fermentation, baking. |
| `mcgee-on-food-and-cooking` | McGee, *On Food and Cooking* (1984) | en | **high** — Ch. 9 (Grains) & Ch. 10 (Cereal Doughs: Bread) are the bread core. |
| `bressanini-scienza-della-pasticceria` | Bressanini, *La scienza della pasticceria* (Gribaudo, 2014) | it | **general** — baking chemistry (gluten, leavening, flour). |

Current corpus: **748 notes → ~1,737 chunks (~1.0M tokens)**, of which ~648 are
flagged `bread_relevant`. Regenerate the exact numbers with the pipeline below.

## Pipeline

```bash
pip install -r requirements.txt          # beautifulsoup4, lxml, PyMuPDF

python scripts/extract_epub.py           # EPUBs  -> notes/<slug>/*.md
python scripts/extract_pdf.py            # PDF    -> notes/<slug>/*.md
python scripts/build_corpus.py           # notes/ -> data/chunks.jsonl + manifest.json
```

`notes/` is the source of truth; `data/` is fully derived from it. Re-running is
idempotent for a given set of source books.

### How extraction works

- **EPUB** (`extract_epub.py`): reads the spine + NCX table of contents directly
  (ebooklib chokes on these files' broken font manifests). Sectioning is
  TOC-driven via anchor IDs, because every page repeats the book title as an
  `<h1>`. Handles both nested TOCs (Bressanini) and flat TOCs where chapter
  titles are listed before a separate flat list of sub-sections (McGee), mapping
  sub-sections to chapters by spine position. Decodes cp1252-mislabeled-as-UTF-8
  bytes so Italian/French accents survive.
- **PDF** (`extract_pdf.py`): the book has no bookmarks, so chapters are detected
  from numbered title lines (`"3 Functional ingredients"`) validated by
  monotonic numbering. Running headers/footers (page numbers, the ALL-CAPS
  running title) are stripped; printed page numbers are captured as inline
  markers so each chunk gets a precise `page` for citation. Front matter
  (title/copyright/contents OCR noise) is skipped.

### Chunk schema (`data/chunks.jsonl`)

Each line is one JSON object:

```jsonc
{
  "id": "cauvain-...:0004:12:ab12cd34",  // stable: book:order:index:hash
  "book_slug": "cauvain-technology-of-breadmaking",
  "book": "Technology of Breadmaking",
  "author": "Stanley P. Cauvain & Linda S. Young",
  "year": 1998,
  "lang": "en",
  "relevance": "core",                    // book-level
  "bread_relevant": true,                 // chunk-level focaccia filter
  "chapter": "Chapter 4: Mixing and dough processing",
  "heading": "Chapter 4: Mixing and dough processing",
  "breadcrumb": ["Chapter 4: ...", "..."],
  "page": 98,                             // printed page (PDF) or null (EPUB)
  "citation": "Stanley P. Cauvain, Technology of Breadmaking (1998), Chapter 4..., p.98",
  "source_note": "notes/cauvain-.../0005-....md",
  "tokens_est": 587,
  "text": "An integral part of all breadmaking is..."
}
```

Chunks target ~800 tokens with ~100 tokens of overlap, packed on paragraph
boundaries (oversized paragraphs are sentence-split). Token counts are estimated
as `chars/4` to avoid a tokenizer dependency.

### Consuming the corpus

`chunks.jsonl` is embedder-agnostic. Typical next step: embed each `text`,
store with the metadata, and at query time filter on `bread_relevant` (or weight
by `relevance`) before vector search. The `citation` field is ready to surface
in answers.
