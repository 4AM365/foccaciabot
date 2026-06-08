"""Extract an EPUB into per-section Markdown notes, driven by its NCX table of
contents.

We read the spine order and the NCX directly (ebooklib chokes on these files'
broken font manifest entries). The NCX gives real section labels; relying on
in-page headings fails because every XHTML repeats the book title as an <h1>.

Sectioning: each NCX entry is a boundary. A section's text is everything from
that entry's anchor (or file start) up to the next entry's boundary, walking
the spine in reading order. Sections that span split-files merge naturally
because `current` persists across files until the next boundary.
"""
from __future__ import annotations

import posixpath
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

from bs4 import BeautifulSoup, Tag

from common import (
    Book, BOOKS, Section, clean_text, decode_bytes, find_source,
    write_section_note,
)

BLOCK_TAGS = {"p", "li", "blockquote", "pre", "h1", "h2", "h3", "h4", "h5", "h6"}


# --- OPF / NCX parsing ------------------------------------------------------

def _read_opf(z: zipfile.ZipFile):
    container = decode_bytes(z.read("META-INF/container.xml"))
    opf_path = re.search(r'full-path="([^"]+)"', container).group(1)
    opf_dir = posixpath.dirname(opf_path)
    opf = decode_bytes(z.read(opf_path))

    manifest: dict[str, str] = {}
    for m in re.finditer(r"<item\b[^>]*>", opf):
        idm = re.search(r'id="([^"]+)"', m.group(0))
        hrefm = re.search(r'href="([^"]+)"', m.group(0))
        if idm and hrefm:
            href = posixpath.normpath(posixpath.join(opf_dir, hrefm.group(1)))
            manifest[idm.group(1)] = href

    spine = []
    for m in re.finditer(r'<itemref\b[^>]*idref="([^"]+)"', opf):
        href = manifest.get(m.group(1))
        if href and re.search(r"\.x?html?$", href, re.I):
            spine.append(href)

    ncx_path = next((h for h in manifest.values() if h.endswith(".ncx")), None)
    return spine, ncx_path, opf_dir


def _read_nav(z: zipfile.ZipFile, ncx_path: str, opf_dir: str):
    """Return ordered nav entries: list of dict(depth,label,file,anchor)."""
    s = decode_bytes(z.read(ncx_path))
    s = re.sub(r'\sxmlns(:\w+)?="[^"]+"', "", s)  # drop namespaces for ET
    root = ET.fromstring(s)
    navmap = root.find("navMap")
    out: list[dict] = []

    def walk(node, depth):
        for np in node.findall("navPoint"):
            label_el = np.find("navLabel/text")
            content = np.find("content")
            if label_el is None or content is None:
                continue
            label = (label_el.text or "").strip()
            src = content.get("src", "")
            file, _, anchor = src.partition("#")
            file = posixpath.normpath(posixpath.join(opf_dir, file)) if file else ""
            out.append({"depth": depth, "label": label, "file": file,
                        "anchor": anchor or None})
            walk(np, depth + 1)

    if navmap is not None:
        walk(navmap, 0)
    return out


_MATTER = re.compile(r"acknowledg|introduction|appendix|references|permissions|"
                     r"index|glossary|preface|contents", re.I)


def _normalize(nav: list[dict], spine: list[str]) -> list[dict]:
    """Attach chapter + breadcrumb to each entry.

    Two NCX shapes occur in the wild:

    * Nested (Bressanini): depth encodes hierarchy directly -> use a depth stack.
    * Flat (McGee): all chapter titles are listed first, then a separate flat
      list of every sub-section (with `filepos` anchors). Order can't be used to
      infer chapters, so we map chapters to their starting position in the spine
      and assign each entry to the chapter whose file-range contains it.
    """
    flat = nav and all(e["depth"] == 0 for e in nav)

    if not flat:
        stack: dict[int, str] = {}
        for e in nav:
            d = e["depth"]
            for k in [k for k in stack if k > d]:
                del stack[k]
            stack[d] = e["label"]
            e["chapter"] = stack.get(0, e["label"])
            e["breadcrumb"] = [stack[k] for k in sorted(stack)]
        return nav

    spine_idx = {f: i for i, f in enumerate(spine)}

    # Chapter boundaries: "Chapter N" + following title, plus front/back matter.
    chapters: list[tuple[int, str]] = []
    i = 0
    while i < len(nav):
        e = nav[i]
        idx = spine_idx.get(e["file"], 10**6)
        if re.fullmatch(r"chapter\s+\d+", e["label"], re.I) and i + 1 < len(nav):
            title = nav[i + 1]["label"]
            tidx = spine_idx.get(nav[i + 1]["file"], idx)
            chapters.append((min(idx, tidx), f"{e['label']}: {title}"))
            i += 2
            continue
        if _MATTER.search(e["label"]) and not e["anchor"]:
            chapters.append((idx, e["label"]))
        i += 1
    chapters.sort()

    def chapter_for(file: str) -> str | None:
        idx = spine_idx.get(file, -1)
        best = None
        for cidx, lbl in chapters:
            if cidx <= idx:
                best = lbl
            else:
                break
        return best

    for e in nav:
        ch = chapter_for(e["file"]) or e["label"]
        e["chapter"] = ch
        e["breadcrumb"] = [ch] if e["label"] == ch else [ch, e["label"]]
    return nav


