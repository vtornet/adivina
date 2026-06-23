import appInfo from "../../app_info/app-info.js";
import { CATEGORY_ORDER, DECADES_ORDER } from "../constants/app-constants.js";

export function getDecadeLabel(decadeId) {
  return appInfo.decadeNames[decadeId] || decadeId;
}

export function getCategoryLabel(categoryId) {
  return appInfo.categoryNames[categoryId] || categoryId;
}

export function getDecadesForSelect() {
  if (Array.isArray(globalThis.allDecadesDefined) && globalThis.allDecadesDefined.length > 1) {
    return globalThis.allDecadesDefined.filter((decade) => decade !== "verano");
  }
  return DECADES_ORDER;
}

export function getCategoriesForSelect() {
  if (Array.isArray(globalThis.allPossibleCategories) && globalThis.allPossibleCategories.length > 1) {
    return globalThis.allPossibleCategories;
  }
  return CATEGORY_ORDER;
}

export function isPremiumSelection(decade, category) {
  return isPremiumDecade(decade) || isPremiumCategory(category);
}
