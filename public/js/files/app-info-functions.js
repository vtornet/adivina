import appInfo from "../../app_info/app-info.json";
import { CATEGORY_ORDER, DECADES_ORDER } from "../../constants/button-constants";

function getDecadeLabel(decadeId) {
  return appInfo.decadeNames[decadeId] || decadeId;
}

function getCategoryLabel(categoryId) {
  return appInfo.categoryNames[categoryId] || categoryId;
}

function getDecadesForSelect() {
  if (Array.isArray(window.allDecadesDefined) && window.allDecadesDefined.length > 1) {
    return window.allDecadesDefined.filter((decade) => decade !== "verano");
  }
  return DECADES_ORDER;
}

function getCategoriesForSelect() {
  if (Array.isArray(window.allPossibleCategories) && window.allPossibleCategories.length > 1) {
    return window.allPossibleCategories;
  }
  return CATEGORY_ORDER;
}

function isPremiumSelection(decade, category) {
  return isPremiumDecade(decade) || isPremiumCategory(category);
}

module.exports = { getDecadeLabel, getCategoryLabel, getDecadesForSelect, getCategoriesForSelect, isPremiumSelection };
