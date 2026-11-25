-- =====================================================================
-- NautiStaff Live: NADOGRADNJA 3 - KALENDAR I ZAUZETI TERMINI
-- Pokrenuti JEDNOM u Supabase > SQL Editor. NE briše postojeće podatke.
-- Može se pokrenuti i više puta bez štete.
--
--  * oglasi dobivaju datum završetka (end_at)
--  * radnik se ne može prijaviti na posao koji se preklapa s već prihvaćenim
--  * poslodavac ne može prihvatiti kandidata koji je u tom terminu već zauzet
--  * kad je radnik prihvaćen, njegove ostale prijave u istom terminu se otkazuju
--  * radnik u kalendaru može označiti dane kad nije dostupan
--  * nema push obavijesti za ponude koje se preklapaju sa zauzetim terminom
-- =====================================================================

-- 1. Kraj posla na oglasima (postojećim oglasima izračunamo ga iz trajanja)
alter table public.jobs add column if not exists end_at timestamptz;
update public.jobs
   set end_at = start_at + make_interval(days => greatest(1, least(365,
                    coalesce(nullif(substring(duration from '\d+'), '')::int, 1))))
 where end_at is null;
alter table public.jobs alter column end_at set not null;
alter table public.jobs drop constraint if exists jobs_end_after_start;
alter table public.jobs add constraint jobs_end_after_start
    check (end_at > start_at and end_at <= start_at + interval '366 days');

-- 2. Novi status prijave: "cancelled" (automatski otkazano zbog preklapanja)
alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications add constraint applications_status_check
    check (status in ('pending', 'accepted', 'rejected', 'withdrawn', 'cancelled'));

-- 3. Dani nedostupnosti u kalendaru radnika
create table if not exists public.worker_unavailability (
    user_id     uuid not null references public.profiles(id) on delete cascade,
    day         date not null,
    primary key (user_id, day)
);
alter table public.worker_unavailability enable row level security;
drop policy if exists "unavail_own" on public.worker_unavailability;
create policy "unavail_own" on public.worker_unavailability for all to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.worker_unavailability to authenticated;

-- 4. Logika zauzetosti, prijave, prihvaćanja i live feeda
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

-- 5. Push obavijesti: ne šaljemo ih onima koji su u tom terminu zauzeti
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

-- 6. Dozvole
revoke execute on function public.booking_conflict(uuid, timestamptz, timestamptz, uuid) from public, anon, authenticated;
revoke execute on function public.live_feed(double precision, double precision, double precision) from public, anon;
grant execute on function public.live_feed(double precision, double precision, double precision) to authenticated;
revoke execute on function public.apply_to_job(uuid) from public, anon;
grant execute on function public.apply_to_job(uuid) to authenticated;
revoke execute on function public.decide_application(uuid, boolean) from public, anon;
grant execute on function public.decide_application(uuid, boolean) to authenticated;
