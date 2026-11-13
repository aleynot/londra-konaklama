-- ============================================================
-- 04: Ziyaret sayacı (tekil ziyaretçi, görüntüleme, ülke, cihaz)
-- SQL Editor'da bir kez çalıştırın; tekrar çalıştırmak güvenlidir.
--
-- Gizlilik: IP adresi hiçbir yerde saklanmaz. Her IP, her gün yeniden
-- üretilen gizli bir "tuz" ile SHA-256 kodlanır; eski tuzlar silinir.
-- Böylece aynı gün aynı IP'den gelenler tek kişi sayılır, ama koddan
-- IP geri bulunamaz ve kişiler günler arasında izlenemez.
-- ============================================================

create table if not exists public.visits (
  id bigserial primary key,
  day date not null default (now() at time zone 'Europe/London')::date,
  visitor text not null,                 -- günlük IP kodu (geri çevrilemez)
  path text check (char_length(path) <= 200),
  referrer text check (char_length(referrer) <= 200),
  country text check (char_length(country) <= 8),
  device text check (device in ('mobil','masaüstü')),
  created_at timestamptz not null default now()
);
create index if not exists visits_day_idx on public.visits (day);
create index if not exists visits_day_visitor_idx on public.visits (day, visitor);

create table if not exists public.visit_salts (
  day date primary key,
  salt text not null
);

alter table public.visits enable row level security;
alter table public.visit_salts enable row level security;
-- Ziyaret kayıtlarını sitede yalnızca yöneticiler okuyabilir; tuzları kimse okuyamaz.
drop policy if exists "admins read visits" on public.visits;
create policy "admins read visits" on public.visits for select to authenticated using (public.is_admin());
revoke all on public.visit_salts from anon, authenticated;
revoke insert, update, delete on public.visits from anon, authenticated;
grant select on public.visits to authenticated;

create or replace function public.log_visit(p_path text default null, p_referrer text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  h json := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  ip text := coalesce(h->>'cf-connecting-ip', split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1), h->>'x-real-ip', '');
  ua text := coalesce(h->>'user-agent', '');
  d date := (now() at time zone 'Europe/London')::date;
  s text;
  v text;
begin
  if ip = '' or ua ~* '(bot|crawl|spider|preview|headless|monitor|curl|wget|python)' then return; end if;
  -- günün tuzu (yoksa oluştur), 2 günden eski tuzları sil
  insert into visit_salts(day, salt) values (d, md5(random()::text || clock_timestamp()::text || random()::text))
    on conflict (day) do nothing;
  delete from visit_salts where day < d - 1;
  select salt into s from visit_salts where day = d;
  v := encode(sha256(convert_to(s || '|' || trim(ip), 'UTF8')), 'hex');
  -- kötüye kullanım sınırı: aynı ziyaretçiden günde en fazla 300 kayıt
  if (select count(*) from visits where day = d and visitor = v) >= 300 then return; end if;
  insert into visits(day, visitor, path, referrer, country, device)
  values (d, v, left(p_path, 200), nullif(left(p_referrer, 200), ''),
          nullif(left(coalesce(h->>'cf-ipcountry', h->>'x-country', ''), 8), ''),
          case when ua ~* '(mobi|android|iphone|ipad)' then 'mobil' else 'masaüstü' end);
end; $$;

revoke all on function public.log_visit(text, text) from public;
grant execute on function public.log_visit(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
