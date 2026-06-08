"""Extract a (text-layer) PDF into per-section Markdown notes.

This book has no embedded bookmarks, so structure is recovered from the text:

* Chapters: a numbered title line ("3 Functional ingredients") in a large font
  near the top of a page, validated by monotonic numbering 1..N.
* Sub-sections: conservatively detected multi-word Helvetica-Bold headings.
  The PDF is full of OCR'd figure/equation noise in large/bold fonts, so the
  filter is deliberately strict; when in doubt we keep chapter-level sections
  and let the chunker split them. Chapter + printed page number are the
  metadata that matter for retrieval/citation.
"""
from __future__ import annotations

import re
import sys

import fitz  # PyMuPDF

from common import (
    Book, BOOKS, Section, clean_text, find_source, write_section_note,
)

RUNNING_HEADER = re.compile(r"technology\s+of\s+bread\s?making", re.I)
CHAPTER_RE = re.compile(r"^(\d{1,2})\s+([A-Z].{2,55})$")


def _page_lines(page):
    """Return (lines, printed_page_no). Strips header/footer page numbers and
    the running ALL-CAPS book title."""
    lines = []
    printed_page = None
    raw = []
    for b in page.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            spans = l["spans"]
            txt = "".join(s["text"] for s in spans).strip()
            if not txt:
                continue
            size = round(max(s["size"] for s in spans), 1)
            font = spans[0]["font"]
            y = l["bbox"][1]
            raw.append((y, size, font, txt))
    raw.sort(key=lambda r: r[0])
    for i, (y, size, font, txt) in enumerate(raw):
        near_edge = i < 2 or i >= len(raw) - 2
        if near_edge and txt.isdigit():
            printed_page = printed_page or int(txt)
            continue
        if near_edge and RUNNING_HEADER.search(txt):
            continue
        lines.append((size, font, txt))
    return lines, printed_page


def extract_pdf(book: Book) -> int:
    src = find_source(book)
    if not src:
        print(f"  ! source not found for {book.slug}")
        return 0
    doc = fitz.open(src)

    sections: list[Section] = []
    expected_ch = 1
    cur_chapter = book.title
    cur_heading = book.title
    cur_page = 1
    buf: list[str] = []
    started = False  # skip front matter (title/copyright/contents OCR noise)

    def flush():
        nonlocal buf
        text = clean_text("\n".join(buf))
        buf = []
        if len(text) < 80:
            return
        sections.append(Section(
            book_slug=book.slug, book_title=book.title, author=book.author,
            lang=book.lang, relevance=book.relevance, order=len(sections) + 1,
            chapter=cur_chapter, heading=cur_heading,
            breadcrumb=[cur_chapter] if cur_heading == cur_chapter
            else [cur_chapter, cur_heading],
            text=text, source_page=cur_page,
        ))

    for page in doc:
        lines, printed = _page_lines(page)
        page_no = printed if printed is not None else page.number + 1
        # Inline page marker; build_corpus uses it to attribute each chunk to a
        # printed page, then strips it. Invisible-ish and harmless if rendered.
        if started:
            buf.append(f"{{{{page:{page_no}}}}}")
        for idx, (size, font, txt) in enumerate(lines):
            # Chapter heading: large numbered title near the top of the page.
            m = CHAPTER_RE.match(txt)
            if m and size > 12 and idx < 4 and int(m.group(1)) == expected_ch:
                flush()
                started = True
                cur_chapter = f"Chapter {m.group(1)}: {m.group(2).strip()}"
                cur_heading = cur_chapter
                cur_page = page_no
                expected_ch += 1
                buf = [f"{{{{page:{page_no}}}}}"]
                continue
            if started:
                buf.append(txt)
    flush()

    for i, sec in enumerate(sections, 1):
        write_section_note(sec, i)
    print(f"  {book.slug}: {len(sections)} sections "
          f"({expected_ch - 1} chapters)")
    return len(sections)


def main():
    targets = [b for b in BOOKS if b.kind == "pdf"]
    if len(sys.argv) > 1:
        targets = [b for b in targets if b.slug in sys.argv[1:]]
    total = 0
    for book in targets:
        print(f"Extracting PDF: {book.title}")
        total += extract_pdf(book)
    print(f"Done. {total} sections from {len(targets)} PDF(s).")


if __name__ == "__main__":
    main()
