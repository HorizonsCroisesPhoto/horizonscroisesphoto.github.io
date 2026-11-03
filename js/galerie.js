// Galeries clients protégées : le mot de passe (sans majuscules, espaces ni accents) dérive une clé
// AES-GCM (PBKDF2-SHA256). Le sommaire et chaque photo sont chiffrés ; rien n'est lisible sans la clé.
(() => {
  const root = document.getElementById("galerie");
  if (!root || !window.crypto?.subtle) return;
  const $ = (s, el = document) => el.querySelector(s);
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const norm = (p) => p.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const SALT = b64(root.dataset.salt), ITER = +root.dataset.iter, MANIFEST = b64(root.dataset.manifest);
  const SLUG = root.dataset.slug, BASE = root.dataset.base || "./";
  const KEYNAME = "hc-galeries-mdp";
  let key = null, photos = [], cur = 0;

  async function derive(pw) {
    const raw = await crypto.subtle.importKey("raw", new TextEncoder().encode(norm(pw)), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt: SALT, iterations: ITER, hash: "SHA-256" }, raw, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  }
  const open = (k, buf) => crypto.subtle.decrypt({ name: "AES-GCM", iv: buf.slice(0, 12) }, k, buf.slice(12));

  async function unlock(pw, silent) {
    const form = $("#g-form"), err = $("#g-err");
    try {
      const k = await derive(pw);
      const m = JSON.parse(new TextDecoder().decode(await open(k, MANIFEST)));
      key = k;
      try { sessionStorage.setItem(KEYNAME, pw); } catch (e) {}
      build(m);
      return true;
    } catch (e) {
      if (!silent) { err.hidden = false; form.querySelector("input").select(); }
      return false;
    }
  }

  // ----- grille
  const cache = new Map();
  async function blobUrl(file) {
    if (cache.has(file)) return cache.get(file);
    const p = fetch(BASE + file).then((r) => r.arrayBuffer()).then((b) => open(key, new Uint8Array(b)))
      .then((d) => URL.createObjectURL(new Blob([d], { type: "image/jpeg" })));
    cache.set(file, p);
    return p;
  }
  let active = 0; const queue = [];
  const pump = () => { while (active < 6 && queue.length) { const job = queue.shift(); active++; job().finally(() => { active--; pump(); }); } };
  const load = (img, file) => { queue.push(async () => { img.src = await blobUrl(file); img.onload = () => img.classList.add("is-in"); }); pump(); };

  function build(m) {
    $("#g-lock").hidden = true;
    const out = $("#g-content");
    out.hidden = false;
    photos = [];
    const bar = $("#g-bar .wrap");
    m.sections.forEach((s, si) => {
      const sec = document.createElement("section");
      sec.className = "g-section"; sec.id = "partie-" + (si + 1);
      if (s.name) {
        const h = document.createElement("h2"); h.textContent = s.name; sec.appendChild(h);
        const a = document.createElement("a"); a.href = "#" + sec.id; a.textContent = s.name; bar.appendChild(a);
      }
      const grid = document.createElement("div"); grid.className = "g-grid";
      for (const ph of s.photos) {
        const i = photos.push(ph) - 1;
        const b = document.createElement("button"); b.type = "button";
        b.setAttribute("aria-label", "Agrandir la photo " + (i + 1));
        const img = document.createElement("img"); img.alt = ""; img.width = ph.tw; img.height = ph.th;
        b.appendChild(img); grid.appendChild(b);
        b.addEventListener("click", () => show(i));
        io.observe(img); img.dataset.file = ph.t;
      }
      sec.appendChild(grid); out.insertBefore(sec, $("#g-note"));
    });
    const c = document.createElement("span"); c.className = "g-count"; c.textContent = photos.length + " photos"; bar.appendChild(c);
    $("#g-bar").hidden = false;
  }
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); load(e.target, e.target.dataset.file); } }), { rootMargin: "600px 0px" });

  // ----- visionneuse + téléchargement
  const lb = $("#g-lb"), lbImg = $("#g-lb img"), wait = $("#g-lb .g-wait"), dl = $("#g-dl");
  async function show(i) {
    cur = (i + photos.length) % photos.length;
    const ph = photos[cur];
    $("#g-lb .g-lb-count").textContent = (cur + 1) + " / " + photos.length;
    if (!lb.open) lb.showModal();
    lbImg.removeAttribute("src"); wait.hidden = false; dl.removeAttribute("href");
    const url = await blobUrl(ph.f);
    if (photos[cur] !== ph) return;
    lbImg.src = url; wait.hidden = true;
    dl.href = url; dl.download = ph.n;
    blobUrl(photos[(cur + 1) % photos.length].f); // photo suivante en avance
  }
  $("#g-lb .g-prev").addEventListener("click", () => show(cur - 1));
  $("#g-lb .g-next").addEventListener("click", () => show(cur + 1));
  $("#g-lb .g-x").addEventListener("click", () => lb.close());
  lb.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") show(cur - 1); if (e.key === "ArrowRight") show(cur + 1); });
  let x0 = null;
  lb.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) show(cur + (dx < 0 ? 1 : -1)); x0 = null; });

  // ----- formulaire
  $("#g-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button"); btn.disabled = true;
    await unlock(e.target.querySelector("input").value, false);
    btn.disabled = false;
  });
  let saved = null;
  try { saved = sessionStorage.getItem(KEYNAME); } catch (e) {}
  if (saved) unlock(saved, true);
})();
