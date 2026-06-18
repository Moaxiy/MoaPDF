import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from pypdf import PdfReader, PdfWriter

from pdf_blank_insert import group_insertions, insert_blank_pages, parse_insert_spec


def make_sample_pdf(path: Path) -> None:
    writer = PdfWriter()
    writer.add_blank_page(width=300, height=400)
    writer.add_blank_page(width=500, height=700)
    writer.add_blank_page(width=300, height=400)
    with path.open("wb") as file:
        writer.write(file)


def test_insert_blank_pages() -> None:
    tmp_dir = Path(tempfile.mkdtemp(prefix="moapdf-test-"))
    input_pdf = tmp_dir / "sample.pdf"
    output_pdf = tmp_dir / "sample_with_blanks.pdf"

    make_sample_pdf(input_pdf)
    before, after = insert_blank_pages(input_pdf, output_pdf, [(0, 1), (2, 2)])

    assert before == 3
    assert after == 6

    reader = PdfReader(str(output_pdf))
    assert len(reader.pages) == 6
    assert float(reader.pages[0].mediabox.width) == 300
    assert float(reader.pages[0].mediabox.height) == 400
    assert float(reader.pages[3].mediabox.width) == 500
    assert float(reader.pages[3].mediabox.height) == 700


def test_parse_insert_spec_defaults_to_one_blank() -> None:
    assert parse_insert_spec("3") == (3, 1)
    assert parse_insert_spec("3:2") == (3, 2)


@pytest.mark.parametrize("spec", ["", "-1", "2:0", "1:2:3", "abc"])
def test_parse_insert_spec_rejects_invalid_values(spec: str) -> None:
    with pytest.raises(Exception):
        parse_insert_spec(spec)


def test_group_insertions_combines_duplicate_positions() -> None:
    assert group_insertions([(0, 1), (2, 1), (2, 3)], page_count=3) == {0: 1, 2: 4}


def test_group_insertions_rejects_positions_after_last_page() -> None:
    with pytest.raises(ValueError):
        group_insertions([(4, 1)], page_count=3)


if __name__ == "__main__":
    test_insert_blank_pages()
    test_parse_insert_spec_defaults_to_one_blank()
    test_group_insertions_combines_duplicate_positions()
    test_group_insertions_rejects_positions_after_last_page()
    print("smoke test passed")
