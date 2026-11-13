-- ============================================================
-- Londra Öğrenci Konaklama Rehberi — Supabase şeması
-- Supabase panelinde: SQL Editor → New query → bu dosyanın tamamını
-- yapıştırıp "Run" deyin. Ardından 02_seed.sql dosyasını çalıştırın.
-- ============================================================

-- Kullanıcı profilleri (görünen ad + yönetici bayrağı)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Kurslar
create table if not exists public.courses (
  id text primary key default gen_random_uuid()::text,
  name text not null check (char_length(name) between 2 and 120),
  address text not null check (char_length(address) between 3 and 200),
  lat double precision check (lat between 51.2 and 51.8),
  lng double precision check (lng between -0.6 and 0.4),
  sort int not null default 100,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- Konaklama tesisleri
create table if not exists public.facilities (
  id text primary key default gen_random_uuid()::text,
  name text not null check (char_length(name) between 2 and 120),
  address text not null check (char_length(address) between 3 and 200),
  lat double precision check (lat between 51.2 and 51.8),
  lng double precision check (lng between -0.6 and 0.4),
  type text not null default 'Rezidans',
  gender text default 'Karma',
  occupants int check (occupants between 1 and 30),
  unit text not null default 'w' check (unit in ('w','m')),
  price numeric(10,2) not null check (price > 0 and price < 20000),
  bills text check (bills in ('yes','no')),
  kitchen text check (kitchen in ('Ortak','Özel','Yemekli','Bilinmiyor')),
  bathroom text check (bathroom in ('Ortak','Özel','Yarı özel','Bilinmiyor')),
  min_stay text check (char_length(min_stay) <= 200),
  notes text check (char_length(notes) <= 1000),
  url text check (url ~ '^https?://' and char_length(url) <= 500),
  verified boolean,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- Tip ve cinsiyet kuralları (dosya tekrar çalıştırılırsa da güncellenir)
alter table public.facilities alter column gender drop not null;
alter table public.facilities drop constraint if exists facilities_type_check;
alter table public.facilities add constraint facilities_type_check check (type in ('Rezidans','Hostel / Vakıf yurdu','Ev','Aile yanı'));
alter table public.facilities drop constraint if exists facilities_gender_check;
alter table public.facilities add constraint facilities_gender_check check (gender is null or gender in ('Karma','Sadece kadın','Sadece erkek'));

-- 6 aylık kalış alanları
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

-- Favoriler (her kullanıcı kendi favorilerini yönetir, herkes sayıları görür)
create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  facility_id text not null references public.facilities(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, facility_id)
);

-- Google rota önbelleği (aynı rota için Google'a tekrar tekrar sorulmasın)
create table if not exists public.route_cache (
  facility_id text not null references public.facilities(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  data jsonb not null check (pg_column_size(data) < 20000),
  updated_at timestamptz not null default now(),
  primary key (facility_id, course_id)
);

-- Yönetici mi?
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Yeni kullanıcı kaydolunca profil oluştur
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'full_name',
                                new.raw_user_meta_data->>'name',
                                split_part(new.email, '@', 1)), 60))
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Erişim izinleri (asıl sınırlamayı aşağıdaki RLS kuralları yapar)
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.courses, public.facilities, public.favorites, public.route_cache to anon, authenticated;
grant insert, update, delete on public.courses, public.facilities, public.favorites, public.route_cache to authenticated;
grant update on public.profiles to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- Satır düzeyi güvenlik (RLS) ----------
alter table public.profiles    enable row level security;
alter table public.courses     enable row level security;
alter table public.facilities  enable row level security;
alter table public.favorites   enable row level security;
alter table public.route_cache enable row level security;

-- Herkes (giriş yapmadan da) okuyabilir
drop policy if exists "read profiles" on public.profiles;
create policy "read profiles" on public.profiles for select using (true);
drop policy if exists "read courses" on public.courses;
create policy "read courses" on public.courses for select using (true);
drop policy if exists "read facilities" on public.facilities;
create policy "read facilities" on public.facilities for select using (true);
drop policy if exists "read favorites" on public.favorites;
create policy "read favorites" on public.favorites for select using (true);
drop policy if exists "read routes" on public.route_cache;
create policy "read routes" on public.route_cache for select using (true);

-- Profil: kişi yalnızca kendi adını değiştirebilir (yönetici bayrağını değil)
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid() and is_admin = (select p.is_admin from public.profiles p where p.id = auth.uid()));

-- Ekleme: giriş yapmış herkes; kayıt kendi adına olmalı
drop policy if exists "insert courses" on public.courses;
create policy "insert courses" on public.courses for insert to authenticated
  with check (created_by = auth.uid());
drop policy if exists "insert facilities" on public.facilities;
create policy "insert facilities" on public.facilities for insert to authenticated
  with check (created_by = auth.uid() and (verified is null or public.is_admin()));

-- Düzenleme/silme: ekleyen kişi veya yönetici
drop policy if exists "modify own facilities" on public.facilities;
create policy "modify own facilities" on public.facilities for update to authenticated
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());
drop policy if exists "delete own facilities" on public.facilities;
create policy "delete own facilities" on public.facilities for delete to authenticated
  using (created_by = auth.uid() or public.is_admin());
drop policy if exists "delete own courses" on public.courses;
create policy "delete own courses" on public.courses for delete to authenticated
  using (created_by = auth.uid() or public.is_admin());

-- Tip ve cinsiyet kuralları (dosya tekrar çalıştırılırsa da güncellenir)
alter table public.facilities alter column gender drop not null;
alter table public.facilities drop constraint if exists facilities_type_check;
alter table public.facilities add constraint facilities_type_check check (type in ('Rezidans','Hostel / Vakıf yurdu','Ev','Aile yanı'));
alter table public.facilities drop constraint if exists facilities_gender_check;
alter table public.facilities add constraint facilities_gender_check check (gender is null or gender in ('Karma','Sadece kadın','Sadece erkek'));

-- Favoriler: yalnızca kendi favorin
drop policy if exists "insert own fav" on public.favorites;
create policy "insert own fav" on public.favorites for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "delete own fav" on public.favorites;
create policy "delete own fav" on public.favorites for delete to authenticated
  using (user_id = auth.uid());

-- Rota önbelleği: giriş yapmış kullanıcılar yazabilir
drop policy if exists "write routes" on public.route_cache;
create policy "write routes" on public.route_cache for insert to authenticated with check (true);
drop policy if exists "update routes" on public.route_cache;
create policy "update routes" on public.route_cache for update to authenticated using (true) with check (true);

-- Canlı güncelleme (başkası ekleyince sayfa kendiliğinden yenilensin)
do $$ begin
  begin alter publication supabase_realtime add table public.facilities; exception when others then null; end;
  begin alter publication supabase_realtime add table public.courses;    exception when others then null; end;
  begin alter publication supabase_realtime add table public.favorites;  exception when others then null; end;
end $$;

-- API'nin yeni tabloları hemen görmesi için
notify pgrst, 'reload schema';
