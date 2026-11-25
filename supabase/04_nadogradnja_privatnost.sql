-- =====================================================================
-- NautiStaff Live: NADOGRADNJA 5 - PRIVATNOST I PRAVNI DIO (GDPR, DSA)
-- Pokrenuti JEDNOM u Supabase > SQL Editor. NE briše postojeće podatke.
-- Može se pokrenuti i više puta bez štete.
--
--  * bilježi se tko je i kada prihvatio koju verziju Uvjeta i Politike privatnosti
--  * izričita privola za zdravstvene dokumente (sanitarna iskaznica)
--  * radnik može isključiti korištenje lokacije
--  * prijava sumnjivih oglasa i korisnika (pregledava administrator)
--  * korisnik može preuzeti sve svoje podatke i obrisati račun
-- =====================================================================

-- 1. Prihvaćanje uvjeta i privola
alter table public.profiles add column if not exists terms_version text;
alter table public.profiles add column if not exists terms_accepted_at timestamptz;
alter table public.profiles add column if not exists health_consent_at timestamptz;

-- korisnik ta polja ne mijenja izravno, nego preko funkcija ispod
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql set search_path = public
as $$
begin
    if not public.is_trusted() then
        if new.role <> old.role then
            raise exception 'Uloga se ne može mijenjati.';
        end if;
        new.terms_version := old.terms_version;
        new.terms_accepted_at := old.terms_accepted_at;
        new.health_consent_at := old.health_consent_at;
    end if;
    return new;
end;
$$;

create or replace function public.accept_terms(p_version text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
    if auth.uid() is null then raise exception 'Niste prijavljeni.'; end if;
    update public.profiles
       set terms_version = p_version, terms_accepted_at = now()
     where id = auth.uid();
end;
$$;

-- p_consent = true daje privolu, false je povlači
create or replace function public.set_health_consent(p_consent boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
    if auth.uid() is null then raise exception 'Niste prijavljeni.'; end if;
    update public.profiles
       set health_consent_at = case when p_consent then now() else null end
     where id = auth.uid();
end;
$$;

-- Sanitarnu iskaznicu (zdravstveni podatak) nije moguće učitati bez izričite privole
create or replace function public.require_health_consent()
returns trigger
language plpgsql set search_path = public
as $$
begin
    if new.type ilike '%sanitarn%'
       and not exists (select 1 from public.profiles where id = new.user_id and health_consent_at is not null) then
        raise exception 'Za učitavanje sanitarne iskaznice potrebna je vaša izričita privola za obradu zdravstvenih podataka.';
    end if;
    return new;
end;
$$;

drop trigger if exists certificates_health_consent on public.certificates;
create trigger certificates_health_consent before insert on public.certificates
    for each row execute function public.require_health_consent();


-- 2. Radnik može isključiti korištenje lokacije
alter table public.worker_profiles add column if not exists share_location boolean not null default true;


-- 3. Prijave sumnjivih oglasa i korisnika (EU Akt o digitalnim uslugama)
create table if not exists public.reports (
    id               uuid primary key default gen_random_uuid(),
    reporter_id      uuid references public.profiles(id) on delete set null,
    job_id           uuid references public.jobs(id) on delete set null,
    reported_user_id uuid references public.profiles(id) on delete set null,
    reason           text not null check (length(reason) between 2 and 80),
    details          text not null default '' check (length(details) <= 1000),
    status           text not null default 'open' check (status in ('open', 'resolved')),
    created_at       timestamptz not null default now()
);
-- prijava ostaje sačuvana i kad se prijavljeni oglas ili korisnik obriše
alter table public.reports drop constraint if exists reports_check;
alter table public.reports enable row level security;
drop policy if exists "reports_insert_own" on public.reports;
drop policy if exists "reports_select" on public.reports;
drop policy if exists "reports_admin_update" on public.reports;
create policy "reports_insert_own" on public.reports for insert to authenticated
    with check (reporter_id = auth.uid() and status = 'open'
                and (job_id is not null or reported_user_id is not null));
create policy "reports_select" on public.reports for select to authenticated
    using (reporter_id = auth.uid() or public.is_admin());
create policy "reports_admin_update" on public.reports for update to authenticated
    using (public.is_admin());
grant select, insert, update on public.reports to authenticated;


-- 4. Preuzimanje svih vlastitih podataka (GDPR pravo na pristup i prenosivost)
create or replace function public.export_my_data()
returns jsonb
language sql stable security definer set search_path = public
as $$
    select jsonb_build_object(
        'izvezeno', now(),
        'racun', (select jsonb_build_object('email', u.email, 'registriran', u.created_at) from auth.users u where u.id = auth.uid()),
        'profil', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
        'profil_posade', (select to_jsonb(w) from public.worker_profiles w where w.user_id = auth.uid()),
        'kontakt', (select to_jsonb(c) from public.private_contacts c where c.user_id = auth.uid()),
        'tvrtka', (select to_jsonb(c) from public.companies c where c.owner_id = auth.uid()),
        'licence', (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from public.certificates c where c.user_id = auth.uid()),
        'prijave_na_oglase', (select coalesce(jsonb_agg(jsonb_build_object(
                                  'oglas', j.title, 'pocetak', j.start_at, 'kraj', j.end_at,
                                  'status', a.status, 'prijavljeno', a.created_at)), '[]')
                                from public.applications a join public.jobs j on j.id = a.job_id
                               where a.worker_id = auth.uid()),
        'moji_oglasi', (select coalesce(jsonb_agg(to_jsonb(j)), '[]')
                          from public.jobs j join public.companies c on c.id = j.company_id
                         where c.owner_id = auth.uid()),
        'nedostupni_dani', (select coalesce(jsonb_agg(u.day order by u.day), '[]') from public.worker_unavailability u where u.user_id = auth.uid()),
        'moje_prijave_sadrzaja', (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from public.reports r where r.reporter_id = auth.uid())
    );
$$;


-- 5. Brisanje računa (GDPR pravo na brisanje; Google Play to traži)
-- Datoteke (CV, licence) aplikacija briše prije poziva ove funkcije.
-- Brisanjem korisnika automatski se brišu profil, kontakt, licence, prijave,
-- kalendar, tvrtka i njezini oglasi.
create or replace function public.delete_my_account()
returns void
language plpgsql security definer set search_path = public
as $$
begin
    if auth.uid() is null then raise exception 'Niste prijavljeni.'; end if;
    if public.is_admin() and (select count(*) from public.profiles where role = 'admin') = 1 then
        raise exception 'Ovo je jedini administratorski račun i ne može se obrisati iz aplikacije.';
    end if;
    delete from auth.users where id = auth.uid();
end;
$$;


-- 6. Dozvole
revoke execute on function public.accept_terms(text) from public, anon;
revoke execute on function public.set_health_consent(boolean) from public, anon;
revoke execute on function public.export_my_data() from public, anon;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.accept_terms(text) to authenticated;
grant execute on function public.set_health_consent(boolean) to authenticated;
grant execute on function public.export_my_data() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
