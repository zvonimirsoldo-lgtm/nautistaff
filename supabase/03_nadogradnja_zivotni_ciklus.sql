-- =====================================================================
-- NautiStaff Live: NADOGRADNJA 4 - ŽIVOTNI CIKLUS OGLASA
-- Pokrenuti JEDNOM u Supabase > SQL Editor. NE briše postojeće podatke.
-- Može se pokrenuti i više puta bez štete.
--
--  * oglas pamti kad je popunjen/zatvoren (closed_at)
--  * poslodavac oglas može ručno označiti kao popunjen ili ga otkazati
--  * kad se oglas popuni ili zatvori, kandidati na čekanju dobivaju status
--    "closed" i push obavijest (ne čekaju uzalud)
--  * rok za prijave ne može biti nakon polaska
--  * kandidata se može prihvatiti i nakon isteka roka za prijave, sve do polaska
--  * popunjeni oglasi ostaju u ponudama još 3 sata, prigušeni i na dnu
-- =====================================================================

-- 1. Kad je oglas popunjen/zatvoren
alter table public.jobs add column if not exists closed_at timestamptz;
update public.jobs set closed_at = created_at where status in ('filled', 'closed') and closed_at is null;

-- 2. Novi status prijave: "closed" (oglas popunjen/zatvoren prije odluke o ovoj prijavi)
alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications add constraint applications_status_check
    check (status in ('pending', 'accepted', 'rejected', 'withdrawn', 'cancelled', 'closed'));

-- 3. Što poslodavac smije mijenjati na oglasu
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
        new.closed_at := null;
        if new.expires_at > now() + interval '30 days' then
            raise exception 'Rok oglasa može biti najviše 30 dana.';
        end if;
        -- rok za prijave najkasnije u trenutku polaska
        if new.expires_at > new.start_at then
            new.expires_at := new.start_at;
        end if;
    else
        new.filled := old.filled;
        new.is_vip := old.is_vip;
        new.company_id := old.company_id;
        new.expires_at := old.expires_at;
        new.closed_at := old.closed_at;
        -- aktivan oglas poslodavac smije označiti kao popunjen ili ga otkazati, ali ne i ponovno otvoriti
        if new.status <> old.status and (old.status <> 'active' or new.status not in ('filled', 'closed')) then
            new.status := old.status;
        end if;
    end if;
    return new;
end;
$$;

-- 4. Zapamti trenutak popunjavanja/zatvaranja (okida se zadnji, nakon zaštite)
create or replace function public.job_set_closed_at()
returns trigger
language plpgsql set search_path = public
as $$
begin
    if new.status <> old.status and new.status in ('filled', 'closed') then
        new.closed_at := now();
    end if;
    return new;
end;
$$;

drop trigger if exists zz_jobs_set_closed_at on public.jobs;
create trigger zz_jobs_set_closed_at before update on public.jobs
    for each row execute function public.job_set_closed_at();

-- 5. Kad se oglas popuni ili zatvori, svim kandidatima na čekanju javi da je gotovo
create or replace function public.close_pending_applications()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
    if new.status <> old.status and new.status in ('filled', 'closed') then
        update public.applications
           set status = 'closed', decided_at = now()
         where job_id = new.id and status = 'pending';
    end if;
    return null;
end;
$$;

drop trigger if exists jobs_close_pending on public.jobs;
create trigger jobs_close_pending after update on public.jobs
    for each row execute function public.close_pending_applications();

-- 6. Prihvaćanje kandidata (sada moguće do polaska)
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
        -- rok za PRIJAVE može isteći, ali kandidata se može prihvatiti sve do polaska
        if v_job.status <> 'active' or v_job.start_at <= now() or v_job.filled >= v_job.spots then
            raise exception 'Oglas više nije aktivan: popunjen je, zatvoren ili je polazak već prošao.';
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


-- 7. Live feed: aktivni oglasi + oglasi popunjeni u zadnja 3 sata (prigušeni, na dnu)
drop function if exists public.live_feed(double precision, double precision, double precision);
create function public.live_feed(p_lat double precision default null,
                                 p_lng double precision default null,
                                 p_radius_km double precision default null)
returns table (
    id uuid, company_id uuid, company_name text, company_verified boolean, company_rating numeric,
    category text, title text, vessel text, location_name text, start_at timestamptz, end_at timestamptz,
    duration text, licence text, spots int, filled int, pay_amount numeric, pay_unit text,
    tips boolean, is_live boolean, is_vip boolean, expires_at timestamptz, distance_km double precision,
    my_application_status text, conflict text, job_status text, closed_at timestamptz
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
           case when j.status = 'active' and (a.status is null or a.status in ('withdrawn', 'cancelled'))
                then public.booking_conflict(auth.uid(), j.start_at, j.end_at, j.id) end,
           j.status,
           j.closed_at
      from public.jobs j
      join public.companies c on c.id = j.company_id
      left join public.applications a on a.job_id = j.id and a.worker_id = auth.uid()
     where auth.uid() is not null
       and (
             (j.status = 'active' and j.expires_at > now() and j.filled < j.spots)
          or (j.status = 'filled' and j.closed_at > now() - interval '3 hours' and j.start_at > now())
           )
       and (p_radius_km is null or p_lat is null or j.lat is null
            or public.distance_km(p_lat, p_lng, j.lat, j.lng) <= p_radius_km)
     order by (j.status = 'filled'), j.is_vip desc, j.is_live desc, j.expires_at asc;
$$;

-- 8. Obavijest kandidatu kad je oglas zatvoren prije odluke
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
    elsif new.status = 'closed' and old.status <> 'closed' then
        perform public.send_push(
            array[new.worker_id], 'Oglas je popunjen',
            v_title || ' (' || v_company || ') više nije dostupan. Hvala na prijavi, nove ponude stižu uskoro!',
            jsonb_build_object('type', 'closed', 'job_id', new.job_id));
    end if;
    return null;
end;
$$;

-- 9. Dozvole
revoke execute on function public.live_feed(double precision, double precision, double precision) from public, anon;
grant execute on function public.live_feed(double precision, double precision, double precision) to authenticated;
revoke execute on function public.decide_application(uuid, boolean) from public, anon;
grant execute on function public.decide_application(uuid, boolean) to authenticated;
