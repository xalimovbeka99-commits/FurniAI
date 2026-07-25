"""
FurniAI - Output Pipeline
=========================
Everything the factory and the customer receive:

  export_cutlist_csv   - the shop floor list
  export_dxf_parts     - one layered DXF per part (BAZIS / CNC ready)
  export_dxf_nest      - one DXF per sheet with parts nested for the beam saw
  export_scene_json    - the parametric 3D scene (arrays of boxes, mm)
  export_viewer_html   - a standalone Three.js viewer with live dimensions
  export_shop_pdf      - the blueprint: elevations, sections, cut list, nesting
"""
from __future__ import annotations
from typing import List, Dict, Any
import os, json, math, csv
import ezdxf
from ezdxf import units as dxfunits
import standards as S


# ===========================================================================
#  CUT LIST
# ===========================================================================
def cutlist_rows(units) -> List[Dict[str, Any]]:
    rows = []
    for u in units:
        for p in u.parts:
            if p.group == "accessory":
                continue
            edges = ",".join(f"{k}:{v}" for k, v in sorted(p.edges.items()) if v)
            rows.append({
                "Unit": u.meta.get("unit_id", ""),
                "Part ID": p.pid,
                "Part Name": p.name,
                "Length_Finished (mm)": round(p.length, 1),
                "Width_Finished (mm)": round(p.width, 1),
                "Length_Raw_Cut (mm)": round(p.raw_length, 1),
                "Width_Raw_Cut (mm)": round(p.raw_width, 1),
                "Thk (mm)": round(p.thickness, 1),
                "Material": S.MATERIALS.get(p.material, {}).get("label", p.material),
                "Qty": p.qty,
                "Edge Banding": edges or "-",
                "Grain": "Length" if p.grain == "length" else "Free",
                "Area m2": round(p.area_m2, 3),
                "Ops": len(p.ops),
                "Notes": p.note.strip(" |"),
            })
    return rows


def export_cutlist_csv(units, path):
    rows = cutlist_rows(units)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    return path


# ===========================================================================
#  DXF
# ===========================================================================
def _new_doc():
    doc = ezdxf.new("R2010", setup=True)
    doc.units = dxfunits.MM
    for key, spec in S.CNC_LAYERS.items():
        if spec["name"] not in doc.layers:
            doc.layers.add(spec["name"], color=spec["color"])
    return doc


def export_dxf_parts(units, outdir):
    os.makedirs(outdir, exist_ok=True)
    written = []
    for u in units:
        for p in u.parts:
            if p.group == "accessory":
                continue
            doc = _new_doc()
            msp = doc.modelspace()
            L, W = p.length, p.width
            msp.add_lwpolyline([(0, 0), (L, 0), (L, W), (0, W)], close=True,
                               dxfattribs={"layer": S.CNC_LAYERS["outline"]["name"]})
            for op in p.ops:
                _draw_op(msp, op, L, W)
            msp.add_text(
                f"{p.pid} {p.name} | Fin: {L:.1f}x{W:.1f}x{p.thickness:.1f} | "
                f"Cut: {p.raw_length:.1f}x{p.raw_width:.1f} | {p.material} | QTY {p.qty}",
                height=max(12, L / 60),
                dxfattribs={"layer": S.CNC_LAYERS["label"]["name"]}
            ).set_placement((0, -max(25, L / 40)))
            fp = os.path.join(outdir, f"{p.pid}.dxf")
            doc.saveas(fp)
            written.append(fp)
    return written


