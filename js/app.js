// Arayüz mantığı
(function () {
const cfg = window.APP_CONFIG || {};
const Store = window.Store, G = window.GMaps;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const gbp = n => "£" + Number(n).toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const gbp2 = n => "£" + Number(n).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ICON = {
  heart: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.5 1.1 4.3 2.4.8-1.3 2.2-2.4 4.3-2.4 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg>',
  heartO: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.5 1.1 4.3 2.4.8-1.3 2.2-2.4 4.3-2.4 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg>',
  kitchen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 11h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M8 7V3M12 7V3M16 7V3"/></svg>',
  bath: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12h18v3a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z"/><path d="M6 12V5a2 2 0 0 1 4 0"/></svg>',
  pin: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>'
};
const ui = { courseId: null, unit: "w", tab: "cards" };
try { ui.courseId = localStorage.getItem("lk_course"); ui.unit = localStorage.getItem("lk_unit") || "w"; } catch (e) {}

function toast(t) { const el = $("#toast"); el.textContent = t; el.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove("show"), 2600); }
function setStatus(t) { const s = $("#status"); s.textContent = t || ""; s.classList.toggle("show", !!t); }
function parseCoords(s) {
  if (!s) return null; s = String(s);
  const m = s.match(/@(-?\d+\.\d+),\s*(-?\d+\.\d+)/) || s.match(/[?&](?:q|query|ll|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/) || s.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (!m) return null; const lat = +m[1], lng = +m[2];
  if (lat < 51.2 || lat > 51.8 || lng < -0.6 || lng > 0.4) return null; return [lat, lng];
}
const weekly = f => f.unit === "m" ? f.price * 12 / 52 : f.price;
const monthly = f => f.unit === "m" ? f.price : f.price * 52 / 12;
const priceLabel = f => `${gbp(weekly(f))}/hafta · ${gbp(monthly(f))}/ay`;
const me = () => Store.user && Store.user.id;
const myFavs = () => Store.favs.filter(x => x.user_id === me()).map(x => x.facility_id);
const favCount = id => Store.favs.filter(x => x.facility_id === id).length;
const currentCourse = () => Store.courses.find(c => c.id === ui.courseId) || Store.courses[0] || null;
const gmaps = (f, c) => "https://www.google.com/maps/dir/?" + new URLSearchParams({ api: "1", origin: f.lat ? f.lat + "," + f.lng : f.address, destination: c.lat ? c.lat + "," + c.lng : c.address, travelmode: "transit" });
const gmapsPlace = f => "https://www.google.com/maps/search/?" + new URLSearchParams({ api: "1", query: f.lat ? f.lat + "," + f.lng : f.address });

// ---------- Rotalar ----------
const estCache = new Map(), gTried = new Set();
let rerenderTimer = null;
function scheduleRender() { clearTimeout(rerenderTimer); rerenderTimer = setTimeout(render, 250); }
function estimate(f, c) {
  const k = f.lat + "," + f.lng + ">" + c.lat + "," + c.lng;
  if (!estCache.has(k)) estCache.set(k, { ...route([f.lat, f.lng], [c.lat, c.lng]), source: "estimate" });
  return estCache.get(k);
}
function isFresh(r) { if (!r || !r.updatedAt) return !!r; return (Date.now() - new Date(r.updatedAt).getTime()) < (cfg.routeCacheDays || 30) * 864e5; }
function requestGoogle(f, c, force) {
  const key = f.id + "|" + c.id;
  if (!G.enabled || G.failed || (!force && gTried.has(key))) return Promise.resolve(null);
  gTried.add(key);
  return G.route(key, { lat: f.lat, lng: f.lng }, { lat: c.lat, lng: c.lng }).then(async r => {
    if (r) { await Store.saveRoute(f.id, c.id, r); scheduleRender(); }
    // başarısız rota bu oturumda tekrar istenmez (Google kotası boşa harcanmasın); sayfa yenilenince yeniden denenir
    return r;
  });
}
function getRoute(f, c) {
  if (!f || !c || !(f.lat && f.lng && c.lat && c.lng)) return null;
  const cached = Store.cachedRoute(f.id, c.id);
  if (cached && cached.source === "google") { if (!isFresh(cached)) requestGoogle(f, c); return enrich(cached, f, c); }
  requestGoogle(f, c);
  return estimate(f, c);
}
function enrich(r, f, c) { // Google ücret vermezse tahmini ücreti kullan
  const e = estimate(f, c);
  // Google, tren+metro aktarmalı yolculuklarda ücretleri ayrı ayrı toplayabiliyor; Oyster/temassız kartta
  // bu tek yolculuk sayılır. Bu yüzden Google ücreti TfL tarifesinden belirgin yüksekse TfL ücretini kullan.
  const est = r.mode === "walk" ? 0 : e.fare;
  if (r.fare == null) return { ...r, zones: e.zones, fareEstimated: true, fare: est };
  if (est && r.fare > est + 0.6) return { ...r, zones: e.zones, fareEstimated: true, fare: est };
  return { ...r, zones: e.zones, fareEstimated: false };
}
function monthlyTransit(r) {
  if (!r || r.mode === "walk") return 0;
  let w = r.fare * 10; const z = r.zones || [];
  if (z[0] === 1) { const cap = { 2: 44.7, 3: 52.5, 4: 64.2 }[Math.max(2, z[1])]; if (cap) w = Math.min(w, cap); }
  return w * 52 / 12;
}

// ---------- Görünüm parçaları ----------
function genderBadge(g) { if (!g) return `<span class="b type">Ev sahibi aile / belirtilmemiş</span>`; const cls = g === "Sadece kadın" ? "f" : g === "Sadece erkek" ? "m" : "mixed"; return `<span class="b ${cls}">${esc(g === "Karma" ? "Kız–erkek karma" : g)}</span>`; }
function facItem(kind, val) {
  const v = val || "Bilinmiyor"; const cls = v === "Ortak" ? "shared" : (v === "Özel" || v === "Yarı özel") ? "priv" : v === "Yemekli" ? "cat" : "unk";
  const txt = v === "Özel" && kind === "b" ? "Özel (en-suite)" : v === "Yemekli" ? "Yemekli (öğün dahil)" : v;
  return `<div class="it"><div class="ic ${cls}">${kind === "k" ? ICON.kitchen : ICON.bath}</div><div><div class="lab">${kind === "k" ? "Mutfak" : "Banyo"}</div>${esc(txt)}</div></div>`;
}
function legsHtml(r) {
  return r.legs.filter(l => !(l.type === "walk" && l.min < 1)).map(l => l.type === "walk"
    ? `<span class="leg walk">🚶 ${l.min} dk</span>`
    : `<span class="leg"><span class="dot" style="background:${esc(l.color)}"></span>${l.kind === "bus" ? "🚌 " : ""}${esc(l.line)} <span style="color:var(--muted)">${esc(l.from)} → ${esc(l.to)}</span></span>`).join('<span class="arrow">›</span>');
}
const srcTag = r => r.source === "google" ? '<span class="src g">Google</span>' : '<span class="src e">Tahmini</span>';
function routeBlock(f, c) {
  if (!c) return `<div class="route"><span class="nocoord">Ulaşım bilgisi için bir kurs seçin.</span></div>`;
  const r = getRoute(f, c);
  const link = `<a class="map" href="${esc(gmaps(f, c))}" target="_blank" rel="noopener">${ICON.pin} Google Haritalar’da rotayı aç</a>`;
  if (!r) return `<div class="route"><div class="nocoord">${f.type === "Aile yanı" ? "Aile yanı konaklamada adres atanan aileye göre değişir; ulaşım bilgisi aile belli olunca hesaplanabilir." : "Bu tesisin konumu bilinmiyor; süre hesaplanamadı."}</div>${f.type === "Aile yanı" ? "" : link}</div>`;
  if (r.mode === "walk") return `<div class="route"><div class="rt"><span class="big">${r.minutes} dk</span><span class="sm">yürüme · <b>${r.km} km</b> · vasıta yok · <b>£0</b></span>${srcTag(r)}</div><div style="height:8px"></div>${link}</div>`;
  return `<div class="route"><div class="rt"><span class="big">${r.source === "google" ? "" : "~"}${r.minutes} dk</span>
    <span class="sm"><b>${r.changes === 0 ? "Aktarmasız" : r.changes + " aktarma"}</b> · ${r.km} km${r.source === "google" ? "" : " (kuş uçuşu)"} · tek yön <b>${r.fareEstimated ? "≈" : ""}${gbp2(r.fare)}</b> · aylık ≈ <b>${gbp(monthlyTransit(r))}</b></span>${srcTag(r)}</div>
    <div class="legs">${legsHtml(r)}</div>${link}</div>`;
}
function stayBadge(f) {
  const s = f.stay6 || "ask";
  if (s === "ok") return '<span class="b ok6">✓ 6 ay kiralanabilir</span>';
  if (s === "no") return '<span class="b no6">✕ Sadece uzun sözleşme</span>';
  return '<span class="b ask6">? 6 ay için sorulmalı</span>';
}
function contractLine(f) {
  const parts = [];
  if (f.contractWeeks) parts.push(`Bu fiyat <b>${f.contractWeeks} haftalık</b> sözleşme için`);
  if (f.moveIn) parts.push(`giriş–çıkış: <b>${esc(f.moveIn)}</b>`);
  if (f.contractWeeks) parts.push(`sözleşme toplamı ≈ <b>${gbp(weekly(f) * f.contractWeeks)}</b>`);
  if (f.deposit != null) parts.push(`depozito <b>${gbp(f.deposit)}</b>`);
  if (!parts.length) return "";
  const warn = f.contractWeeks && f.contractWeeks > 30;
  return `<div class="contract ${warn ? "warn" : ""}">${warn ? "⚠️ " : "📅 "}${parts.join(" · ")}${warn ? ". 6 aylık kalışta haftalık fiyat farklı olabilir." : ""}</div>`;
}
function card(f, c) {
  const favd = myFavs().includes(f.id), fc = favCount(f.id), w = weekly(f), m = monthly(f), mainW = ui.unit === "w";
  const occ = f.type === "Ev" && f.occupants ? `<span class="b type">🏠 Evde ${f.occupants} kişi</span>` : "";
  const canDel = Store.user && (f.createdBy === me() || Store.isAdmin());
  const who = f.createdBy ? (Store.names[f.createdBy] || "bir kullanıcı") : "Rehber (araştırma)";
  return `<article class="card">
  <div class="hd"><div class="t"><h2>${esc(f.name)}</h2><div class="addr">${esc(f.address)}</div></div>
   <button class="fav ${favd ? "on" : ""}" data-fav="${esc(f.id)}" title="Favorilere ekle" aria-label="Favori">${favd ? ICON.heart : ICON.heartO}<span>${fc}</span></button></div>
  <div class="badges"><span class="b type">${esc(f.type || "Rezidans")}</span>${genderBadge(f.gender)}${occ}${stayBadge(f)}${f.verified === false ? '<span class="b warn">Bazı bilgiler teyit bekliyor</span>' : ""}</div>
  ${contractLine(f)}
  <div class="price"><div class="${mainW ? "main" : ""}"><div class="k">Haftalık</div><div class="v">${gbp(w)}<small> /hafta</small></div></div>
   <div class="${mainW ? "" : "main"}"><div class="k">Aylık</div><div class="v">${gbp(m)}<small> /ay</small></div></div>
   <div><div class="k">${f.contractWeeks && f.contractWeeks > 26 ? f.contractWeeks + " hf sözleşme" : "6 ay (26 hf)"}</div><div class="v" style="font-size:17px">${gbp(w * (f.contractWeeks && f.contractWeeks > 26 ? f.contractWeeks : 26))}</div></div></div>
  <div class="facil">${facItem("k", f.kitchen)}${facItem("b", f.bathroom)}</div>
  ${routeBlock(f, c)}
  <div class="extra">${f.minStay ? `<p><b>Kalış:</b> ${esc(f.minStay)}</p>` : ""}${f.bills ? `<p><b>Faturalar:</b> ${f.bills === "yes" ? "dahil" : "hariç"}</p>` : ""}${f.notes ? `<p>${esc(f.notes)}</p>` : ""}</div>
  <div class="ft"><span>Ekleyen: ${esc(who)}</span><span>${f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">Kaynak ↗</a> · ` : ""}${f.type === "Aile yanı" && !f.lat ? "" : `<a href="${esc(gmapsPlace(f))}" target="_blank" rel="noopener">Haritada gör ↗</a>`}${canDel ? ` · <button class="linkbtn" data-del="${esc(f.id)}">Sil</button>` : ""}</span></div>
 </article>`;
}
function filtered() {
  const st = $("#fStay").value, g = $("#fGender").value, t = $("#fType").value, k = $("#fKitchen").value, b = $("#fBath").value, max = +$("#fMax").value || 0, favOnly = $("#fFav").checked, sort = $("#fSort").value;
  const c = currentCourse(), mf = myFavs();
  const L = Store.facilities.filter(f => (!g || f.gender === g) && (!t || f.type === t) && (!k || f.kitchen === k) && (!b || f.bathroom === b) && (!max || weekly(f) <= max) && (!favOnly || mf.includes(f.id)) && (!st || (st === "ok" ? f.stay6 === "ok" : f.stay6 !== "no")));
  const time = f => { const r = getRoute(f, c); return r ? r.minutes : 9999; };
  L.sort(sort === "price" ? (a, b) => weekly(a) - weekly(b) : sort === "fav" ? (a, b) => favCount(b.id) - favCount(a.id) : sort === "name" ? (a, b) => a.name.localeCompare(b.name, "tr") : (a, b) => time(a) - time(b));
  return L;
}
function tableView(L) {
  const cs = Store.courses, cur = currentCourse();
  const head = `<tr><th>Tesis</th><th>Kimler</th><th>6 ay</th><th>Haftalık</th><th>Aylık</th><th>Mutfak / Banyo</th>${cs.map(c => `<th class="${cur && c.id === cur.id ? "hl" : ""}">${esc(c.name)}</th>`).join("")}</tr>`;
  const rows = L.map(f => `<tr><td><b>${esc(f.name)}</b><br><span style="color:var(--muted);font-size:12px">${esc(f.type)}${f.type === "Ev" && f.occupants ? ` · ${f.occupants} kişi` : ""}</span></td>
  <td>${esc(f.gender || "—")}</td><td>${{ok:"✓ Uygun",no:"✕ Uzun sözleşme"}[f.stay6]||"? Sorulmalı"}${f.contractWeeks?`<br><span style="color:var(--muted);font-size:12px">${f.contractWeeks} hf</span>`:""}</td><td class="n">${gbp(weekly(f))}</td><td class="n">${gbp(monthly(f))}</td><td>${esc(f.kitchen || "?")} / ${esc(f.bathroom || "?")}</td>
  ${cs.map(c => { const r = getRoute(f, c); const hl = cur && c.id === cur.id ? "hl" : ""; return `<td class="${hl}"><a href="${esc(gmaps(f, c))}" target="_blank" rel="noopener"><span class="cell">${r ? (r.mode === "walk" ? r.minutes + " dk 🚶" : (r.source === "google" ? "" : "~") + r.minutes + " dk") : "—"}<small>${r ? (r.mode === "walk" ? "yürüme" : (r.changes === 0 ? "aktarmasız" : r.changes + " aktarma") + " · " + gbp2(r.fare)) : "Haritada aç"}</small></span></a></td>`; }).join("")}</tr>`).join("");
  return `<div class="tablewrap"><table class="cmp"><thead>${head}</thead><tbody>${rows}</tbody></table></div><div class="note" style="margin-top:10px">Hücreye tıklayınca o tesis–kurs rotası Google Haritalar’da açılır. "~" işaretli süreler tahminidir.</div>`;
}
const colorFor = m => m == null ? "#999999" : m <= 25 ? "#1f7a4a" : m <= 45 ? "#d08a12" : "#c8102e";
const legend = `<div class="legend"><span><i style="background:#1f7a4a"></i>≤25 dk</span><span><i style="background:#d08a12"></i>26–45 dk</span><span><i style="background:#c8102e"></i>45+ dk</span><span>★ / ◆ seçili kurs</span></div>`;
function svgMap(L, c) {
  const pts = L.filter(f => f.lat && f.lng), all = [...pts, ...Store.courses.filter(x => x.lat)];
  if (!all.length) return `<div class="empty">Konumu olan tesis yok.</div>`;
  let minLat = 51.39, maxLat = 51.59, minLng = -0.30, maxLng = 0.02;
  for (const p of all) { minLat = Math.min(minLat, p.lat - .01); maxLat = Math.max(maxLat, p.lat + .01); minLng = Math.min(minLng, p.lng - .015); maxLng = Math.max(maxLng, p.lng + .015); }
  const W = 1000, kx = Math.cos(51.5 * Math.PI / 180), H = Math.round(W * (maxLat - minLat) / ((maxLng - minLng) * kx));
  const X = lng => (lng - minLng) / (maxLng - minLng) * W, Y = lat => (maxLat - lat) / (maxLat - minLat) * H;
  const th = [[51.468, -0.30], [51.474, -0.255], [51.483, -0.225], [51.470, -0.21], [51.465, -0.19], [51.476, -0.17], [51.482, -0.145], [51.486, -0.125], [51.497, -0.122], [51.507, -0.118], [51.509, -0.10], [51.507, -0.08], [51.503, -0.06], [51.507, -0.035], [51.500, -0.012], [51.488, -0.008], [51.485, -0.02], [51.495, 0.005], [51.505, 0.02]];
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Konum haritası"><rect width="${W}" height="${H}" fill="#f4f1e9" rx="10"/><polyline points="${th.map(p => X(p[1]).toFixed(1) + "," + Y(p[0]).toFixed(1)).join(" ")}" fill="none" stroke="#b9d3ea" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`;
  for (const f of pts) { const r = getRoute(f, c); s += `<a href="${esc(c ? gmaps(f, c) : gmapsPlace(f))}" target="_blank" rel="noopener"><circle cx="${X(f.lng)}" cy="${Y(f.lat)}" r="8" fill="${colorFor(r ? r.minutes : null)}" stroke="#fff" stroke-width="2"><title>${esc(f.name)} — ${r ? r.minutes + " dk" : ""} — ${gbp(weekly(f))}/hafta</title></circle><text x="${X(f.lng) + 11}" y="${Y(f.lat) + 4}" font-size="12" fill="#14213d">${esc(f.name.length > 26 ? f.name.slice(0, 25) + "…" : f.name)}</text></a>`; }
  for (const k of Store.courses) { if (!k.lat) continue; const on = c && k.id === c.id; s += `<rect x="${X(k.lng) - 8}" y="${Y(k.lat) - 8}" width="16" height="16" transform="rotate(45 ${X(k.lng)} ${Y(k.lat)})" fill="${on ? "#0a4d8c" : "#fff"}" stroke="#0a4d8c" stroke-width="2.5"/>${on ? `<text x="${X(k.lng) + 13}" y="${Y(k.lat) - 8}" font-size="12.5" font-weight="600" fill="#0a4d8c">${esc(k.name)}</text>` : ""}`; }
  return `<div class="mapbox">${s}</svg>${legend}</div>`;
}
function renderCourses() {
  const c = currentCourse();
  $("#courseBar").innerHTML = `<span class="lbl">Kurs seçin</span>` + Store.courses.map(k => `<button class="chip ${c && k.id === c.id ? "on" : ""}" data-course="${esc(k.id)}">${esc(k.name)}</button>`).join("") + `<button class="chip add" id="addCourseBtn">+ Kurs ekle</button>`;
  $("#courseAddr").innerHTML = c ? `📍 <b>${esc(c.name)}</b> — ${esc(c.address)} · <a href="${esc(gmapsPlace(c))}" target="_blank" rel="noopener">Haritada gör ↗</a>` : "";
}
function renderAuth() {
  const box = $("#authBox");
  if (Store.user) {
    const name = Store.names[Store.user.id] || (Store.profile && Store.profile.display_name) || Store.user.email || "Hesabım";
    box.innerHTML = `<span>👤 ${esc(name)}${Store.isAdmin() && Store.mode !== "demo" ? " (yönetici)" : ""}</span><button id="logoutBtn">Çıkış</button>`;
  } else box.innerHTML = `<button class="primary" id="loginBtn">Giriş yap</button>`;
  const ab = $("#adminBar");
  if (Store.isAdmin() && G.enabled) { ab.hidden = false; ab.innerHTML = `<button class="btn ghost small" id="refreshRoutes">Tüm rotaları Google’dan yeniden hesapla</button><span id="refreshInfo">Yalnızca yöneticiler görür.</span>`; }
  else ab.hidden = true;
}
function renderNote() {
  $("#methodNote").innerHTML = G.enabled
    ? `<b>Ulaşım bilgileri:</b> Süre, aktarma, hatlar ve ücret Google Haritalar’dan, hafta içi sabah 08:30 çıkışına göre alınır (<span class="src g" style="margin:0">Google</span>). Google ücret vermezse TfL 2026 tarifesine göre tahmini ücret “≈” ile gösterilir. Sonuçlar ${cfg.routeCacheDays || 30} gün saklanır. Google’dan yanıt gelene kadar tahmin (<span class="src e" style="margin:0">Tahmini</span>) görünür. 18+ Student Oyster ile Travelcard’larda %30 indirim vardır.`
    : `<b>Ulaşım bilgileri tahminidir:</b> Google Haritalar anahtarı tanımlanmadığı için süre, aktarma ve ücret sadeleştirilmiş bir metro/tren modeliyle hesaplanıyor (otobüs dahil değil). Kesin rota için “Google Haritalar’da rotayı aç” bağlantısını kullanın.`;
}
let lastMapKey = "";
function render() {
  renderCourses(); renderAuth();
  const c = currentCourse(), L = filtered(), v = $("#view");
  $("#count").textContent = `${L.length} / ${Store.facilities.length} tesis`;
  if (!Store.facilities.length) { v.innerHTML = `<div class="empty">Henüz tesis yok. “+ Konaklama ekle” ile ilk tesisi ekleyin.</div>`; return; }
  if (!L.length) { v.innerHTML = `<div class="empty">Filtrelere uyan tesis yok.</div>`; return; }
  if (ui.tab === "cards") { lastMapKey = ""; v.innerHTML = `<div class="grid">${L.map(f => card(f, c)).join("")}</div>`; }
  else if (ui.tab === "table") { lastMapKey = ""; v.innerHTML = tableView(L); }
  else {
    if (G.enabled && !G.failed) {
      const key = (c && c.id) + ":" + L.map(f => f.id).join(",");
      if (key === lastMapKey) return; lastMapKey = key;
      v.innerHTML = `<div class="mapbox"><div id="gmap"></div>${legend}</div>`;
      G.renderMap($("#gmap"), L, c, getRoute, colorFor, gmaps, f => priceLabel(f)).then(ok => { if (!ok) { lastMapKey = ""; v.innerHTML = svgMap(L, c); } });
    } else v.innerHTML = svgMap(L, c);
  }
}

// ---------- Etkileşim ----------
function needLogin() { if (Store.user) return false; openModal("#loginModal"); toast("Bunun için önce giriş yapın."); return true; }
function openModal(sel) { $(sel).classList.add("open"); const i = $(sel + " input"); if (i) i.focus(); }
document.addEventListener("click", async e => {
  const t = e.target.closest("[data-course],[data-fav],[data-del],[data-close],#addCourseBtn,#addFacBtn,#tabs button,#unitSeg button,#loginBtn,#logoutBtn,#refreshRoutes"); if (!t) return;
  if (t.dataset.course) { ui.courseId = t.dataset.course; try { localStorage.setItem("lk_course", ui.courseId); } catch (e) {} render(); }
  else if (t.dataset.fav) { if (needLogin()) return; try { await Store.toggleFav(t.dataset.fav); } catch (err) { toast("Favori kaydedilemedi."); } }
  else if (t.dataset.del) delFac(t.dataset.del);
  else if (t.hasAttribute("data-close")) t.closest(".modal-bg").classList.remove("open");
  else if (t.id === "addCourseBtn") { if (!needLogin()) openModal("#courseModal"); }
  else if (t.id === "addFacBtn") { if (!needLogin()) openModal("#facModal"); }
  else if (t.id === "loginBtn") openModal("#loginModal");
  else if (t.id === "logoutBtn") { await Store.signOut(); toast("Çıkış yapıldı."); }
  else if (t.id === "refreshRoutes") refreshAll(t);
  else if (t.parentElement.id === "tabs") { ui.tab = t.dataset.v; document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b === t)); render(); }
  else if (t.parentElement.id === "unitSeg") { ui.unit = t.dataset.v; try { localStorage.setItem("lk_unit", ui.unit); } catch (e) {} syncUnit(); render(); }
});
function syncUnit() { document.querySelectorAll("#unitSeg button").forEach(b => b.classList.toggle("on", b.dataset.v === ui.unit)); }
["#fStay", "#fGender", "#fType", "#fKitchen", "#fBath", "#fMax", "#fSort", "#fFav"].forEach(s => $(s).addEventListener("input", render));
document.querySelectorAll(".modal-bg").forEach(m => m.addEventListener("click", e => { if (e.target === m) m.classList.remove("open"); }));
document.addEventListener("keydown", e => { if (e.key === "Escape") document.querySelectorAll(".modal-bg.open").forEach(m => m.classList.remove("open")); });

