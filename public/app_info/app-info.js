export const appInfo = {
  decadeNames: {
    "80s": "Década de los 80",
    "90s": "Década de los 90",
    "00s": "Década de los 2000",
    "10s": "Década de los 2010",
    "actual": "Década Actual",
    "Actual": "Década Actual",
    "Todas": "Todas las Décadas",
    "elderly": "Modo Fácil",
    "especiales": "Especiales"
  },
  categoryNames: {
    "espanol": "Canciones en Español",
    "ingles": "Canciones en Inglés",
    "peliculas": "BSO de Películas",
    "series": "BSO de Series",
    "tv": "Programas de TV",
    "infantiles": "Series Infantiles",
    "anuncios": "Anuncios",
    "consolidated": "Todas las Categorías",
    "verano": "Canciones del Verano"
  },
  premium: {
    premiumCategories: new Set(["peliculas", "series", "tv", "infantiles", "anuncios"]),
    premiumDecades: new Set(["Todas", "verano"])
  }
};

// Default export for compatibility
export default appInfo;
