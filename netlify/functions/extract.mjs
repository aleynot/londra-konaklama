// Netlify Function: bir konaklama sayfasının linkinden bilgileri çıkarır.
// Netlify'ın 10 saniyelik süre sınırı nedeniyle iki adımda çalışır:
//   1) POST { url }              → sayfayı indirir, metne çevirir      → { text }
//   2) POST { url, text }        → metni Gemini'ye gönderir, alanları çıkarır → { listing }
// Her iki adımda da Authorization: Bearer <Supabase oturum token'ı> gerekir.
// Gerekli ortam değişkenleri (Netlify → Project configuration → Environment variables):
//   GEMINI_API_KEY      (gizli)  — aistudio.google.com/apikey (ücretsiz katman)
//   SUPABASE_URL                 — https://xxxx.supabase.co
//   SUPABASE_ANON_KEY            — publishable / anon anahtar
//   GEMINI_MODEL        (isteğe bağlı; varsayılan gemini-3.5-flash-lite)

// Supabase adresi ve publishable anahtar zaten herkese açık (config.js); ortam değişkeni yoksa bunlar kullanılır.
const SUPABASE_URL = process.env.SUPABASE_URL || "https://xmdqqdfeqnrsjeeazdxl.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_3Oc6bKI40_7vOGh_1LTONw_-pJhjTR5";
const MAX_HTML = 2_000_000;   // indirilecek en fazla sayfa boyutu
const MAX_TEXT = 24_000;      // modele gönderilecek en fazla metin

const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json; charset=utf-8" }
});

function isBlockedHost(host) {
  host = host.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return true;          // IP adresleriyle doğrudan istek yok
  if (host.includes(":") || host.startsWith("[")) return true;   // IPv6
  return false;
}

async function verifyUser(req) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const r = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: { Authorization: "Bearer " + token, apikey: SUPABASE_ANON_KEY }
  });
  if (!r.ok) return null;
  return r.json();
}

function htmlToText(html) {
  const keep = [];
  // Yapısal veriler (JSON-LD, Next.js/Nuxt verisi) çoğu zaman fiyat ve adresi içerir
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) keep.push("JSON-LD: " + m[1].trim().slice(0, 8000));
  const next = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (next) keep.push("PAGE DATA: " + next[1].slice(0, 15000));
  const metas = [...html.matchAll(/<meta[^>]+(?:property|name)=["']([^"']+)["'][^>]+content=["']([^"']*)["']/gi)]
    .filter(m => /title|description|address|price|locality|postal/i.test(m[1])).map(m => `${m[1]}: ${m[2]}`);
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "";
  let body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr|\/td|\/th)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&pound;/g, "£").replace(/&#163;/g, "£")
    .replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/&[a-z]+;/g, " ")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  return [`TITLE: ${title.trim()}`, ...metas, ...keep, "TEXT:\n" + body].join("\n").slice(0, MAX_TEXT);
}

