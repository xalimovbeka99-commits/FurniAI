/**
 * FurnitureKnowledgeService (Section 18) — single entry point the brain and
 * validator use to look up category rules. Everything else in this
 * directory is data; this file is the only place that dispatches on
 * furniture_type, so adding a category later means one new branch here
 * plus (ideally) its own dedicated rules file like wardrobe.js.
 */
import * as wardrobe from "./wardrobe.js";
import * as kitchen from "./kitchen.js";
import * as bookcase from "./bookcase.js";
import * as officeCabinet from "./officeCabinet.js";
import * as sideboard from "./sideboard.js";
import { genericKnowledgeFor } from "./genericCategory.js";
import { FURNITURE_TYPES } from "../fsl/enums.js";

export { CONFIGURATOR_TYPE_MAP, isConfiguratorSupportedType, configuratorTypeFor } from "./categories.js";
export { CONFIGURATOR_COMPONENT_SUPPORT, componentSupport, isComponentConfiguratorSupported } from "./components.js";
export { pickConfiguratorMaterialKey, isKnownConfiguratorMaterialKey } from "./materials.js";

/** Adapts a category module (wardrobe.js-shaped exports) into the normalized knowledge shape below. */
function knowledgeFrom(mod) {
  return {
    furnitureType: mod.FURNITURE_TYPE,
    dimensionRules: mod.DIMENSION_RULES,
    defaultMaterials: mod.DEFAULT_MATERIALS,
    defaultStyle: mod.DEFAULT_STYLE,
    allowedComponents: mod.ALLOWED_COMPONENTS,
    semanticWarnings: mod.semanticWarnings,
    defaultComponentQuantity: mod.defaultComponentQuantity,
    defaultComponentProperties: mod.defaultComponentProperties,
    defaultMaterialRefFor: mod.defaultMaterialRefFor,
  };
}

const KNOWLEDGE_BY_TYPE = {
  wardrobe: () => knowledgeFrom(wardrobe),
  kitchen: () => knowledgeFrom(kitchen),
  bookcase: () => knowledgeFrom(bookcase),
  office_cabinet: () => knowledgeFrom(officeCabinet),
  sideboard: () => knowledgeFrom(sideboard),
};

/** Categories with dedicated rules today — everything else uses the generic fallback. */
export const CATEGORIES_WITH_DEDICATED_KNOWLEDGE = Object.freeze(Object.keys(KNOWLEDGE_BY_TYPE));

/**
 * @param {string} furnitureType one of fsl/enums FURNITURE_TYPES
 * @returns normalized knowledge: { furnitureType, dimensionRules, defaultMaterials, defaultStyle, allowedComponents, semanticWarnings }
 */
export function getCategoryKnowledge(furnitureType) {
  if (!FURNITURE_TYPES.includes(furnitureType)) return null;
  const dedicated = KNOWLEDGE_BY_TYPE[furnitureType];
  return dedicated ? dedicated() : genericKnowledgeFor(furnitureType);
}
