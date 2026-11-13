-- ============================================================
-- Ziyaret raporları — SQL Editor'da istediğiniz sorguyu seçip çalıştırın
-- (bir sorgunun tamamını seçip Run / Cmd+Enter)
-- ============================================================

-- 1) Son 30 gün: günlük tekil ziyaretçi ve görüntüleme
select day as gun,
       count(distinct visitor) as tekil_ziyaretci,
       count(*) as goruntuleme
from visits
where day > current_date - 30
group by day
order by day desc;

-- 2) Genel özet
select count(*) as toplam_goruntuleme,
       count(distinct (day, visitor)) as toplam_gunluk_tekil_ziyaret,
       min(day) as ilk_kayit,
       max(day) as son_kayit
from visits;

-- 3) Bugün kaç farklı kişi girdi?
select count(distinct visitor) as bugun_tekil, count(*) as bugun_goruntuleme
from visits
where day = (now() at time zone 'Europe/London')::date;

-- 4) Ülkelere göre (son 30 gün)
select coalesce(country, 'bilinmiyor') as ulke,
       count(distinct (day, visitor)) as tekil_ziyaret,
       count(*) as goruntuleme
from visits
where day > current_date - 30
group by 1
order by 2 desc;

-- 5) Cihaz türüne göre (son 30 gün)
select device as cihaz, count(distinct (day, visitor)) as tekil_ziyaret, count(*) as goruntuleme
from visits
where day > current_date - 30
group by 1
order by 2 desc;

-- 6) Ziyaretçiler nereden geliyor (son 30 gün)
select coalesce(referrer, 'doğrudan / bilinmiyor') as kaynak,
       count(distinct (day, visitor)) as tekil_ziyaret
from visits
where day > current_date - 30
group by 1
order by 2 desc;
