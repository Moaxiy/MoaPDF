import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pypdf import PdfReader, PdfWriter

from pdf_blank_insert import insert_blank_pages


def make_sample_pdf(path: Path) -> None:
    writer = PdfWriter()
    writer.add_blank_page(width=300, height=400)
    writer.add_blank_page(width=500, height=700)
    writer.add_blank_page(width=300, height=400)
    with path.open("wb") as file:
        writer.write(file)


def test_insert_blank_pages() -> None:
    tmp_dir = Path("tmp")
    tmp_dir.mkdir(exist_ok=True)
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


if __name__ == "__main__":
    test_insert_blank_pages()
    print("smoke test passed")
