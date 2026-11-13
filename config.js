// ============================================================
// AYARLAR — README'deki adımları izleyerek doldurun.
// Boş bırakılırsa site "demo modu"nda çalışır: veriler yalnızca
// sizin tarayıcınızda tutulur ve ulaşım bilgileri tahminidir.
// ============================================================
window.APP_CONFIG = {
  // Supabase → Project Settings → API (Data API)
  supabaseUrl: "https://xmdqqdfeqnrsjeeazdxl.supabase.co",        // ör. "https://abcdefgh.supabase.co"
  supabaseAnonKey: "sb_publishable_3Oc6bKI40_7vOGh_1LTONw_-pJhjTR5",    // "anon public" (ya da "publishable") anahtar

  // Google Cloud → APIs & Services → Credentials → API key
  // (Maps JavaScript API + Routes API + Geocoding API açık olmalı,
  //  anahtar sitenizin adresiyle sınırlandırılmalı)
  googleMapsApiKey: "AIzaSyD04VATbJXACmKIz0AJu3Befh-3rFMAs2Y",

  // Harita kimliği. Google Cloud'da kendi Map ID'nizi oluşturduysanız yazın;
  // yoksa Google'ın deneme kimliği kullanılır.
  googleMapId: "DEMO_MAP_ID",

  // Google rotası kaç gün sonra yenilensin
  routeCacheDays: 30,

  // Google ile giriş düğmesi gösterilsin mi (Supabase'de Google sağlayıcısını
  // açtıysanız true yapın)
  enableGoogleLogin: false
};
