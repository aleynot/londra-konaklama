# Londra Öğrenci Konaklama Rehberi

Londra'da 6 aylık öğrenci konaklamalarını karşılaştıran site: kimlerin kaldığı, haftalık/aylık £ ücret, mutfak ve banyo düzeni, seçilen dil okuluna Google Haritalar'dan toplu taşıma süresi, aktarma ve ücret. Kullanıcılar giriş yapıp tesis ve kurs ekleyebilir, favorileyebilir.

**Canlı site:** https://londra-konaklama.netlify.app

**Teknoloji:** Sade HTML/CSS/JS (derleme yok) · Supabase (veritabanı + e-postayla giriş) · Google Maps Platform (Routes, Geocoding, Maps JS) · Netlify (yayın)

## Güncelleme akışı
Bu depo Netlify'a bağlıdır: `main` dalına yapılan her değişiklik birkaç saniye içinde siteye yansır. Dosyaları GitHub'da düzenleyip **Commit changes** demeniz yeterli.

`config.js` içindeki anahtarlar herkese açık olacak şekilde tasarlanmıştır: Supabase *publishable* anahtarı veritabanı güvenlik kurallarıyla (RLS), Google anahtarı ise site adresi kısıtlamasıyla korunur. **Supabase `secret` / `service_role` anahtarını asla bu depoya koymayın.**

---

## Sıfırdan kurulum

Bu klasör, herkese açık çalışan bağımsız bir web sitesidir. Üç ücretsiz hizmetle yayına alınır:

| Hizmet | Ne işe yarar | Ücret |
|---|---|---|
| **Supabase** | Veritabanı ve kullanıcı girişi (tesisler, kurslar, favoriler) | Ücretsiz plan yeterli |
| **Google Maps Platform** | Gerçek toplu taşıma rotası, süre, aktarma, ücret; adres → konum; harita | Aylık ücretsiz kullanım kotası var; kredi kartı tanımlamak gerekir |
| **Netlify** | Siteyi internette yayınlar | Ücretsiz |

> Hiçbir ayar yapmadan da `index.html` dosyasına çift tıklayarak siteyi **demo modunda** görebilirsiniz. Demo modunda veriler yalnızca o tarayıcıda tutulur ve ulaşım bilgileri tahminidir.

Toplam kurulum süresi yaklaşık 30–45 dakikadır. Adımları sırayla izleyin.

---

## Klasör içeriği

```
index.html            Sayfa
styles.css            Görünüm
config.js             ← SİZİN DOLDURACAĞINIZ AYARLAR
js/app.js             Arayüz mantığı
js/store.js           Supabase / demo veri katmanı
js/google.js          Google rota, adres arama ve harita
js/estimator.js       Google kullanılamazsa yedek tahmin motoru
js/demo-seed.js       Demo modu verisi
supabase/01_schema.sql  Veritabanı tabloları ve güvenlik kuralları
supabase/02_seed.sql    Başlangıç verisi (7 kurs + 18 tesis, TUEV teklifleri dahil)
```

---

## 1. Siteyi Netlify'da yayına alın (önce adres lazım)

1. https://app.netlify.com/signup adresinden ücretsiz hesap açın.
2. https://app.netlify.com/drop sayfasını açın ve **bu klasörün tamamını** sayfaya sürükleyin.
3. Birkaç saniye sonra `https://rastgele-isim.netlify.app` gibi bir adres verilir. **Site configuration → Change site name** ile adı değiştirebilirsiniz, örneğin `londra-konaklama.netlify.app`.
4. Bu adresi not edin. Aşağıda **SİTE_ADRESİ** diye geçiyor.

Siteyi sonra güncellemek için: Netlify'da sitenizi açın, **Deploys** sekmesine gidin ve klasörü yeniden sürükleyin.

---

## 2. Supabase (veritabanı + giriş)

1. https://supabase.com adresinden hesap açın ve **New project** deyin.
   - Region olarak **West EU (London)** seçin.
   - Veritabanı şifresini bir yere kaydedin (siteye girilmeyecek).
2. Proje açılınca sol menüden **SQL Editor → New query** seçin.
   - `supabase/01_schema.sql` dosyasının **tamamını** yapıştırın ve **Run** deyin.
   - Yeni bir sorgu açın, `supabase/02_seed.sql` dosyasını yapıştırın ve **Run** deyin.
3. **Project Settings → API** (veya **Data API**) sayfasından iki değeri kopyalayın:
   - **Project URL** (`https://xxxx.supabase.co`)
   - **anon public** anahtarı (yeni projelerde adı **publishable key** olabilir)
4. `config.js` dosyasını bir metin düzenleyiciyle açın ve doldurun:
   ```js
   supabaseUrl: "https://xxxx.supabase.co",
   supabaseAnonKey: "eyJhbGciOi...",
   ```
   Bu anahtarın sitede görünmesi normaldir. Veritabanındaki güvenlik kuralları (RLS) kimin neyi yapabileceğini sınırlar.
5. **Authentication → URL Configuration**:
   - **Site URL**: `SİTE_ADRESİ` (ör. `https://londra-konaklama.netlify.app`)
   - **Redirect URLs**: `SİTE_ADRESİ/**` ekleyin.

