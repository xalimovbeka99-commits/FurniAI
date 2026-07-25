"""
FurniAI - Pack consistency check
================================
    python3 pack_check.py <pack_dir> [<pack_dir> ...]

Confirms every artefact in a pack describes the SAME furniture, and refuses to
let two packs be confused for one another.
"""
import sys, os, json

from pypdf import PdfReader


def pdf_text(path):
    with open(path, "rb") as fh:
        return "\n".join(page.extract_text() or "" for page in PdfReader(fh).pages)


def check(pack):
    with open(os.path.join(pack, "report.json"), encoding="utf-8") as fh:
        rep = json.load(fh)
    bid = rep["build_id"]
    ok = True
    out = [f"  build {bid}   {rep['input'].get('name','')}   "
           f"{rep['input']['width']:.0f}x{rep['input']['height']:.0f}x"
           f"{rep['input']['depth']:.0f}"]

    with open(os.path.join(pack, "viewer.html"), encoding="utf-8") as fh:
        html = fh.read()
    out.append(f"    viewer.html          {'OK' if bid in html else 'MISMATCH'}")
    ok &= bid in html

    for pdf in ("shop_drawings.pdf", "first_article_inspection.pdf"):
        fp = os.path.join(pack, pdf)
        if not os.path.exists(fp):
            continue
        txt = pdf_text(fp)
        hit = bid in txt
        out.append(f"    {pdf:20} {'OK' if hit else 'MISMATCH'}")
        ok &= hit

    with open(os.path.join(pack, "scene.json"), encoding="utf-8") as fh:
        scene = json.load(fh)
    want = [rep["input"]["width"], rep["input"]["height"], rep["input"]["depth"]]
    same = all(abs(a - b) < 1.0 for a, b in zip(scene["bbox"], want))
    out.append(f"    scene.json bbox      {'OK' if same else 'MISMATCH'}  "
               f"{scene['bbox']} vs spec {want}")
    ok &= same

    n_solids = len(scene["boxes"])
    out.append(f"    solids {n_solids} == pieces {rep['part_count']}   "
               f"{'OK' if n_solids == rep['part_count'] else 'MISMATCH'}")
    ok &= n_solids == rep["part_count"]
    return bid, ok, out


if __name__ == "__main__":
    packs = sys.argv[1:] or ["./factory_pack"]
    seen, allok = {}, True
    print("=" * 70)
    for p in packs:
        print(os.path.basename(p.rstrip("/")))
        bid, ok, lines = check(p)
        print("\n".join(lines))
        allok &= ok
        if bid in seen:
            print(f"    !! shares a build ID with {seen[bid]}")
            allok = False
        seen[bid] = p
        print()
    print("=" * 70)
    print("  ALL PACKS INTERNALLY CONSISTENT AND DISTINCT" if allok
          else "  PROBLEMS FOUND")
    print("=" * 70)
    sys.exit(0 if allok else 1)
