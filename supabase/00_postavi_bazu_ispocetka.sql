-- =====================================================================
-- NautiStaff Live: ČIŠĆENJE + POSTAVLJANJE BAZE + POPRAVAK POSTOJEĆIH RAČUNA
-- Može se pokrenuti više puta. Briše testne oglase, prijave, tvrtke i profile
-- (profili se odmah ponovno naprave prazni). Računi (e-mail i lozinka) ostaju.
-- =====================================================================

-- ---------- 0. ČIŠĆENJE prethodnog (djelomičnog) pokretanja ----------
drop trigger if exists on_auth_user_created on auth.users;

drop policy if exists "files_own_rw" on storage.objects;
drop policy if exists "cv_employer_read" on storage.objects;
drop policy if exists "certs_admin_read" on storage.objects;

drop table if exists public.worker_unavailability cascade;
drop table if exists public.private_contacts cascade;
drop table if exists public.push_tokens     cascade;
drop table if exists public.applications    cascade;
drop table if exists public.jobs            cascade;
drop table if exists public.certificates    cascade;
drop table if exists public.companies       cascade;
drop table if exists public.worker_profiles cascade;
drop table if exists public.profiles        cascade;

drop function if exists public.handle_new_user()          cascade;
drop function if exists public.is_admin()                 cascade;
drop function if exists public.is_trusted()               cascade;
drop function if exists public.my_company_id()            cascade;
drop function if exists public.distance_km(double precision, double precision, double precision, double precision) cascade;
drop function if exists public.protect_profile_fields()   cascade;
drop function if exists public.protect_worker_fields()    cascade;
drop function if exists public.protect_company_fields()   cascade;
drop function if exists public.protect_job_fields()       cascade;
drop function if exists public.apply_to_job(uuid)         cascade;
drop function if exists public.withdraw_application(uuid) cascade;
drop function if exists public.decide_application(uuid, boolean) cascade;
drop function if exists public.live_feed(double precision, double precision, double precision) cascade;
drop function if exists public.recompute_verified(uuid)   cascade;
drop function if exists public.on_certificate_change()    cascade;
drop function if exists public.get_contact(uuid)          cascade;
drop function if exists public.register_push_token(text, text) cascade;
drop function if exists public.send_push(uuid[], text, text, jsonb) cascade;
drop function if exists public.notify_new_job()           cascade;
drop function if exists public.notify_application()       cascade;
drop function if exists public.booking_conflict(uuid, timestamptz, timestamptz, uuid) cascade;
drop function if exists public.set_job_end()              cascade;

-- =====================================================================
-- NautiStaff Live: baza podataka za Supabase
-- Pokrenuti jednom u Supabase > SQL Editor (cijelu datoteku odjednom).
-- =====================================================================

-- Proširenje za slanje push obavijesti iz baze (HTTP pozivi prema Expo serveru)
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------
-- 1. TABLICE
-- ---------------------------------------------------------------------

-- Osnovni profil svakog korisnika (nastaje automatski pri registraciji)
create table public.profiles (
    id          uuid primary key references auth.users(id) on delete cascade,
    role        text not null default 'worker' check (role in ('worker', 'employer', 'admin')),
    full_name   text not null default '',
    language    text not null default 'hr' check (language in ('hr', 'en')),
    created_at  timestamptz not null default now()
);

-- Detalji za posadu / radnike
create table public.worker_profiles (
    user_id     uuid primary key references public.profiles(id) on delete cascade,
    title       text not null default '',
    categories  text[] not null default '{}',
    experience_years int check (experience_years between 0 and 60),
    languages   text not null default '',
    vessels     text not null default '',
    bio         text not null default '',
    cv_path     text,                               -- putanja u Storage bucketu "cv"
    available   boolean not null default true,
    lat         double precision,                   -- zadnja poznata lokacija (za krug od 30 km)
    lng         double precision,
    rating      numeric(2,1),
    verified    boolean not null default false,     -- mijenja samo admin
    updated_at  timestamptz not null default now()
);

-- Tvrtke / čarter agencije
create table public.companies (
    id          uuid primary key default gen_random_uuid(),
    owner_id    uuid not null unique references public.profiles(id) on delete cascade,
    name        text not null check (length(name) between 2 and 80),
    oib         text check (oib ~ '^[0-9]{11}$'),
    fleet       text not null default '',
    base        text not null default '',
    package     text not null default 'none' check (package in ('none', 'S', 'M', 'VIP')),
    verified    boolean not null default false,     -- mijenja samo admin
    rating      numeric(2,1),
    created_at  timestamptz not null default now()
);

