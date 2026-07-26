"""
FurniAI - Shop Drawing / Blueprint PDF
======================================
The document a UAE factory floor can build from without asking a question:
  1. Cover + project data + engineering verdict
  2. Front elevation (dimensioned), plan section, side section
  3. Part detail sheets - every hole, groove and cup located from a datum
  4. Cut list
  5. CNC operation schedule (BAZIS layer names)
  6. Nesting layouts, per sheet, with yield and kerf
  7. BOM + priced quote
  8. QC checklist + installation sequence
"""
from __future__ import annotations
from typing import List
from reportlab.lib.pagesizes import A3, landscape
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfgen import canvas as pdfcanvas
import math
import standards as S

PW, PH = landscape(A3)
M = 18 * mm
INK = colors.HexColor("#1b1b1b")
ACC = colors.HexColor("#8a6b3f")
DIMC = colors.HexColor("#7a6a55")
LIGHT = colors.HexColor("#efece5")


class Sheet:
    STAMP = ""

    def __init__(self, c: pdfcanvas.Canvas, title, meta, page_no):
        self.c, self.title, self.meta, self.n = c, title, meta, page_no
        self.stamp = Sheet.STAMP
        self.frame()

    def frame(self):
        c = self.c
        c.setStrokeColor(INK); c.setLineWidth(1.1)
        c.rect(M, M, PW - 2 * M, PH - 2 * M)
        c.setLineWidth(.6)
        c.line(M, PH - M - 13 * mm, PW - M, PH - M - 13 * mm)
        c.setFillColor(ACC); c.setFont("Helvetica-Bold", 13)
        c.drawString(M + 5 * mm, PH - M - 9 * mm, "FurniAI")
        c.setFillColor(INK); c.setFont("Helvetica-Bold", 11)
        c.drawString(M + 27 * mm, PH - M - 9 * mm, self.title)
        c.setFont("Helvetica", 7.5); c.setFillColor(DIMC)
        c.drawRightString(PW - M - 5 * mm, PH - M - 9 * mm,
                          f"{self.meta} | ALL DIMENSIONS IN MM | SHEET {self.n}")
        c.setFont("Courier-Bold", 6.6)
        c.setFillColor(ACC)
        c.drawRightString(PW - M - 5 * mm, PH - M - 12.6 * mm, self.stamp)
        c.setFillColor(DIMC); c.setFont("Helvetica", 7.5)
        c.setFont("Helvetica", 6.5)
        c.drawString(M + 5 * mm, M + 4 * mm,
                     "Tolerances: cut +/-0.5  drilling +/-0.3  squareness +/-1.0 over "
                     "diagonal  door gaps 3.0 +/-0.5 | System 32: 5mm dia x 12 deep, "
                     "32 pitch, 37 from front edge")
        c.setFillColor(INK)


def _fit(items_w, items_h, avail_w, avail_h):
    return min(avail_w / max(items_w, 1), avail_h / max(items_h, 1))


def _dim_h(c, x1, x2, y, text, tick=2.2 * mm):
    c.setStrokeColor(DIMC); c.setLineWidth(.4)
    c.line(x1, y, x2, y)
    c.line(x1, y - tick, x1, y + tick); c.line(x2, y - tick, x2, y + tick)
    c.setFont("Helvetica", 6.4); c.setFillColor(DIMC)
    c.drawCentredString((x1 + x2) / 2, y + 1.4 * mm, text)
    c.setFillColor(INK)


def _dim_v(c, y1, y2, x, text, tick=2.2 * mm):
    c.setStrokeColor(DIMC); c.setLineWidth(.4)
    c.line(x, y1, x, y2)
    c.line(x - tick, y1, x + tick, y1); c.line(x - tick, y2, x + tick, y2)
    c.saveState(); c.translate(x - 1.4 * mm, (y1 + y2) / 2); c.rotate(90)
    c.setFont("Helvetica", 6.4); c.setFillColor(DIMC)
    c.drawCentredString(0, 0, text); c.restoreState(); c.setFillColor(INK)


# ---------------------------------------------------------------- elevations
def _lum(hexstr):
    h = hexstr.lstrip("#")
    r, g, bl = (int(h[i:i+2], 16) for i in (0, 2, 4))
    return (0.299*r + 0.587*g + 0.114*bl) / 255.0


