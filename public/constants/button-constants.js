export const BASE_DECADES = Array.isArray(window.allDecadesDefined)
  ? window.allDecadesDefined
  : ["80s", "90s", "00s", "10s", "actual", "verano"];

export const DECADES_ORDER = BASE_DECADES.filter((decade) => decade !== "verano" && decade !== "especiales").concat([
  "especiales",
]);

export const CATEGORY_ORDER = Array.isArray(window.allPossibleCategories)
? window.allPossibleCategories
: ["espanol", "ingles", "peliculas", "series", "tv", "infantiles", "anuncios"];

export const DECADES_WITH_SPECIALS = [...DECADES_ORDER, "Todas"];