# --- Content walk -----------------------------------------------------------

def _leaf_blocks(body):
    """Yield (element, text) for leaf block elements, in document order."""
    for el in body.find_all(BLOCK_TAGS):
        if el.find(BLOCK_TAGS):   # skip containers; their children carry the text
            continue
        txt = el.get_text(" ", strip=True)
        if txt:
            yield el, txt


def extract_epub(book: Book) -> int:
    src = find_source(book)
    if not src:
        print(f"  ! source not found for {book.slug}")
        return 0
    z = zipfile.ZipFile(src)
    spine, ncx_path, opf_dir = _read_opf(z)
    nav = _normalize(_read_nav(z, ncx_path, opf_dir), spine) if ncx_path else []

    # Index nav entries by file.
    by_file: dict[str, list[dict]] = {}
    for e in nav:
        by_file.setdefault(e["file"], []).append(e)

    # Accumulate text per nav entry (keyed by identity/order).
    buffers: dict[int, list[str]] = {}
    order_of: dict[int, int] = {}
    current: dict | None = None

    for path in spine:
        try:
            raw = z.read(path)
        except KeyError:
            continue
        soup = BeautifulSoup(decode_bytes(raw), "html.parser")
        body = soup.body or soup
        file_navs = by_file.get(path, [])

        # Position index for all tags, to order anchors vs. text.
        all_tags = body.find_all(True)
        pos = {id(t): i for i, t in enumerate(all_tags)}

        # File-start entries (no anchor): the last one becomes current at file top.
        start_entries = [e for e in file_navs if not e["anchor"]]
        anchor_entries = [e for e in file_navs if e["anchor"]]

        events: list[tuple[int, str, object]] = []
        for el, txt in _leaf_blocks(body):
            events.append((pos.get(id(el), 0), "text", txt))
        for e in anchor_entries:
            el = soup.find(id=e["anchor"])
            p = pos.get(id(el)) if isinstance(el, Tag) else None
            events.append((p if p is not None else 0, "anchor", e))
        # Stable sort: at equal position, switch anchor before consuming text.
        events.sort(key=lambda x: (x[0], 0 if x[1] == "anchor" else 1))

        if start_entries:
            current = start_entries[-1]
            buffers.setdefault(id(current), [])
            order_of.setdefault(id(current), len(order_of))

        for _, kind, payload in events:
            if kind == "anchor":
                current = payload
                buffers.setdefault(id(current), [])
                order_of.setdefault(id(current), len(order_of))
            elif current is not None:
                buffers[id(current)].append(payload)

    # Emit sections in discovery order.
    entries_by_oid = {id(e): e for e in nav}
    ordered = sorted(buffers.items(), key=lambda kv: order_of[kv[0]])
    sections: list[Section] = []
    for oid, parts in ordered:
        e = entries_by_oid.get(oid)
        if e is None:
            continue
        text = clean_text("\n\n".join(parts))
        if len(text) < 40:
            continue
        sections.append(Section(
            book_slug=book.slug, book_title=book.title, author=book.author,
            lang=book.lang, relevance=book.relevance, order=len(sections) + 1,
            chapter=e["chapter"], heading=e["label"],
            breadcrumb=e["breadcrumb"], text=text,
        ))

    for i, sec in enumerate(sections, 1):
        write_section_note(sec, i)
    print(f"  {book.slug}: {len(sections)} sections")
    return len(sections)


def main():
    targets = [b for b in BOOKS if b.kind == "epub"]
    if len(sys.argv) > 1:
        targets = [b for b in targets if b.slug in sys.argv[1:]]
    total = 0
    for book in targets:
        print(f"Extracting EPUB: {book.title}")
        total += extract_epub(book)
    print(f"Done. {total} sections from {len(targets)} EPUB(s).")


if __name__ == "__main__":
    main()
