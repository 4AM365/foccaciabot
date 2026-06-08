"""Shared helpers for the foccaciabot RAG preprocessing pipeline.

The pipeline turns purchased reference books (EPUB/PDF, git-ignored) into
committable, RAG-appropriate notes:

    <book>.epub / .pdf  --extract-->  notes/<slug>/NN-section.md  --chunk-->  data/chunks.jsonl

`notes/` is the human-reviewable source of truth (one Markdown file per
section, with YAML front matter). `data/chunks.jsonl` + `data/manifest.json`
are the machine artifacts an embedder/retriever consumes.
"""
from __future__ import annotations

import glob
import hashlib
import json
import re
import unicodedata
from dataclasses import dataclass, field, asdict
from pathlib import Path

# --- Layout -----------------------------------------------------------------

ROOT = Path(__file__).resolve().parent.parent
NOTES_DIR = ROOT / "notes"
DATA_DIR = ROOT / "data"


# --- Book registry ----------------------------------------------------------
# Filenames in this repo are noisy (Anna's Archive hashes), so we identify each
# book by a substring match and attach clean, stable metadata. `relevance`
# flags how central a book is to focaccia specifically — carried into chunk
# metadata so the retriever can weight bread science over, say, the chapter on
# distilled spirits.

@dataclass(frozen=True)
class Book:
    slug: str
    title: str
    author: str
    year: int
    lang: str          # ISO 639-1
    kind: str          # "epub" | "pdf"
    match: str         # case-insensitive substring used to find the file
    relevance: str     # "core" | "high" | "general"
    note: str = ""


BOOKS: list[Book] = [
    Book(
        slug="cauvain-technology-of-breadmaking",
        title="Technology of Breadmaking",
        author="Stanley P. Cauvain & Linda S. Young",
        year=1998,
        lang="en",
        kind="pdf",
        match="technology of breadmaking",
        relevance="core",
        note="Academic reference. Dough rheology, fermentation, oven processes.",
    ),
    Book(
        slug="mcgee-on-food-and-cooking",
        title="On Food and Cooking: The Science and Lore of the Kitchen",
        author="Harold McGee",
        year=1984,
        lang="en",
        kind="epub",
        match="on food and cooking",
        relevance="high",
        note="Ch. 9 (Grains) and Ch. 10 (Cereal Doughs: Bread) are the bread core.",
    ),
    Book(
        slug="bressanini-scienza-della-pasticceria",
        title="La scienza della pasticceria",
        author="Dario Bressanini",
        year=2014,
        lang="it",
        kind="epub",
        match="scienza della pasticceria",
        relevance="general",
        note="Italian. Baking chemistry (gluten, leavening, sugars, fats).",
    ),
]


def find_source(book: Book) -> Path | None:
    """Locate the on-disk file for a registry entry by substring match."""
    for p in sorted(ROOT.glob("*")):
        if p.is_file() and book.match in p.name.lower():
            return p
    return None


# --- Text decoding & cleaning ----------------------------------------------

def decode_bytes(raw: bytes) -> str:
    """Decode bytes that *claim* UTF-8 but are often cp1252 (these EPUBs are).

    Strategy: trust strict UTF-8 only if it succeeds cleanly; otherwise fall
    back to cp1252, then latin-1. This recovers `più`/`perché`/`crème` instead
    of producing U+FFFD replacement characters.
    """
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        for enc in ("cp1252", "latin-1"):
            try:
                return raw.decode(enc)
            except UnicodeDecodeError:
                continue
    return raw.decode("utf-8", "replace")


_CTRL = dict.fromkeys(range(0x00, 0x09), None)
_CTRL.update(dict.fromkeys(range(0x0B, 0x20), None))
_CTRL.pop(0x0A, None)  # keep \n


def clean_text(s: str) -> str:
    """Normalize whitespace, unicode, and de-hyphenate line-wrapped words."""
    s = unicodedata.normalize("NFC", s)
    s = s.translate(_CTRL)
    # Normalize fancy punctuation to plain forms retrieval-friendly.
    s = (s.replace(" ", " ")
           .replace("‘", "'").replace("’", "'")
           .replace("“", '"').replace("”", '"')
           .replace("–", "-").replace("—", "-")
           .replace("ﬁ", "fi").replace("ﬂ", "fl"))
    # Join words split across a line break with a hyphen: "fermenta-\ntion".
    s = re.sub(r"(\w)-\n(\w)", r"\1\2", s)
    # Collapse intra-paragraph single newlines into spaces; preserve blank-line
    # paragraph breaks (\n\n). Lets PDF visual-line wrapping reflow into prose.
    s = re.sub(r"(?<!\n)\n(?!\n)", " ", s)
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def slugify(s: str, maxlen: int = 60) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return (s or "section")[:maxlen].strip("-")


def estimate_tokens(s: str) -> int:
    """Cheap, dependency-free token estimate (~4 chars/token for English/Italian)."""
    return max(1, round(len(s) / 4))


# --- Section / chunk data models -------------------------------------------

