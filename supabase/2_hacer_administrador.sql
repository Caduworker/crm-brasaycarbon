-- =====================================================================
--  BRASA Y CARBÓN · Convertir a alguien en DUEÑO (administrador)
--
--  ANTES: ya debes haber ejecutado 1_schema.sql y haber creado tu usuario
--  en Supabase → Authentication → Users → Add user.
--
--  CAMBIA el correo de la línea marcada y pulsa "Run".
-- =====================================================================
do $$
declare
  v_id uuid;
begin
  select id into v_id from auth.users
   where lower(email) = lower('CAMBIA_ESTE_CORREO@ejemplo.com');   -- <<< escribe aquí TU correo

  if v_id is null then
    raise exception 'No encontré ese correo. Escríbelo igual que lo creaste en Authentication > Users.';
  end if;

  insert into public.perfiles (id, nombre, rol, activo)
  values (v_id, 'Dueño', 'admin', true)
  on conflict (id) do update
    set rol = 'admin',
        activo = true,
        nombre = case when public.perfiles.nombre = '' then 'Dueño' else public.perfiles.nombre end;
end $$;
