// Netlify Function: bir konaklama sayfasının linkinden bilgileri çıkarır.
// Netlify'ın 10 saniyelik süre sınırı nedeniyle iki adımda çalışır:
//   1) POST { url }              → sayfayı indirir, metne çevirir      → { text }
//   2) POST { url, text }        → metni Claude'a gönderir, alanları çıkarır → { listing }
// Her iki adımda da Authorization: Bearer <Supabase oturum token'ı> gerekir.
// Gerekli ortam değişkenleri (Netlify → Project configuration → Environment variables):
//   ANTHROPIC_API_KEY   (gizli)  — console.anthropic.com
//   SUPABASE_URL                 — https://xxxx.supabase.co
//   SUPABASE_ANON_KEY            — publishable / anon anahtar
//   ANTHROPIC_MODEL     (isteğe bağlı, varsayılan claude-haiku-5-5)

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
  const r = await fetch(process.env.SUPABASE_URL + "/auth/v1/user", {
    headers: { Authorization: "Bearer " + token, apikey: process.env.SUPABASE_ANON_KEY }
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

const TOOL = {
  name: "save_listing",
  description: "Londra'daki öğrenci konaklama ilanından çıkarılan bilgileri kaydeder.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Tesisin adı" },
      address: { type: "string", description: "Sokak, posta kodu, London. Bilinmiyorsa boş." },
      type: { type: "string", enum: ["Rezidans", "Hostel / Vakıf yurdu", "Ev", "Aile yanı"] },
      gender: { type: "string", enum: ["Karma", "Sadece kadın", "Sadece erkek", ""], description: "Belirtilmemişse boş" },
      occupants: { type: ["integer", "null"], description: "Ev ise evde kalan toplam kişi/oda sayısı" },
      price: { type: ["number", "null"], description: "En uygun oda/seçeneğin fiyatı (sayı, £)" },
      unit: { type: "string", enum: ["w", "m"], description: "w = haftalık, m = aylık" },
      bills: { type: "string", enum: ["yes", "no", ""], description: "Faturalar dahil mi" },
      kitchen: { type: "string", enum: ["Ortak", "Özel", "Yemekli", "Bilinmiyor"] },
      bathroom: { type: "string", enum: ["Ortak", "Özel", "Yarı özel", "Bilinmiyor"] },
      stay6: { type: "string", enum: ["ok", "ask", "no"], description: "ok: 6 ay (≈26 hafta) veya daha kısa kiralama açıkça mümkün; no: yalnızca 6 aydan uzun sözleşmeler; ask: belirsiz" },
      contractWeeks: { type: ["integer", "null"], description: "Fiyatın ait olduğu sözleşme süresi (hafta)" },
      moveIn: { type: "string", description: "Giriş–çıkış tarihleri, ör. '12 Eyl 2026 – 17 Tem 2027'; yoksa boş" },
      deposit: { type: ["number", "null"], description: "Depozito (£)" },
      minStay: { type: "string", description: "Kalış/sözleşme koşullarının Türkçe kısa özeti" },
      notes: { type: "string", description: "Türkçe: diğer oda tipleri ve fiyatları, önemli koşullar, uygunluk kısıtları. En fazla 600 karakter." },
      warnings: { type: "string", description: "Türkçe: sayfada bulunamayan veya emin olunamayan bilgiler" }
    },
    required: ["name", "type", "unit", "kitchen", "bathroom", "stay6", "notes"]
  }
};

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Yalnızca POST" });
  for (const k of ["ANTHROPIC_API_KEY", "SUPABASE_URL", "SUPABASE_ANON_KEY"])
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
Kullanıcı Londra'da yaklaşık 6 ay kalacak bir dil okulu öğrencisi. Bilgileri save_listing aracıyla kaydet.
Kurallar:
- Yalnızca sayfada yazanları kullan; tahmin etme. Bulamadığın alanları boş/null/"Bilinmiyor" bırak ve warnings'e yaz.
- price: en uygun seçeneğin fiyatı. Hangi süreye ait olduğunu contractWeeks ve moveIn'e yaz.
- En-suite = özel banyo; stüdyo = özel mutfak + özel banyo; "shared kitchen" = Ortak; yemek dahil ise Yemekli.
- notes ve minStay Türkçe olsun.

SAYFA:
${text}`;

  const ar = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
      max_tokens: 1200,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "save_listing" },
      messages: [{ role: "user", content: prompt }]
    }),
    signal: AbortSignal.timeout(9500)
  }).catch(() => null);
  if (!ar) return json(504, { error: "Yapay zekâ servisi zamanında yanıt vermedi." });
  if (!ar.ok) {
    const t = await ar.text().catch(() => "");
    console.error("Anthropic hata", ar.status, t.slice(0, 500));
    return json(502, { error: ar.status === 401 ? "Anthropic API anahtarı geçersiz." : ar.status === 429 ? "Yapay zekâ kullanım sınırına ulaşıldı, biraz sonra deneyin." : "Yapay zekâ servisi hata verdi (" + ar.status + ")." });
  }
  const data = await ar.json();
  const tool = (data.content || []).find(c => c.type === "tool_use");
  if (!tool) return json(502, { error: "Bilgiler çıkarılamadı." });
  return json(200, { listing: tool.input, url: url.href });
}
