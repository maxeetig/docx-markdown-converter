#!/usr/bin/env python3
"""Convert DOCX files to Markdown and write adjacent metadata JSON."""

from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile

import mammoth
from bs4 import BeautifulSoup
from markdownify import markdownify as html_to_markdown


CORE_NS = {"dc": "http://purl.org/dc/elements/1.1/", "cp": "http://schemas.openxmlformats.org/package/2006/metadata/core-properties"}
APP_NS = {"ep": "http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"}


def preprocess_table_html(html: str) -> str:
    """Normalize table markup so markdown conversion preserves GFM tables."""
    soup = BeautifulSoup(html, "html.parser")

    for cell in soup.select("table td, table th"):
        paragraphs = list(cell.find_all("p", recursive=False))
        if paragraphs:
            for paragraph in paragraphs:
                for child in list(paragraph.children):
                    cell.append(child)
                paragraph.decompose()

    for table in soup.find_all("table"):
        first_row = table.select_one("tbody tr, thead tr, tr")
        if not first_row:
            continue
        td_cells = first_row.find_all("td", recursive=False)
        has_header = bool(first_row.find_all("th", recursive=False))
        if td_cells and not has_header:
            for td in td_cells:
                th = soup.new_tag("th")
                for child in list(td.children):
                    th.append(child)
                td.replace_with(th)

    return str(soup)


def read_docx_metadata(docx_path: Path) -> dict:
    metadata: dict[str, object] = {}
    with zipfile.ZipFile(docx_path) as archive:
        core_xml = _safe_read_zip_file(archive, "docProps/core.xml")
        app_xml = _safe_read_zip_file(archive, "docProps/app.xml")

    if core_xml:
        core_root = ET.fromstring(core_xml)
        metadata["title"] = _xml_text(core_root, "dc:title", CORE_NS)
        metadata["author"] = _xml_text(core_root, "dc:creator", CORE_NS)
        metadata["creator"] = _xml_text(core_root, "cp:lastModifiedBy", CORE_NS)
        metadata["creation_date_raw"] = _xml_text(core_root, "cp:created", CORE_NS)
        metadata["mod_date_raw"] = _xml_text(core_root, "cp:modified", CORE_NS)

    if app_xml:
        app_root = ET.fromstring(app_xml)
        metadata["producer"] = _xml_text(app_root, "ep:Application", APP_NS)
        pages = _xml_text(app_root, "ep:Pages", APP_NS)
        metadata["pages"] = int(pages) if pages and pages.isdigit() else None

    return metadata


def convert_docx_to_markdown(docx_path: Path) -> tuple[str, list[str]]:
    with docx_path.open("rb") as docx_file:
        result = mammoth.convert_to_html(docx_file)

    normalized_html = preprocess_table_html(result.value)
    markdown = html_to_markdown(
        normalized_html,
        heading_style="ATX",
        bullets="-",
        strip=["span"],
    ).strip()

    messages = [f"{msg.type}: {msg.message}" for msg in result.messages]
    return markdown + "\n", messages


def build_metadata(docx_path: Path, metadata_from_docx: dict) -> dict:
    output: dict[str, object] = {
        "source_path": str(docx_path),
        "file_name": docx_path.name,
    }

    for key in ("title", "author", "creator", "producer", "creation_date_raw", "mod_date_raw", "pages"):
        output[key] = metadata_from_docx.get(key)

    output["generated_at"] = dt.datetime.now(dt.UTC).isoformat()
    return output


def _safe_read_zip_file(archive: zipfile.ZipFile, file_name: str) -> str | None:
    try:
        return archive.read(file_name).decode("utf-8")
    except KeyError:
        return None


def _xml_text(root: ET.Element, query: str, namespaces: dict[str, str]) -> str | None:
    node = root.find(query, namespaces)
    if node is None or node.text is None:
        return None
    value = node.text.strip()
    return value if value else None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert DOCX to Markdown and write adjacent metadata JSON."
    )
    parser.add_argument("input_docx", type=Path, help="Path to input .docx file")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help="Path to output .md file (default: next to input with .md extension)",
    )
    parser.add_argument(
        "--print-messages",
        action="store_true",
        help="Print mammoth conversion messages to stderr",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    input_docx = args.input_docx.resolve()

    if not input_docx.exists():
        raise FileNotFoundError(f"Input DOCX not found: {input_docx}")
    if input_docx.suffix.lower() != ".docx":
        raise ValueError(f"Expected a .docx file, got: {input_docx}")

    output_md = args.output.resolve() if args.output else input_docx.with_suffix(".md")
    output_md.parent.mkdir(parents=True, exist_ok=True)
    metadata_path = output_md.with_name(f"{output_md.name}.metadata.json")

    markdown_text, messages = convert_docx_to_markdown(input_docx)
    output_md.write_text(markdown_text, encoding="utf-8")

    metadata_json = build_metadata(input_docx, read_docx_metadata(input_docx))
    metadata_path.write_text(
        json.dumps(metadata_json, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    if args.print_messages and messages:
        for message in messages:
            print(message)

    print(f"Markdown written: {output_md}")
    print(f"Metadata written: {metadata_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
