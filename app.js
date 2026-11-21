(function () {
  "use strict";

  const DEFAULT_DISCLOSURE =
    "Links oficiais de afiliado (Mercado Livre e Amazon). A FluxoTech pode receber comissão por compras qualificadas sem custo adicional para você.";
  const DEFAULT_PRICE_NOTICE =
    "Preço e estoque podem variar desde a data da publicação original.";

  const state = {
    offers: [],
    activeCategory: "Todas",
    query: "",
    priceNotice: DEFAULT_PRICE_NOTICE,
  };

  const searchInput = document.getElementById("search-input");
  const clearBtn = document.getElementById("clear-search");
  const categoryFiltersEl = document.getElementById("category-filters");
  const resultsCountEl = document.getElementById("results-count");
  const offersGridEl = document.getElementById("offers-grid");
  const emptyStateEl = document.getElementById("empty-state");
  const emptyTitleEl = document.getElementById("empty-title");
  const emptyBodyEl = document.getElementById("empty-body");
  const disclosureEl = document.getElementById("affiliate-disclosure");
  const priceNoticeEl = document.getElementById("price-notice");

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseCodeNumber(code) {
    const match = String(code || "").trim().match(/^#?(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  }

  function formatDateBR(isoDate) {
    const match = String(isoDate || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return isoDate || "Data não informada";
    }
    return match[3] + "/" + match[2] + "/" + match[1];
  }

  function matchesQuery(offer, rawQuery) {
    const cleanQuery = normalizeText(rawQuery);
    if (!cleanQuery) {
      return true;
    }

    const codeQuery = cleanQuery.replace(/^#/, "").trim();
    const offerCodeNorm = normalizeText(offer.code).replace(/^#/, "").trim();

    let codeMatch = false;
    if (/^\d+$/.test(codeQuery) && /^\d+$/.test(offerCodeNorm)) {
      codeMatch = parseInt(offerCodeNorm, 10) === parseInt(codeQuery, 10);
    } else if (normalizeText(offer.code).includes(cleanQuery)) {
      codeMatch = true;
    }

    const haystack = normalizeText(
      [offer.title, offer.category, offer.platform, offer.highlight].join(" ")
    );
    return codeMatch || haystack.includes(cleanQuery);
  }

  function createOfferCard(offer) {
    const card = document.createElement("article");
    card.className = "offer-card";
    card.dataset.code = offer.code || "";

    const meta = document.createElement("div");
    meta.className = "offer-meta";

    const codeBadge = document.createElement("span");
    codeBadge.className = "offer-code";
    codeBadge.textContent = offer.code || "#000";

    const badges = document.createElement("div");
    badges.className = "offer-badges";

    if (offer.category) {
      const catChip = document.createElement("span");
      catChip.className = "offer-chip";
      catChip.textContent = offer.category;
      badges.appendChild(catChip);
    }

    if (offer.platform) {
      const platChip = document.createElement("span");
      platChip.className = "offer-chip";
      platChip.textContent = offer.platform;
      badges.appendChild(platChip);
    }

    meta.appendChild(codeBadge);
    meta.appendChild(badges);
    card.appendChild(meta);

    if (offer.image_url) {
      const imgWrap = document.createElement("div");
      imgWrap.className = "offer-image-wrap";
      const img = document.createElement("img");
      img.className = "offer-image";
      img.src = offer.image_url;
      img.alt = offer.title || "Produto recomendado";
      img.loading = "lazy";
      imgWrap.appendChild(img);
      card.appendChild(imgWrap);
    }

    const title = document.createElement("h2");
    title.className = "offer-title";
    title.textContent = offer.title || "";
    card.appendChild(title);

    if (offer.highlight) {
      const highlight = document.createElement("p");
      highlight.className = "offer-highlight";
      highlight.textContent = offer.highlight;
      card.appendChild(highlight);
    }

    const priceRow = document.createElement("div");
    priceRow.className = "offer-price-row";

    const price = document.createElement("span");
    price.className = "offer-price";
    price.textContent = offer.price_label || "";

    const dateEl = document.createElement("span");
    dateEl.className = "offer-date";
    dateEl.textContent = "Publicado em " + formatDateBR(offer.posted_date);

    priceRow.appendChild(price);
    priceRow.appendChild(dateEl);
    card.appendChild(priceRow);

    if (offer.attention_point) {
      const attention = document.createElement("div");
      attention.className = "offer-attention";

      const label = document.createElement("span");
      label.className = "offer-attention-label";
      label.textContent = "Ponto de atenção";

      const detail = document.createElement("span");
      detail.textContent = offer.attention_point;

      attention.appendChild(label);
      attention.appendChild(detail);
      card.appendChild(attention);
    }

    const priceNote = document.createElement("p");
    priceNote.className = "offer-price-note";
    priceNote.textContent = state.priceNotice;
    card.appendChild(priceNote);

    const cta = document.createElement("a");
    cta.className = "offer-cta";
    const safeUrl = /^https:\/\//i.test(offer.affiliate_url || "")
      ? offer.affiliate_url
      : "#";
    cta.href = safeUrl;
    cta.target = "_blank";
    cta.rel = "noopener noreferrer sponsored";
    const platformName = offer.platform || "loja";
    const preposition = platformName === "Mercado Livre" ? "no " : "na ";
    cta.textContent = "Ver oferta " + preposition + platformName;
    cta.setAttribute(
      "aria-label",
      "Abrir oferta " + (offer.code || "") + " " + preposition + platformName
    );
    card.appendChild(cta);

    return card;
  }

  function renderCategoryFilters() {
    categoryFiltersEl.replaceChildren();
    const categories = ["Todas"];
    for (const offer of state.offers) {
      if (offer.category && !categories.includes(offer.category)) {
        categories.push(offer.category);
      }
    }

    for (const category of categories) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "filter-pill" + (state.activeCategory === category ? " is-active" : "");
      btn.textContent = category;
      btn.addEventListener("click", function () {
        state.activeCategory = category;
        renderCategoryFilters();
        renderOffers();
      });
      categoryFiltersEl.appendChild(btn);
    }
  }

  function renderOffers() {
    const filtered = state.offers.filter(function (offer) {
      const categoryOk =
        state.activeCategory === "Todas" ||
        offer.category === state.activeCategory;
      return categoryOk && matchesQuery(offer, state.query);
    });

    clearBtn.hidden = !state.query && state.activeCategory === "Todas";

    if (state.offers.length === 0) {
      resultsCountEl.textContent = "Nenhuma oferta publicada ainda.";
      offersGridEl.replaceChildren();
      emptyTitleEl.textContent = "Vitrine pronta para as primeiras ofertas.";
      emptyBodyEl.textContent =
        "Assim que uma oferta for aprovada no Radar Fluxo, ela aparece aqui com seu código #00X.";
      emptyStateEl.hidden = false;
      return;
    }

    const plural = filtered.length === 1 ? "oferta exibida" : "ofertas exibidas";
    resultsCountEl.textContent =
      filtered.length + " de " + state.offers.length + " " + plural;

    offersGridEl.replaceChildren();
    if (filtered.length === 0) {
      emptyTitleEl.textContent = "Nenhuma oferta encontrada para essa busca.";
      emptyBodyEl.textContent =
        "Tente outro código (ex.: #001) ou clique em Limpar para ver o histórico completo.";
      emptyStateEl.hidden = false;
      return;
    }

    emptyStateEl.hidden = true;
    const fragment = document.createDocumentFragment();
    for (const offer of filtered) {
      fragment.appendChild(createOfferCard(offer));
    }
    offersGridEl.appendChild(fragment);
  }

  function applyInitialQueryFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const qParam = params.get("q");
    const hashValue = window.location.hash ? window.location.hash.slice(1) : "";
    const initial = (qParam || hashValue || "").trim();
    if (initial) {
      state.query = initial;
      searchInput.value = initial;
    }
  }

  async function loadData() {
    let payload = null;
    if (window.__FLUXOTECH_OFFERS__) {
      payload = window.__FLUXOTECH_OFFERS__;
    } else {
      const response = await fetch("./data/offers.json", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }
      payload = await response.json();
    }

    const rawOffers = Array.isArray(payload.offers) ? payload.offers.slice() : [];
    rawOffers.sort(function (a, b) {
      return parseCodeNumber(b.code) - parseCodeNumber(a.code);
    });

    state.offers = rawOffers;
    state.priceNotice = payload.price_notice || DEFAULT_PRICE_NOTICE;
    disclosureEl.textContent = payload.disclosure || DEFAULT_DISCLOSURE;
    priceNoticeEl.textContent = state.priceNotice;

    renderCategoryFilters();
    renderOffers();
  }

  searchInput.addEventListener("input", function (event) {
    state.query = event.target.value || "";
    renderOffers();
  });

  clearBtn.addEventListener("click", function () {
    state.query = "";
    state.activeCategory = "Todas";
    searchInput.value = "";
    renderCategoryFilters();
    renderOffers();
    searchInput.focus();
  });

  applyInitialQueryFromUrl();
  loadData().catch(function () {
    resultsCountEl.textContent = "Não foi possível carregar o catálogo agora.";
    emptyTitleEl.textContent = "Erro ao carregar as ofertas.";
    emptyBodyEl.textContent = "Atualize a página para tentar novamente.";
    emptyStateEl.hidden = false;
  });
})();