-- Certifikati i licence (voditelj brodice, STCW, sanitarna...)
create table public.certificates (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references public.profiles(id) on delete cascade,
    type        text not null,
    file_path   text not null,                      -- putanja u Storage bucketu "certificates"
    expires_on  date,
    status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    created_at  timestamptz not null default now()
);

-- Oglasi / hitne ponude
create table public.jobs (
    id            uuid primary key default gen_random_uuid(),
    company_id    uuid not null references public.companies(id) on delete cascade,
    category      text not null check (category in ('skipper','hostess','chef','deckhand','cleaner','mechanic','basemanager','wellness')),
    title         text not null check (length(title) between 3 and 80),
    vessel        text not null default '',
    location_name text not null,
    lat           double precision,
    lng           double precision,
    start_at      timestamptz not null,
    end_at        timestamptz not null,     -- kraj posla (za kalendar i provjeru preklapanja)
    duration      text not null default '',
    licence       text not null default '',
    spots         int not null default 1 check (spots between 1 and 50),
    filled        int not null default 0 check (filled >= 0),
    pay_amount    numeric(10,2) not null check (pay_amount > 0),
    pay_unit      text not null default 'day' check (pay_unit in ('day', 'week', 'month')),
    tips          boolean not null default false,
    is_live       boolean not null default true,
    is_vip        boolean not null default false,
    expires_at    timestamptz not null,
    status        text not null default 'active' check (status in ('active', 'filled', 'closed')),
    created_at    timestamptz not null default now(),
    check (filled <= spots),
    constraint jobs_end_after_start check (end_at > start_at and end_at <= start_at + interval '366 days'),
    check (expires_at > created_at)
);

create index jobs_feed_idx on public.jobs (status, expires_at);
create index jobs_company_idx on public.jobs (company_id);

-- Prijave na oglase
create table public.applications (
    id          uuid primary key default gen_random_uuid(),
    job_id      uuid not null references public.jobs(id) on delete cascade,
    worker_id   uuid not null references public.profiles(id) on delete cascade,
    status      text not null default 'pending'
                constraint applications_status_check
                check (status in ('pending', 'accepted', 'rejected', 'withdrawn', 'cancelled')),
                -- cancelled = automatski otkazano jer je radnik prihvaćen na drugom poslu u istom terminu
    created_at  timestamptz not null default now(),
    decided_at  timestamptz,
    unique (job_id, worker_id)
);

create index applications_worker_idx on public.applications (worker_id);

-- Tokeni za push obavijesti (Expo push token po uređaju)
create table public.push_tokens (
    token       text primary key,
    user_id     uuid not null references public.profiles(id) on delete cascade,
    platform    text not null check (platform in ('ios', 'android')),
    updated_at  timestamptz not null default now()
);

-- Privatni kontakt (broj mobitela). Vidi ga samo druga strana NAKON prihvaćanja prijave.
create table public.private_contacts (
    user_id     uuid primary key references public.profiles(id) on delete cascade,
    phone       text not null default '' check (length(phone) <= 30),
    updated_at  timestamptz not null default now()
);

-- Dani koje je radnik u kalendaru označio kao nedostupne (godišnji, privatne obveze...)
create table public.worker_unavailability (
    user_id     uuid not null references public.profiles(id) on delete cascade,
    day         date not null,
    primary key (user_id, day)
);


-- ---------------------------------------------------------------------
-- 2. POMOĆNE FUNKCIJE
-- ---------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
    select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- "Povjerljivi" kontekst: admin, interna funkcija sustava, ili vi u Supabase SQL Editoru.
-- Zahtjevi iz aplikacije uvijek dolaze kao uloga authenticated/anon i nisu povjerljivi.
create or replace function public.is_trusted()
returns boolean
language sql stable set search_path = public
as $$
    select coalesce(
               current_user not in ('authenticated', 'anon')
               or coalesce(current_setting('app.trusted', true), '') = 'on'
               or public.is_admin(),
           false);
$$;

