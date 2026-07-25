"""
FurniAI - First Article Inspection (FAI) sheet
==============================================
The paper the CNC operator fills in while cutting the test unit. Every row has
a nominal, a tolerance and a blank for the measured value, so the result is
data, not an opinion.
"""
from __future__ import annotations
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfgen import canvas as pdfcanvas
import standards as S

PW, PH = A4
M = 14 * mm
INK = colors.HexColor("#1b1b1b")
ACC = colors.HexColor("#8a6b3f")
GREY = colors.HexColor("#7a6a55")


class Page:
    def __init__(self, c, title, sub, n):
        self.c = c
        c.setStrokeColor(INK); c.setLineWidth(1)
        c.rect(M, M, PW - 2 * M, PH - 2 * M)
        c.line(M, PH - M - 15 * mm, PW - M, PH - M - 15 * mm)
        c.setFillColor(ACC); c.setFont("Helvetica-Bold", 12)
        c.drawString(M + 4 * mm, PH - M - 7 * mm, "FurniAI")
        c.setFillColor(INK); c.setFont("Helvetica-Bold", 10)
        c.drawString(M + 24 * mm, PH - M - 7 * mm, title)
        c.setFont("Helvetica", 7); c.setFillColor(GREY)
        c.drawString(M + 24 * mm, PH - M - 11 * mm, sub)
        c.drawRightString(PW - M - 4 * mm, PH - M - 7 * mm, f"PAGE {n}")
        c.setFillColor(INK)
        self.y = PH - M - 22 * mm

    def head(self, t):
        c = self.c
        self.y -= 2 * mm
        c.setFillColor(colors.HexColor("#2a231b"))
        c.rect(M + 3 * mm, self.y - 1.5 * mm, PW - 2 * M - 6 * mm, 5.5 * mm,
               fill=1, stroke=0)
        c.setFillColor(colors.white); c.setFont("Helvetica-Bold", 7.6)
        c.drawString(M + 5 * mm, self.y + .4 * mm, t)
        c.setFillColor(INK)
        self.y -= 8 * mm

    def cols(self, headers, widths):
        c = self.c
        c.setFont("Helvetica-Bold", 6.4); c.setFillColor(GREY)
        x = M + 5 * mm
        for h, w in zip(headers, widths):
            c.drawString(x, self.y, h); x += w * mm
        c.setFillColor(INK)
        c.setStrokeColor(colors.HexColor("#ccc")); c.setLineWidth(.3)
        c.line(M + 4 * mm, self.y - 1.6 * mm, PW - M - 4 * mm, self.y - 1.6 * mm)
        self.y -= 5.4 * mm
        self.w = widths

    def row(self, vals, blanks=2, alt=False):
        c = self.c
        if alt:
            c.setFillColor(colors.HexColor("#f5f3ee"))
            c.rect(M + 4 * mm, self.y - 1.4 * mm, PW - 2 * M - 8 * mm, 5 * mm,
                   fill=1, stroke=0)
            c.setFillColor(INK)
        c.setFont("Helvetica", 6.6)
        x = M + 5 * mm
        n = len(self.w)
        for i, w in enumerate(self.w):
            v = vals[i] if i < len(vals) else None
            if v is None:
                c.setStrokeColor(colors.HexColor("#999")); c.setLineWidth(.4)
                c.line(x, self.y - 1 * mm, x + (w - 3) * mm, self.y - 1 * mm)
            else:
                c.drawString(x, self.y, str(v))
            x += w * mm
        self.y -= 5 * mm

    def note(self, t, bold=False):
        self.c.setFont("Helvetica-Bold" if bold else "Helvetica", 6.8)
        self.c.drawString(M + 5 * mm, self.y, t)
        self.y -= 4.4 * mm


