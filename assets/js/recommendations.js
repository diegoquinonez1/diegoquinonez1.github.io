// Recomendaciones (Supabase Edge Functions)
(() => {
  const form = document.getElementById("rec-form");
  const statusEl = document.getElementById("rec-status");
  const listEl = document.getElementById("rec-list");
  const summaryEl = document.getElementById("rec-summary");

  if (!form || !statusEl || !listEl || !summaryEl) return;

  const FUNCTIONS_BASE_URL = "https://lbjbthtjiqnlorursqnr.supabase.co/functions/v1";
  const LIST_URL = `${FUNCTIONS_BASE_URL}/recommendations-list`;
  const SUBMIT_URL = `${FUNCTIONS_BASE_URL}/recommendations-submit`;

  const stars = (n) => "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);

  const render = (items) => {
    if (!Array.isArray(items) || items.length === 0) {
      summaryEl.textContent = "Aun no hay recomendaciones publicadas.";
      listEl.innerHTML = "";
      return;
    }

    const avg = items.reduce((acc, x) => acc + x.rating, 0) / items.length;
    summaryEl.textContent = `Promedio: ${avg.toFixed(1)}/5 · Total: ${items.length}`;

    listEl.innerHTML = items
      .slice(0, 10)
      .map((r) => {
        const safeName = (r.name || "Anonimo").toString();
        const safeComment = (r.comment || "").toString();
        return `
          <div class="rec">
            <div class="rec-top">
              <div class="rec-name">${escapeHtml(safeName)}</div>
              <div class="rec-rating" aria-label="Calificacion">${stars(Number(r.rating) || 0)}</div>
            </div>
            <p class="rec-comment">${escapeHtml(safeComment)}</p>
          </div>
        `;
      })
      .join("");
  };

  const escapeHtml = (str) =>
    str.replaceAll("&", "&amp;")
       .replaceAll("<", "&lt;")
       .replaceAll(">", "&gt;")
       .replaceAll('"', "&quot;")
       .replaceAll("'", "&#039;");

  const load = async () => {
    try {
      summaryEl.textContent = "Cargando...";
      const res = await fetch(LIST_URL, { method: "GET" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      render(data.items || []);
    } catch (e) {
      summaryEl.textContent = "No se pudieron cargar las recomendaciones.";
      listEl.innerHTML = "";
    }
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    statusEl.textContent = "";

    const fd = new FormData(form);

    // Honeypot: si viene lleno, es bot
    if ((fd.get("website") || "").toString().trim().length > 0) {
      statusEl.textContent = "Gracias. (Pendiente de moderacion)";
      form.reset();
      return;
    }

    const payload = {
      name: (fd.get("name") || "").toString().trim(),
      rating: Number(fd.get("rating")),
      comment: (fd.get("comment") || "").toString().trim(),
    };

    if (!payload.rating || payload.rating < 1 || payload.rating > 5) {
      statusEl.textContent = "Selecciona una calificacion de 1 a 5.";
      return;
    }
    if (payload.comment.length < 20) {
      statusEl.textContent = "El comentario debe tener al menos 20 caracteres.";
      return;
    }

    try {
      statusEl.textContent = "Enviando...";
      const res = await fetch(SUBMIT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      statusEl.textContent = "Gracias. Tu recomendacion quedo pendiente de moderacion.";
      form.reset();
      await load(); // recarga (seguira mostrando solo approved)
    } catch (err) {
      statusEl.textContent = "No se pudo enviar. Intenta de nuevo mas tarde." + (err.message ? ` (${err.message})` : "");
    }
  });

  load();
})();