async function delFac(id) {
  if (delFac.pending !== id) { delFac.pending = id; toast("Silmek için “Sil”e tekrar tıklayın."); setTimeout(() => { if (delFac.pending === id) delFac.pending = null; }, 4000); return; }
  delFac.pending = null; try { await Store.deleteFacility(id); toast("Silindi."); } catch (e) { toast("Silinemedi: yetkiniz olmayabilir."); }
}
async function refreshAll(btn) {
  btn.disabled = true; let n = 0; const total = Store.facilities.length * Store.courses.length; const info = $("#refreshInfo");
  const jobs = [];
  for (const f of Store.facilities) for (const c of Store.courses) if (f.lat && c.lat) jobs.push(requestGoogle(f, c, true).then(() => { n++; info.textContent = `${n} / ${total} rota hesaplandı`; }));
  await Promise.all(jobs); btn.disabled = false; toast("Rotalar güncellendi.");
}
async function locate(coordsText, address, hintEl) {
  if (coordsText && coordsText.trim()) { const co = parseCoords(coordsText); if (!co) throw new Error("Koordinat okunamadı (Londra içinde “51.52, -0.14” biçiminde olmalı)."); return co; }
  if (G.enabled) { if (hintEl) hintEl.textContent = "Adres Google’da aranıyor…"; const g = await G.geocode(address); if (g) return [g.lat, g.lng]; }
  return null;
}
$("#loginSend").addEventListener("click", async () => {
  const email = $("#loginEmail").value.trim(), err = $("#loginErr"); err.textContent = "";
  if (!/^\S+@\S+\.\S+$/.test(email)) { err.textContent = "Geçerli bir e-posta girin."; return; }
  $("#loginSend").disabled = true;
  try {
    await Store.signInEmail(email);
    if (Store.mode === "demo") { $("#loginModal").classList.remove("open"); toast("Demo modunda giriş yapıldı."); }
    else err.innerHTML = `<span style="color:var(--green)">Giriş bağlantısı ${esc(email)} adresine gönderildi. E-postanızdaki bağlantıya tıklayın.</span>`;
  } catch (e) { err.textContent = "Gönderilemedi: " + (e.message || e); }
  $("#loginSend").disabled = false;
});
$("#loginForm").addEventListener("submit", e => { e.preventDefault(); $("#loginSend").click(); });
if (cfg.enableGoogleLogin && Store.mode !== "demo") { $("#googleLoginWrap").hidden = false; $("#googleLogin").addEventListener("click", () => Store.signInGoogle().catch(e => { $("#loginErr").textContent = e.message || e; })); }