def _draw_elev(c, units, ox, oy, s, BX, BY, show_fronts, label_parts=True):
    for u in units:
        dx0 = u.spec.get("_stack_x", 0); dy0 = u.spec.get("_stack_y", 0)
        zo = {"back": 0, "plinth": 1, "carcass": 2, "drawer": 3,
              "accessory": 4, "front": 5}
        for p in sorted(u.parts, key=lambda q: zo.get(q.group, 3)):
            if p.group == "accessory" and p.name != "Hanger rod":
                continue
            if p.group == "front" and not show_fronts:
                continue
            if p.pos == (0, 0, 0) and p.group == "drawer":
                continue   # drawer box internals carry no elevation position
            W, H, D = p.size
            hexc = S.MATERIALS.get(p.material, {}).get("hex", "#d8d3c8")
            if p.group == "front":
                c.setFillColor(colors.HexColor(hexc)); c.setLineWidth(.8)
                c.setStrokeColor(INK)
            elif p.name == "Hanger rod":
                c.setFillColor(colors.HexColor("#9aa3ab")); c.setLineWidth(.4)
                c.setStrokeColor(colors.HexColor("#555"))
            else:
                c.setFillColor(colors.HexColor("#efeadd")); c.setLineWidth(.5)
                c.setStrokeColor(colors.HexColor("#5a5a5a"))
            for (X, Y, Z) in (p.instances or [p.pos]):
                x, y = ox + (X + dx0) * s, oy + (Y + dy0) * s
                c.rect(x, y, max(W*s, .35), max(H*s, .35), fill=1, stroke=1)
                if label_parts and W*s > 13*mm and H*s > 4.4*mm:
                    c.setFont("Helvetica", 5.0)
                    c.setFillColor(colors.white if (p.group == "front" and
                                   _lum(hexc) < .5) else colors.HexColor("#3a3a3a"))
                    c.drawCentredString(x + W*s/2, y + H*s/2 - 1.3,
                                        f"{p.pid.split('-')[-1]}  "
                                        f"{p.length:.0f}x{p.width:.0f}")
                    c.setFillColor(colors.HexColor(hexc) if p.group == "front"
                                   else colors.HexColor("#efeadd"))
    c.setFillColor(INK)