### Giriş nasıl çalışıyor?
Kullanıcı e-postasını yazar ve gelen bağlantıya tıklayarak giriş yapar. Şifre yoktur. Giriş yapmadan herkes listeyi görebilir, ama **ekleme ve favori için giriş gerekir**. Bu sayede spam eklemeler engellenir.

> Supabase'in yerleşik e-posta gönderimi saatte birkaç e-postayla sınırlıdır. Çok kullanıcı bekliyorsanız **Authentication → Emails → SMTP Settings** bölümünden kendi e-posta servisinizi bağlayın (ör. Resend, Brevo; ücretsiz planları var).

### (İsteğe bağlı) Google ile giriş
Supabase'de **Authentication → Sign In / Providers → Google** bölümünü açın ve oradaki rehberi izleyin. Ardından `config.js` içinde `enableGoogleLogin: true` yapın.

### Kendinizi yönetici yapın
Önce sitede kendi e-postanızla bir kez giriş yapın. Ardından SQL Editor'da şunu çalıştırın (e-postayı değiştirin):
```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'sizin@epostaniz.com');
```
Yöneticiler herkesin eklediği tesisleri silebilir. Ayrıca sayfada **"Tüm rotaları Google'dan yeniden hesapla"** düğmesini görür.

---

## 3. Google Maps (gerçek rota, süre, aktarma, ücret)

1. https://console.cloud.google.com adresine gidin ve yeni bir proje oluşturun.
2. **Billing** bölümünden faturalandırmayı açın (kredi kartı). Google her ay belirli bir ücretsiz kullanım tanır. Bu site rotaları veritabanında 30 gün sakladığı için kullanım çok düşük kalır (16 tesis × 7 kurs ≈ 112 rota hesabı).
3. **APIs & Services → Library** bölümünden şu üç API'yi bulup **Enable** deyin:
   - **Maps JavaScript API**
   - **Routes API**
   - **Geocoding API**
4. **APIs & Services → Credentials → Create credentials → API key** ile anahtar oluşturun. Ardından anahtarı **kısıtlayın** (önemli):
   - **Application restrictions → Websites**: `SİTE_ADRESİ/*` ekleyin. Bilgisayarınızda denemek için `http://localhost/*` de ekleyebilirsiniz.
   - **API restrictions → Restrict key**: yukarıdaki üç API'yi seçin.
5. Anahtarı `config.js` içine yapıştırın:
   ```js
   googleMapsApiKey: "AIza...",
   ```
6. Güvenlik için **Billing → Budgets & alerts** bölümünden küçük bir bütçe uyarısı (ör. 10 $) kurun. İsterseniz **Quotas** sayfasından günlük istek sınırı da koyabilirsiniz.

`googleMapId` alanını `DEMO_MAP_ID` olarak bırakabilirsiniz. Kendi harita stilinizi isterseniz **Google Maps Platform → Map Management** bölümünden bir Map ID oluşturup yazın.

---

## 4. Güncellenmiş klasörü yeniden yükleyin

`config.js` dosyasını doldurduktan sonra klasörü Netlify'daki sitenizin **Deploys** sekmesine yeniden sürükleyin. Site artık:

- Tesisleri ve kursları Supabase'den okur. Başkasının eklediği tesis anında herkeste görünür.
- Süre, aktarma, hat ve ücreti **Google'dan** alır. Kartlarda yeşil "GOOGLE" etiketi görünür. Google yanıt verene kadar ya da hata olursa sarı "TAHMİNİ" etiketiyle yedek tahmin gösterir.
- Yeni tesis eklenirken adresi Google'da arayıp konumu kendisi bulur.
- Harita sekmesinde gerçek Google haritası gösterir.

---

## Sık karşılaşılan sorunlar

| Belirti | Çözüm |
|---|---|
| Üstte "Demo modu" yazıyor | `config.js` dosyasında Supabase URL'si ve anahtarı boş ya da hatalı. |
| "Veriler yüklenemedi" | SQL dosyaları çalıştırılmamış olabilir; 2. adıma dönün. |
| Giriş e-postası gelmiyor | Spam klasörüne bakın. Saatlik e-posta sınırına takılmış olabilirsiniz; SMTP bağlayın. |
| E-postadaki bağlantı yanlış adrese gidiyor | Supabase'de **Site URL** ve **Redirect URLs** ayarlarını kontrol edin. |
| Hep "TAHMİNİ" görünüyor | Routes API açık mı, anahtar kısıtlamasında site adresi doğru mu, faturalandırma açık mı? Tarayıcı konsoluna (F12) bakın. |
| "Google API anahtarı reddedildi" | Anahtarın **Websites** kısıtlamasına `SİTE_ADRESİ/*` eklenmemiş. |

## Kendi alan adınız
Netlify'da **Domain management → Add a domain** ile kendi alan adınızı (ör. `londrakonaklama.com`) bağlayabilirsiniz. Bağladıktan sonra yeni adresi Supabase **Redirect URLs** listesine ve Google anahtarının **Websites** kısıtlamasına da ekleyin.

## Veriyi güncellemek
`supabase/02_seed.sql` tekrar çalıştırılabilir: başlangıç kayıtlarını günceller, kullanıcıların eklediklerine dokunmaz. Şemayı (`01_schema.sql`) yeniden çalıştırmak da güvenlidir; yeni kurallar (ör. "Aile yanı" tipi) mevcut veritabanına uygulanır.
