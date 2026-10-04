const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".site-nav");
const searchInput = document.querySelector("#search-input");

menuToggle?.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(open));
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchInput?.focus();
  }
});

searchInput?.addEventListener("input", () => {
  // Search is intentionally unimplemented until wiki content exists.
});
