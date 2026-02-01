export function toggleHamburgerMenu() {
  const menu = document.getElementById("hamburger-menu");
  if (!menu) return;
  menu.classList.toggle("hidden");
}

export function closeHamburgerMenu() {
  const menu = document.getElementById("hamburger-menu");
  if (menu) menu.classList.add("hidden");
}