create or replace function public.my_company_id()
returns uuid
language sql stable security definer set search_path = public
as $$
    select id from public.companies where owner_id = auth.uid();
$$;

-- Udaljenost u km između dvije točke (haversine)
create or replace function public.distance_km(lat1 double precision, lng1 double precision,
                                              lat2 double precision, lng2 double precision)
returns double precision
language sql immutable
as $$
    select 6371 * 2 * asin(sqrt(
        power(sin(radians(lat2 - lat1) / 2), 2) +
        cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
    ));
$$;


-- ---------------------------------------------------------------------
-- 3. AUTOMATSKI PROFIL PRI REGISTRACIJI
-- Aplikacija pri registraciji šalje role i full_name u "user metadata".
-- Admin se NE može sam registrirati: ulogu admin dodjeljujete ručno u bazi.
-- ---------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
    v_role text := coalesce(new.raw_user_meta_data ->> 'role', 'worker');
begin
    if v_role not in ('worker', 'employer') then
        v_role := 'worker';
    end if;

    insert into public.profiles (id, role, full_name)
    values (new.id, v_role, coalesce(new.raw_user_meta_data ->> 'full_name', ''));

    if v_role = 'worker' then
        insert into public.worker_profiles (user_id) values (new.id);
    end if;
    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------
-- 4. ZAŠTITA POLJA KOJA SMIJE MIJENJATI SAMO ADMIN
-- (uloga, verifikacija, ocjena, paket, popunjenost oglasa)
-- ---------------------------------------------------------------------

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql set search_path = public
as $$
begin
    if not public.is_trusted() and new.role <> old.role then
        raise exception 'Uloga se ne može mijenjati.';
    end if;
    return new;
end;
$$;

create trigger protect_profiles before update on public.profiles
    for each row execute function public.protect_profile_fields();

create or replace function public.protect_worker_fields()
returns trigger
language plpgsql set search_path = public
as $$
begin
    -- plavu značku postavlja samo sustav (nakon što admin odobri licencu) ili admin
    if not public.is_trusted() then
        new.verified := old.verified;
        new.rating := old.rating;
    end if;
    new.updated_at := now();
    return new;
end;
$$;

create trigger protect_worker_profiles before update on public.worker_profiles
    for each row execute function public.protect_worker_fields();

create or replace function public.protect_company_fields()
returns trigger
language plpgsql set search_path = public
as $$
begin
    if not public.is_trusted() then
        if tg_op = 'INSERT' then
            new.verified := false;
            new.rating := null;
            new.package := 'none';
        else
            new.verified := old.verified;
            new.rating := old.rating;
            new.package := old.package;
            new.owner_id := old.owner_id;
        end if;
    end if;
    return new;
end;
$$;

create trigger protect_companies before insert or update on public.companies
    for each row execute function public.protect_company_fields();

-- Poslodavac ne smije ručno mijenjati popunjenost, VIP oznaku ni rok nakon objave.
-- (filled mijenja samo funkcija decide_application, koja postavlja app.trusted)
create or replace function public.protect_job_fields()
returns trigger
language plpgsql set search_path = public
as $$
begin
    if public.is_trusted() then
        return new;
    end if;
    if tg_op = 'INSERT' then
        new.filled := 0;
        new.status := 'active';
        new.is_vip := false;          -- VIP dodjeljuje sustav nakon plaćanja
        if new.expires_at > now() + interval '30 days' then
            raise exception 'Rok oglasa može biti najviše 30 dana.';
        end if;
    else
        new.filled := old.filled;
        new.is_vip := old.is_vip;
        new.company_id := old.company_id;
        new.expires_at := old.expires_at;
        -- poslodavac smije samo zatvoriti oglas, ne i ponovno otvoriti
        if new.status <> old.status and new.status <> 'closed' then
            new.status := old.status;
        end if;
    end if;
    return new;
end;
$$;

create trigger protect_jobs before insert or update on public.jobs
    for each row execute function public.protect_job_fields();


-- ---------------------------------------------------------------------
-- 5. RADNJE (pozivaju se iz aplikacije kao RPC)
-- Sve provjere roka i broja mjesta rade se na serveru, ne na mobitelu.
-- ---------------------------------------------------------------------

