# EXP-01 tubeType + assumed dimensions

## Supported `hardware.hangingRails.type`
- `OVAL_TUBE_<a>X<b>` → oval; minor=min(a,b) vertical mm; major=max(a,b) depth mm; `tubeTypeResolved=true`
- `ROUND_D<d>` / `ROUND_<d>` / `ROUND_DIA_<d>` → round diameter d; `tubeTypeResolved=true`
- Anything else → **explicit limitation**: render fixed OVAL 15×30 fallback; `tubeTypeResolved=false`; notes explain

Golden uses `OVAL_TUBE_15X30` → resolved true.

## Assumed placement (exposed on `preview.assumed` and mesh `userData.assumed`)
- `minorDiamMm` / `majorDiamMm` / `lengthMm` / `endInsetMm` (default 2.0 mm each end)
- `offsetBelowShelfMm` from component
- `centerYRule`: shelfBottomFaceY - offsetBelowShelfMm
- `centerZRule`: zCarcassFront + floor(dividerDepth/2) — mid carcass depth heuristic
- `finishIntent`: chrome metal preview (independent of melamine materialKey)

These are **visual defaults**, not CNC/hardware SKU placement.
