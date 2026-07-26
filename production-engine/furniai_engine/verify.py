"""
FurniAI - Self-verification suite
=================================
Checks the engine's output against the published standards it claims to follow,
and calibrates the fast quote model against real decomposed geometry.
Run:  python3 verify.py
"""
import math, itertools
import standards as S, planner, engine, nest, cost

FAIL = []
def check(name, cond, detail=""):
    print(("  PASS  " if cond else "  FAIL  ") + name + (f"   {detail}" if detail else ""))
    if not cond: FAIL.append(name)

print("\n=== 1. SYSTEM 32 CONFORMANCE " + "="*46)
h = engine.sys32_rows(2364)
check("hole pitch is exactly 32mm",
      all(abs(h[i+1]-h[i]-32) < 1e-6 for i in range(len(h)-1)), f"{len(h)} holes")
check("first/last hole symmetric about panel centre",
      abs(h[0] - (2364 - h[-1])) < 1e-6, f"{h[0]:.1f} vs {2364-h[-1]:.1f}")
check("hole dia 5mm, depth 12mm, setback 37mm",
      (S.SYS32["hole_dia"], S.SYS32["hole_depth"], S.SYS32["front_setback"])
      == (5.0, 12.0, 37.0))
check("end margin >= 2 pitches", h[0] >= 64, f"{h[0]:.1f}mm")

print("\n=== 2. HINGE GEOMETRY " + "="*53)
check("cup centre = cup_dia/2 + K",
      abs(S.HINGE["cup_centre_from_edge"] -
          (S.HINGE["cup_dia"]/2 + S.HINGE["boring_distance_K"])) < 1e-9,
      f"{S.HINGE['cup_centre_from_edge']} = 17.5 + {S.HINGE['boring_distance_K']}")
check("mounting-plate setback == System-32 front row",
      S.HINGE["plate_setback"] == S.SYS32["front_setback"])
for hgt, n in [(600,2),(900,2),(1500,3),(1900,4),(2350,5)]:
    check(f"hinge count for {hgt}mm door = {n}", engine.hinge_count(hgt)==n)

print("\n=== 3. FRONT GAP ARITHMETIC " + "="*47)
for W, n in [(1200,2),(900,1),(2000,3),(600,1)]:
    u = engine.build({"unit_id":"T","type":"cabinet","width":W,"height":720,
                      "depth":400,"bays":[{"width":None,"no_split":True,
                      "front":{"kind":"door","leaves":n},
                      "modules":[{"type":"shelves","height":"fill","count":1}]}]})
    doors = [p for p in u.parts if p.group=="front"]
    total = sum(d.width for d in doors) + (len(doors)-1)*S.FRONTS["gap"] \
            + 2*S.FRONTS["edge_reveal"]
    check(f"{n} leaf/leaves across {W}mm close out exactly",
          abs(total - W) < 0.05, f"{total:.2f} vs {W}")

print("\n=== 4. CARCASS PANEL ARITHMETIC " + "="*43)
t = S.PANEL["carcass"]; g = S.CARCASS["back_groove_depth"]
u = engine.build({"unit_id":"C","type":"cabinet","width":900,"height":720,
                  "depth":400,"bays":[{"width":None,"no_split":True,
                  "modules":[{"type":"shelves","height":"fill","count":2}]}]})
bot = [p for p in u.parts if p.name=="Bottom"][0]
check("top/bottom length = W - 2t", abs(bot.length-(900-2*t))<1e-6,
      f"{bot.length} = 900 - 2x{t}")
side = [p for p in u.parts if p.name=="Side L"][0]
check("side length = carcass height", abs(side.length-720)<1e-6)
back = [p for p in u.parts if p.group=="back"]
bw = sum(b.width for b in back)
check("back width = W - 2t + 2 x groove depth", abs(bw-(900-2*t+2*g))<0.6,
      f"{bw:.1f} = 900 - {2*t} + {2*g}")
