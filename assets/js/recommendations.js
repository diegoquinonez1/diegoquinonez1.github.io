// Recomendaciones (un solo archivo)
// - Home: form + ultimas 6
// - Page (/recommendations/): metrics + search + paginacion

(() => {
  const FUNCTIONS_BASE_URL =
    "https://lbjbthtjiqnlorursqnr.supabase.co/functions/v1";
  const LIST_URL = `${FUNCTIONS_BASE_URL}/recommendations-list`;
  const SUBMIT_URL = `${FUNCTIONS_BASE_URL}/recommendations-submit`;
  const METRICS_URL = `${FUNCTIONS_BASE_URL}/recommendations-metrics`;

  // anon key (publica)
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiamJ0aHRqaXFubG9ydXJzcW5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDQzMjQsImV4cCI6MjA4OTI4MDMyNH0.pDdJlCr5rCQzpYySdCi6dOdQx4lu-f4Drzdw-imElOw";

  const commonHeaders = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };

  const escapeHtml = (str) =>
    String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const stars = (n) => "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);

  function renderRecCard(r) {
    const name = (r?.name || "Anonimo").toString();
    const comment = (r?.comment || "").toString();
    const rating = Math.max(1, Math.min(5, Number(r?.rating) || 0));

    return `
      <div class="rec">
        <div class="rec-top">
          <div class="rec-name">${escapeHtml(name)}</div>
          <div class="rec-rating" aria-label="Calificacion">${stars(rating)}</div>
        </div>
        <p class="rec-comment">${escapeHtml(comment)}</p>
      </div>
    `;
  }

  // ========== HOME ==========
  async function initRecommendationsHome() {
    const form = document.getElementById("rec-form");
    const statusEl = document.getElementById("rec-status");
    const listEl = document.getElementById("rec-list");
    const summaryEl = document.getElementById("rec-summary");

    // Si no existe la seccion de Home, no inicializa
    if (!form || !statusEl || !listEl || !summaryEl) return;

    const loadLatest = async () => {
      try {
        summaryEl.textContent = "Cargando...";

        const url = new URL(LIST_URL);
        url.searchParams.set("limit", "6");
        url.searchParams.set("offset", "0");

        const res = await fetch(url.toString(), { headers: commonHeaders });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const items = data.items || [];

        if (!Array.isArray(items) || items.length === 0) {
          summaryEl.textContent = "Aun no hay recomendaciones publicadas.";
          listEl.innerHTML = "";
          return;
        }

        const avg =
          items.reduce((acc, x) => acc + (Number(x.rating) || 0), 0) /
          items.length;

        summaryEl.textContent = `Ultimas recomendaciones · Promedio: ${avg.toFixed(1)}/5`;
        listEl.innerHTML = items.map(renderRecCard).join("");
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

      try {
        statusEl.textContent = "Enviando...";

        const res = await fetch(SUBMIT_URL, {
          method: "POST",
          headers: { ...commonHeaders, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 429) throw new Error("rate_limited");
          if (data?.error === "captcha_failed") throw new Error("captcha_failed");
          throw new Error("submit_failed");
        }

        statusEl.textContent =
          "Gracias. Tu recomendacion quedo pendiente de moderacion.";
        form.reset();

        if (window.turnstile && typeof window.turnstile.reset === "function") {
          window.turnstile.reset();
        }

        await loadLatest();
      } catch (err) {
        const msg = err?.message || "";
        if (msg === "rate_limited") {
          statusEl.textContent = "Se alcanzo el limite de envios. Intenta mas tarde.";
        } else if (msg === "captcha_failed") {
          statusEl.textContent = "Captcha invalido. Intenta de nuevo.";
        } else {
          statusEl.textContent = "No se pudo enviar. Intenta de nuevo mas tarde.";
        }
      }
    });

    loadLatest();
  }

  // ========== PAGE (/recommendations/) ==========
  async function initRecommendationsPage() {
    const listEl = document.getElementById("rec-list");
    const metricsEl = document.getElementById("rec-metrics");
    const statusEl = document.getElementById("rec-status");
    const moreBtn = document.getElementById("rec-more");
    const qEl = document.getElementById("rec-q");

    // Si no existen los elementos de la pagina, no inicializa
    if (!listEl || !metricsEl || !statusEl || !moreBtn || !qEl) return;

    let offset = 0;
    const pageSize = 10;
    let currentQ = "";

    // Premium: boton limpiar solo cuando hay texto
    const controlEl = qEl.closest(".rec-search__control");
    const clearBtn = document.getElementById("rec-clear");

    function syncClearVisibility() {
      const has = qEl.value.trim().length > 0;
      if (controlEl) controlEl.classList.toggle("has-value", has);
    }

    async function loadMetrics() {
      try {
        metricsEl.textContent = "Cargando...";
        const res = await fetch(METRICS_URL, { headers: commonHeaders });
        if (!res.ok) throw new Error();
        const data = await res.json();

        const total = Number(data.total || 0);
        const avg = Number(data.avg || 0);
        const dist = data.dist || {};

        metricsEl.innerHTML = `
          <div class="meta">Promedio: <strong>${avg.toFixed(1)}/5</strong> · Total: <strong>${total}</strong></div>
          <div class="meta">
            ★★★★★ ${dist["5"] || 0} · ★★★★☆ ${dist["4"] || 0} · ★★★☆☆ ${dist["3"] || 0} · ★★☆☆☆ ${dist["2"] || 0} · ★☆☆☆☆ ${dist["1"] || 0}
          </div>
        `;
      } catch {
        metricsEl.textContent = "No se pudieron cargar las metricas.";
      }
    }

    async function loadPage({ reset }) {
      try {
        statusEl.textContent = "";

        if (reset) {
          offset = 0;
          listEl.innerHTML = "";
        }

        moreBtn.disabled = true;
        moreBtn.textContent = "Cargando...";

        const url = new URL(LIST_URL);
        url.searchParams.set("limit", String(pageSize));
        url.searchParams.set("offset", String(offset));
        if (currentQ.trim().length) url.searchParams.set("q", currentQ.trim());

        const res = await fetch(url.toString(), { headers: commonHeaders });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const items = data.items || [];

        if (items.length === 0 && offset === 0) {
          statusEl.textContent = currentQ
            ? "No hay resultados para esa busqueda."
            : "Aun no hay recomendaciones.";
        }

        listEl.insertAdjacentHTML(
          "beforeend",
          items.map(renderRecCard).join(""),
        );
        offset += items.length;

        moreBtn.hidden = items.length < pageSize;
        moreBtn.disabled = false;
        moreBtn.textContent = "Cargar mas";
      } catch {
        statusEl.textContent = "No se pudieron cargar las recomendaciones.";
        moreBtn.disabled = false;
        moreBtn.textContent = "Cargar mas";
      }
    }

    // Estado inicial del boton Limpiar
    syncClearVisibility();

    // debounce busqueda
    let t = null;
    qEl.addEventListener("input", () => {
      syncClearVisibility();

      clearTimeout(t);
      t = setTimeout(() => {
        currentQ = qEl.value;
        loadPage({ reset: true });
      }, 300);
    });

    // Enter = buscar inmediato (sin esperar debounce)
    qEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        clearTimeout(t);
        currentQ = qEl.value;
        loadPage({ reset: true });
      }
      // Bonus UX: Escape limpia
      if (e.key === "Escape") {
        if (qEl.value.length) {
          e.preventDefault();
          qEl.value = "";
          currentQ = "";
          syncClearVisibility();
          loadPage({ reset: true });
        }
      }
    });

    moreBtn.addEventListener("click", () => loadPage({ reset: false }));

    clearBtn?.addEventListener("click", () => {
      qEl.value = "";
      currentQ = "";
      syncClearVisibility();
      loadPage({ reset: true });
      qEl.focus();
    });

    await loadMetrics();
    await loadPage({ reset: true });
  }

  // Auto-init: intenta inicializar ambos; cada uno se auto-salta si no encuentra su DOM.
  initRecommendationsHome();
  initRecommendationsPage();
})();