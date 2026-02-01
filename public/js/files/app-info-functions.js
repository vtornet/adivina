import appInfo from "../../app_info/app-info.js";
import { CATEGORY_ORDER, DECADES_ORDER } from "../../constants/button-constants.js";

export function getDecadeLabel(decadeId) {
  return appInfo.decadeNames[decadeId] || decadeId;
}

export function getCategoryLabel(categoryId) {
  return appInfo.categoryNames[categoryId] || categoryId;
}

export function getDecadesForSelect() {
  if (Array.isArray(window.allDecadesDefined) && window.allDecadesDefined.length > 1) {
    return window.allDecadesDefined.filter((decade) => decade !== "verano");
  }
  return DECADES_ORDER;
}

export function getCategoriesForSelect() {
  if (Array.isArray(window.allPossibleCategories) && window.allPossibleCategories.length > 1) {
    return window.allPossibleCategories;
  }
  return CATEGORY_ORDER;
}

export function isPremiumSelection(decade, category) {
  return isPremiumDecade(decade) || isPremiumCategory(category);
}