sh = [p for p in u.parts if p.name.startswith("Adj")][0]
check("adjustable shelf = opening - 2mm drop-in clearance",
      abs(sh.length-(900-2*t-S.CARCASS["shelf_side_clearance"]))<1e-6,
      f"{sh.length}")
auto = engine.build({"unit_id":"C2","type":"cabinet","width":1600,"height":720,
                     "depth":400,"bays":[{"width":None,
                     "modules":[{"type":"shelves","height":"fill","count":2}]}]})
ashelves = [p for p in auto.parts if p.name.startswith("Adj")]
check("auto-divider keeps every shelf under the deflection limit",
      ashelves and all(p.length <= S.SHELF_SPAN["mdf"][18] for p in ashelves),
      f"1600mm single bay auto-split into {len(auto.meta['bay_openings'])} -> "
      f"widest shelf {max(p.length for p in ashelves):.0f}mm "
      f"<= {S.SHELF_SPAN['mdf'][18]}mm")
wide = engine.build({"unit_id":"X","type":"shelving","width":1400,"height":2000,
                     "depth":350,"panel_thickness":18,
                     "bays":[{"width":1400,"no_split":True,
                              "modules":[{"type":"shelves","height":"fill","count":3}]}]})
check("an explicitly over-wide shelf is still reported",
      any(i["code"]=="SHELF_SPAN" for i in wide.issues) or
      all(p.length <= S.SHELF_SPAN["mdf"][18]
          for p in wide.parts if p.name.startswith("Adj")),
      "over-span either split or flagged")

print("\n=== 5. DRAWER GEOMETRY " + "="*52)
u = engine.build({"unit_id":"D","type":"kitchen_base","width":600,"height":720,
                  "depth":560})
opening = u.meta["bay_openings"][0]
side = [p for p in u.parts if p.name=="Drawer side"][0]
fb   = [p for p in u.parts if "front/back" in p.name][0]
out_w = fb.length + 2*S.PANEL["drawer_side"]
check("box outside width = opening - 10 (undermount)",
      abs(out_w-(opening-10))<0.05, f"{out_w:.1f} vs {opening-10:.1f}")
check("box depth = a catalogue runner length",
      side.length in S.DRAWER["slide_lengths"], f"{side.length}mm runner")
check("runner fits inside carcass with rear clearance",
      side.length + S.DRAWER["box_rear_clearance"] <= u.meta["internal_depth"],
      f"{side.length}+{S.DRAWER['box_rear_clearance']} <= {u.meta['internal_depth']}")
bottom = [p for p in u.parts if p.name=="Drawer bottom"][0]
check("bottom sized for a 6x8 groove both directions",
      abs(bottom.length-(fb.length+2*S.DRAWER["bottom_groove_depth"]))<0.05)

print("\n=== 6. ERGONOMICS " + "="*57)
u = engine.build({"unit_id":"E","type":"wardrobe","width":1200,"height":2400,
                  "depth":600})
check("wardrobe internal depth >= 530 for hangers",
      u.meta["internal_depth"] >= S.ERGO["wardrobe"]["min_internal_depth_hanging"],
      f"{u.meta['internal_depth']}mm")
k = S.ERGO["kitchen"]
worktop = k["toe_kick_height"] + k["base_carcass_height"]
check("kitchen 150 toe + 720 carcass + worktop lands in 850-950",
      k["worktop_height"][0] <= worktop + k["worktop_thickness"][0]
      and worktop + k["worktop_thickness"][1] <= k["worktop_height"][1],
      f"{worktop+k['worktop_thickness'][0]}-{worktop+k['worktop_thickness'][1]}mm")

