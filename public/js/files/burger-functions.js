function toggleHamburgerMenu() {
  const menu = document.getElementById("hamburger-menu");
  if (!menu) return;
  menu.classList.toggle("hidden");
}

function closeHamburgerMenu() {
  const menu = document.getElementById("hamburger-menu");
  if (menu) menu.classList.add("hidden");
}

module.exports = { toggleHamburgerMenu, closeHamburgerMenu };
