-- =====================================================================
-- NautiStaff Live: NADOGRADNJA 6 - OGLASI DO 6 MJESECI UNAPRIJED
-- Pokrenuti JEDNOM u Supabase > SQL Editor. NE briše podatke.
-- Rok za prijave sada može biti do 6 mjeseci ("Do polaska"); prije je bio najviše 30 dana.
-- =====================================================================

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
        -- oglasi do 6 mjeseci unaprijed: rok za prijave može trajati do polaska
        if new.start_at > now() + interval '200 days' then
            raise exception 'Polazak može biti najviše 6 mjeseci unaprijed.';
        end if;
        if new.expires_at > now() + interval '200 days' then
            raise exception 'Rok za prijave može biti najviše 6 mjeseci.';
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