// ---------- Linkten otomatik doldurma ----------
function clearMissing(fm) {
  fm.querySelectorAll(".missing").forEach(el => { el.classList.remove("missing"); if (el.dataset.ph !== undefined) { el.placeholder = el.dataset.ph; delete el.dataset.ph; } });
}
$("#facForm").addEventListener("input", e => { const el = e.target; if (el.classList.contains("missing") && el.value && el.value !== "Bilinmiyor") { el.classList.remove("missing"); if (el.dataset.ph !== undefined) { el.placeholder = el.dataset.ph; delete el.dataset.ph; } } });
$("#facForm").addEventListener("reset", e => clearMissing(e.target));
async function callExtract(payload, token) {
  const r = await fetch("/.netlify/functions/extract", { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify(payload) });
  let d = null; try { d = await r.json(); } catch (e) {}
  if (!r.ok || !d) throw new Error((d && d.error) || (r.status === 404 ? "Otomatik doldurma sunucuda kurulu değil." : "Sunucu hatası (" + r.status + ")."));
  return d;
}
$("#autofillBtn").addEventListener("click", async () => {
  const fm = $("#facForm"), hint = $("#autofillHint"), btn = $("#autofillBtn"), url = fm.url.value.trim();
  if (!/^https?:\/\//.test(url)) { hint.innerHTML = '<span style="color:var(--red)">Önce http(s) ile başlayan bir link yapıştırın.</span>'; return; }
  if (Store.mode === "demo") { hint.innerHTML = '<span style="color:var(--red)">Demo modunda otomatik doldurma çalışmaz.</span>'; return; }
  const token = await Store.accessToken();
  if (!token) { hint.innerHTML = '<span style="color:var(--red)">Bu özellik için giriş yapın.</span>'; return; }
  btn.disabled = true;
  try {
    hint.textContent = "1/2 Sayfa okunuyor…";
    const { text } = await callExtract({ url }, token);
    hint.textContent = "2/2 Bilgiler çıkarılıyor…";
    const { listing: L } = await callExtract({ url, text }, token);
    const LABELS = { name: "Tesis adı", address: "Adres", gender: "Kimler kalıyor", occupants: "Evde kaç kişi", price: "Fiyat", bills: "Faturalar", kitchen: "Mutfak", bathroom: "Banyo", contractWeeks: "Sözleşme süresi", moveIn: "Giriş–çıkış tarihleri", deposit: "Depozito", minStay: "Kalış koşulları" };
    const missing = [];
    clearMissing(fm);
    const set = (n, v) => {
      const el = fm.elements[n]; if (!el) return;
      const empty = v === undefined || v === null || v === "" || v === "Bilinmiyor";
      if (n === "occupants" && L.type !== "Ev") return;           // ev değilse kişi sayısı aranmaz
      if (empty) {
        if (LABELS[n]) missing.push(LABELS[n]);
        el.classList.add("missing");
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") { el.value = ""; el.dataset.ph = el.placeholder; el.placeholder = "Bulunamadı — elle girin"; }
        if (v === "Bilinmiyor") el.value = v;
        return;
      }
      el.value = v;
    };
    set("name", L.name); set("address", L.address); set("type", L.type); set("gender", L.gender);
    set("occupants", L.occupants); set("unit", L.unit); set("price", L.price); set("bills", L.bills);
    set("kitchen", L.kitchen); set("bathroom", L.bathroom); set("stay6", L.stay6); set("contractWeeks", L.contractWeeks);
    set("moveIn", L.moveIn); set("deposit", L.deposit); set("minStay", L.minStay); set("notes", L.notes);
    if (L.gender === "") fm.elements.gender.value = "";
    hint.innerHTML = '<span style="color:var(--green)">✓ Bulunan bilgiler dolduruldu — lütfen kontrol edip Kaydet deyin.</span>'
      + (missing.length ? '<br><span style="color:var(--red)">Bulunamadı: ' + esc(missing.join(", ")) + ' (kırmızı çerçeveli alanları elle doldurun)</span>' : "")
      + (L.warnings ? '<br><span style="color:var(--amber)">Not: ' + esc(L.warnings) + '</span>' : "");
  } catch (e) {
    hint.innerHTML = '<span style="color:var(--red)">' + esc(e.message || e) + '</span>';
  }
  btn.disabled = false;
});

$("#facSave").addEventListener("click", async () => {
  const fm = $("#facForm"), d = Object.fromEntries(new FormData(fm).entries()), err = $("#facErr"); err.textContent = "";
  if (!d.name.trim() || !d.address.trim() || !(+d.price > 0)) { err.textContent = "Ad, adres ve fiyat zorunlu."; return; }
  if (d.url && !/^https?:\/\//.test(d.url)) { err.textContent = "Kaynak linki http(s) ile başlamalı."; return; }
  $("#facSave").disabled = true;
  try {
    const co = await locate(d.coords, d.address, $("#geoHint"));
    const f = { name: d.name.trim(), address: d.address.trim(), type: d.type, gender: d.gender || null, occupants: d.type === "Ev" && +d.occupants ? +d.occupants : null, unit: d.unit, price: +(+d.price).toFixed(2),
      bills: d.bills || null, kitchen: d.kitchen, bathroom: d.bathroom, minStay: d.minStay.trim(), stay6: d.stay6, contractWeeks: +d.contractWeeks || null, moveIn: d.moveIn.trim() || null, deposit: d.deposit !== "" ? +d.deposit : null, notes: d.notes.trim(), url: d.url.trim(), lat: co ? co[0] : null, lng: co ? co[1] : null };
    await Store.addFacility(f); fm.reset(); $("#facModal").classList.remove("open");
    toast(co ? "Tesis eklendi." : "Tesis eklendi, ancak konumu bulunamadı — ulaşım süresi hesaplanamayacak.");
  } catch (e) { err.textContent = e.message && !e.code ? e.message : "Kaydedilemedi: " + (e.message || e); }
  $("#geoHint").textContent = "Konum adresten otomatik bulunur. Bulunamazsa aşağıya koordinat girin.";
  $("#facSave").disabled = false;
});
$("#courseSave").addEventListener("click", async () => {
  const fm = $("#courseForm"), d = Object.fromEntries(new FormData(fm).entries()), err = $("#courseErr"); err.textContent = "";
  if (!d.name.trim() || !d.address.trim()) { err.textContent = "Ad ve adres zorunlu."; return; }
  $("#courseSave").disabled = true;
  try {
    const co = await locate(d.coords, d.address);
    if (!co) throw new Error(G.enabled ? "Adres bulunamadı; koordinat girin." : "Koordinat girin (demo modunda adres aranamaz).");
    ui.courseId = await Store.addCourse({ name: d.name.trim(), address: d.address.trim(), lat: co[0], lng: co[1] });
    fm.reset(); $("#courseModal").classList.remove("open"); toast("Kurs eklendi."); render();
  } catch (e) { err.textContent = e.message || String(e); }
  $("#courseSave").disabled = false;
});

// ---------- Başlat ----------
G.onError = msg => { setStatus(msg + " Tahmini değerler gösteriliyor."); estCache.clear(); render(); };
Store.onChange(scheduleRender);
$("#demoBar").hidden = Store.mode !== "demo";
syncUnit(); renderNote(); render();
if (G.enabled) G.load();
// Ziyaret sayacı (IP saklanmaz; bkz. supabase/04_ziyaret_sayaci.sql)
(() => { let ref = ""; try { const u = new URL(document.referrer); if (u.host !== location.host) ref = u.host; } catch (e) {}
  setTimeout(() => Store.logVisit && Store.logVisit(location.pathname + location.hash, ref), 1500); })();
Store.init().catch(e => { console.error(e); setStatus("Veriler yüklenemedi: " + (e.message || e) + " — config.js ve Supabase kurulumunu kontrol edin."); });
})();
