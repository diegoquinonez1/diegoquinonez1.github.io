// Año en footer
document.getElementById("year")?.append(String(new Date().getFullYear()));

// Menu responsive (hamburguesa)
const toggleBtn = document.querySelector(".menu-toggle");
const menu = document.getElementById("site-menu");

if (toggleBtn && menu) {
  const setExpanded = (expanded) => {
    toggleBtn.setAttribute("aria-expanded", String(expanded));
    menu.classList.toggle("is-open", expanded);
  };

  toggleBtn.addEventListener("click", () => {
    const expanded = toggleBtn.getAttribute("aria-expanded") === "true";
    setExpanded(!expanded);
  });

  // Cierra el menu al hacer click en un link (mejor UX en mobile)
  menu.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => setExpanded(false));
  });

  // NUEVO: cerrar al hacer click/tap fuera del menu
  document.addEventListener("click", (e) => {
    const expanded = toggleBtn.getAttribute("aria-expanded") === "true";
    if (!expanded) return;

    const target = e.target;
    const clickedInsideMenu = menu.contains(target);
    const clickedToggle = toggleBtn.contains(target);

    if (!clickedInsideMenu && !clickedToggle) setExpanded(false);
  });

  // NUEVO: cerrar con Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setExpanded(false);
  });
}