-- Kraj posla: ako ga aplikacija ne pošalje, izračuna se iz trajanja ("7 dana" -> +7 dana)
create or replace function public.set_job_end()
returns trigger
language plpgsql set search_path = public
as $$
begin
    if new.end_at is null then
        new.end_at := new.start_at + make_interval(days => greatest(1, least(365,
            coalesce(nullif(substring(new.duration from '\d+'), '')::int, 1))));
    end if;
    return new;
end;
$$;

drop trigger if exists jobs_set_end on public.jobs;
create trigger jobs_set_end before insert on public.jobs
    for each row execute function public.set_job_end();

-- Je li radnik zauzet u zadanom terminu? Vraća opis preklapanja ili NULL ako je slobodan.
-- Zauzet = već PRIHVAĆEN na drugom poslu u tom terminu, ili je taj dan sam označio kao nedostupan.
create or replace function public.booking_conflict(p_worker uuid, p_start timestamptz, p_end timestamptz,
                                                   p_exclude_job uuid default null)
returns text
language sql stable security definer set search_path = public
as $$
    select coalesce(
        (select 'poslom „' || j.title || '" (' || c.name || ', '
                || to_char(j.start_at at time zone 'Europe/Zagreb', 'FMDD.FMMM.') || ' – '
                || to_char(j.end_at at time zone 'Europe/Zagreb', 'FMDD.FMMM.') || ')'
           from public.applications a
           join public.jobs j on j.id = a.job_id
           join public.companies c on c.id = j.company_id
          where a.worker_id = p_worker
            and a.status = 'accepted'
            and (p_exclude_job is null or j.id <> p_exclude_job)
            and j.start_at < p_end and p_start < j.end_at
          order by j.start_at
          limit 1),
        (select 'danom koji ste u kalendaru označili kao nedostupan (' || to_char(u.day, 'FMDD.FMMM.') || ')'
           from public.worker_unavailability u
          where u.user_id = p_worker
            and (u.day::timestamp at time zone 'Europe/Zagreb') < p_end
            and p_start < ((u.day + 1)::timestamp at time zone 'Europe/Zagreb')
          order by u.day
          limit 1));
$$;