@dataclass
class Section:
    """A logical unit of a book (a heading and its prose), pre-chunking."""
    book_slug: str
    book_title: str
    author: str
    lang: str
    relevance: str
    order: int                       # position within the book
    chapter: str                     # nearest chapter/part title
    heading: str                     # this section's heading
    breadcrumb: list[str]            # full heading path, e.g. ["Ch10", "Breads", "Baking"]
    text: str                        # cleaned prose
    source_page: int | None = None   # PDF page (1-based) where it starts, if known


def front_matter(d: dict) -> str:
    """Minimal YAML front matter (no dependency on a YAML writer)."""
    def fmt(v):
        if isinstance(v, list):
            return "[" + ", ".join(json.dumps(x, ensure_ascii=False) for x in v) + "]"
        if isinstance(v, str):
            return json.dumps(v, ensure_ascii=False)
        if v is None:
            return "null"
        return str(v)
    lines = ["---"]
    for k, val in d.items():
        lines.append(f"{k}: {fmt(val)}")
    lines.append("---")
    return "\n".join(lines)


def write_section_note(sec: Section, idx: int) -> Path:
    """Write one section to notes/<slug>/NNNN-heading.md and return its path."""
    book_dir = NOTES_DIR / sec.book_slug
    book_dir.mkdir(parents=True, exist_ok=True)
    fname = f"{idx:04d}-{slugify(sec.heading)}.md"
    path = book_dir / fname
    meta = {
        "book": sec.book_title,
        "book_slug": sec.book_slug,
        "author": sec.author,
        "lang": sec.lang,
        "relevance": sec.relevance,
        "chapter": sec.chapter,
        "heading": sec.heading,
        "breadcrumb": sec.breadcrumb,
        "order": sec.order,
        "source_page": sec.source_page,
        "tokens_est": estimate_tokens(sec.text),
    }
    body = f"{front_matter(meta)}\n\n# {sec.heading}\n\n{sec.text}\n"
    path.write_text(body, encoding="utf-8")
    return path


# --- Markdown note parsing (for the chunking stage) -------------------------

def parse_note(path: Path) -> tuple[dict, str]:
    """Read a notes/*.md file back into (front_matter_dict, body_text)."""
    text = path.read_text(encoding="utf-8")
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
    if not m:
        return {}, text
    meta = {}
    for line in m.group(1).splitlines():
        if ":" not in line:
            continue
        k, _, v = line.partition(":")
        v = v.strip()
        try:
            meta[k.strip()] = json.loads(v)
        except json.JSONDecodeError:
            meta[k.strip()] = v.strip('"')
    body = m.group(2)
    body = re.sub(r"^\s*#[^\n]*\n+", "", body, count=1)  # drop leading "# Heading"
    return meta, body.strip()


# --- Chunking ---------------------------------------------------------------

def _split_paragraphs(text: str) -> list[str]:
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    return paras or ([text.strip()] if text.strip() else [])


def chunk_text(text: str, target_tokens: int, overlap_tokens: int) -> list[str]:
    """Greedy paragraph packing into ~target_tokens chunks with sentence overlap.

    Paragraphs are never split mid-word; an oversized paragraph is sentence-split.
    Consecutive chunks share a tail of ~overlap_tokens for retrieval continuity.
    """
    paras = _split_paragraphs(text)
    chunks: list[str] = []
    cur: list[str] = []
    cur_tok = 0

    def flush():
        nonlocal cur, cur_tok
        if cur:
            chunks.append("\n\n".join(cur).strip())
            cur, cur_tok = [], 0

    for para in paras:
        ptok = estimate_tokens(para)
        if ptok > target_tokens:
            flush()
            # Sentence-split the oversized paragraph.
            sents = re.split(r"(?<=[.!?])\s+", para)
            buf, buftok = [], 0
            for s in sents:
                st = estimate_tokens(s)
                if buftok + st > target_tokens and buf:
                    chunks.append(" ".join(buf).strip())
                    buf, buftok = [], 0
                buf.append(s)
                buftok += st
            if buf:
                chunks.append(" ".join(buf).strip())
            continue
        if cur_tok + ptok > target_tokens and cur:
            flush()
        cur.append(para)
        cur_tok += ptok
    flush()

    if overlap_tokens <= 0 or len(chunks) < 2:
        return chunks

    # Prepend a tail of the previous chunk to each subsequent chunk.
    overlapped = [chunks[0]]
    for i in range(1, len(chunks)):
        prev = chunks[i - 1]
        tail_chars = overlap_tokens * 4
        tail = prev[-tail_chars:]
        tail = tail[tail.find(" ") + 1:] if " " in tail else tail
        overlapped.append((tail + "\n\n" + chunks[i]).strip())
    return overlapped


def chunk_id(book_slug: str, order: int, n: int, text: str) -> str:
    h = hashlib.sha1(text.encode("utf-8")).hexdigest()[:8]
    return f"{book_slug}:{order:04d}:{n:02d}:{h}"
