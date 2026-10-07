#!/usr/bin/env python3
"""Mutation checks for the asset viewer (v3). Each mutant is applied to the source, the
asset-viewer vitest suite is run, and the source is restored. Every mutant must be KILLED.
    python3 docs/m3/asset-viewer/replica/mutate.py
"""
import subprocess, shutil, sys, re, json
import os
R=os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..')) + '/'
M=[
 ("caching the resolved URL (download reuses the display address)", "src/lib/assetViewer/mountAssetViewer.js",
  "  async function downloadCreative(info, save, auto) {\n    const attempts = { resolve: 0 };\n    const resolveOnce = () => {\n      attempts.resolve++;\n      return creative.resolve(info.jobId, info.index);\n    };",
  "  async function downloadCreative(info, save, auto) {\n    const attempts = { resolve: 0 };\n    const resolveOnce = async () => {\n      attempts.resolve++;\n      const k = `${info.jobId}/${info.index}`;\n      if (!globalThis.__mutCache) globalThis.__mutCache = new Map();\n      if (globalThis.__mutCache.has(k)) return globalThis.__mutCache.get(k);\n      const d = await creative.resolve(info.jobId, info.index);\n      globalThis.__mutCache.set(k, d);\n      return d;\n    };"),
 ("removing dispose calls (model geometries/materials/textures not disposed)", "src/lib/assetViewer/mountAssetViewer.js",
  "    if (model) {\n      disposeObject3D(model);\n      model = null;",
  "    if (model) {\n      model = null;"),
 ("removing renderer.dispose() + forceContextLoss()", "src/lib/assetViewer/mountAssetViewer.js",
  '      if (typeof renderer.dispose === "function") renderer.dispose();',
  '      if (false) renderer.dispose();'),
 ("skipping navigation dispose (no pagehide hook)", "src/lib/assetViewer/mountAssetViewer.js",
  '  if (options.disposeOnPageHide !== false && win.addEventListener) hook(win, "pagehide");',
  '  if (false) hook(win, "pagehide");'),
 ("showing Download in an error state", "src/lib/assetViewer/overlay.js",
  'Boolean(valid) && (isError ||',
  '(isError || Boolean(valid)) && (isError ||'),
 ("rescaling to claimed real-world dimensions", "src/lib/assetViewer/mountAssetViewer.js",
  "      parsedRoot.updateMatrixWorld(true);\n      const box = new three.Box3().setFromObject(parsedRoot);",
  "      if (desc && desc.hasScaleMetadata) { const b0 = new three.Box3().setFromObject(parsedRoot).getSize(new three.Vector3()); parsedRoot.scale.multiplyScalar(desc.scale && desc.scale.width ? desc.scale.width / (b0.x || 1) : 1000); }\n      parsedRoot.updateMatrixWorld(true);\n      const box = new three.Box3().setFromObject(parsedRoot);"),
 ("autoRetry default turned to true", "src/lib/assetViewer/mountAssetViewer.js",
  ': options.autoRetry === true);', ': options.autoRetry !== false);'),
]
out=[]
for name,f,a,b in M:
    p=R+f; src=open(p).read()
    assert src.count(a)==1, (name, src.count(a))
    open(p,'w').write(src.replace(a,b))
    try:
        r=subprocess.run("npx vitest run --config tests/assetViewer/vitest.config.js --reporter=json --outputFile=/tmp/mut.json",shell=True,cwd=R,capture_output=True,text=True,timeout=300)
        j=json.load(open('/tmp/mut.json'))
        failed=[f"{t['fullName']}" for fr in j['testResults'] for t in fr['assertionResults'] if t['status']=='failed']
        out.append((name,j['numFailedTests'],failed[:3]))
    finally:
        open(p,'w').write(src)
for name,n,ex in out:
    print(f"{'KILLED' if n else 'SURVIVED'} ({n} failing) - {name}")
    for e in ex: print('     e.g.', e[:140])
