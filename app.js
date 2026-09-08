(function () {
  "use strict";

  const STORAGE_KEY = "standkasse_state_v1";
  const app = document.getElementById("app");
  const viewTitle = document.getElementById("view-title");
  const cartbar = document.getElementById("cartbar");
  const btnBack = document.getElementById("btn-back");
  const toastEl = document.getElementById("toast");

  let state = load();
  let route = "sell"; // sell | checkout | history | stats | settings
  let priceOverride = null; // number or null, set on checkout view
  let selectedPayment = null;

  // ---------------- storage ----------------
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* fall through to default */ }
    return defaultState();
  }
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function fmtEUR(n) {
    return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  }
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove("show"), 1800);
  }

  // ---------------- price engine ----------------
  // Finds the cheapest way to buy `qty` items of one category given its
  // quantity tiers, repeating tiers as needed (e.g. 4 = 3er + 1er).
  function priceFor(tiers, qty) {
    if (qty <= 0) return { price: 0, picks: {} };
    const sorted = [...tiers].sort((a, b) => a.qty - b.qty);
    const cost = new Array(qty + 1).fill(Infinity);
    const choice = new Array(qty + 1).fill(0);
    cost[0] = 0;
    for (let n = 1; n <= qty; n++) {
      for (const t of sorted) {
        if (t.qty <= n && cost[n - t.qty] + t.price < cost[n]) {
          cost[n] = cost[n - t.qty] + t.price;
          choice[n] = t.qty;
        }
        // allow overshoot only at the top level (buying a bigger tier than needed
        // is never cheaper due to monotonic tiers, so we skip that case)
      }
    }
    let n = qty;
    const picks = {};
    while (n > 0 && choice[n] > 0) {
      picks[choice[n]] = (picks[choice[n]] || 0) + 1;
      n -= choice[n];
    }
    if (n > 0) {
      // no tier of qty 1 existed and we couldn't fully decompose; fall back
      // to unit price of the smallest tier to avoid a stuck price of 0
      const unit = sorted[0];
      picks[unit.qty] = (picks[unit.qty] || 0) + Math.ceil(n / unit.qty);
      cost[qty] = (cost[qty] === Infinity ? 0 : cost[qty]) + unit.price * Math.ceil(n / unit.qty);
    }
    return { price: cost[qty], picks };
  }

  function cartCategoryQty(catId) {
    const c = state.cart[catId] || {};
    return Object.values(c).reduce((a, b) => a + b, 0);
  }
  function cartTotal() {
    let total = 0;
    for (const cat of state.categories) {
      const qty = cartCategoryQty(cat.id);
      total += priceFor(cat.tiers, qty).price;
    }
    return total;
  }
  function cartItemCount() {
    let n = 0;
    for (const catId in state.cart) n += cartCategoryQty(catId);
    return n;
  }

  // ---------------- theme ----------------
  const THEME_VARS = { paper: "--paper", card: "--card", ink: "--ink", brass: "--brass" };
  function applyTheme() {
    const mode = state.theme.mode;
    const dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    for (const key in THEME_VARS) {
      const val = state.theme[key];
      if (val) document.documentElement.style.setProperty(THEME_VARS[key], val);
      else document.documentElement.style.removeProperty(THEME_VARS[key]);
    }
  }
  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (state.theme.mode === "system") applyTheme();
    });
  }
  function go(next) {
    route = next;
    priceOverride = null;
    selectedPayment = null;
    render();
  }

  document.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => go(btn.dataset.view));
  });
  btnBack.addEventListener("click", () => go("sell"));
  document.getElementById("btn-checkout").addEventListener("click", () => {
    if (cartItemCount() === 0) return;
    go("checkout");
  });

  // ---------------- render dispatch ----------------
  function render() {
    btnBack.hidden = route === "sell";
    document.querySelectorAll(".icon-btn[data-view]").forEach((b) => {
      b.classList.toggle("active", b.dataset.view === route);
    });
    const titles = { sell: "Verkaufen", checkout: "Kauf abschließen", history: "Historie", stats: "Auswertung", settings: "Einstellungen" };
    viewTitle.textContent = titles[route] || "Standkasse";
    cartbar.hidden = route !== "sell" || cartItemCount() === 0;

    if (route === "sell") renderSell();
    else if (route === "checkout") renderCheckout();
    else if (route === "history") renderHistory();
    else if (route === "stats") renderStats();
    else if (route === "settings") renderSettings();

    if (!cartbar.hidden) {
      document.getElementById("cart-count").textContent = cartItemCount() + " Artikel";
      document.getElementById("cart-price").textContent = fmtEUR(cartTotal());
    }
  }

  // ---------------- SELL view ----------------
  function motifIcon() {
    return '<svg viewBox="0 0 24 24"><path d="M4 5h16v14H4z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M4 16l4.5-5 3.5 4 2.5-3L20 16" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="9" r="1.4" fill="currentColor"/></svg>';
  }

  function renderSell() {
    let html = "";
    for (const cat of state.categories) {
      const totalStock = cat.motifs.reduce((a, m) => a + m.stock, 0);
      html += `<section class="category-block">
        <div class="category-head">
          <h2>${escapeHTML(cat.name)}</h2>
          <span class="stock-total">${totalStock} übrig</span>
        </div>
        <div class="motif-grid cols-${cat.columns}">`;
      const isRow = cat.columns === 1;
      for (const m of cat.motifs) {
        const inCart = (state.cart[cat.id] && state.cart[cat.id][m.id]) || 0;
        const soldOut = m.stock <= 0;
        const imgHtml = m.image
          ? `<img src="${escapeHTML(m.image)}" alt="" loading="lazy">`
          : motifIcon();
        const stepper = inCart > 0 ? `<div class="motif-stepper">
            <button type="button" class="step-btn" data-step="${cat.id}:${m.id}:-1" aria-label="Eins weniger">−</button>
            <span class="step-count">${inCart}</span>
            <button type="button" class="step-btn" data-step="${cat.id}:${m.id}:1" aria-label="Eins mehr" ${inCart >= m.stock ? "disabled" : ""}>+</button>
          </div>` : "";
        html += `<div class="motif-tile ${isRow ? "tile-row" : ""} ${inCart > 0 ? "selected" : ""} ${soldOut ? "empty" : ""}"
            data-cat="${cat.id}" data-motif="${m.id}" role="button" tabindex="0">
          <div class="motif-img ${m.image ? "has-photo" : ""}">${imgHtml}${!isRow ? stepper : ""}</div>
          <div class="motif-meta">
            <div class="name">${escapeHTML(m.name)}</div>
            <div class="stock">${m.stock}×</div>
          </div>
          ${isRow ? stepper : ""}
        </div>`;
      }
      html += `</div></section>`;
    }
    app.innerHTML = html || `<p class="empty-state">Keine Kategorien angelegt. Unter Einstellungen anlegen.</p>`;

    app.querySelectorAll(".motif-tile").forEach((tile) => {
      const catId = tile.dataset.cat, motifId = tile.dataset.motif;
      tile.addEventListener("click", (e) => {
        if (e.target.closest(".motif-stepper")) return; // handled separately below
        addToCart(catId, motifId, 1);
      });
      tile.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); addToCart(catId, motifId, 1); }
      });
    });
    app.querySelectorAll(".step-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const [catId, motifId, delta] = btn.dataset.step.split(":");
        addToCart(catId, motifId, parseInt(delta, 10));
      });
    });
  }

  function addToCart(catId, motifId, delta) {
    const cat = state.categories.find((c) => c.id === catId);
    const motif = cat.motifs.find((m) => m.id === motifId);
    state.cart[catId] = state.cart[catId] || {};
    const current = state.cart[catId][motifId] || 0;
    const next = current + delta;
    if (delta > 0 && current >= motif.stock) { toast("Nicht mehr auf Lager"); return; }
    if (next <= 0) delete state.cart[catId][motifId];
    else state.cart[catId][motifId] = next;
    render();
  }

  // ---------------- CHECKOUT view ----------------
  function tierLabel(picks) {
    const parts = Object.entries(picks).sort((a, b) => b[0] - a[0]).map(([q, c]) => `${c}× ${q}er-Staffel`);
    return parts.join(", ");
  }

  function renderCheckout() {
    let html = `<div class="summary-card">`;
    let originalTotal = 0;
    const breakdown = [];
    for (const cat of state.categories) {
      const items = state.cart[cat.id];
      if (!items) continue;
      const qty = Object.values(items).reduce((a, b) => a + b, 0);
      if (qty === 0) continue;
      const { price, picks } = priceFor(cat.tiers, qty);
      originalTotal += price;
      breakdown.push({ catId: cat.id, catName: cat.name, qty, price, picks, items: { ...items } });
      const lines = Object.entries(items).map(([mid, q]) => {
        const m = cat.motifs.find((x) => x.id === mid);
        return `${q}× ${escapeHTML(m ? m.name : mid)}`;
      }).join(", ");
      html += `<div class="summary-row">
        <div><div>${escapeHTML(cat.name)} — ${lines}</div><span class="sub">${tierLabel(picks)}</span></div>
        <div>${fmtEUR(price)}</div>
      </div>`;
    }
    html += `</div>`;

    if (priceOverride === null) priceOverride = originalTotal;
    const overridden = Math.abs(priceOverride - originalTotal) > 0.001;

    html += `<div class="total-row">
      <span class="label">Summe</span>
      <div class="amount-wrap">
        ${overridden ? `<span class="orig-amount">${fmtEUR(originalTotal)}</span>` : ""}
        <input class="edit-price-input" id="price-input" type="number" min="0" step="0.5" inputmode="decimal" value="${priceOverride}">
        <span>€</span>
      </div>
    </div>`;

    html += `<p class="section-label">Zahlungsart</p><div class="pay-grid" id="pay-grid">`;
    for (const method of state.paymentMethods) {
      html += `<button type="button" class="pay-btn ${selectedPayment === method ? "active" : ""}" data-method="${escapeHTML(method)}">${escapeHTML(method)}</button>`;
    }
    html += `</div>`;

    html += `<button type="button" class="finish-btn" id="btn-finish">Kauf abgeschlossen</button>`;

    app.innerHTML = html;

    if (breakdown.length === 0) {
      app.innerHTML = `<p class="empty-state">Warenkorb ist leer.</p>`;
      return;
    }

    document.getElementById("price-input").addEventListener("input", (e) => {
      const v = parseFloat(e.target.value);
      priceOverride = isNaN(v) || v < 0 ? 0 : v;
      if (v < 0) e.target.value = 0;
      renderCheckoutSoft(originalTotal);
    });

    document.querySelectorAll(".pay-btn").forEach((b) => {
      b.addEventListener("click", () => { selectedPayment = b.dataset.method; render(); });
    });

    document.getElementById("btn-finish").addEventListener("click", () => {
      finishSale(breakdown, originalTotal);
    });
  }

  // lightweight re-render of just the total row's strikethrough while typing,
  // to avoid losing input focus on every keystroke
  function renderCheckoutSoft(originalTotal) {
    const overridden = Math.abs(priceOverride - originalTotal) > 0.001;
    const wrap = document.querySelector(".amount-wrap");
    const existingOrig = wrap.querySelector(".orig-amount");
    if (overridden && !existingOrig) {
      wrap.insertAdjacentHTML("afterbegin", `<span class="orig-amount">${fmtEUR(originalTotal)}</span>`);
    } else if (!overridden && existingOrig) {
      existingOrig.remove();
    }
  }

  function finishSale(breakdown, originalTotal) {
    const payment = selectedPayment;
    if (!payment) { toast("Zahlungsart wählen"); return; }

    for (const b of breakdown) {
      const cat = state.categories.find((c) => c.id === b.catId);
      for (const [mid, q] of Object.entries(b.items)) {
        const m = cat.motifs.find((x) => x.id === mid);
        if (m) m.stock = Math.max(0, m.stock - q);
      }
    }

    const sale = {
      id: state.nextSaleId++,
      time: new Date().toISOString(),
      payment,
      originalPrice: originalTotal,
      finalPrice: priceOverride,
      categories: breakdown.map((b) => ({
        catId: b.catId, catName: b.catName, qty: b.qty, price: b.price, picks: b.picks,
        items: Object.entries(b.items).map(([mid, q]) => {
          const cat = state.categories.find((c) => c.id === b.catId);
          const m = cat.motifs.find((x) => x.id === mid);
          return { motifId: mid, name: m ? m.name : mid, qty: q };
        })
      }))
    };
    state.history.unshift(sale);
    state.cart = {};
    save();
    toast("Verkauf gespeichert");
    go("sell");
  }

  // ---------------- HISTORY view ----------------
  function renderHistory() {
    if (state.history.length === 0) {
      app.innerHTML = `<p class="empty-state">Noch keine Verkäufe.</p>`;
      return;
    }
    let html = "";
    for (const sale of state.history) {
      const time = new Date(sale.time);
      const timeStr = time.toLocaleDateString("de-DE") + " · " + time.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
      const itemsStr = sale.categories.map((c) => c.items.map((i) => `${i.qty}× ${escapeHTML(i.name)}`).join(", ")).join(" · ");
      const overridden = Math.abs(sale.finalPrice - sale.originalPrice) > 0.001;
      html += `<div class="history-item">
        <div>
          <div class="time">${timeStr}</div>
          <div class="items">${itemsStr}</div>
          <div class="pay">${escapeHTML(sale.payment)}</div>
        </div>
        <div class="history-right">
          <div class="price">${fmtEUR(sale.finalPrice)}${overridden ? `<span class="orig">${fmtEUR(sale.originalPrice)}</span>` : ""}</div>
          <button type="button" class="icon-btn small btn-danger" data-id="${sale.id}" aria-label="Löschen">
            <svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>`;
    }
    app.innerHTML = html;
    app.querySelectorAll(".btn-danger").forEach((b) => {
      b.addEventListener("click", () => deleteSale(parseInt(b.dataset.id, 10)));
    });
  }

  function deleteSale(id) {
    if (!confirm("Diesen Verkauf löschen? Der Bestand wird wieder aufgefüllt.")) return;
    const idx = state.history.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const sale = state.history[idx];
    for (const c of sale.categories) {
      const cat = state.categories.find((x) => x.id === c.catId);
      if (!cat) continue;
      for (const i of c.items) {
        const m = cat.motifs.find((x) => x.id === i.motifId);
        if (m) m.stock += i.qty;
      }
    }
    state.history.splice(idx, 1);
    save();
    render();
    toast("Verkauf gelöscht");
  }

  // ---------------- STATS view ----------------
  function renderStats() {
    const sales = state.history;
    const totalRevenue = sales.reduce((a, s) => a + s.finalPrice, 0);
    const totalDiscount = sales.reduce((a, s) => a + (s.originalPrice - s.finalPrice), 0);
    const saleCount = sales.length;

    const revenueByCat = {};
    const qtyByMotifOverall = {};
    const qtyByMotifInCat = {};
    const tierCountByCat = {};
    const comboCount = {};
    const revenueByPayment = {};

    for (const s of sales) {
      const ratio = s.originalPrice > 0 ? s.finalPrice / s.originalPrice : 1;
      revenueByPayment[s.payment] = (revenueByPayment[s.payment] || 0) + s.finalPrice;
      const catNames = [];
      for (const c of s.categories) {
        revenueByCat[c.catName] = (revenueByCat[c.catName] || 0) + c.price * ratio;
        catNames.push(c.catName);
        tierCountByCat[c.catName] = tierCountByCat[c.catName] || {};
        for (const [q, cnt] of Object.entries(c.picks)) {
          tierCountByCat[c.catName][q] = (tierCountByCat[c.catName][q] || 0) + cnt;
        }
        for (const i of c.items) {
          qtyByMotifOverall[i.name] = (qtyByMotifOverall[i.name] || 0) + i.qty;
          const key = c.catName + " — " + i.name;
          qtyByMotifInCat[key] = (qtyByMotifInCat[key] || 0) + i.qty;
        }
      }
      if (catNames.length > 1) {
        const combo = [...new Set(catNames)].sort().join(" + ");
        comboCount[combo] = (comboCount[combo] || 0) + 1;
      }
    }

    const remainingStock = state.categories.reduce((a, c) => a + c.motifs.reduce((x, m) => x + m.stock, 0), 0);

    const adjSign = totalDiscount > 0.001 ? "-" : totalDiscount < -0.001 ? "+" : "";
    let html = `<div class="stat-grid">
      <div class="stat-card"><div class="label">Umsatz gesamt</div><div class="value">${fmtEUR(totalRevenue)}</div></div>
      <div class="stat-card"><div class="label">Verkäufe</div><div class="value">${saleCount}</div></div>
      <div class="stat-card"><div class="label">Noch da</div><div class="value">${remainingStock}</div></div>
      <div class="stat-card"><div class="label">Preisanpassung</div><div class="value">${adjSign}${fmtEUR(Math.abs(totalDiscount))}</div></div>
    </div>`;

    html += statBars("Umsatz je Kategorie", revenueByCat, (v) => fmtEUR(v));
    html += statBars("Meistverkaufte Motive", topN(qtyByMotifOverall, 6), (v) => v + "×");
    html += statBars("Meistverkauft je Kategorie", topN(qtyByMotifInCat, 6), (v) => v + "×");

    html += `<section class="stats-section"><h3>Mengenrabatt nach Kategorie</h3>`;
    for (const cat of state.categories) {
      const tiers = tierCountByCat[cat.name] || {};
      const parts = Object.entries(tiers).filter(([q]) => q !== "1").sort((a, b) => b[0] - a[0]);
      if (parts.length === 0) continue;
      html += `<div class="bar-row"><span class="bar-label">${escapeHTML(cat.name)}</span><span style="color:var(--ink-soft)">${parts.map(([q, c]) => `${c}× ${q}er`).join(", ")}</span></div>`;
    }
    html += `</section>`;

    html += statBars("Kategorien zusammen gekauft", comboCount, (v) => v + "×");
    html += statBars("Umsatz je Zahlungsart", revenueByPayment, (v) => fmtEUR(v));

    app.innerHTML = html;
  }

  function topN(obj, n) {
    return Object.fromEntries(Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n));
  }

  function statBars(title, obj, fmt) {
    const entries = Object.entries(obj);
    if (entries.length === 0) return "";
    const max = Math.max(...entries.map((e) => e[1]), 1);
    let html = `<section class="stats-section"><h3>${title}</h3>`;
    for (const [label, value] of entries) {
      const pct = Math.max(4, (value / max) * 100);
      html += `<div class="bar-row">
        <span class="bar-label">${escapeHTML(label)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${pct}%"></span></span>
        <span class="bar-value">${fmt(value)}</span>
      </div>`;
    }
    html += `</section>`;
    return html;
  }

  // ---------------- SETTINGS view ----------------
  function renderSettings() {
    const mode = state.theme.mode;
    const cs = getComputedStyle(document.documentElement);
    const colorRow = (label, key) => {
      const current = (cs.getPropertyValue(THEME_VARS[key]).trim() || "#000000");
      return `<div class="color-row">
        <span>${label}</span>
        <input type="color" data-color="${key}" value="${current}">
      </div>`;
    };
    let html = `<section class="settings-section">
      <h3>Darstellung</h3>
      <div class="theme-mode-row">
        <button type="button" class="theme-mode-btn ${mode === "system" ? "active" : ""}" data-mode="system">System</button>
        <button type="button" class="theme-mode-btn ${mode === "light" ? "active" : ""}" data-mode="light">Hell</button>
        <button type="button" class="theme-mode-btn ${mode === "dark" ? "active" : ""}" data-mode="dark">Dunkel</button>
      </div>
      ${colorRow("Hintergrund", "paper")}
      ${colorRow("Flächen / Karten", "card")}
      ${colorRow("Text", "ink")}
      ${colorRow("Akzentfarbe", "brass")}
      <div class="settings-actions">
        <button type="button" class="btn-secondary" id="btn-reset-theme">Farben zurücksetzen</button>
      </div>
    </section>`;
    for (const cat of state.categories) {
      html += `<section class="settings-section">
        <h3>${escapeHTML(cat.name)}</h3>
        <div class="tier-row"><span>1×</span><input type="number" step="0.5" data-tier="${cat.id}:0" value="${cat.tiers[0].price}"> €</div>
        <div class="tier-row"><span>2×</span><input type="number" step="0.5" data-tier="${cat.id}:1" value="${cat.tiers[1].price}"> €</div>
        <div class="tier-row"><span>3×</span><input type="number" step="0.5" data-tier="${cat.id}:2" value="${cat.tiers[2].price}"> €</div>`;
      for (const m of cat.motifs) {
        html += `<div class="motif-row">
          ${m.image ? `<img src="${escapeHTML(m.image)}" alt="" class="motif-thumb">` : ""}
          <input type="text" data-name="${cat.id}:${m.id}" value="${escapeHTML(m.name)}">
          <input type="number" min="0" data-stock="${cat.id}:${m.id}" value="${m.stock}">
          <button type="button" class="remove-btn" data-remove="${cat.id}:${m.id}">×</button>
        </div>`;
      }
      html += `<button type="button" class="add-motif-btn" data-add="${cat.id}">+ Motiv hinzufügen</button>
      </section>`;
    }

    html += `<section class="settings-section">
      <h3>Zahlungsarten</h3>`;
    for (const p of state.paymentMethods) {
      html += `<div class="motif-row"><input type="text" value="${escapeHTML(p)}" disabled><button type="button" class="remove-btn" data-removepay="${escapeHTML(p)}">×</button></div>`;
    }
    html += `<div class="motif-row">
        <input type="text" id="new-pay-input" placeholder="Neue Zahlungsart, z. B. Twint">
        <button type="button" class="btn-secondary" id="btn-add-pay">Hinzufügen</button>
      </div>
    </section>`;

    html += `<section class="settings-section">
      <h3>Daten</h3>
      <div class="settings-actions">
        <button type="button" class="btn-secondary" id="btn-export">Backup exportieren (JSON)</button>
        <label class="btn-secondary" style="text-align:center; display:block;">Backup importieren
          <input type="file" id="import-file" accept="application/json" style="display:none;">
        </label>
        <button type="button" class="btn-secondary" id="btn-reset-sales">Verkäufe & Warenkorb zurücksetzen</button>
        <button type="button" class="btn-secondary btn-danger" id="btn-reset-all">Alles zurücksetzen</button>
      </div>
    </section>`;

    app.innerHTML = html;

    app.querySelectorAll("input[data-tier]").forEach((inp) => {
      inp.addEventListener("change", (e) => {
        const [catId, idx] = e.target.dataset.tier.split(":");
        const cat = state.categories.find((c) => c.id === catId);
        cat.tiers[+idx].price = parseFloat(e.target.value) || 0;
        save();
      });
    });
    app.querySelectorAll("input[data-name]").forEach((inp) => {
      inp.addEventListener("change", (e) => {
        const [catId, motifId] = e.target.dataset.name.split(":");
        const cat = state.categories.find((c) => c.id === catId);
        const m = cat.motifs.find((x) => x.id === motifId);
        m.name = e.target.value.trim() || m.name;
        save();
      });
    });
    app.querySelectorAll("input[data-stock]").forEach((inp) => {
      inp.addEventListener("change", (e) => {
        const [catId, motifId] = e.target.dataset.stock.split(":");
        const cat = state.categories.find((c) => c.id === catId);
        const m = cat.motifs.find((x) => x.id === motifId);
        m.stock = Math.max(0, parseInt(e.target.value, 10) || 0);
        save();
      });
    });
    app.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const [catId, motifId] = e.target.dataset.remove.split(":");
        const cat = state.categories.find((c) => c.id === catId);
        if (!confirm("Motiv wirklich entfernen?")) return;
        cat.motifs = cat.motifs.filter((m) => m.id !== motifId);
        save(); renderSettings();
      });
    });
    app.querySelectorAll("[data-add]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const catId = e.target.dataset.add;
        const cat = state.categories.find((c) => c.id === catId);
        const id = catId + "_" + Date.now();
        cat.motifs.push({ id, name: "Neues Motiv", stock: 0 });
        save(); renderSettings();
      });
    });
    app.querySelectorAll("[data-removepay]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        state.paymentMethods = state.paymentMethods.filter((p) => p !== e.target.dataset.removepay);
        save(); renderSettings();
      });
    });
    document.getElementById("btn-add-pay").addEventListener("click", () => {
      const input = document.getElementById("new-pay-input");
      const name = input.value.trim();
      if (!name) return;
      if (!state.paymentMethods.includes(name)) state.paymentMethods.push(name);
      save(); renderSettings();
    });

    app.querySelectorAll(".theme-mode-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.theme.mode = btn.dataset.mode;
        applyTheme(); save(); renderSettings();
      });
    });
    app.querySelectorAll("input[data-color]").forEach((inp) => {
      inp.addEventListener("input", (e) => {
        state.theme[e.target.dataset.color] = e.target.value;
        applyTheme(); save();
      });
    });
    document.getElementById("btn-reset-theme").addEventListener("click", () => {
      state.theme.paper = null; state.theme.card = null; state.theme.ink = null; state.theme.brass = null;
      applyTheme(); save(); renderSettings(); toast("Farben zurückgesetzt");
    });

    document.getElementById("btn-export").addEventListener("click", exportBackup);
    document.getElementById("import-file").addEventListener("change", importBackup);
    document.getElementById("btn-reset-sales").addEventListener("click", () => {
      if (!confirm("Alle Verkäufe und der Warenkorb werden gelöscht. Bestände bleiben wie sie sind. Fortfahren?")) return;
      state.history = []; state.cart = {}; save(); renderSettings(); toast("Zurückgesetzt");
    });
    document.getElementById("btn-reset-all").addEventListener("click", () => {
      if (!confirm("Wirklich ALLES zurücksetzen? Das kann nicht rückgängig gemacht werden.")) return;
      state = defaultState(); applyTheme(); save(); renderSettings(); toast("Alles zurückgesetzt");
    });
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url; a.download = `standkasse-backup-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function importBackup(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed.categories) throw new Error("invalid");
        state = parsed;
        if (!state.theme) state.theme = { mode: "system", paper: null, card: null, ink: null, brass: null };
        applyTheme();
        save();
        renderSettings();
        toast("Backup geladen");
      } catch (err) {
        toast("Datei konnte nicht gelesen werden");
      }
    };
    reader.readAsText(file);
  }

  function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ---------------- init ----------------
  if (!state.paymentMethods) state.paymentMethods = ["Bar", "PayPal"];
  if (!state.theme) state.theme = { mode: "system", paper: null, card: null, ink: null, brass: null };
  applyTheme();
  render();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
})();
