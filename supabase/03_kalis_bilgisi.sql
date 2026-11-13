-- ============================================================
-- 03: 6 aylık kalış bilgisi (Kasım 2026)
-- Mevcut veritabanına yeni alanları ekler ve başlangıç tesislerini sınıflandırır.
-- SQL Editor'da bir kez çalıştırın; tekrar çalıştırmak da güvenlidir.
-- ============================================================
alter table public.facilities add column if not exists stay6 text not null default 'ask';
alter table public.facilities add column if not exists contract_weeks int;
alter table public.facilities add column if not exists move_in text;
alter table public.facilities add column if not exists deposit numeric(10,2);
alter table public.facilities drop constraint if exists facilities_stay6_check;
alter table public.facilities add constraint facilities_stay6_check check (stay6 in ('ok','ask','no'));
alter table public.facilities drop constraint if exists facilities_contract_weeks_check;
alter table public.facilities add constraint facilities_contract_weeks_check check (contract_weeks is null or contract_weeks between 1 and 60);
alter table public.facilities drop constraint if exists facilities_move_in_check;
alter table public.facilities add constraint facilities_move_in_check check (move_in is null or char_length(move_in) <= 80);
alter table public.facilities drop constraint if exists facilities_deposit_check;
alter table public.facilities add constraint facilities_deposit_check check (deposit is null or (deposit >= 0 and deposit < 20000));

update public.facilities set stay6='ask', contract_weeks=null, move_in=null, deposit=null where id='ish-gps';
update public.facilities set stay6='ok', contract_weeks=null, move_in=null, deposit=null where id='lee-abbey';
update public.facilities set stay6='ask', contract_weeks=null, move_in='Güz 30 Ağu–19 Ara 2026 · Bahar 3 Oca–20 Mar 2027 · Yaz 4 Nis–10 Tem 2027', deposit=null where id='queen-alexandras';
update public.facilities set stay6='ask', contract_weeks=39, move_in='14 Eyl 2026 – 14 Haz 2027', deposit=null where id='netherhall';
update public.facilities set stay6='ask', contract_weeks=50, move_in='19 Eyl 2026 – 4 Eyl 2027', deposit=null where id='goldsmiths-house';
update public.facilities set stay6='ok', contract_weeks=null, move_in=null, deposit=null where id='lha-belsize';
update public.facilities set stay6='ask', contract_weeks=51, move_in=null, deposit=null where id='urbanest-wb';
update public.facilities set stay6='ask', contract_weeks=null, move_in=null, deposit=null where id='manna-ash';
update public.facilities set stay6='ask', contract_weeks=null, move_in=null, deposit=null where id='coopers-court';
update public.facilities set stay6='ask', contract_weeks=null, move_in=null, deposit=null where id='dinwiddy';
update public.facilities set stay6='ok', contract_weeks=null, move_in=null, deposit=null where id='sterling-court';
update public.facilities set stay6='ask', contract_weeks=44, move_in='12 Eyl 2026 – 17 Tem 2027', deposit=250, min_stay='£230''lık Silver En-suite yalnızca 44 haftalık (12 Eyl 2026 – 17 Tem 2027) akademik yıl sözleşmesi için. Dönem ortası/6 aylık giriş için TUEV''e veya GoBritanya''ya (esnek kalış, £280''den) sorun.', notes='TUEV teklifi (haftalık): En-suite oda (karma) £230 · Silver Studio £300 · Silver Deluxe Studio £325 · Gold Studio (yenilenmemiş) £380 · Platinum Studio (yenilenmemiş, çift kişilik yatak) £385 — bu fiyatlar akademik yıl sözleşmelerine ait (40–51 hafta). En-suite odada mutfak ve oturma alanı ortak; stüdyolarda mutfak ve banyo odaya özel. Oxford International Greenwich''e yürüme mesafesinde.' where id='mcmillan';
update public.facilities set stay6='ok', contract_weeks=null, move_in=null, deposit=null where id='ealing-res';
update public.facilities set stay6='ok', contract_weeks=null, move_in=null, deposit=null where id='lewisham-res';
update public.facilities set stay6='ok', contract_weeks=null, move_in=null, deposit=null where id='highbury-res';
update public.facilities set stay6='ok', contract_weeks=null, move_in=null, deposit=null where id='kent-house-share';
update public.facilities set stay6='ask', contract_weeks=null, move_in=null, deposit=null where id='wood-green-hall';
update public.facilities set stay6='ask', contract_weeks=null, move_in=null, deposit=null where id='homestay-tuev';

notify pgrst, 'reload schema';
