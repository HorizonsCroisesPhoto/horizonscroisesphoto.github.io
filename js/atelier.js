(() => {
  const root = document.getElementById("tirage");
  if (!root) return;
  // Photo affichée : lue sur la section #tirage ; window.atelier.set() permet d'en changer
  // (page des Sourires d'Anosibe : un configurateur pour les 50 portraits).
  // data-sizes (facultatif) limite les formats proposés, ex. "20x30" pour un recadrage serré.
  let PHOTO, PHOTO_SM, REF, PORTRAIT, ALLOWED;
  function load() {
    PHOTO = root.dataset.photo;
    PHOTO_SM = root.dataset.photoSm || PHOTO;
    REF = root.dataset.ref || "";
    PORTRAIT = root.dataset.orient === "portrait";
    ALLOWED = root.dataset.sizes ? root.dataset.sizes.split(",") : null;
  }
  load();

  // Liens de paiement Stripe (un par support / format / bord blanc). La référence de l'œuvre
  // est transmise avec client_reference_id et apparaît sur le paiement dans le Dashboard Stripe.
  const LINKS = {
      "tirage|20x30|0": "https://buy.stripe.com/14A7sN77ZeQfaRqbD56wE00",
      "tirage|20x30|2": "https://buy.stripe.com/9B628t3VN8rRbVubD56wE01",
      "tirage|30x45|0": "https://buy.stripe.com/9B63cx4ZRgYn7Fe6iL6wE02",
      "tirage|30x45|2": "https://buy.stripe.com/6oU7sNcsj4bBe3CePh6wE03",
      "tirage|40x60|0": "https://buy.stripe.com/eVq8wR0JB5fF9Nm9uX6wE04",
      "tirage|40x60|2": "https://buy.stripe.com/cNi14p9g7azZ0cMcH96wE05",
      "toile|40x60|0": "https://buy.stripe.com/9B6fZj4ZRgYngbK0Yr6wE06",
      "cadre|30x45|0": "https://buy.stripe.com/7sY7sN0JB9vV8JifTl6wE07",
      "cadre|30x45|3": "https://buy.stripe.com/3cI28t0JB23tbVu9uX6wE08",
      "cadre|40x60|0": "https://buy.stripe.com/14A8wR4ZRfUjgbKdLd6wE09",
      "cadre|40x60|3": "https://buy.stripe.com/fZudRb2RJbE32kU6iL6wE0a",
      "caisse|30x45|0": "https://buy.stripe.com/14AdRb3VN8rRe3C9uX6wE0b",
      "caisse|30x45|3": "https://buy.stripe.com/3cI5kFbof5fFcZy7mP6wE0c",
      "caisse|40x60|0": "https://buy.stripe.com/7sY5kF1NFazZbVu5eH6wE0d",
      "caisse|40x60|3": "https://buy.stripe.com/bJe9AVakbfUj9NmfTl6wE0e",
      "fichier|hd|0": "https://buy.stripe.com/7sY5kFcsj7nNgbKePh6wE0f"
  };

  // Formats : hauteur × largeur en cm (paysage), tous au ratio 3:2 des photos : aucun recadrage.
  const SIZES = {
    "20x30": { h: 20,   w: 30,   label: "20 × 30 cm" },
    "30x45": { h: 30,   w: 45,   label: "30 × 45 cm" },
    "40x60": { h: 40,   w: 60,   label: "40 × 60 cm" },
    hd:      { h: 20,   w: 30,   label: "" },
  };
  // Supports : bordure visible (cm), jour (cm), profondeur (cm), prix de vente (€) par format.
  // Prix WhiteWall TTC relevés le 3 nov. 2026, port France WhiteWall inclus, arrondi à l'euro supérieur.
  // tirage (Fuji Crystal DP II) : × 2 + port → 10,95×2 + 8,95 = 31 · 13,95×2 + 8,95 = 37 · 16,95×2 + 8,95 = 43
  // toile mate 40×60 : 66,95×1,5 + 14,95 = 116
  // cadre Hambourg 20 mm noir mat + Alu Dibond : 129,95×1,5 + 14,95 = 210 · 178,95×1,5 + 19,95 = 289
  // caisse Bâle 15 mm noir mat + Alu Dibond : 153,95×1,5 + 14,95 = 246 · 189,95×1,5 + 19,95 = 305
  // fichier HD : 25 € (le 20×30 imprimé et livré coûte 31 €, pour inciter au tirage)
  // Bord blanc (option « Marge » WhiteWall, ajoutée autour de l'image) : 2 cm sur les tirages, 3 cm sur cadres et caisses.
  //   tirage 11,95×2 + 8,95 = 33 · 13,95×2 + 8,95 = 37 · 18,95×2 + 9,95 (64 cm : envoi jusqu'à 100 cm) = 48
  //   cadre 153,95×1,5 + 14,95 = 246 · 204,95×1,5 + 19,95 = 328 · caisse 170,95×1,5 + 14,95 = 272 · 218,95×1,5 + 19,95 = 349
  const SUPPORTS = {
    tirage:  { name: "Tirage photo",            lip: 0,   gap: 0,   depth: 0.1, prices: { "20x30": 31, "30x45": 37, "40x60": 43 }, border: 2, pricesBorder: { "20x30": 33, "30x45": 37, "40x60": 48 } },
    toile:   { name: "Toile",                   lip: 0,   gap: 0,   depth: 2.0, prices: { "40x60": 116 } },
    cadre:   { name: "Cadre noir",              lip: 2.0, gap: 0,   depth: 3.0, prices: { "30x45": 210, "40x60": 289 }, border: 3, pricesBorder: { "30x45": 246, "40x60": 328 } },
    caisse:  { name: "Caisse américaine noire", lip: 1.5, gap: 0.7, depth: 2.9, prices: { "30x45": 246, "40x60": 305 }, border: 3, pricesBorder: { "30x45": 272, "40x60": 349 } },
    fichier: { name: "Fichier numérique haute définition", lip: 0, gap: 0, depth: 0.1, prices: { hd: 25 }, digital: true },
  };
  for (const s of Object.values(SUPPORTS)) s.sizes = Object.keys(s.prices);
  for (const el of document.querySelectorAll("[data-from]")) {
    const p = Object.values(SUPPORTS[el.dataset.from].prices);
    el.textContent = (p.length > 1 ? "dès " : "") + Math.min(...p) + " €";
  }

  // Géométrie de la photo de pièce (1448 × 965 px). Échelle estimée d'après le buffet (≈ 60 cm de haut) :
  // 5,05 px/cm au mur, appareil à ≈ 2,95 m. Centre du tirage à 1,10 m du sol, à gauche du vase.
  // ppx/ppy : axe de l'appareil. sunDx/sunDy : décalage de l'ombre portée par cm de profondeur.
  const ROOM = { w: 1448, pxPerCm: 5.05, camDistCm: 295, wallX: 650, wallY: 326.5, ppx: 199, ppy: 579, sunDx: 1.9, sunDy: 0.35 };

  const $ = (id) => document.getElementById(id);
  const form = $("order");

  const state = () => {
    const support = form.support.value;
    const size = form.size.value;
    let { h, w } = SIZES[size];
    if (PORTRAIT) [h, w] = [w, h];
    const s = SUPPORTS[support];
    const b = s.border && form.border.checked ? s.border : 0; // largeur du bord blanc (cm)
    return { support, size, h, w, s, b, z: SIZES[size] };
  };

  // Construit la face avant (cadre, jour, photo) à une échelle donnée (px par cm)
  function buildFront(el, st, pxcm, src) {
    const { s } = st;
    el.innerHTML = "";
    const lip = s.lip * pxcm, gap = s.gap * pxcm;
    if (st.support === "caisse") {
      const v = document.createElement("div");
      v.className = "void";
      v.style.inset = lip + "px";
      el.appendChild(v);
    }
    const bw = st.b * pxcm;
    if (bw) {
      const paper = document.createElement("div");
      paper.className = "paper";
      paper.style.inset = (lip + gap) + "px";
      el.appendChild(paper);
    }
    const p = document.createElement("div");
    p.className = "photo";
    p.style.inset = (lip + gap + bw) + "px";
    p.style.backgroundImage = `url("${src}")`;
    el.appendChild(p);
    if (st.support === "cadre") {
      const g = document.createElement("div");
      g.className = "glass";
      g.style.inset = lip + "px";
      el.appendChild(g);
    }
  }

  function outer(st) {
    const b = 2 * (st.s.lip + st.s.gap + st.b);
    return { W: st.w + b, H: st.h + b };
  }

  function render3d(st) {
    const box = $("stage3d").getBoundingClientRect();
    const { W, H } = outer(st);
    // même taille apparente quel que soit le format : le format se juge dans la pièce
    const pxcm = Math.min(box.width * 0.72 / W, box.height * 0.78 / H);
    const obj = $("obj");
    obj.className = "obj s-" + st.support;
    obj.style.width = W * pxcm + "px";
    obj.style.height = H * pxcm + "px";
    buildFront($("front3d"), st, pxcm, PHOTO);
    const d = Math.max(st.s.depth * pxcm, 1.5);
    const sl = $("sideL"), stp = $("sideT");
    sl.style.width = d + "px"; sl.style.left = -d + "px";
    stp.style.height = d + "px"; stp.style.top = -d + "px";
    const wrapL = sl.firstElementChild, wrapT = stp.firstElementChild;
    if (st.support === "toile") {
      wrapL.style.backgroundImage = wrapT.style.backgroundImage = `url("${PHOTO_SM}")`;
      wrapL.style.backgroundSize = `${W * pxcm}px ${H * pxcm}px`;
    } else {
      wrapL.style.backgroundImage = wrapT.style.backgroundImage = "none";
    }
    const cast = $("cast");
    cast.style.transform = `translateZ(${-d - 2}px) translate(${3 + d * 0.35}px, ${5 + d * 0.45}px)`;
    cast.style.opacity = st.s.depth < 0.5 ? 0.45 : 1;
  }

  function renderRoom(st) {
    const box = $("screenRoom");
    const scale = box.clientWidth / ROOM.w;
    const D = st.s.depth;
    const k = ROOM.camDistCm / (ROOM.camDistCm - D); // face avant un peu plus proche que le mur
    const pxcm = ROOM.pxPerCm * k * scale;
    const { W, H } = outer(st);
    const w = W * pxcm, h = H * pxcm;
    const cx = (ROOM.ppx + (ROOM.wallX - ROOM.ppx) * k) * scale;
    const cy = (ROOM.ppy + (ROOM.wallY - ROOM.ppy) * k) * scale;
    const el = $("onwall");
    el.style.width = w + "px";
    el.style.height = h + "px";
    el.style.left = cx + "px";
    el.style.top = cy + "px";
    const amb = Math.max(D, 0.3) * ROOM.pxPerCm * scale; // ombre douce de contact
    el.style.setProperty("--sx", amb * 0.25 + "px");
    el.style.setProperty("--sy", amb * 0.45 + "px");
    el.style.setProperty("--blur", Math.max(1.5, amb * 0.5) + "px");
    el.className = "onwall s-" + st.support;
    buildFront($("frontRoom"), st, pxcm, PHOTO_SM);

    // Ombre portée par le soleil : contour du tirage projeté sur le mur dans la direction de la lumière
    const pw = W * ROOM.pxPerCm * scale, ph = H * ROOM.pxPerCm * scale;
    const c = $("castSun");
    c.style.width = pw + "px";
    c.style.height = ph + "px";
    c.style.left = ROOM.wallX * scale - pw / 2 + D * ROOM.sunDx * ROOM.pxPerCm * scale + "px";
    c.style.top = ROOM.wallY * scale - ph / 2 + D * ROOM.sunDy * ROOM.pxPerCm * scale + "px";
    c.style.setProperty("--sb", Math.max(0.6, D * 0.25 * ROOM.pxPerCm * scale) + "px");

    // Lumière du mur reportée sur le tirage seulement
    const L = cx - w / 2, T = cy - h / 2;
    $("light").style.clipPath = `inset(${T}px ${box.clientWidth - L - w}px ${box.clientHeight - T - h}px ${L}px)`;
  }

  // formats proposés pour la photo affichée (le fichier HD reste toujours disponible)
  const sizesOf = (s) => s.sizes.filter((z) => z === "hd" || !ALLOWED || ALLOWED.includes(z));

  function update() {
    // supports disponibles pour cette photo
    for (const inp of form.querySelectorAll('input[name="support"]')) {
      inp.disabled = sizesOf(SUPPORTS[inp.value]).length === 0;
      inp.closest(".opt").classList.toggle("is-off", inp.disabled);
    }
    if (form.querySelector('input[name="support"]:checked').disabled) {
      form.querySelector('input[name="support"][value="tirage"]').checked = true;
    }
    const st0 = state();
    const avail = sizesOf(st0.s);
    // formats disponibles selon le support
    for (const inp of form.querySelectorAll('input[name="size"]')) {
      inp.disabled = !avail.includes(inp.value);
    }
    if (!avail.includes(form.size.value)) {
      form.querySelector(`input[name="size"][value="${avail[0]}"]`).checked = true;
    }
    $("sizeNote") && ($("sizeNote").hidden = !ALLOWED);
    const st = state();
    const file = !!st.s.digital;
    $("formats").hidden = file;
    $("lab").hidden = file;
    $("finish").hidden = !st.s.border;
    if (st.s.border) {
      const delta = st.s.pricesBorder[st.size] - st.s.prices[st.size];
      $("borderInfo").textContent = `${st.s.border} cm autour de l'image · ${delta ? `+${delta} €` : "sans supplément"}`;
    }
    const price = st.b ? st.s.pricesBorder[st.size] : st.s.prices[st.size];
    $("sumLabel").textContent = file ? st.s.name : `${st.s.name}, ${st.z.label}${st.b ? `, bord blanc ${st.b} cm` : ""}`;
    $("price").textContent = `${price} €`;
    $("shipNote").textContent = file
      ? "Envoyé par lien de téléchargement après paiement. Usage privé uniquement, la photo reste protégée par le droit d'auteur."
      : "Frais de port inclus pour une livraison en France. Autres pays : sur demande.";
    $("cap3d").textContent = file ? "Fichier numérique HD" : `${st.s.name} · ${st.z.label}`;
    $("room").classList.toggle("is-file", file);
    $("roomMsg").hidden = !file;
    render3d(st);
    renderRoom(st);
  }

  form.addEventListener("change", update);
  $("sun").addEventListener("change", () => $("room").classList.toggle("no-sun", !$("sun").checked));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const st = state();
    const url = LINKS[`${st.support}|${st.size}|${st.b}`];
    if (!url) return;
    form.querySelector(".btn").setAttribute("aria-busy", "true");
    // Stripe n'accepte que lettres, chiffres, - et _ : « Painted Souls-5 » devient « Painted_Souls-5 »
    const cref = REF.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9_-]+/g, "_");
    window.location.href = url + (cref ? "?client_reference_id=" + cref : "");
  });
  // retour arrière depuis Stripe : réactiver le bouton
  window.addEventListener("pageshow", () => form.querySelector(".btn").removeAttribute("aria-busy"));
  const ro = new ResizeObserver(update);
  ro.observe($("screen3d"));
  ro.observe($("screenRoom"));
  update();

  window.atelier = {
    // ds : { photo, photoSm, ref, orient, sizes } — mêmes clés que les attributs data-* de #tirage
    set(ds) {
      for (const k of ["photo", "photoSm", "ref", "orient", "sizes"]) {
        if (ds[k]) root.dataset[k] = ds[k]; else delete root.dataset[k];
      }
      load();
      update();
    },
  };
})();