print("\n=== 7. CUT LIST COMPLETENESS (nothing renders that is not cut) " + "="*11)
for demo in ("wardrobe","wardrobe_sliding","kitchen_base","vanity"):
    import furniai
    specs = planner.plan(furniai.DEMOS[demo])
    units = [engine.build(s) for s in specs]
    import exporters
    scene = exporters.scene_json(units)["boxes"]
    boxes = {b["pid"].split("#")[0] for b in scene}
    rows  = {r["Part ID"] for r in exporters.cutlist_rows(units)}
    accs  = {p.pid for u in units for p in u.parts if p.group=="accessory"}
    check(f"{demo}: every rendered solid has a cut-list row",
          not (boxes - rows - accs), f"{len(rows)} rows / {len(boxes)} part IDs")
    pieces = sum(p.qty for u in units for p in u.parts)
    check(f"{demo}: solid count == piece count (nothing stacked, nothing missing)",
          len(scene)==pieces, f"{len(scene)} solids vs {pieces} pieces")

print("\n=== 8. NESTING INTEGRITY " + "="*50)
import furniai
units = [engine.build(s) for s in planner.plan(furniai.DEMOS["wardrobe"])]
parts = [p for u in units for p in u.parts]
r = nest.nest(parts)
check("no part left unplaced", not r["unplaced"], f"{len(r['unplaced'])} unplaced")
placed = sum(len(s.placements) for s in r["sheets"])
expect = sum(p.qty for p in parts if p.group!="accessory")
check("every piece nested exactly once", placed==expect, f"{placed} vs {expect}")
ov = 0
for sh in r["sheets"]:
    for a,b in itertools.combinations(sh.placements,2):
        if (a.x < b.x+b.w-0.01 and b.x < a.x+a.w-0.01 and
            a.y < b.y+b.h-0.01 and b.y < a.y+a.h-0.01): ov += 1
check("no overlapping placements", ov==0, f"{ov} overlaps")
inb = all(p.x>=0 and p.y>=0 and p.x+p.w<=sh.w and p.y+p.h<=sh.h
          for sh in r["sheets"] for p in sh.placements)
check("all placements inside the sheet", inb)
grained = all(not p.rotated for sh in r["sheets"] for p in sh.placements
              if S.MATERIALS.get(p.material,{}).get("grained"))
check("no grained panel rotated across the grain", grained)

print("\n=== 9. QUOTE MODEL CALIBRATION " + "="*44)
print("  Comparing the configurator's bounding-box panel factor against the")
print("  panel area the real decomposition actually produces.\n")
print(f"  {'type':16}{'sizes tested':14}{'current':>9}{'measured':>10}{'error':>9}")
recs = {}
for typ, sizes in [
    ("wardrobe",      [(1800,2400,600),(2400,2400,600),(3600,2800,600),(4200,2600,650)]),
    ("kitchen_base",  [(600,720,560),(1200,720,560),(3000,720,560)]),
    ("kitchen_wall",  [(600,720,320),(1800,720,320)]),
    ("vanity",        [(900,720,480),(1500,720,500)]),
    ("shelving",      [(800,2000,350),(1600,2200,350)]),
    ("cabinet",       [(600,1800,450),(1200,1800,450)]),
]:
    facs = []
    for (W,H,D) in sizes:
        us = [engine.build(s) for s in planner.plan(
            {"unit_id":"X","type":typ,"width":W,"height":H,"depth":D})]
        area = sum(p.area_m2 for u in us for p in u.parts if p.group!="accessory")
        bnd = (2*(W*H)+2*(W*D)+2*(H*D))/1e6
        facs.append(area/bnd)
    cur = S.PANEL_FACTOR.get(typ, 1.5)
    meas = sum(facs)/len(facs)
    recs[typ] = round(meas,2)
    print(f"  {typ:16}{len(sizes):<14}{cur:>9.2f}{meas:>10.2f}{(meas/cur-1)*100:>8.0f}%")
print("\n  RECOMMENDED panel factors for the configurator:")
print("  ", recs)

print("\n" + "="*74)
print(f"  {'ALL CHECKS PASSED' if not FAIL else 'FAILURES: ' + ', '.join(FAIL)}")
print("="*74)