def _draw_op(msp, op, L, W):
    lay = S.CNC_LAYERS.get(op.layer, S.CNC_LAYERS["drill_thru"])["name"]
    if op.kind in ("drill",):
        msp.add_circle((op.x, op.y), op.dia / 2.0, dxfattribs={"layer": lay})
    elif op.kind == "edge_drill":
        edge = op.face.split(":")[-1]
        # L1/L2 are the LONG edges (y = 0 / y = W); W1/W2 are the SHORT
        # edges (x = 0 / x = L). op.x is the distance along that edge.
        pos = {"L1": (op.x, 0), "L2": (op.x, W), "W1": (0, op.x), "W2": (L, op.x)}
        pt = pos.get(edge, (op.x, 0))
        msp.add_circle(pt, op.dia / 2.0, dxfattribs={"layer": lay})
        msp.add_text(f"EDGE {edge} d{op.dia}x{op.depth}", height=8,
                     dxfattribs={"layer": S.CNC_LAYERS["label"]["name"]}
                     ).set_placement(pt)
    elif op.kind == "groove":
        h = op.width / 2.0
        msp.add_lwpolyline([(op.x, op.y - h), (op.x2, op.y2 - h),
                            (op.x2, op.y2 + h), (op.x, op.y + h)],
                           close=True, dxfattribs={"layer": lay})
    elif op.kind in ("rebate", "pocket", "contour_in"):
        msp.add_lwpolyline([(op.x, op.y), (op.x2, op.y), (op.x2, op.y2),
                            (op.x, op.y2)], close=True, dxfattribs={"layer": lay})


def export_dxf_nest(nest_result, outdir, prefix="NEST"):
    os.makedirs(outdir, exist_ok=True)
    written = []
    for sh in nest_result["sheets"]:
        doc = _new_doc()
        msp = doc.modelspace()
        msp.add_lwpolyline([(0, 0), (sh.w, 0), (sh.w, sh.h), (0, sh.h)],
                           close=True,
                           dxfattribs={"layer": S.CNC_LAYERS["dim"]["name"]})
        for pl in sh.placements:
            msp.add_lwpolyline([(pl.x, pl.y), (pl.x + pl.w, pl.y),
                                (pl.x + pl.w, pl.y + pl.h), (pl.x, pl.y + pl.h)],
                               close=True,
                               dxfattribs={"layer": S.CNC_LAYERS["outline"]["name"]})
            msp.add_text(f"{pl.pid}", height=28,
                         dxfattribs={"layer": S.CNC_LAYERS["label"]["name"]}
                         ).set_placement((pl.x + 12, pl.y + 12))
        msp.add_text(
            f"SHEET {sh.index} | {S.MATERIALS.get(sh.material,{}).get('label',sh.material)} "
            f"{sh.thk:.0f}mm | {sh.w:.0f}x{sh.h:.0f} | yield {sh.yield_pct:.1f}% | "
            f"kerf {nest_result['kerf']:.0f}mm",
            height=45, dxfattribs={"layer": S.CNC_LAYERS["label"]["name"]}
        ).set_placement((0, sh.h + 40))
        fp = os.path.join(outdir, f"{prefix}_{sh.index:02d}_{sh.material}_{sh.thk:.0f}.dxf")
        doc.saveas(fp)
        written.append(fp)
    return written


# ===========================================================================
#  3D SCENE  (parametric boxes, millimetres, cabinet space)
# ===========================================================================
def scene_json(units) -> Dict[str, Any]:
    boxes, bbox = [], [0, 0, 0]
    for u in units:
        off_x = u.spec.get("_stack_x", 0.0)
        off_y = u.spec.get("_stack_y", 0.0)
        for p in u.parts:
            dx, dy, dz = p.size
            if dx <= 0 or dy <= 0 or dz <= 0:
                continue
            mat = S.MATERIALS.get(p.material, {})
            for k, (x, y, z) in enumerate(p.instances or [p.pos]):
                boxes.append({
                    "pid": p.pid if p.qty == 1 else f"{p.pid}#{k+1}",
                    "name": p.name, "group": p.group,
                    "pos": [round(x + off_x, 1), round(y + off_y, 1), round(z, 1)],
                    "size": [round(dx, 1), round(dy, 1), round(dz, 1)],
                    "color": mat.get("hex", "#cfcfcf"),
                    "material": mat.get("label", p.material),
                    "cut": [round(p.length, 1), round(p.width, 1),
                            round(p.thickness, 1)],
                    "qty": p.qty,
                })
                bbox[0] = max(bbox[0], x + off_x + dx)
                bbox[1] = max(bbox[1], y + off_y + dy)
                bbox[2] = max(bbox[2], z + dz)
    return {
        "units": [u.meta for u in units],
        "bbox": [round(v, 1) for v in bbox],
        "boxes": boxes,
        "issues": [i for u in units for i in u.issues],
    }


