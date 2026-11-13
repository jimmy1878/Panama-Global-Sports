-- =============================================================================
-- Panama Global Sports · 7 · Funciones del panel de administración
--
-- Los correos están en auth.users (no accesible desde la app). Estas funciones
-- los exponen SOLO a administradores.
-- =============================================================================

-- Lista de usuarios con correo, nombre y rol
create function public.admin_list_users()
returns table (id uuid, email text, full_name text, role public.app_role, created_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return query
    select p.id, u.email::text, p.full_name, p.role, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;

-- Buscar un usuario por correo exacto (para vincularlo a una familia)
create function public.admin_find_user(p_email text)
returns table (id uuid, email text, full_name text, role public.app_role)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return query
    select p.id, u.email::text, p.full_name, p.role
    from public.profiles p
    join auth.users u on u.id = p.id
    where lower(u.email) = lower(btrim(p_email));
end;
$$;

-- Marcar una temporada como actual (desmarca la anterior en una sola transacción).
-- También se puede usar desde el SQL Editor (auth.uid() es NULL allí).
create function public.admin_set_current_season(p_season_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if not exists (select 1 from public.seasons where id = p_season_id) then
    raise exception 'Temporada no encontrada';
  end if;
  update public.seasons set is_current = false where is_current and id <> p_season_id;
  update public.seasons set is_current = true where id = p_season_id;
end;
$$;

revoke execute on function public.admin_list_users()               from public, anon;
revoke execute on function public.admin_find_user(text)            from public, anon;
revoke execute on function public.admin_set_current_season(uuid)   from public, anon;
grant execute on function public.admin_list_users()               to authenticated;
grant execute on function public.admin_find_user(text)            to authenticated;
grant execute on function public.admin_set_current_season(uuid)   to authenticated;
