#!/usr/bin/env python
"""Insert blank pages into an existing PDF without changing original page content."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from pypdf import PdfReader, PdfWriter


def parse_insert_spec(spec: str) -> tuple[int, int]:
    """Parse INSERT spec as PAGE_AFTER or PAGE_AFTER:COUNT."""
    parts = spec.split(":")
    if len(parts) > 2:
        raise argparse.ArgumentTypeError(f"Invalid insert spec: {spec}")

    try:
        page_after = int(parts[0])
        count = int(parts[1]) if len(parts) == 2 else 1
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"Invalid insert spec: {spec}") from exc

    if page_after < 0:
        raise argparse.ArgumentTypeError("PAGE_AFTER must be 0 or greater")
    if count < 1:
        raise argparse.ArgumentTypeError("COUNT must be 1 or greater")

    return page_after, count


def group_insertions(insertions: list[tuple[int, int]], page_count: int) -> dict[int, int]:
    grouped: dict[int, int] = {}
    for page_after, count in insertions:
        if page_after > page_count:
            raise ValueError(
                f"Cannot insert after page {page_after}: input PDF has {page_count} pages"
            )
        grouped[page_after] = grouped.get(page_after, 0) + count
    return grouped


def add_blank_like(writer: PdfWriter, reader: PdfReader, page_after: int) -> None:
    """Add one blank page, using the neighboring original page size."""
    if page_after == 0:
        reference_page = reader.pages[0]
    else:
        reference_page = reader.pages[page_after - 1]

    box = reference_page.mediabox
    writer.add_blank_page(width=float(box.width), height=float(box.height))


def insert_blank_pages(
    input_pdf: Path,
    output_pdf: Path,
    insertions: list[tuple[int, int]],
) -> tuple[int, int]:
    reader = PdfReader(str(input_pdf))
    writer = PdfWriter()

    if reader.is_encrypted:
        raise ValueError("Encrypted PDFs are not supported in this MVP")

    page_count = len(reader.pages)
    if page_count == 0:
        raise ValueError("Input PDF has no pages")

    grouped_insertions = group_insertions(insertions, page_count)

    for page_after in range(0, page_count + 1):
        for _ in range(grouped_insertions.get(page_after, 0)):
            add_blank_like(writer, reader, page_after)

        if page_after < page_count:
            writer.add_page(reader.pages[page_after])

    output_pdf.parent.mkdir(parents=True, exist_ok=True)
    with output_pdf.open("wb") as file:
        writer.write(file)

    inserted_count = sum(grouped_insertions.values())
    return page_count, page_count + inserted_count


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Insert blank pages into a PDF. Existing PDF pages are copied as-is, "
            "so printed page numbers already on the pages are not changed."
        )
    )
    parser.add_argument("input_pdf", type=Path, help="Path to the source PDF")
    parser.add_argument("output_pdf", type=Path, help="Path for the generated PDF")
    parser.add_argument(
        "--after",
        action="append",
        required=True,
        type=parse_insert_spec,
        metavar="PAGE[:COUNT]",
        help=(
            "Insert blank page(s) after a 1-based page number. "
            "Use 0 to insert before the first page. Repeat for multiple positions. "
            "Examples: --after 3, --after 5:2"
        ),
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if not args.input_pdf.exists():
        parser.error(f"Input PDF does not exist: {args.input_pdf}")
    if args.input_pdf.resolve() == args.output_pdf.resolve():
        parser.error("Output PDF must be different from input PDF")

    try:
        before_count, after_count = insert_blank_pages(
            args.input_pdf, args.output_pdf, args.after
        )
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    inserted_count = after_count - before_count
    print(
        f"Done: {args.output_pdf} ({before_count} original pages + "
        f"{inserted_count} blank pages = {after_count} pages)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