def draw_elevations(c, units, page_no):
    Sheet(c, "GENERAL ARRANGEMENT - ELEVATIONS / PLAN SECTION",
          units[0].meta["unit_id"].split(".")[0], page_no)
    BX = max(u.spec.get("_stack_x", 0) + u.meta["W"] for u in units)
    BY = max(u.spec.get("_stack_y", 0) + u.meta["H"] for u in units)
    BZ = max(u.meta["D"] for u in units)

    top = PH - M - 20 * mm
    bot = M + 16 * mm
    colw = (PW - 2*M - 16*mm) / 3.0

    # --- 1. internal elevation (fronts removed) --------------------------
    s1 = _fit(BX, BY, colw - 26*mm, (top - bot) - 20*mm)
    ox1, oy1 = M + 22*mm, bot + 6*mm
    c.setFont("Helvetica-Bold", 8)
    c.drawString(ox1, oy1 + BY*s1 + 9*mm, "INTERNAL ELEVATION  (fronts removed)")
    _draw_elev(c, units, ox1, oy1, s1, BX, BY, show_fronts=False)
    _dim_h(c, ox1, ox1 + BX*s1, oy1 - 6*mm, f"{BX:.0f}")
    _dim_v(c, oy1, oy1 + BY*s1, ox1 - 6*mm, f"{BY:.0f}")
    yy = 0.0
    for u in sorted(units, key=lambda q: q.spec.get("_stack_y", 0)):
        if u.spec.get("_stack_x", 0) > 0:
            continue
        h = u.meta["H"]
        if h*s1 > 8*mm:
            _dim_v(c, oy1 + yy*s1, oy1 + (yy+h)*s1, ox1 - 14*mm,
                   f"{u.meta['unit_id']}  {h:.0f}")
        yy += h
        if yy >= BY - 1:
            break

    # --- 2. front elevation ----------------------------------------------
    ox2 = M + colw + 22*mm
    s2 = _fit(BX, BY, colw - 26*mm, (top - bot) - 20*mm)
    oy2 = bot + 6*mm
    c.setFont("Helvetica-Bold", 8)
    c.drawString(ox2, oy2 + BY*s2 + 9*mm, "FRONT ELEVATION  (as delivered)")
    _draw_elev(c, units, ox2, oy2, s2, BX, BY, show_fronts=True)
    _dim_h(c, ox2, ox2 + BX*s2, oy2 - 6*mm, f"{BX:.0f}")
    fronts = [p for u in units for p in u.parts if p.group == "front"]
    if fronts:
        f0 = min(fronts, key=lambda p: (p.pos[0], p.pos[1]))
        _dim_h(c, ox2 + f0.pos[0]*s2, ox2 + (f0.pos[0]+f0.size[0])*s2,
               oy2 + BY*s2 + 4*mm, f"leaf {f0.size[0]:.0f}")
    c.setFont("Helvetica", 6.2); c.setFillColor(DIMC)
    c.drawString(ox2, oy2 - 12*mm,
                 f"Gaps {S.FRONTS['gap']:.0f} between leaves, "
                 f"{S.FRONTS['edge_reveal']:.1f} reveal at each outer edge, "
                 f"{S.FRONTS['top_reveal']:.1f} top and bottom.")
    c.setFillColor(INK)

    # --- 3. plan section + notes -----------------------------------------
    px = M + 2*colw + 26*mm
    availw = PW - M - 6*mm - px
    ps = _fit(BX, BZ, availw, (top - bot) * .30)
    py = top - 12*mm - BZ*ps
    c.setFont("Helvetica-Bold", 8)
    c.drawString(px, py + BZ*ps + 6*mm, "PLAN SECTION A-A")
    u0 = units[0]
    for u in units:
        if u.spec.get("_stack_y", 0) > 0:
            continue
        dx0 = u.spec.get("_stack_x", 0)
        mid = u.meta["plinth"] + u.meta["carcass_height"] * .5
        zo = {"back": 0, "plinth": 1, "carcass": 2, "drawer": 3,
              "accessory": 4, "front": 5}
        for p in sorted(u.parts, key=lambda q: zo.get(q.group, 3)):
            if p.group == "accessory":
                continue
            W, H, D = p.size
            hexc = S.MATERIALS.get(p.material, {}).get("hex", "#dcd6c8")
            for (X, Y, Z) in (p.instances or [p.pos]):
                if p.group != "front" and not (Y <= mid <= Y + H):
                    continue
                c.setFillColor(colors.HexColor(hexc) if p.group == "front"
                               else colors.HexColor("#dcd6c8"))
                c.setStrokeColor(INK); c.setLineWidth(.45)
                c.rect(px + (X+dx0)*ps, py + Z*ps, max(W*ps, .4), max(D*ps, .4),
                       fill=1, stroke=1)
    _dim_h(c, px, px + BX*ps, py - 6*mm, f"{BX:.0f}")
    _dim_v(c, py, py + BZ*ps, px - 6*mm, f"{BZ:.0f}")
    c.setFillColor(INK); c.setFont("Helvetica", 6.2)
    c.drawString(px, py - 12*mm,
                 f"Internal depth {u0.meta['internal_depth']:.0f}  |  back in "
                 f"{S.CARCASS['back_groove_width']:.0f}x"
                 f"{S.CARCASS['back_groove_depth']:.0f} groove, "
                 f"{S.CARCASS['back_groove_setback']:.0f} from rear edge")

    ty = py - 22*mm
    c.setFont("Helvetica-Bold", 8); c.drawString(px, ty, "CONSTRUCTION NOTES")
    ty -= 5*mm
    c.setFont("Helvetica", 6.4)
    notes = [
        f"Carcass {S.PANEL['carcass']:.0f}mm. Sides run full height; top and bottom "
        f"are captured between them so load goes straight to the floor.",
        f"Back {S.PANEL['back']:.0f}mm HDF in a grooved rebate on all four sides. "
        f"The back squares the carcass - never nail it on.",
        f"Adjustable shelves on 5mm pins. System-32 rows at "
        f"{S.SYS32['front_setback']:.0f} from the front and rear edges, "
        f"{S.SYS32['pitch']:.0f} pitch.",
        f"Hinge cups {S.HINGE['cup_dia']:.0f} dia x {S.HINGE['cup_depth']:.1f} deep, "
        f"centre {S.HINGE['cup_centre_from_edge']:.1f} from the hinge edge "
        f"(K={S.HINGE['boring_distance_K']:.0f}). Plates land on the System-32 row.",
        f"Exposed edges banded {S.EDGEBAND['thickness']:.0f}mm PVC; internal edges "
        f"{S.EDGEBAND['thin']:.1f}mm.",
        f"Scribe fillers to walls - UAE block and render walls are rarely plumb. "
        f"Allow {S.TOLERANCE['scribe_allowance']:.0f}mm.",
    ]
    for n in notes:
        for line in _wrap(n, 78):
            c.drawString(px, ty, line); ty -= 3.4*mm
        ty -= .8*mm

    issues = [i for u in units for i in u.issues]
    errs = [i for i in issues if i["level"] == "error"]
    ty -= 3*mm
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(colors.HexColor("#a33" if errs else "#2d6a3f"))
    c.drawString(px, ty, "REJECTED - CORRECTIONS REQUIRED" if errs
                 else "ENGINEERING CHECKS PASSED - FACTORY QUALIFICATION REQUIRED")
    c.setFillColor(INK); c.setFont("Helvetica", 6.2); ty -= 4.4*mm
    for i in issues[:6]:
        for line in _wrap(f"[{i['level'].upper()}] {i['code']}: {i['message']}", 82):
            c.drawString(px, ty, line); ty -= 3.3*mm
    c.showPage()