def export_scene_json(units, path):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(scene_json(units), f, indent=1)
    return path


VIEWER_HTML = r"""<!doctype html><html><head><meta charset="utf-8">
<title>FurniAI - 3D Viewer</title>
<style>
 html,body{margin:0;height:100%;background:#14100c;color:#e9e3d8;
   font:13px/1.5 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
 #c{position:fixed;inset:0}
 #hud{position:fixed;top:14px;left:14px;background:rgba(20,16,12,.86);
   border:1px solid #4a3f31;border-radius:12px;padding:14px 16px;max-width:330px;
   backdrop-filter:blur(8px)}
 #hud h1{margin:0 0 4px;font-size:15px;letter-spacing:.04em}
 #stamp{font:11px ui-monospace,SFMono-Regular,Menlo,monospace;color:#c8a165;
   margin:0 0 8px;padding-bottom:7px;border-bottom:1px solid #4a3f31;
   word-break:break-word}
 .row{display:flex;justify-content:space-between;gap:14px;padding:2px 0}
 .k{color:#a0917c}
 #legend{margin-top:10px;border-top:1px solid #4a3f31;padding-top:8px}
 .sw{display:inline-block;width:11px;height:11px;border-radius:3px;
   margin-right:6px;vertical-align:-1px;border:1px solid #0004}
 button{background:#2a231b;color:#e9e3d8;border:1px solid #5c4c3a;border-radius:8px;
   padding:5px 10px;margin:3px 4px 0 0;cursor:pointer;font-size:12px}
 button.on{background:#8a6b3f;border-color:#c8a165}
 #tip{position:fixed;pointer-events:none;background:#000c;border:1px solid #6b5a44;
   border-radius:7px;padding:6px 9px;font-size:12px;display:none}
 #issues{position:fixed;bottom:14px;left:14px;max-width:420px;
   background:rgba(20,16,12,.86);border:1px solid #4a3f31;border-radius:12px;
   padding:10px 13px;max-height:30vh;overflow:auto}
 .err{color:#ff8b7a}.warn{color:#f0c674}.info{color:#8fc3d6}
</style></head><body>
<canvas id="c"></canvas>
<div id="hud"><h1>__TITLE__</h1><div id="stamp">__STAMP__</div><div id="stats"></div>
<div id="legend"></div>
<div>
<button id="bExp" class="">Explode</button>
<button id="bDoors" class="on">Fronts</button>
<button id="bDim" class="on">Dimensions</button>
<button id="bWire">Wireframe</button>
</div></div>
<div id="tip"></div><div id="issues"></div>
<script type="importmap">
{"imports":{"three":"https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.module.min.js"}}
</script>
<script type="module">
import * as THREE from 'three';
const DATA = __DATA__;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x14100c);
const [BX,BY,BZ] = DATA.bbox;
const camera = new THREE.PerspectiveCamera(38, innerWidth/innerHeight, 1, 60000);
const renderer = new THREE.WebGLRenderer({canvas:document.getElementById('c'),antialias:true});
renderer.setPixelRatio(devicePixelRatio); renderer.setSize(innerWidth,innerHeight);

scene.add(new THREE.HemisphereLight(0xfff3e0, 0x2a2018, 1.05));
const key = new THREE.DirectionalLight(0xffffff, 1.15);
key.position.set(BX*1.2, BY*1.8, -BZ*3); scene.add(key);
const fill = new THREE.DirectionalLight(0xffd9a0, .35);
fill.position.set(-BX, BY*.6, BZ*2); scene.add(fill);

const root = new THREE.Group(); scene.add(root);
root.position.set(-BX/2, -BY/2, -BZ/2);

const grid = new THREE.GridHelper(Math.max(BX,BZ)*3, 24, 0x3a2f24, 0x2a231b);
grid.position.y = -BY/2; scene.add(grid);

const meshes = [], edgesList = [], byMat = {};
for (const b of DATA.boxes){
  const g = new THREE.BoxGeometry(b.size[0], b.size[1], b.size[2]);
  const m = new THREE.MeshStandardMaterial({color:b.color, roughness:.62, metalness:.06});
  const mesh = new THREE.Mesh(g,m);
  mesh.position.set(b.pos[0]+b.size[0]/2, b.pos[1]+b.size[1]/2, b.pos[2]+b.size[2]/2);
  mesh.userData = b; root.add(mesh); meshes.push(mesh);
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(g),
        new THREE.LineBasicMaterial({color:0x000000, transparent:true, opacity:.28}));
  e.position.copy(mesh.position); root.add(e); edgesList.push(e);
  byMat[b.material] = b.color;
}

// ---- dimension annotations -------------------------------------------------
const dimGroup = new THREE.Group(); root.add(dimGroup);
function label(text, x,y,z, size){
  const cv = document.createElement('canvas'); const s=4;
  const ctx = cv.getContext('2d'); ctx.font = `${28*s}px sans-serif`;
  cv.width = ctx.measureText(text).width + 24*s; cv.height = 44*s;
  const c2 = cv.getContext('2d'); c2.font = `${28*s}px sans-serif`;
  c2.fillStyle='rgba(20,16,12,.85)'; c2.fillRect(0,0,cv.width,cv.height);
  c2.fillStyle='#f2e6cf'; c2.fillText(text, 12*s, 32*s);
  const tex = new THREE.CanvasTexture(cv);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({map:tex, depthTest:false}));
  const h = size||90; sp.scale.set(h*cv.width/cv.height, h, 1);
  sp.position.set(x,y,z); dimGroup.add(sp); return sp;
}
function dimLine(a,b,text){
  const g = new THREE.BufferGeometry().setFromPoints(
      [new THREE.Vector3(...a), new THREE.Vector3(...b)]);
  dimGroup.add(new THREE.Line(g, new THREE.LineBasicMaterial({color:0xc8a165})));
  label(text,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);
}
const off = 140;
dimLine([0,-off,0],[BX,-off,0], `W ${BX.toFixed(0)} mm`);
dimLine([-off,0,0],[-off,BY,0], `H ${BY.toFixed(0)} mm`);
dimLine([BX+off,0,0],[BX+off,0,BZ], `D ${BZ.toFixed(0)} mm`);

// ---- interaction -----------------------------------------------------------
let rx=-0.22, ry=0.72, dist=Math.max(BX,BY,BZ)*2.3, tx=0, ty=0;
let drag=false, lx=0, ly=0, pan=false;
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight);});
renderer.domElement.addEventListener('pointerdown',e=>{drag=true;pan=e.button===2||e.shiftKey;lx=e.clientX;ly=e.clientY;});
addEventListener('pointerup',()=>drag=false);
addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('pointermove',e=>{
  if(drag){ const dx=e.clientX-lx, dy=e.clientY-ly; lx=e.clientX; ly=e.clientY;
    if(pan){ tx-=dx*dist/900; ty+=dy*dist/900; }
    else { ry+=dx*0.006; rx=Math.max(-1.4,Math.min(1.4,rx+dy*0.006)); } }
  else hover(e);
});
addEventListener('wheel',e=>{dist*=(1+Math.sign(e.deltaY)*0.09);},{passive:true});

const ray = new THREE.Raycaster(), pt = new THREE.Vector2();
const tip = document.getElementById('tip');
function hover(e){
  pt.x=(e.clientX/innerWidth)*2-1; pt.y=-(e.clientY/innerHeight)*2+1;
  ray.setFromCamera(pt,camera);
  const hit = ray.intersectObjects(meshes)[0];
  if(hit){ const d=hit.object.userData;
    tip.style.display='block'; tip.style.left=(e.clientX+14)+'px';
    tip.style.top=(e.clientY+14)+'px';
    tip.innerHTML=`<b>${d.pid}</b> ${d.name}<br>`+
      `cut ${d.cut[0]} x ${d.cut[1]} x ${d.cut[2]} mm<br>`+
      `${d.material} &middot; qty ${d.qty}`;
  } else tip.style.display='none';
}

let explode=0, expTarget=0;
document.getElementById('bExp').onclick=e=>{expTarget=expTarget?0:1;e.target.classList.toggle('on');};
document.getElementById('bDoors').onclick=e=>{e.target.classList.toggle('on');
  const on=e.target.classList.contains('on');
  meshes.forEach((m,i)=>{ if(m.userData.group==='front'){m.visible=on;edgesList[i].visible=on;} });};
document.getElementById('bDim').onclick=e=>{e.target.classList.toggle('on');
  dimGroup.visible=e.target.classList.contains('on');};
document.getElementById('bWire').onclick=e=>{e.target.classList.toggle('on');
  const on=e.target.classList.contains('on');
  meshes.forEach(m=>{m.material.wireframe=on;});};

function animate(){
  requestAnimationFrame(animate);
  explode += (expTarget-explode)*0.12;
  meshes.forEach((m,i)=>{
    const b=m.userData; const cx=BX/2, cy=BY/2, cz=BZ/2;
    const bx=b.pos[0]+b.size[0]/2, by=b.pos[1]+b.size[1]/2, bz=b.pos[2]+b.size[2]/2;
    const k=explode*0.45;
    m.position.set(bx+(bx-cx)*k, by+(by-cy)*k, bz+(bz-cz)*k);
    edgesList[i].position.copy(m.position);
  });
  camera.position.set(tx+dist*Math.cos(rx)*Math.sin(ry),
                      ty+dist*Math.sin(rx),
                      dist*Math.cos(rx)*Math.cos(ry));
  camera.lookAt(tx,ty,0);
  renderer.render(scene,camera);
}
animate();

document.getElementById('stats').innerHTML =
  `<div class="row"><span class="k">Overall</span><span>${BX.toFixed(0)} x ${BY.toFixed(0)} x ${BZ.toFixed(0)} mm</span></div>`+
  `<div class="row"><span class="k">Carcasses</span><span>${DATA.units.length}</span></div>`+
  `<div class="row"><span class="k">Components</span><span>${DATA.boxes.length}</span></div>`+
  DATA.units.map(u=>`<div class="row"><span class="k">${u.unit_id}</span><span>${u.W}x${u.H}x${u.D} &middot; int. depth ${u.internal_depth}</span></div>`).join('');
document.getElementById('legend').innerHTML =
  Object.entries(byMat).map(([k,v])=>`<span class="sw" style="background:${v}"></span>${k}`).join('<br>');
document.getElementById('issues').innerHTML = DATA.issues.length
  ? '<b>Engineering checks</b><br>'+DATA.issues.map(i=>
      `<span class="${i.level}">[${i.level.toUpperCase()}] ${i.code}</span> ${i.message}`+
      (i.fix?`<br><span class="k">&rarr; ${i.fix}</span>`:'')).join('<br>')
  : '<b>Engineering checks</b><br><span class="info">All checks passed.</span>';
</script></body></html>"""


def export_viewer_html(units, path, title="FurniAI Unit", stamp=""):
    data = json.dumps(scene_json(units))
    html = (VIEWER_HTML.replace("__DATA__", data)
                       .replace("__TITLE__", title)
                       .replace("__STAMP__", stamp))
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
    return path
