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

  //cerrar con Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setExpanded(false);
  });
}

// Resaltar seccion activa en el menu (segun scroll)
(() => {
  const menu = document.getElementById("site-menu");
  if (!menu) return;

  const links = Array.from(menu.querySelectorAll('a[href^="#"]'));
  const sections = links
    .map((a) => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);

  if (links.length === 0 || sections.length === 0) return;

  const setActive = (id) => {
    links.forEach((a) => {
      const isActive = a.getAttribute("href") === `#${id}`;
      a.classList.toggle("is-active", isActive);
    });
  };

  // IntersectionObserver: detecta cual seccion esta "dominando" la vista
  const observer = new IntersectionObserver(
    (entries) => {
      // nos quedamos con la seccion visible con mayor interseccion
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (visible?.target?.id) setActive(visible.target.id);
    },
    {
      // Ajuste: considera el header sticky
      root: null,
      rootMargin: "-30% 0px -60% 0px",
      threshold: [0.1, 0.2, 0.35, 0.5, 0.65],
    },
  );

  sections.forEach((s) => observer.observe(s));
})();