def build(path, units, project):
    c = pdfcanvas.Canvas(path, pagesize=A4)
    c.setTitle("FurniAI First Article Inspection")
    import buildid
    sub = (f"{project.get('name','')} | unit {units[0].meta['unit_id']} | "
           f"BUILD {buildid.build_id(project)} | STD {buildid.STANDARDS_VERSION}")

    # ---------------------------------------------------------- page 1
    p = Page(c, "FIRST ARTICLE INSPECTION", sub, 1)
    p.head("JOB IDENTIFICATION")
    p.cols(["Field", "Value"], [45, 130])
    for k, v in [("Date", None), ("Operator", None), ("Machine / post-processor", None),
                 ("Software version (BAZIS)", None), ("Board batch / supplier", None),
                 ("Board nominal thickness", "18.0 mm"),
                 ("Board measured thickness", None),
                 ("Tooling: 5mm bit", None), ("Tooling: 8mm bit", None),
                 ("Tooling: 35mm cup bit", None), ("Tooling: 6mm groover", None),
                 ("Saw blade kerf (measured)", None)]:
        p.row([k, v])

    p.head("A. CALIBRATION COUPON  (cut COUPON_calibration.dxf first, on an offcut)")
    p.note("Do not cut a single carcass panel until every row below passes. "
           "Measure with callipers, not a tape.", bold=True)
    p.cols(["Feature", "Nominal", "Tol", "Measured", "Pass/Fail"], [58, 30, 22, 32, 28])
    coupon = [
        ("System-32 hole diameter", f"{S.SYS32['hole_dia']:.1f} mm", "+0.1/-0"),
        ("System-32 hole depth", f"{S.SYS32['hole_depth']:.1f} mm", "±0.5"),
        ("System-32 pitch over 4 gaps", f"{4*S.SYS32['pitch']:.1f} mm", "±0.3"),
        ("System-32 setback from edge", f"{S.SYS32['front_setback']:.1f} mm", "±0.3"),
        ("Hinge cup diameter", f"{S.HINGE['cup_dia']:.1f} mm", "+0.2/-0"),
        ("Hinge cup depth", f"{S.HINGE['cup_depth']:.1f} mm", "±0.3"),
        ("Cup dowel diameter", f"{S.HINGE['cup_screw_dia']:.1f} mm", "+0.1/-0"),
        ("Cup dowel spacing", f"{S.HINGE['cup_screw_pitch']:.1f} mm", "±0.3"),
        ("Confirmat through-hole dia", f"{S.CARCASS['confirmat_dia']:.1f} mm", "±0.2"),
        ("Back groove width", f"{S.CARCASS['back_groove_width']:.1f} mm", "±0.2"),
        ("Back groove depth", f"{S.CARCASS['back_groove_depth']:.1f} mm", "±0.3"),
        ("Drawer groove depth (same layer!)",
         f"{S.DRAWER['bottom_groove_depth']:.1f} mm", "±0.3"),
        ("Edge pilot dia", f"{S.CARCASS['confirmat_pilot']:.1f} mm", "±0.2"),
        ("Edge pilot depth", "50 mm", "±2"),
        ("Coupon overall length", "600.0 mm", "±0.5"),
        ("Coupon overall width", "300.0 mm", "±0.5"),
    ]
    for i, (f, nom, tol) in enumerate(coupon):
        p.row([f, nom, tol, None, None], alt=i % 2 == 0)
    p.y -= 2 * mm
    p.note("If the two groove depths came out the same, your layer mapping is "
           "collapsing depth. Stop and fix it — see the BAZIS layer map.", bold=True)
    c.showPage()

    # ---------------------------------------------------------- page 2
    p = Page(c, "FIRST ARTICLE INSPECTION", sub, 2)
    p.head("B. PANEL DIMENSIONS  (every part, off the saw, before edgebanding)")
    p.cols(["Part ID", "Name", "L nom", "W nom", "Thk",
            "L meas", "W meas", "P/F"], [20, 42, 18, 18, 14, 20, 20, 14])
    i = 0
    for u in units:
        for part in u.parts:
            if part.group == "accessory":
                continue
            for q in range(part.qty):
                pid = part.pid if part.qty == 1 else f"{part.pid}#{q+1}"
                p.row([pid, part.name[:26], f"{part.length:.1f}",
                       f"{part.width:.1f}", f"{part.thickness:.0f}",
                       None, None, None], alt=i % 2 == 0)
                i += 1
                if p.y < M + 20 * mm:
                    c.showPage()
                    p = Page(c, "FIRST ARTICLE INSPECTION", sub, 3)
                    p.head("B. PANEL DIMENSIONS (continued)")
                    p.cols(["Part ID", "Name", "L nom", "W nom", "Thk",
                            "L meas", "W meas", "P/F"],
                           [20, 42, 18, 18, 14, 20, 20, 14])
    p.note(f"Tolerance on every panel dimension: ±{S.TOLERANCE['panel_cut']} mm.",
           bold=True)
    c.showPage()

    # ---------------------------------------------------------- page 3
    p = Page(c, "FIRST ARTICLE INSPECTION", sub, 4)
    p.head("C. HOLE POSITION SPOT CHECKS  (on the real panels)")
    p.note("Accumulated pitch error is what ruins a System-32 job. Measure "
           "across ten gaps, not one.")
    p.cols(["Check", "Nominal", "Tol", "Measured", "P/F"], [72, 30, 20, 30, 18])
    side = None
    for u in units:
        for part in u.parts:
            if part.name.startswith("Side"):
                side = part; break
    holes = sorted({op.x for op in (side.ops if side else []) if op.dia == 5.0})
    door = None
    for u in units:
        for part in u.parts:
            if part.group == "front" and any(o.dia == 35.0 for o in part.ops):
                door = part; break
    cups = sorted({o.x for o in (door.ops if door else []) if o.dia == 35.0})
    rows = [
        ("Side panel: first System-32 hole from the bottom end",
         f"{holes[0]:.1f} mm" if holes else "-", "±0.3"),
        ("Side panel: distance across 10 pitch gaps",
         f"{10*S.SYS32['pitch']:.1f} mm", "±0.3"),
        ("Side panel: row setback from the FRONT edge",
         f"{S.SYS32['front_setback']:.1f} mm", "±0.3"),
        ("Side panel: row setback from the REAR edge",
         f"{S.SYS32['rear_setback']:.1f} mm", "±0.3"),
        ("Side panel: back-groove centre from the rear edge",
         f"{S.CARCASS['back_groove_setback']+S.CARCASS['back_groove_width']/2:.1f} mm",
         "±0.3"),
        ("Door: cup centre from the hinge edge",
         f"{S.HINGE['cup_centre_from_edge']:.1f} mm", "±0.2"),
        ("Door: first cup centre from the door end",
         f"{cups[0]:.1f} mm" if cups else "-", "±0.3"),
        ("Door: distance between the two outer cups",
         f"{cups[-1]-cups[0]:.1f} mm" if len(cups) > 1 else "-", "±0.5"),
        ("Drawer side: bottom-groove centre from the lower edge",
         f"{S.DRAWER['bottom_groove_from_edge']:.1f} mm", "±0.3"),
    ]
    for i, (k, nom, tol) in enumerate(rows):
        p.row([k, nom, tol, None, None], alt=i % 2 == 0)

    p.head("D. ASSEMBLY  (dry-assemble the carcass, hang the fronts)")
    p.cols(["Check", "Nominal", "Tol", "Measured", "P/F"], [72, 30, 20, 30, 18])
    asm = [
        ("Carcass diagonal 1 minus diagonal 2", "0.0 mm",
         f"±{S.TOLERANCE['carcass_squareness']}"),
        ("Back panel seats fully in its groove all round", "yes", "-"),
        ("Gap between the two doors", f"{S.FRONTS['gap']:.1f} mm",
         f"±{S.TOLERANCE['door_gap_variation']}"),
        ("Door gap at the top", f"{S.FRONTS['top_reveal']:.1f} mm", "±0.5"),
        ("Door gap at the bottom", f"{S.FRONTS['bottom_reveal']:.1f} mm", "±0.5"),
        ("Gap between the two drawer faces", f"{S.FRONTS['gap']:.1f} mm", "±0.5"),
        ("Hinge plate seats on the System-32 row without re-drilling",
         "yes", "-"),
        ("Shelf pins fit without forcing; shelf drops in", "yes", "-"),
        ("Drawer runners clip both sides; box runs full travel", "yes", "-"),
        ("Soft-close engages on every door and drawer", "yes", "-"),
        ("Doors cycled 10x - no rub, gaps unchanged", "yes", "-"),
    ]
    for i, (k, nom, tol) in enumerate(asm):
        p.row([k, nom, tol, None, None], alt=i % 2 == 0)

    p.head("E. RESULT")
    p.note("Overall verdict:   [  ] PASS - FurniAI output drives this machine "
           "correctly     [  ] FAIL", bold=True)
    p.y -= 2 * mm
    p.cols(["If anything failed, record it here", ""], [95, 80])
    for _ in range(4):
        p.row([None, None])
    p.y -= 3 * mm
    p.note("Send back to FurniAI: this sheet, the coupon, and a photo of the "
           "assembled unit.")
    p.note("Signed ______________________   Date ______________   "
           "Machine hours used ____________")
    c.showPage()
    c.save()
    return path