// Çıkarılacak alanlar (modele açıklama olarak verilir, dönen veri sunucuda doğrulanır)
const FIELDS = `{
  "name": "Tesisin adı (metin)",
  "address": "Sokak, posta kodu, London; bilinmiyorsa \"\"",
  "type": "Rezidans | Hostel / Vakıf yurdu | Ev | Aile yanı",
  "gender": "Karma | Sadece kadın | Sadece erkek | \"\" (belirtilmemişse)",
  "occupants": "Ev ise evdeki toplam kişi/oda sayısı (tam sayı) ya da null",
  "price": "En uygun oda/seçeneğin fiyatı (sayı, £) ya da null",
  "unit": "w (haftalık) | m (aylık)",
  "bills": "yes | no | \"\" (faturalar dahil mi)",
  "kitchen": "Ortak | Özel | Yemekli | Bilinmiyor",
  "bathroom": "Ortak | Özel | Yarı özel | Bilinmiyor",
  "stay6": "ok (6 ay ya da daha kısa kiralama açıkça mümkün) | no (yalnızca 6 aydan uzun sözleşmeler) | ask (belirsiz)",
  "contractWeeks": "Fiyatın ait olduğu sözleşme süresi, hafta (tam sayı) ya da null",
  "moveIn": "Giriş–çıkış tarihleri, ör. 12 Eyl 2026 – 17 Tem 2027; yoksa \"\"",
  "deposit": "Depozito £ (sayı) ya da null",
  "minStay": "Kalış/sözleşme koşullarının Türkçe kısa özeti",
  "notes": "Türkçe: diğer oda tipleri ve fiyatları, önemli koşullar, uygunluk kısıtları (en fazla 600 karakter)",
  "warnings": "Türkçe: sayfada bulunamayan veya emin olunamayan bilgiler"
}`;
const ENUMS = {
  type: ["Rezidans", "Hostel / Vakıf yurdu", "Ev", "Aile yanı"],
  gender: ["Karma", "Sadece kadın", "Sadece erkek", ""],
  unit: ["w", "m"], bills: ["yes", "no", ""],
  kitchen: ["Ortak", "Özel", "Yemekli", "Bilinmiyor"],
  bathroom: ["Ortak", "Özel", "Yarı özel", "Bilinmiyor"],
  stay6: ["ok", "ask", "no"]
};
const DEFAULTS = { type: "Rezidans", gender: "", unit: "w", bills: "", kitchen: "Bilinmiyor", bathroom: "Bilinmiyor", stay6: "ask" };
function clean(o) {
  const out = {};
  const str = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  const num = (v, min, max, int) => { const x = typeof v === "string" ? parseFloat(v.replace(/[^0-9.]/g, "")) : v; return typeof x === "number" && isFinite(x) && x >= min && x <= max ? (int ? Math.round(x) : Math.round(x * 100) / 100) : null; };
  out.name = str(o.name, 120); out.address = str(o.address, 200);
  for (const k of Object.keys(ENUMS)) out[k] = ENUMS[k].includes(o[k]) ? o[k] : DEFAULTS[k];
  out.occupants = num(o.occupants, 1, 30, true); out.price = num(o.price, 1, 19999, false);
  out.contractWeeks = num(o.contractWeeks, 1, 60, true); out.deposit = num(o.deposit, 0, 19999, false);
  out.moveIn = str(o.moveIn, 80); out.minStay = str(o.minStay, 200); out.notes = str(o.notes, 1000); out.warnings = str(o.warnings, 400);
  return out;
}
// Ücretsiz katmanda denenecek modeller (ilk çalışan kullanılır). GEMINI_MODEL ile değiştirilebilir.
const MODELS = [process.env.GEMINI_MODEL, "gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.8-flash", "gemini-flash-latest"].filter(Boolean);

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Yalnızca POST" });
  for (const k of ["GEMINI_API_KEY"])
    if (!process.env[k]) return json(500, { error: `Sunucu ayarı eksik: ${k} (Netlify ortam değişkenleri)` });

  const user = await verifyUser(req).catch(() => null);
  if (!user || !user.id) return json(401, { error: "Bu özellik için giriş yapın." });

  let url, body;
  try { body = await req.json(); url = new URL(body.url); } catch { return json(400, { error: "Geçerli bir link girin." }); }
  if (!/^https?:$/.test(url.protocol) || isBlockedHost(url.hostname)) return json(400, { error: "Bu link kullanılamaz." });

  // ---- 2. adım: metinden bilgi çıkar
  if (typeof body.text === "string") return extract(url, body.text.slice(0, MAX_TEXT));

  // ---- 1. adım: sayfayı indir
  let html;
  try {
    const r = await fetch(url, {
      redirect: "follow", signal: AbortSignal.timeout(7500),
      headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36", "accept-language": "en-GB,en;q=0.9" }
    });
    if (!r.ok) return json(502, { error: `Sayfa açılamadı (HTTP ${r.status}). Site otomatik okumayı engelliyor olabilir; bilgileri elle girin.` });
    const ct = r.headers.get("content-type") || "";
    if (!ct.includes("html")) return json(400, { error: "Bu link bir web sayfası değil." });
    html = (await r.text()).slice(0, MAX_HTML);
  } catch (e) {
    return json(502, { error: "Sayfa zamanında açılamadı. Bilgileri elle girin." });
  }

  const text = htmlToText(html);
  if (text.length < 200) return json(422, { error: "Sayfada okunabilir içerik bulunamadı (içerik JavaScript ile yükleniyor olabilir)." });
  return json(200, { text });
};

async function extract(url, text) {
  const prompt = `Aşağıda Londra'daki bir öğrenci konaklama ilanının sayfa metni var (kaynak: ${url.href}). Bugünün tarihi ${new Date().toISOString().slice(0, 10)}.
Kullanıcı Londra'da yaklaşık 6 ay kalacak bir dil okulu öğrencisi.
Yalnızca şu alanlara sahip TEK bir JSON nesnesi döndür (başka metin yazma):
${FIELDS}
Kurallar:
- Yalnızca sayfada yazanları kullan; tahmin etme. Bulamadığın alanları "" / null / "Bilinmiyor" bırak ve warnings'e yaz.
- price: en uygun seçeneğin fiyatı; hangi süreye ait olduğunu contractWeeks ve moveIn'e yaz.
- En-suite = özel banyo; stüdyo = özel mutfak + özel banyo; "shared kitchen" = Ortak; yemek dahil ise Yemekli.
- minStay, notes ve warnings Türkçe olsun.

SAYFA:
${text}`;

  const started = Date.now();
  let lastErr = "Yapay zekâ servisi yanıt vermedi.";
  for (const model of MODELS) {
    const left = 9300 - (Date.now() - started);
    if (left < 2500) break;
    let r;
    try {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.1, maxOutputTokens: 1500 }
        }),
        signal: AbortSignal.timeout(left)
      });
    } catch (e) { return json(504, { error: "Yapay zekâ zamanında yanıt vermedi; tekrar deneyin." }); }
    if (r.status === 404) { lastErr = "Model bulunamadı: " + model; continue; }   // sıradaki modeli dene
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      console.error("Gemini hata", model, r.status, t.slice(0, 500));
      if (r.status === 429) return json(429, { error: "Ücretsiz günlük/dakikalık kullanım sınırı doldu; biraz sonra tekrar deneyin." });
      if (r.status === 400 && /API key/i.test(t)) return json(502, { error: "Gemini API anahtarı geçersiz." });
      if (r.status === 403) return json(502, { error: "Gemini API anahtarının yetkisi yok (anahtarı ve projeyi kontrol edin)." });
      return json(502, { error: "Yapay zekâ servisi hata verdi (" + r.status + ")." });
    }
    const data = await r.json().catch(() => null);
    const raw = data && data.candidates && data.candidates[0] && data.candidates[0].content && (data.candidates[0].content.parts || []).map(p => p.text || "").join("");
    if (!raw) return json(502, { error: "Bilgiler çıkarılamadı (boş yanıt)." });
    let obj;
    try { obj = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { return json(502, { error: "Yapay zekâ yanıtı okunamadı; tekrar deneyin." }); }
    if (Array.isArray(obj)) obj = obj[0] || {};
    return json(200, { listing: clean(obj), url: url.href, model });
  }
  return json(502, { error: lastErr });
}