# --------------------------------------------------------------- part sheets
def draw_part_sheets(c, units, page_no, per_page=6):
    parts = [p for u in units for p in u.parts
             if p.group != "accessory" and (p.ops or p.group in ("carcass", "front"))]
    parts.sort(key=lambda p: (-len(p.ops), p.pid))
    pages = [parts[i:i + per_page] for i in range(0, len(parts), per_page)]
    for k, grp in enumerate(pages):
        Sheet(c, f"PART DETAILS & MACHINING  ({k+1}/{len(pages)})",
              units[0].meta["unit_id"].split(".")[0], page_no); page_no += 1
        cols, rows = 3, 2
        cw = (PW - 2 * M - 8 * mm) / cols
        ch = (PH - 2 * M - 20 * mm) / rows
        for i, p in enumerate(grp):
            cx = M + 4 * mm + (i % cols) * cw
            cy = PH - M - 18 * mm - (i // cols + 1) * ch
            _part_detail(c, p, cx, cy, cw - 6 * mm, ch - 6 * mm)
        c.showPage()
    return page_no


def _part_detail(c, p, x, y, w, h):
    c.setStrokeColor(colors.HexColor("#bbb")); c.setLineWidth(.4)
    c.rect(x, y, w, h)
    c.setFont("Helvetica-Bold", 7.6); c.setFillColor(INK)
    c.drawString(x + 2 * mm, y + h - 5 * mm, f"{p.pid}  {p.name}")
    c.setFont("Helvetica", 6.2); c.setFillColor(DIMC)
    c.drawString(x + 2 * mm, y + h - 8.6 * mm,
                 f"{p.length:.1f} x {p.width:.1f} x {p.thickness:.1f}  |  "
                 f"{S.MATERIALS.get(p.material,{}).get('label',p.material)}  |  QTY {p.qty}"
                 f"  |  grain: {'length' if p.grain=='length' else 'free'}")
    c.setFillColor(INK)
    dw, dh = w - 14 * mm, h - 24 * mm
    s = _fit(p.length, p.width, dw, dh)
    ox, oy = x + 9 * mm, y + 7 * mm
    c.setStrokeColor(INK); c.setLineWidth(.8)
    c.rect(ox, oy, p.length * s, p.width * s)
    # edge banding indication
    for e, t in p.edges.items():
        if not t:
            continue
        c.setStrokeColor(ACC); c.setLineWidth(1.9)
        if e == "L1": c.line(ox, oy, ox + p.length * s, oy)
        if e == "L2": c.line(ox, oy + p.width * s, ox + p.length * s, oy + p.width * s)
        if e == "W1": c.line(ox, oy, ox, oy + p.width * s)
        if e == "W2": c.line(ox + p.length * s, oy, ox + p.length * s, oy + p.width * s)
    for op in p.ops:
        _draw_op_pdf(c, op, ox, oy, s, p)
    _dim_h(c, ox, ox + p.length * s, oy - 4 * mm, f"{p.length:.1f}", 1.6 * mm)
    _dim_v(c, oy, oy + p.width * s, ox - 4 * mm, f"{p.width:.1f}", 1.6 * mm)
    # op summary
    from collections import Counter
    cnt = Counter((o.kind, o.dia, o.depth, o.layer) for o in p.ops)
    c.setFont("Helvetica", 5.5); c.setFillColor(colors.HexColor("#555"))
    yy = y + h - 11.6 * mm
    for (kind, dia, dep, lay), n in list(cnt.items())[:5]:
        lname = S.CNC_LAYERS.get(lay, {}).get("name", lay)
        txt = (f"{n} x {kind} d{dia:.1f}x{dep:.1f} -> {lname}" if dia
               else f"{n} x {kind} -> {lname}")
        c.drawString(x + 2 * mm, yy, txt); yy -= 2.6 * mm
    c.setFillColor(INK)


def _draw_op_pdf(c, op, ox, oy, s, p):
    if op.kind == "drill":
        r = max(0.35 * mm, op.dia / 2 * s)
        c.setStrokeColor(colors.HexColor("#c0392b") if op.dia >= 30
                         else colors.HexColor("#2d6a3f"))
        c.setLineWidth(.45)
        c.circle(ox + op.x * s, oy + op.y * s, r)
    elif op.kind == "groove":
        c.setStrokeColor(colors.HexColor("#2b6ca3")); c.setLineWidth(.9)
        c.line(ox + op.x * s, oy + op.y * s, ox + op.x2 * s, oy + op.y2 * s)
    elif op.kind == "edge_drill":
        c.setStrokeColor(colors.HexColor("#8a6b3f")); c.setLineWidth(.5)
        edge = op.face.split(":")[-1]
        pos = {"L1": (op.x, 0), "L2": (op.x, p.width),
               "W1": (0, op.x), "W2": (p.length, op.x)}.get(edge, (op.x, 0))
        c.circle(ox + pos[0] * s, oy + pos[1] * s, .7 * mm)


# ------------------------------------------------------------------ tables
def draw_table(c, title, headers, rows, page_no, meta, widths=None, note=""):
    per = 34
    chunks = [rows[i:i + per] for i in range(0, len(rows), per)] or [[]]
    for k, ch in enumerate(chunks):
        Sheet(c, f"{title}  ({k+1}/{len(chunks)})", meta, page_no); page_no += 1
        aw = PW - 2 * M - 10 * mm
        widths = widths or [aw / len(headers)] * len(headers)
        scale = aw / sum(widths)
        wpx = [w * scale for w in widths]
        y = PH - M - 22 * mm
        c.setFont("Helvetica-Bold", 7); c.setFillColor(colors.white)
        c.setStrokeColor(INK)
        c.setFillColor(colors.HexColor("#2a231b"))
        c.rect(M + 5 * mm, y - 1.5 * mm, aw, 6 * mm, fill=1, stroke=0)
        xx = M + 5 * mm
        c.setFillColor(colors.white)
        for h, w in zip(headers, wpx):
            c.drawString(xx + 1.4 * mm, y + .8 * mm, str(h)); xx += w
        y -= 6.2 * mm
        c.setFont("Helvetica", 6.4)
        for j, r in enumerate(ch):
            if j % 2 == 0:
                c.setFillColor(colors.HexColor("#f4f2ec"))
                c.rect(M + 5 * mm, y - 1.2 * mm, aw, 5 * mm, fill=1, stroke=0)
            c.setFillColor(INK)
            xx = M + 5 * mm
            for v, w in zip(r, wpx):
                t = str(v)
                maxc = int(w / (3.1 * 0.9))
                c.drawString(xx + 1.4 * mm, y, t[:maxc]); xx += w
            y -= 5 * mm
        if note:
            c.setFont("Helvetica-Oblique", 6.4); c.setFillColor(DIMC)
            c.drawString(M + 5 * mm, M + 9 * mm, note); c.setFillColor(INK)
        c.showPage()
    return page_no


# ----------------------------------------------------------------- nesting
def draw_nesting(c, nest_result, page_no, meta):
    sheets = nest_result["sheets"]
    per = 4
    chunks = [sheets[i:i + per] for i in range(0, len(sheets), per)]
    for k, ch in enumerate(chunks):
        Sheet(c, f"NESTING / CUTTING LAYOUT  ({k+1}/{len(chunks)})", meta, page_no)
        page_no += 1
        cols, rows = 2, 2
        cw = (PW - 2 * M - 10 * mm) / cols
        chh = (PH - 2 * M - 22 * mm) / rows
        for i, sh in enumerate(ch):
            x = M + 5 * mm + (i % cols) * cw
            yb = PH - M - 20 * mm - (i // cols + 1) * chh
            s = _fit(sh.w, sh.h, cw - 12 * mm, chh - 16 * mm)
            c.setFont("Helvetica-Bold", 7.4); c.setFillColor(INK)
            c.drawString(x, yb + chh - 6 * mm,
                         f"SHEET {sh.index}  "
                         f"{S.MATERIALS.get(sh.material,{}).get('label',sh.material)} "
                         f"{sh.thk:.0f}mm  {sh.w:.0f}x{sh.h:.0f}  "
                         f"yield {sh.yield_pct:.1f}%  kerf {nest_result['kerf']:.0f}")
            ox, oy = x, yb + 4 * mm
            c.setStrokeColor(colors.HexColor("#999")); c.setLineWidth(.5)
            c.rect(ox, oy, sh.w * s, sh.h * s)
            for pl in sh.placements:
                c.setFillColor(colors.HexColor("#e6dfd0"))
                c.setStrokeColor(INK); c.setLineWidth(.4)
                c.rect(ox + pl.x * s, oy + pl.y * s, pl.w * s, pl.h * s,
                       fill=1, stroke=1)
                if pl.w * s > 9 * mm and pl.h * s > 3.4 * mm:
                    c.setFont("Helvetica", 4.6); c.setFillColor(colors.HexColor("#333"))
                    c.drawString(ox + pl.x * s + .8 * mm, oy + pl.y * s + 1.2 * mm,
                                 pl.pid.split("-")[-1])
                    if pl.rotated:
                        c.drawString(ox + pl.x * s + .8 * mm,
                                     oy + pl.y * s + 3.4 * mm, "ROT")
            c.setFillColor(INK)
        c.showPage()
    return page_no


# ------------------------------------------------------------------- build
def build_pdf(path, units, nest_result, quote, project=None):
    project = project or {}
    import buildid
    Sheet.STAMP = buildid.stamp(project) if project else ""
    meta = units[0].meta["unit_id"].split(".")[0]
    c = pdfcanvas.Canvas(path, pagesize=landscape(A3))
    c.setTitle(f"FurniAI shop drawings - {project.get('name', meta)}")
    n = 1
    _cover(c, units, nest_result, quote, project, n); n += 1
    # A multi-run kitchen (see planner._expand_kitchen_runs) has no single
    # front elevation - two perpendicular runs don't share a projection
    # plane. _draw_elev only ever reasons in one run's own local X/Y/Z, so
    # draw one elevation+plan-section sheet per run instead of flattening
    # every run onto the same page, which would draw run B rotated wrong
    # and stacked on top of run A.
    run_ids = sorted({u.spec.get("_run_id") for u in units
                       if u.spec.get("_run_id")})
    if run_ids:
        for rid in run_ids:
            run_units = [u for u in units if u.spec.get("_run_id") == rid]
            draw_elevations(c, run_units, n); n += 1
    else:
        draw_elevations(c, units, n); n += 1
    n = draw_part_sheets(c, units, n)

    from exporters import cutlist_rows
    rows = cutlist_rows(units)
    n = draw_table(c, "CUT LIST", list(rows[0].keys()),
                   [list(r.values()) for r in rows], n, meta,
                   widths=[14, 22, 40, 16, 16, 12, 22, 8, 24, 12, 12, 8, 60],
                   note="Length runs with the grain. Every part in the 3D model "
                        "appears here - nothing renders that is not cut.")

    ops = []
    for u in units:
        for p in u.parts:
            from collections import Counter
            cnt = Counter((o.kind, o.face, o.dia, o.depth, o.layer) for o in p.ops)
            for (kind, face, dia, dep, lay), q in cnt.items():
                ops.append([p.pid, p.name[:26], face, kind, f"{dia:.1f}",
                            f"{dep:.1f}", q,
                            S.CNC_LAYERS.get(lay, {}).get("name", lay)])
    if ops:
        n = draw_table(c, "CNC OPERATION SCHEDULE",
                       ["Part", "Name", "Face", "Operation", "Dia", "Depth",
                        "Qty", "DXF Layer (BAZIS)"],
                       ops, n, meta, widths=[16, 30, 12, 16, 10, 10, 8, 26],
                       note="Face A = internal face of a side panel / back face of a "
                            "door. Coordinates are on the individual part DXF files.")

    n = draw_nesting(c, nest_result, n, meta)
    _commercial(c, units, nest_result, quote, n, meta); n += 1
    _qc_install(c, units, n, meta)
    c.save()
    return path


def _cover(c, units, nest_result, quote, project, n):
    Sheet(c, "PRODUCTION PACKAGE - COVER", units[0].meta["unit_id"].split(".")[0], n)
    y = PH - M - 30 * mm
    c.setFont("Helvetica-Bold", 22); c.setFillColor(INK)
    c.drawString(M + 8 * mm, y, project.get("name", "Custom furniture unit"))
    y -= 9 * mm
    c.setFont("Helvetica", 9); c.setFillColor(DIMC)
    c.drawString(M + 8 * mm, y, project.get("brief", ""))
    c.setFillColor(INK); y -= 12 * mm
    rows = [
        ("Client", project.get("client", "-")),
        ("Room", project.get("room", "-")),
        ("Type", units[0].spec.get("type", "-")),
        ("Carcasses", str(len(units))),
        ("Components", str(sum(p.qty for u in units for p in u.parts))),
        ("Material", S.MATERIALS.get(units[0].spec.get("material"), {})
                     .get("label", "-")),
        ("Panel area", f"{quote['area_m2']:.2f} m2"),
        ("Sheets", f"{quote.get('sheets_total','-')} @ "
                   f"{nest_result['sheet_size'][0]:.0f}x{nest_result['sheet_size'][1]:.0f}"),
        ("Nest yield", f"{nest_result['yield_pct']:.1f} %"),
        ("Quote", f"AED {quote['total_aed']:,.2f}"),
        ("Delivery zone", project.get("zone", S.DEFAULT_ZONE)),
        ("Build ID", Sheet.STAMP.split("BUILD ")[-1] if Sheet.STAMP else "-"),
    ]
    c.setFont("Helvetica", 9)
    for k, v in rows:
        c.setFillColor(DIMC); c.drawString(M + 8 * mm, y, k)
        c.setFillColor(INK); c.drawString(M + 45 * mm, y, str(v))
        y -= 6.2 * mm

    issues = [i for u in units for i in u.issues]
    errs = [i for i in issues if i["level"] == "error"]
    x2 = PW / 2 + 6 * mm
    yy = PH - M - 30 * mm
    c.setFont("Helvetica-Bold", 11)
    c.drawString(x2, yy, "FACTORY VALIDATION GATE"); yy -= 7 * mm
    checks = ["Can every part be cut?", "Can every part be machined?",
              "Can every part be assembled?", "Can every part be transported?",
              "Can every part be installed?", "Can every part be serviced later?",
              "Will it survive long-term use?"]
    c.setFont("Helvetica", 8.4)
    for ck in checks:
        c.setFillColor(colors.HexColor("#a33" if errs else "#2d6a3f"))
        c.drawString(x2, yy, "X" if errs else "OK")
        c.setFillColor(INK); c.drawString(x2 + 8 * mm, yy, ck); yy -= 5.4 * mm
    yy -= 3 * mm
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(colors.HexColor("#a33" if errs else "#2d6a3f"))
    c.drawString(x2, yy, "REJECTED - CORRECTIONS REQUIRED" if errs
                 else "ENGINEERING CHECKS PASSED - FACTORY QUALIFICATION REQUIRED")
    c.setFillColor(INK); yy -= 7 * mm
    c.setFont("Helvetica-Bold", 8.6); c.drawString(x2, yy, "ENGINEERING NOTES")
    yy -= 5 * mm; c.setFont("Helvetica", 7)
    for i in issues[:16]:
        c.setFillColor(colors.HexColor({"error": "#a33", "warn": "#8a6b1f",
                                        "info": "#33607a"}[i["level"]]))
        c.drawString(x2, yy, f"[{i['level'].upper()}] {i['code']}")
        c.setFillColor(INK)
        c.drawString(x2 + 30 * mm, yy, i["message"][:96]); yy -= 4 * mm
        if i.get("fix"):
            c.setFillColor(DIMC)
            c.drawString(x2 + 32 * mm, yy, "-> " + i["fix"][:94]); yy -= 4 * mm
            c.setFillColor(INK)
    c.showPage()


def _commercial(c, units, nest_result, quote, n, meta):
    Sheet(c, "BILL OF MATERIALS & QUOTATION (AED)", meta, n)
    y = PH - M - 24 * mm
    c.setFont("Helvetica-Bold", 9); c.drawString(M + 6 * mm, y, "HARDWARE & FITTINGS")
    y -= 6 * mm; c.setFont("Helvetica", 7)
    for l in quote.get("hardware_lines", []):
        c.drawString(M + 6 * mm, y, l["item"][:56])
        c.drawRightString(M + 88 * mm, y, f"{l['qty']:g} {l['unit']}")
        c.drawRightString(M + 108 * mm, y, f"{l['rate']:.2f}")
        c.drawRightString(M + 130 * mm, y, f"{l['total']:.2f}")
        y -= 4.2 * mm
    y -= 4 * mm
    c.setFont("Helvetica-Bold", 9); c.drawString(M + 6 * mm, y, "PANEL STOCK")
    y -= 6 * mm; c.setFont("Helvetica", 7)
    for k, v in quote.get("sheets_by_material", {}).items():
        c.drawString(M + 6 * mm, y,
                     f"{S.MATERIALS.get(k,{}).get('label',k)}  x{v} sheets  "
                     f"({nest_result['sheet_size'][0]:.0f}x"
                     f"{nest_result['sheet_size'][1]:.0f})")
        y -= 4.2 * mm

    x2 = PW / 2 + 10 * mm; yy = PH - M - 24 * mm
    c.setFont("Helvetica-Bold", 11); c.drawString(x2, yy, quote["title"]); yy -= 9 * mm
    c.setFont("Helvetica", 9.4)
    for k, v in quote["lines"]:
        bold = k.startswith("Subtotal")
        c.setFont("Helvetica-Bold" if bold else "Helvetica", 9.4)
        c.drawString(x2, yy, k)
        c.drawRightString(x2 + 92 * mm, yy, f"{v:,.2f}")
        yy -= 6.2 * mm
    c.setStrokeColor(INK); c.setLineWidth(1)
    c.line(x2, yy + 3 * mm, x2 + 92 * mm, yy + 3 * mm); yy -= 3 * mm
    c.setFont("Helvetica-Bold", 13)
    c.drawString(x2, yy, "TOTAL (AED)")
    c.drawRightString(x2 + 92 * mm, yy, f"{quote['total_aed']:,.2f}")
    yy -= 10 * mm
    c.setFont("Helvetica-Oblique", 7.4); c.setFillColor(DIMC)
    c.drawString(x2, yy, quote["formula"]); yy -= 4.4 * mm
    c.drawString(x2, yy, quote.get("note", "")); yy -= 4.4 * mm
    c.drawString(x2, yy, f"Nest yield {quote.get('nest_yield_pct','-')}% -> waste "
                         f"allowance {quote.get('waste_pct','-')}% applied to material.")
    c.setFillColor(INK)
    c.showPage()


def _qc_install(c, units, n, meta):
    Sheet(c, "QC CHECKLIST & INSTALLATION SEQUENCE", meta, n)
    y = PH - M - 24 * mm
    tol = S.TOLERANCE
    qc = [
        ("Dimensions", [
            f"Overall W/H/D within +/-{tol['panel_cut']}mm of drawing",
            f"Carcass diagonals equal within {tol['carcass_squareness']}mm",
            "All parts present against the cut list (count, do not eyeball)"]),
        ("Alignment & gaps", [
            f"All front gaps {S.FRONTS['gap']}mm +/-{tol['door_gap_variation']}mm, "
            f"even top to bottom",
            "Door faces flush with each other across the run (straightedge)",
            "Drawer faces level; reveal equal left and right"]),
        ("Movement", [
            "Every door opened/closed 10x - no rub, soft-close engages",
            "Every drawer cycled 10x fully loaded - no drop, no side play",
            "Sliding doors run full travel without lift-off"]),
        ("Hardware", [
            "Hinge plates fully seated on the System-32 row, screws torqued",
            "Runners clipped both sides; front brackets engaged",
            "Handles at consistent height, no through-hole blowout"]),
        ("Surface & edges", [
            "Edgeband fully bonded, no glue line, corners dressed",
            "No CNC scoring on visible faces; no tear-out on cross-cuts",
            "Colour/grain matched across adjacent fronts (front-set numbered)"]),
        ("Structural", [
            "Shelves loaded to rated UDL - deflection under L/200",
            "Back panel fully in its groove all round",
            "Unit fixed to wall at min. 2 points per carcass"]),
    ]
    c.setFont("Helvetica-Bold", 10); c.drawString(M + 6 * mm, y, "QC CHECKLIST")
    y -= 7 * mm
    for grp, items in qc:
        c.setFont("Helvetica-Bold", 8); c.drawString(M + 6 * mm, y, grp); y -= 4.6 * mm
        c.setFont("Helvetica", 7.2)
        for it in items:
            c.rect(M + 7 * mm, y - .8 * mm, 2.6 * mm, 2.6 * mm)
            c.drawString(M + 12 * mm, y, it); y -= 4.2 * mm
        y -= 1.6 * mm

    x2 = PW / 2 + 6 * mm; yy = PH - M - 24 * mm
    c.setFont("Helvetica-Bold", 10); c.drawString(x2, yy, "INSTALLATION SEQUENCE")
    yy -= 7 * mm
    steps = [
        "FACTORY: edgeband -> CNC -> dry-assemble each carcass -> fit runners and "
        "hinge plates -> hang fronts -> adjust to 3mm gaps -> number every part -> "
        "knock down.",
        "SITE PREP: confirm wall type (UAE block + render vs gypsum), mark a level "
        "datum line, check floor level across the run, and confirm all wall "
        "obstructions and approved joinery cut-out envelopes behind the unit.",
        "1. Set the plinth / legs, level across the full run to "
        f"{S.TOLERANCE['level_over_1m']}mm per metre.",
        "2. Assemble carcasses on the floor; square by checking diagonals before the "
        "back goes in.",
        "3. Slide the back into its groove, then fix - the back is what holds square.",
        "4. Stand carcasses, clamp adjacent units front and back, bolt together "
        "through the sides.",
        "5. Fix to wall - min. 2 anchors per carcass into block, never into render "
        "alone. Gypsum needs a batten or toggles.",
        "6. Stack and bolt the top boxes; scribe the ceiling filler.",
        "7. Hang fronts, set gaps, adjust hinges in all three axes.",
        "8. Fit shelves, rods, LED, handles.",
        "9. Fit scribe fillers to the walls; silicone only where specified.",
        "10. Clean, protective film off, customer walkthrough, sign-off.",
    ]
    c.setFont("Helvetica", 7.2)
    for st in steps:
        for line in _wrap(st, 92):
            c.drawString(x2, yy, line); yy -= 4 * mm
        yy -= 1.2 * mm
    yy -= 3 * mm
    c.setFont("Helvetica-Bold", 8); c.drawString(x2, yy, "SAFETY / RISK"); yy -= 4.8 * mm
    c.setFont("Helvetica", 7.2)
    for r in [f"Two-person lift for any part over {S.LOGISTICS['max_single_person_kg']}kg "
              f"- flagged in the cut list notes.",
              "Tall units must be wall-fixed before loading - tip-over risk.",
              "Mirror/glass fronts: transport vertical, edge-protected, gloves on.",
              "Dust extraction on all site cutting; MDF dust is a respiratory hazard."]:
        c.drawString(x2, yy, "- " + r); yy -= 4 * mm
    c.showPage()


def _wrap(text, n):
    out, line = [], ""
    for w in text.split():
        if len(line) + len(w) + 1 > n:
            out.append(line); line = w
        else:
            line = (line + " " + w).strip()
    if line:
        out.append(line)
    return out