-- Instant prijava radnika na oglas
create or replace function public.apply_to_job(p_job_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
    v_job      public.jobs;
    v_id       uuid;
    v_conflict text;
begin
    if not exists (select 1 from public.profiles where id = auth.uid() and role = 'worker') then
        raise exception 'Samo posada se može prijaviti na oglas.';
    end if;

    select * into v_job from public.jobs where id = p_job_id;
    if not found then
        raise exception 'Oglas ne postoji.';
    end if;
    if v_job.status <> 'active' or v_job.expires_at <= now() or v_job.filled >= v_job.spots then
        raise exception 'Ponuda više nije aktivna.';
    end if;

    -- ZAUZET TERMIN: ne može se prijaviti na posao koji se preklapa s već rezerviranim
    v_conflict := public.booking_conflict(auth.uid(), v_job.start_at, v_job.end_at, v_job.id);
    if v_conflict is not null then
        raise exception 'Termin je zauzet. Ovaj posao se vremenski preklapa s %. Prijava nije moguća.', v_conflict;
    end if;

    insert into public.applications (job_id, worker_id)
    values (p_job_id, auth.uid())
    on conflict (job_id, worker_id) do update
        set status = 'pending', created_at = now(), decided_at = null
        where public.applications.status in ('withdrawn', 'cancelled')
    returning id into v_id;

    if v_id is null then
        raise exception 'Već ste se prijavili na ovaj oglas.';
    end if;
    return v_id;
end;
$$;

-- Poslodavac prihvaća ili odbija kandidata
create or replace function public.decide_application(p_application_id uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
    v_app public.applications;
    v_job public.jobs;
begin
    select * into v_app from public.applications where id = p_application_id;
    if not found or v_app.status <> 'pending' then
        raise exception 'Prijava nije na čekanju.';
    end if;

    -- zaključaj oglas da dva istovremena prihvaćanja ne prepune mjesta
    select * into v_job from public.jobs where id = v_app.job_id for update;
    if v_job.company_id is distinct from public.my_company_id() then
        raise exception 'Ovo nije vaš oglas.';
    end if;

    if p_accept then
        if v_job.status <> 'active' or v_job.expires_at <= now() or v_job.filled >= v_job.spots then
            raise exception 'Oglas više nije aktivan ili je popunjen.';
        end if;
        -- kandidat je u međuvremenu možda prihvaćen na drugom poslu u istom terminu
        if public.booking_conflict(v_app.worker_id, v_job.start_at, v_job.end_at, v_job.id) is not null then
            raise exception 'Kandidat je u tom terminu već angažiran na drugom poslu ili nije dostupan. Odaberite drugog kandidata.';
        end if;

        update public.applications set status = 'accepted', decided_at = now() where id = v_app.id;

        perform set_config('app.trusted', 'on', true);
        update public.jobs
           set filled = filled + 1,
               status = case when filled + 1 >= spots then 'filled' else status end
         where id = v_job.id;
        perform set_config('app.trusted', 'off', true);

        -- ostale prijave tog radnika koje se vremenski preklapaju automatski se otkazuju
        update public.applications a
           set status = 'cancelled', decided_at = now()
          from public.jobs j
         where a.job_id = j.id
           and a.worker_id = v_app.worker_id
           and a.status = 'pending'
           and a.id <> v_app.id
           and j.start_at < v_job.end_at and v_job.start_at < j.end_at;
    else
        update public.applications set status = 'rejected', decided_at = now() where id = v_app.id;
    end if;
end;
$$;

-- Live feed za radnika: aktivni oglasi, po želji samo u krugu X km.
-- "conflict" opisuje preklapanje s već rezerviranim terminom (tada se prijava ne nudi).
drop function if exists public.live_feed(double precision, double precision, double precision);
create function public.live_feed(p_lat double precision default null,
                                 p_lng double precision default null,
                                 p_radius_km double precision default null)
returns table (
    id uuid, company_id uuid, company_name text, company_verified boolean, company_rating numeric,
    category text, title text, vessel text, location_name text, start_at timestamptz, end_at timestamptz,
    duration text, licence text, spots int, filled int, pay_amount numeric, pay_unit text,
    tips boolean, is_live boolean, is_vip boolean, expires_at timestamptz, distance_km double precision,
    my_application_status text, conflict text
)
language sql stable security definer set search_path = public
as $$
    select j.id, j.company_id, c.name, c.verified, c.rating,
           j.category, j.title, j.vessel, j.location_name, j.start_at, j.end_at,
           j.duration, j.licence, j.spots, j.filled, j.pay_amount, j.pay_unit,
           j.tips, j.is_live, j.is_vip, j.expires_at,
           case when p_lat is not null and j.lat is not null
                then public.distance_km(p_lat, p_lng, j.lat, j.lng) end,
           a.status,
           case when a.status is null or a.status in ('withdrawn', 'cancelled')
                then public.booking_conflict(auth.uid(), j.start_at, j.end_at, j.id) end
      from public.jobs j
      join public.companies c on c.id = j.company_id
      left join public.applications a on a.job_id = j.id and a.worker_id = auth.uid()
     where auth.uid() is not null
       and j.status = 'active'
       and j.expires_at > now()
       and j.filled < j.spots
       and (p_radius_km is null or p_lat is null or j.lat is null
            or public.distance_km(p_lat, p_lng, j.lat, j.lng) <= p_radius_km)
     order by j.is_vip desc, j.is_live desc, j.expires_at asc;
$$;

-- Radnik povlači prijavu
create or replace function public.withdraw_application(p_application_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
    update public.applications
       set status = 'withdrawn', decided_at = now()
     where id = p_application_id
       and worker_id = auth.uid()
       and status = 'pending';
    if not found then
        raise exception 'Prijava se ne može povući.';
    end if;
end;
$$;



-- ---------------------------------------------------------------------
-- 5b. VERIFICIRANI PROFIL (plava značka)
-- Radnik učita licencu -> status "na provjeri" -> admin odobri -> značka se
-- uključi automatski. Ako se licenca odbije ili obriše, značka se ugasi.
-- ---------------------------------------------------------------------

create or replace function public.recompute_verified(p_user uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
    perform set_config('app.trusted', 'on', true);
    update public.worker_profiles
       set verified = exists (
               select 1 from public.certificates c
                where c.user_id = p_user
                  and c.status = 'approved'
                  and (c.expires_on is null or c.expires_on >= current_date))
     where user_id = p_user;
    perform set_config('app.trusted', 'off', true);
end;
$$;

create or replace function public.on_certificate_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
    perform public.recompute_verified(coalesce(new.user_id, old.user_id));
    return null;
end;
$$;

create trigger certificates_changed
    after insert or update or delete on public.certificates
    for each row execute function public.on_certificate_change();


-- ---------------------------------------------------------------------
-- 5c. KONTAKT NAKON PRIHVAĆANJA
-- Radnik dobiva kontakt poslodavca, poslodavac kontakt radnika,
-- ali tek kad je prijava prihvaćena, i samo te dvije strane.
-- ---------------------------------------------------------------------

create or replace function public.get_contact(p_application_id uuid)
returns table (name text, company text, phone text, email text)
language plpgsql stable security definer set search_path = public
as $$
#variable_conflict use_column
declare
    v_app     public.applications;
    v_owner   uuid;
    v_company text;
    v_other   uuid;
begin
    select * into v_app from public.applications where id = p_application_id;
    if not found or v_app.status <> 'accepted' then
        raise exception 'Kontakt je dostupan tek nakon prihvaćanja prijave.';
    end if;

    select c.owner_id, c.name into v_owner, v_company
      from public.jobs j join public.companies c on c.id = j.company_id
     where j.id = v_app.job_id;

    if auth.uid() = v_app.worker_id then
        v_other := v_owner;
    elsif auth.uid() = v_owner then
        v_other := v_app.worker_id;
    else
        raise exception 'Nemate pristup ovom kontaktu.';
    end if;

    return query
        select p.full_name, v_company, coalesce(pc.phone, ''), u.email::text
          from public.profiles p
          join auth.users u on u.id = p.id
          left join public.private_contacts pc on pc.user_id = p.id
         where p.id = v_other;
end;
$$;


-- ---------------------------------------------------------------------
-- 5d. PUSH OBAVIJESTI
-- Baza sama šalje obavijesti preko Expo push servisa:
--   * nova ponuda      -> posadi u krugu 30 km koja radi to zanimanje
--   * nova prijava     -> poslodavcu
--   * prihvaćen/odbijen -> radniku
-- Greška u slanju nikad ne blokira objavu ili prijavu.
-- ---------------------------------------------------------------------

create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
    if auth.uid() is null then
        raise exception 'Niste prijavljeni.';
    end if;
    insert into public.push_tokens (token, user_id, platform, updated_at)
    values (p_token, auth.uid(), p_platform, now())
    on conflict (token) do update
        set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

create or replace function public.send_push(p_users uuid[], p_title text, p_body text, p_data jsonb default '{}')
returns void
language plpgsql security definer set search_path = public, extensions
as $$
declare
    v_batch jsonb;
begin
    for v_batch in
        select jsonb_agg(jsonb_build_object(
                   'to', t.token, 'title', p_title, 'body', p_body, 'data', p_data,
                   'sound', 'default', 'priority', 'high', 'channelId', 'default'))
          from (select token, (row_number() over (order by token) - 1) / 100 as grp
                  from public.push_tokens
                 where user_id = any(p_users)) t
         group by t.grp
    loop
        perform net.http_post(
            url     := 'https://exp.host/--/api/v2/push/send',
            body    := v_batch,
            headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
        );
    end loop;
exception when others then
    raise warning 'Push obavijest nije poslana: %', sqlerrm;
end;
$$;

create or replace function public.notify_new_job()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
    v_users   uuid[];
    v_company text;
begin
    select name into v_company from public.companies where id = new.company_id;

    select array_agg(w.user_id) into v_users
      from public.worker_profiles w
      join public.profiles p on p.id = w.user_id
     where p.role = 'worker'
       and w.available
       and (cardinality(w.categories) = 0 or new.category = any(w.categories))
       and (w.lat is null or new.lat is null
            or public.distance_km(w.lat, w.lng, new.lat, new.lng) <= 30)
       -- ne šaljemo obavijest onima koji su u tom terminu već zauzeti
       and public.booking_conflict(w.user_id, new.start_at, new.end_at, new.id) is null;

    if v_users is not null then
        perform public.send_push(
            v_users,
            case when new.is_live then '⚡ Hitna ponuda: ' else 'Nova ponuda: ' end || new.title,
            new.location_name || ' · ' || round(new.pay_amount)::text || ' € · ' || coalesce(v_company, ''),
            jsonb_build_object('type', 'job', 'job_id', new.id));
    end if;
    return null;
end;
$$;

create trigger jobs_notify
    after insert on public.jobs
    for each row execute function public.notify_new_job();

create or replace function public.notify_application()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
    v_title   text;
    v_owner   uuid;
    v_company text;
    v_worker  text;
begin
    select j.title, c.owner_id, c.name into v_title, v_owner, v_company
      from public.jobs j join public.companies c on c.id = j.company_id
     where j.id = new.job_id;

    if tg_op = 'INSERT' or (new.status = 'pending' and old.status <> 'pending') then
        select full_name into v_worker from public.profiles where id = new.worker_id;
        perform public.send_push(
            array[v_owner], '🔔 Novi kandidat: ' || coalesce(nullif(v_worker, ''), 'kandidat'),
            'Prijava za: ' || v_title || '. Otvorite aplikaciju i odgovorite.',
            jsonb_build_object('type', 'application', 'job_id', new.job_id));
    elsif new.status = 'accepted' and old.status <> 'accepted' then
        perform public.send_push(
            array[new.worker_id], '🎉 Prihvaćeni ste!',
            v_company || ' vas je odabrao za: ' || v_title || '. Otvorite aplikaciju za kontakt.',
            jsonb_build_object('type', 'accepted', 'job_id', new.job_id));
    elsif new.status = 'rejected' and old.status <> 'rejected' then
        perform public.send_push(
            array[new.worker_id], 'Odgovor na prijavu',
            v_company || ' je odabrao drugog kandidata za: ' || v_title,
            jsonb_build_object('type', 'rejected', 'job_id', new.job_id));
    end if;
    return null;
end;
$$;

create trigger applications_notify
    after insert or update on public.applications
    for each row execute function public.notify_application();


-- ---------------------------------------------------------------------
-- 6. SIGURNOSNA PRAVILA (Row Level Security)
-- Bez ovoga bi svatko s ključem aplikacije mogao čitati i mijenjati sve.
-- ---------------------------------------------------------------------

alter table public.profiles        enable row level security;
alter table public.worker_profiles enable row level security;
alter table public.companies       enable row level security;
alter table public.certificates    enable row level security;
alter table public.jobs            enable row level security;
alter table public.applications    enable row level security;
alter table public.push_tokens     enable row level security;
alter table public.private_contacts enable row level security;
alter table public.worker_unavailability enable row level security;

-- profiles: prijavljeni korisnici vide imena; svatko mijenja samo svoj
create policy "profiles_select" on public.profiles for select to authenticated using (true);
create policy "profiles_update_own" on public.profiles for update to authenticated
    using (id = auth.uid()) with check (id = auth.uid());

-- worker_profiles: vidljivi prijavljenima (to je "burza" posade); mijenja vlasnik
create policy "worker_select" on public.worker_profiles for select to authenticated using (true);
create policy "worker_update_own" on public.worker_profiles for update to authenticated
    using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

-- companies: vidljive svima prijavljenima; poslodavac kreira i mijenja svoju
create policy "companies_select" on public.companies for select to authenticated using (true);
create policy "companies_insert_own" on public.companies for insert to authenticated
    with check (owner_id = auth.uid()
                and exists (select 1 from public.profiles where id = auth.uid() and role = 'employer'));
create policy "companies_update_own" on public.companies for update to authenticated
    using (owner_id = auth.uid() or public.is_admin());

-- certificates: vidi vlasnik i admin; vlasnik dodaje; admin odobrava
create policy "certs_select" on public.certificates for select to authenticated
    using (user_id = auth.uid() or public.is_admin());
create policy "certs_insert_own" on public.certificates for insert to authenticated
    with check (user_id = auth.uid() and status = 'pending');
create policy "certs_admin_update" on public.certificates for update to authenticated
    using (public.is_admin());
create policy "certs_delete_own" on public.certificates for delete to authenticated
    using (user_id = auth.uid());

-- jobs: prijavljeni vide oglase; poslodavac objavljuje i mijenja samo svoje
create policy "jobs_select" on public.jobs for select to authenticated using (true);
create policy "jobs_insert_own" on public.jobs for insert to authenticated
    with check (company_id = public.my_company_id());
create policy "jobs_update_own" on public.jobs for update to authenticated
    using (company_id = public.my_company_id() or public.is_admin())
    with check (company_id = public.my_company_id() or public.is_admin());

-- applications: radnik vidi svoje; poslodavac vidi prijave na svoje oglase.
-- Upis i promjene idu ISKLJUČIVO preko funkcija iz odjeljka 5.
create policy "apps_select" on public.applications for select to authenticated
    using (
        worker_id = auth.uid()
        or exists (select 1 from public.jobs j where j.id = job_id and j.company_id = public.my_company_id())
        or public.is_admin()
    );

-- push_tokens: svatko upravlja samo svojim tokenima
create policy "push_own" on public.push_tokens for all to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());

-- private_contacts: svatko vidi i mijenja SAMO svoj broj (drugi ga dobivaju preko get_contact)
create policy "contact_own" on public.private_contacts for all to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());

-- worker_unavailability: radnik upravlja samo svojim kalendarom
create policy "unavail_own" on public.worker_unavailability for all to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());


-- ---------------------------------------------------------------------
-- 7. DOZVOLE ZA RPC FUNKCIJE
-- ---------------------------------------------------------------------

-- Novi Supabase projekti više ne daju automatski pristup tablicama,
-- pa ga dajemo izričito. Što tko smije vidjeti i dalje određuju pravila iz odjeljka 6.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

revoke execute on function public.apply_to_job(uuid) from public, anon;
revoke execute on function public.withdraw_application(uuid) from public, anon;
revoke execute on function public.decide_application(uuid, boolean) from public, anon;
revoke execute on function public.live_feed(double precision, double precision, double precision) from public, anon;
grant execute on function public.apply_to_job(uuid) to authenticated;
grant execute on function public.withdraw_application(uuid) to authenticated;
grant execute on function public.decide_application(uuid, boolean) to authenticated;
grant execute on function public.live_feed(double precision, double precision, double precision) to authenticated;

revoke execute on function public.get_contact(uuid) from public, anon;
revoke execute on function public.register_push_token(text, text) from public, anon;
grant execute on function public.get_contact(uuid) to authenticated;
grant execute on function public.register_push_token(text, text) to authenticated;

-- interne funkcije: ne smiju se pozivati iz aplikacije
revoke execute on function public.send_push(uuid[], text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.recompute_verified(uuid) from public, anon, authenticated;
revoke execute on function public.booking_conflict(uuid, timestamptz, timestamptz, uuid) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 8. REAL-TIME: promjene na oglasima i prijavama šalju se odmah u aplikaciju
-- ---------------------------------------------------------------------

alter publication supabase_realtime add table public.jobs;
alter publication supabase_realtime add table public.applications;


-- ---------------------------------------------------------------------
-- 9. POHRANA DATOTEKA (CV i certifikati), privatni bucketi
-- Svaki korisnik sprema u mapu nazvanu po svom ID-u: <user_id>/datoteka.pdf
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('cv', 'cv', false), ('certificates', 'certificates', false)
on conflict (id) do nothing;

create policy "files_own_rw" on storage.objects for all to authenticated
    using (bucket_id in ('cv', 'certificates') and (storage.foldername(name))[1] = auth.uid()::text)
    with check (bucket_id in ('cv', 'certificates') and (storage.foldername(name))[1] = auth.uid()::text);

-- Poslodavac smije vidjeti CV kandidata koji se prijavio na njegov oglas; admin vidi sve
create policy "cv_employer_read" on storage.objects for select to authenticated
    using (
        bucket_id = 'cv' and (
            public.is_admin()
            or exists (
                select 1 from public.applications a
                  join public.jobs j on j.id = a.job_id
                 where a.worker_id::text = (storage.foldername(name))[1]
                   and j.company_id = public.my_company_id()
            )
        )
    );

create policy "certs_admin_read" on storage.objects for select to authenticated
    using (bucket_id = 'certificates' and public.is_admin());


-- ---------- 10. PROFILI ZA RAČUNE REGISTRIRANE PRIJE OVOG KORAKA ----------
insert into public.profiles (id, role, full_name)
select id,
       case when raw_user_meta_data->>'role' in ('worker', 'employer')
            then raw_user_meta_data->>'role' else 'worker' end,
       coalesce(raw_user_meta_data->>'full_name', '')
from auth.users
on conflict (id) do nothing;

insert into public.worker_profiles (user_id)
select id from public.profiles where role = 'worker'
on conflict (user_id) do nothing;
