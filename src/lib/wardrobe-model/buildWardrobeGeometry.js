/**
 * buildWardrobeGeometry — WardrobeModel -> the exact part shape
 * FurnitureModel.jsx already renders: { id, role, size, position, material }.
 * ---------------------------------------------------------------------
 * This is Milestone 9's adapter. It does not replace buildGeometry.js — it
 * is a second, parallel producer of the same contract, so FurnitureModel.jsx
 * needs only a one-line switch (see docs/IMPLEMENTATION_CHANGELOG.md) between
 * "render the manually-configured piece" and "render the AI-modeled piece."
 *
 * Every part ID is deterministic and traceable to a stable WardrobeModel
 * identity: structural parts (sides/top/bottom/back/dividers) get names
 * derived from their fixed role or from the two section IDs they sit
 * between; every other part reuses the WardrobeModel component's own
 * `id` (or `${id}-rowN` / `${id}-leafN` for a multi-piece component like a
 * 4-row drawer bank) — never a regenerated counter.
 *
 * Units: WardrobeModel is millimetres (matches production-engine and the
 * rest of this schema); Three.js/buildGeometry.js is metres. Converted once,
 * here, same as configurator-adapter/adapter.js already does for FSL.
 *
 * Same panel-thickness/back-thickness constants buildGeometry.js uses —
 * imported, not retyped, so there is no fourth copy of "18mm" in this repo.
 */
import { PANEL_THICKNESS as DEFAULT_T, BACK_THICKNESS as BT } from "../furnitureConfig.js";
import { DEFAULT_MATERIAL } from "../knowledgeBase.js";
import { COMPONENT_TYPES } from "./schema.js";
import { dividerId } from "./ids.js";

const MM = 0.001;

export function buildWardrobeGeometry(model, { materialKey = DEFAULT_MATERIAL } = {}) {
  const parts = [];
  const W = model.widthMm * MM;
  const H = model.heightMm * MM;
  const D = model.depthMm * MM;
  const t = (model.panelThicknessMm ?? DEFAULT_T / MM) * MM;

  const push = (id, role, size, position, extra = {}) =>
    parts.push({ id, role, size, position, material: materialKey, ...extra });

  // --- carcass shell, identical box math to buildGeometry.js -------------
  const midY = H / 2;
  push("carcass-side-left", "side", [t, H, D], [-W / 2 + t / 2, midY, 0]);
  push("carcass-side-right", "side", [t, H, D], [W / 2 - t / 2, midY, 0]);
  const innerW = W - 2 * t;
  push("carcass-top", "top", [innerW, t, D], [0, H - t / 2, 0]);
  push("carcass-bottom", "bottom", [innerW, t, D], [0, t / 2, 0]);
  push("carcass-back", "back", [innerW, H - 2 * t, BT], [0, midY, -D / 2 + BT / 2]);

  const interiorBottom = t;
  const interiorLeft = -W / 2 + t;

  let cursorX = interiorLeft;
  const sections = model.sections;
  sections.forEach((section, i) => {
    const secW = section.widthMm * MM;
    const secCenterX = cursorX + secW / 2;

    if (i < sections.length - 1) {
      const next = sections[i + 1];
      push(dividerId(section.id, next.id), "divider", [t, H - 2 * t, D - BT], [cursorX + secW + t / 2, midY, BT / 2]);
    }

    for (const component of section.components) {
      pushComponent(push, component, { secCenterX, cursorX, secW, D, t, BT, interiorBottom, moduleIndex: i });
    }

    cursorX += secW + (i < sections.length - 1 ? t : 0);
  });

  return parts;
}

function pushComponent(push, component, ctx) {
  const { secCenterX, cursorX, secW, D, t, BT, interiorBottom, moduleIndex } = ctx;
  const yBase = interiorBottom + component.positionMm * MM;

  switch (component.type) {
    case COMPONENT_TYPES.SHELF: {
      push(component.id, "shelf", [secW - 0.004, t, D - BT - 0.02], [secCenterX, yBase, BT / 2], { module: moduleIndex });
      break;
    }
    case COMPONENT_TYPES.HANGING_RAIL: {
      push(component.id, "rail", [secW - 0.02, 0.03, 0.03], [secCenterX, yBase, 0], { module: moduleIndex });
      break;
    }
    case COMPONENT_TYPES.DRAWER_BANK: {
      const rows = component.rows || 3;
      const rowH = (component.heightMm * MM) / rows;
      for (let r = 0; r < rows; r++) {
        const y = interiorBottom + component.positionMm * MM + rowH * (r + 0.5);
        push(`${component.id}-row${r + 1}`, "drawerFront", [secW - 0.006, rowH - 0.006, t], [secCenterX, y, D / 2 - t / 2], {
          module: moduleIndex,
        });
      }
      break;
    }
    case COMPONENT_TYPES.DOOR: {
      const leaves = component.leaves || 1;
      const doorW = secW / leaves;
      const interiorH = component.heightMm * MM;
      for (let dn = 0; dn < leaves; dn++) {
        const x = cursorX + doorW * (dn + 0.5);
        push(`${component.id}-leaf${dn + 1}`, "door", [doorW - 0.006, interiorH - 0.006, t], [x, interiorBottom + interiorH / 2, D / 2 - t / 2], {
          module: moduleIndex,
          hingeSide: component.hingeSide,
        });
      }
      break;
    }
    default:
      // DIVIDER never appears on a component list — see kernel.addComponent.
      break;
  }
}
