// Art équestre : un seul mot de passe (sans majuscules, espaces ni accents) ouvre la rubrique.
// Il dérive une clé AES-GCM (PBKDF2-SHA256) ; la liste des galeries, les couvertures et chaque photo
// sont chiffrées et ne se lisent qu'avec cette clé. Mémorisé le temps de l'onglet (sessionStorage).
(() => {
  const root = document.getElementById("galerie");
  const html = document.documentElement;
  if (!root || !window.crypto?.subtle) { html.classList.remove("eq-auto"); return; }
  const $ = (s, el = document) => el.querySelector(s);
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const norm = (p) => p.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const SALT = b64(root.dataset.salt), ITER = +root.dataset.iter;
  const IS_INDEX = "index" in root.dataset;
  const PAYLOAD = b64(IS_INDEX ? root.dataset.index : root.dataset.manifest);
  const KEYNAME = "hc-galeries-mdp";
  let key = null, photos = [], cur = 0, show = () => {};

  async function derive(pw) {
    const raw = await crypto.subtle.importKey("raw", new TextEncoder().encode(norm(pw)), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt: SALT, iterations: ITER, hash: "SHA-256" }, raw, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  }
  const open = (k, buf) => crypto.subtle.decrypt({ name: "AES-GCM", iv: buf.slice(0, 12) }, k, buf.slice(12));

  async function unlock(pw, silent) {
    try {
      const k = await derive(pw);
      const data = JSON.parse(new TextDecoder().decode(await open(k, PAYLOAD)));
      key = k;
      try { sessionStorage.setItem(KEYNAME, pw); } catch (e) {}
      document.querySelectorAll("[data-locked]").forEach((el) => { el.hidden = true; });
      IS_INDEX ? buildIndex(data) : buildGallery(data);
      html.classList.remove("eq-auto");
      return true;
    } catch (e) {
      html.classList.remove("eq-auto");
      if (silent) { try { sessionStorage.removeItem(KEYNAME); } catch (e) {} }
      else { $("#g-err").hidden = false; $("#g-pw").select(); }
      return false;
    }
  }

  // ----- fichiers chiffrés → images
  const cache = new Map();
  function blobUrl(file) {
    if (cache.has(file)) return cache.get(file);
    const p = fetch(file).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then((b) => open(key, new Uint8Array(b)))
      .then((d) => URL.createObjectURL(new Blob([d], { type: "image/jpeg" })));
    cache.set(file, p);
    p.catch(() => cache.delete(file));
    return p;
  }
  let active = 0; const queue = [];
  const pump = () => { while (active < 6 && queue.length) { const job = queue.shift(); active++; job().catch(() => {}).finally(() => { active--; pump(); }); } };
  const load = (img, file) => { queue.push(async () => { img.onload = () => img.classList.add("is-in"); img.src = await blobUrl(file); }); pump(); };
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); load(e.target, e.target.dataset.file); } }), { rootMargin: "600px 0px" });
  const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };

  // ----- page d'entrée : liste des galeries
  function buildIndex(list) {
    const ul = $("#g-list");
    for (const g of list) {
      const li = el("li"), a = el("a", "dep eq-card"); a.href = g.slug + "/";
      const cov = el("span", "dep-cover"), img = el("img");
      img.alt = "Couverture de la galerie " + g.title; img.width = 720; img.height = 900;
      img.dataset.file = g.slug + "/c.bin"; cov.appendChild(img); io.observe(img);
      const body = el("span", "dep-body");
      body.appendChild(el("h2", "dep-title", g.title));
      const meta = el("span", "dep-meta");
      meta.append(el("span", null, g.date), el("span", null, g.n + " photos"), el("span", "status", "Voir la galerie →"));
      body.appendChild(meta);
      a.append(cov, body); li.appendChild(a); ul.appendChild(li);
    }
    ul.hidden = false;
  }

  // ----- galerie
  function buildGallery(m) {
    document.title = m.title + " · " + m.date + " · Art équestre · Horizons Croisés";
    const h1 = $("#g-title"); h1.textContent = m.title; h1.hidden = false;
    $("#g-crumb").textContent = " / " + m.title;
    const strip = $("#g-strip");
    strip.append(el("li", null, m.date), el("li", null, m.n + " photos"));
    strip.hidden = false;
    $("#g-help").hidden = false;
    const out = $("#g-content");
    out.hidden = false;
    photos = [];
    const bar = $("#g-bar .wrap");
    let named = 0;
    m.sections.forEach((s, si) => {
      const sec = el("section", "g-section"); sec.id = "partie-" + (si + 1);
      if (s.name) {
        named++;
        sec.appendChild(el("h2", null, s.name));
        const a = el("a", null, s.name); a.href = "#" + sec.id; bar.appendChild(a);
      }
      const grid = el("div", "g-grid");
      for (const ph of s.photos) {
        const i = photos.push(ph) - 1;
        const b = el("button"); b.type = "button";
        b.setAttribute("aria-label", "Agrandir la photo n° " + ph.no);
        const img = el("img"); img.alt = ""; img.width = ph.tw; img.height = ph.th;
        img.dataset.file = ph.t;
        b.appendChild(img); grid.appendChild(b);
        b.addEventListener("click", () => show(i));
        ph.btn = b;
        io.observe(img);
      }
      sec.appendChild(grid); out.insertBefore(sec, $("#tirage") || $("#g-note"));
    });
    if (named) { bar.appendChild(el("span", "g-count", photos.length + " photos")); $("#g-bar").hidden = false; }
  }

  // ----- visionneuse + téléchargement
  const lb = $("#g-lb");
  if (lb) {
    const lbImg = $("img", lb), wait = $(".g-wait", lb), dl = $("#g-dl"), buy = $("#g-buy"), pop = $("#g-pop");
    // téléchargement offert : fenêtre qui demande de mentionner le compte Instagram
    $("#g-free").addEventListener("click", () => pop.showModal());
    $(".g-x", pop).addEventListener("click", () => pop.close());
    pop.addEventListener("click", (e) => { if (e.target === pop) pop.close(); });
    dl.addEventListener("click", () => { if (dl.href) setTimeout(() => pop.close(), 300); });
    buy.addEventListener("click", () => { lb.close(); order(photos[cur]); });
    show = async (i) => {
      cur = (i + photos.length) % photos.length;
      const ph = photos[cur];
      $(".g-lb-count", lb).textContent = "Photo n° " + ph.no + " · " + (cur + 1) + " / " + photos.length;
      if (!lb.open) lb.showModal();
      lbImg.removeAttribute("src"); wait.hidden = false; dl.removeAttribute("href");
      buy.hidden = ph.s === "-"; // définition trop faible pour un tirage : téléchargement seul
      try {
        const url = await blobUrl(ph.f);
        if (photos[cur] !== ph) return;
        lbImg.src = url; wait.hidden = true;
        dl.href = url; dl.download = ph.n;
        blobUrl(photos[(cur + 1) % photos.length].f).catch(() => {}); // photo suivante en avance
      } catch (e) { wait.textContent = "Photo indisponible"; }
    };
    $(".g-prev", lb).addEventListener("click", () => show(cur - 1));
    $(".g-next", lb).addEventListener("click", () => show(cur + 1));
    $(".g-x", lb).addEventListener("click", () => lb.close());
    lb.addEventListener("click", (e) => { if (e.target === lb || e.target.classList.contains("g-lb-stage")) lb.close(); });
    lb.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") show(cur - 1); if (e.key === "ArrowRight") show(cur + 1); });
    let x0 = null;
    lb.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) show(cur + (dx < 0 ? 1 : -1)); x0 = null; });
  }

  // ----- commande d'un tirage ou du fichier HD (même configurateur que les pages œuvres)
  let ordered = null;
  async function order(ph) {
    const sec = $("#tirage");
    if (!sec || !window.atelier) return;
    ordered = ph;
    $("#g-ono").textContent = ph.no;
    const note = $("#sizeNote");
    if (note) note.textContent = ph.s ? "Pour garder une impression de qualité, cette photo est proposée jusqu'au " + ph.s.split(",").pop().replace("x", " × ") + " cm." : "";
    sec.hidden = false;
    const url = await blobUrl(ph.t); // aperçu sans le logo
    window.atelier.set({ photo: url, photoSm: url, ref: ph.r, orient: ph.o, sizes: ph.s || "" });
    sec.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const back = $("#g-back");
  if (back) back.addEventListener("click", (e) => {
    e.preventDefault();
    if (ordered && ordered.btn) { ordered.btn.scrollIntoView({ behavior: "smooth", block: "center" }); ordered.btn.focus({ preventScroll: true }); }
    else window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // ----- formulaire
  $("#g-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("button", e.target); btn.disabled = true; $("#g-err").hidden = true;
    await unlock($("#g-pw").value, false);
    btn.disabled = false;
  });
  let saved = null;
  try { saved = sessionStorage.getItem(KEYNAME); } catch (e) {}
  if (saved) unlock(saved, true); else html.classList.remove("eq-auto");
})();
