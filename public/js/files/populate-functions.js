import { getDecadeLabel, getCategoryLabel } from "./app-info-functions.js";

export function populateDecadeOptions(selectElement, decades) {
  selectElement.innerHTML = "";
  decades.forEach((dec) => {
    const option = document.createElement("option");
    option.value = dec;
    option.textContent = getDecadeLabel(dec);
    selectElement.appendChild(option);
  });
}

export function populateCategoryOptions(selectElement, categories) {
  selectElement.innerHTML = "";
  categories.forEach((cat) => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = getCategoryLabel(cat);
    selectElement.appendChild(option);
  });
}
