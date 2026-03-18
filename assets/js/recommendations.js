// Recomendaciones (Supabase Edge Functions + Turnstile)
(() => {
  const form = document.getElementById("rec-form");
  const statusEl = document.getElementById("rec-status");
  const listEl = document.getElementById("rec-list");
  const summaryEl = document.getElementById("rec-summary");

  if (!form || !statusEl || !listEl || !summaryEl) return;

  const FUNCTIONS_BASE_URL = "https://lbjbthtjiqnlorursqnr.supabase.co/functions/v1";
  const LIST_URL = `${FUNCTIONS_BASE_URL}/recommendations-list`;
  const SUBMIT_URL = `${FUNCTIONS_BASE_URL}/recommendations-submit`;

  const escapeHtml = (str) =>
    str.replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const stars = (n) => "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);

  const render = (items) => {
    if (!Array.isArray(items) || items.length === 0) {
      summaryEl.textContent = "Aun no hay recomendaciones publicadas.";
      listEl.innerHTML = "";
      return;
    }

    const avg = items.reduce((acc, x) => acc + (Number(x.rating) || 0), 0) / items.length;
    summaryEl.textContent = `Promedio: ${avg.toFixed(1)}/5 · Total: ${items.length}`;

    listEl.innerHTML = items.map((r) => {
      const name = (r.name || "Anonimo").toString();
      const comment = (r.comment || "").toString();
      const rating = Math.max(1, Math.min(5, Number(r.rating) || 0));

      return `
        <div class="rec">
          <div class="rec-top">
            <div class="rec-name">${escapeHtml(name)}</div>
            <div class="rec-rating" aria-label="Calificacion">${stars(rating)}</div>
          </div>
          <p class="rec-comment">${escapeHtml(comment)}</p>
        </div>
      `;
    }).join("");
  };

  const load = async () => {
    try {
      summaryEl.textContent = "Cargando...";
      const res = await fetch(LIST_URL, { method: "GET" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      render(data.items || []);
    } catch {
      summaryEl.textContent = "No se pudieron cargar las recomendaciones.";
      listEl.innerHTML = "";
    }
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    statusEl.textContent = "";

    const fd = new FormData(form);

    // Honeypot
    if ((fd.get("website") || "").toString().trim().length > 0) {
      statusEl.textContent = "Gracias. Quedo pendiente de moderacion.";
      form.reset();
      return;
    }

    const payload = {
      name: (fd.get("name") || "").toString().trim(),
      rating: Number(fd.get("rating")),
      comment: (fd.get("comment") || "").toString().trim(),
      turnstileToken: (fd.get("cf-turnstile-response") || "").toString(),
    };

    if (!payload.turnstileToken) {
      statusEl.textContent = "Completa el captcha para enviar.";
      return;
    }
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

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Mensajes mas amigables por tipo de error
        if (res.status === 429) throw new Error("rate_limited");
        if (data?.error === "captcha_failed") throw new Error("captcha_failed");
        throw new Error("submit_failed");
      }

      statusEl.textContent = "Gracias. Tu recomendacion quedo pendiente de moderacion.";
      form.reset();

      // Reset Turnstile (si esta disponible)
      if (window.turnstile && typeof window.turnstile.reset === "function") {
        window.turnstile.reset();
      }

      await load();
    } catch (err) {
      const msg = (err && err.message) ? err.message : "";
      if (msg === "rate_limited") {
        statusEl.textContent = "Se alcanzo el limite de envios. Intenta mas tarde.";
      } else if (msg === "captcha_failed") {
        statusEl.textContent = "Captcha invalido. Intenta de nuevo.";
        if (window.turnstile && typeof window.turnstile.reset === "function") {
          window.turnstile.reset();
        }
      } else {
        statusEl.textContent = "No se pudo enviar. Intenta de nuevo mas tarde.";
      }
    }
  });

  load();
})();