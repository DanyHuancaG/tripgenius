-- =============================================================================
-- TripGenius — 002_generacion_ia.sql
-- Hito 3 — IA integrada (Gemini) · Actividad 1
-- Requiere: 001_schema_inicial.sql
--
-- Contenido:
--   1. Esquema `private` con validaciones reutilizables (no expuesto por la API)
--   2. generaciones_log: columnas para la solicitud, el itinerario validado y
--      la trazabilidad del token; lectura del cliente limitada a columnas seguras
--   3. public.iniciar_generacion   — rate limit atómico 5/día America/Lima (C4)
--   4. public.completar_generacion — valida y emite token de un solo uso (C2)
--   5. public.guardar_itinerario_completo(p_token) — verifica, bloquea y
--      consume el token y guarda en la MISMA transacción (C1, C2)
--   6. Elimina la firma antigua de la RPC (JSON enviado por el navegador)
--
-- Permisos resultantes:
--   iniciar_generacion, completar_generacion → solo service_role (Edge Function)
--   guardar_itinerario_completo(uuid)        → solo authenticated
--   esquema private                          → sin acceso para anon/authenticated
--
-- Códigos de error (PostgREST traduce PTnnn a HTTP nnn):
--   22023 → 400 datos inválidos      42501 → sesión no válida
--   PT403 → 403 token inválido/ajeno/vencido   PT409 → 409 ya guardado
--   PT429 → 429 límite diario alcanzado
--
-- ⚠ Operación destructiva: DROP FUNCTION de la firma antigua de
--   guardar_itinerario_completo (no borra datos).
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. ESQUEMA PRIVATE — validaciones compartidas
-- -----------------------------------------------------------------------------
-- PostgREST solo expone `public`; además se revoca todo acceso de los roles de
-- la API. Estas funciones solo se ejecutan dentro de las funciones
-- SECURITY DEFINER de abajo (cuyo dueño es postgres).

create schema private;
revoke all on schema private from public, anon, authenticated;

-- 1.1 Destinos válidos del Perú
--     Debe mantenerse sincronizada con DESTINOS_PERU en src/js/viaje.js
create function private.destinos_peru()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'Lima', 'Callao', 'Cusco', 'Machu Picchu', 'Valle Sagrado', 'Ollantaytambo', 'Pisac',
    'Arequipa', 'Valle del Colca', 'Colca', 'Puno', 'Lago Titicaca', 'Iquitos', 'Loreto',
    'Trujillo', 'La Libertad', 'Huanchaco', 'Chiclayo', 'Lambayeque', 'Piura', 'Máncora',
    'Tumbes', 'Punta Sal', 'Zorritos', 'Cajamarca', 'Chachapoyas', 'Amazonas', 'Kuélap',
    'Huaraz', 'Áncash', 'Chavín', 'Ica', 'Paracas', 'Pisco', 'Huacachina', 'Nazca', 'Chincha',
    'Lunahuaná', 'Cañete', 'Ayacucho', 'Huancayo', 'Junín', 'Tarma', 'Oxapampa', 'Pozuzo',
    'Pasco', 'Huánuco', 'Huancavelica', 'Tarapoto', 'San Martín', 'Moyobamba',
    'Puerto Maldonado', 'Madre de Dios', 'Tambopata', 'Tacna', 'Moquegua', 'Ilo',
    'Abancay', 'Apurímac', 'Andahuaylas', 'Pucallpa', 'Ucayali'
  ]::text[];
$$;

-- 1.2 Valida las preferencias del viaje (lanza 22023 si algo no es válido)
create function private.validar_solicitud(
  p_destino      text,
  p_dias         integer,
  p_presupuesto  numeric,
  p_intereses    text[]
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_destino is null or not (btrim(p_destino) = any (private.destinos_peru())) then
    raise exception 'La cobertura del MVP está limitada a destinos del Perú.' using errcode = '22023';
  end if;

  if p_dias is null or p_dias not between 2 and 5 then
    raise exception 'La duración debe ser entre 2 y 5 días.' using errcode = '22023';
  end if;

  if p_presupuesto is null or p_presupuesto <= 0 or p_presupuesto > 99999999.99 then
    raise exception 'El presupuesto debe ser mayor a S/ 0.' using errcode = '22023';
  end if;

  if p_intereses is null
     or cardinality(p_intereses) not between 1 and 5
     or not (p_intereses <@ array['cultura', 'aventura', 'gastronomia', 'naturaleza', 'familiar']::text[])
     or cardinality(p_intereses) <> (select count(distinct x) from unnest(p_intereses) as x)
  then
    raise exception 'Intereses no válidos.' using errcode = '22023';
  end if;
end;
$$;

-- 1.3 Valida la estructura del itinerario y devuelve el costo total estimado.
--     Mismas reglas que la RPC del Hito 2. Lanza 22023 si algo no es válido.
create function private.validar_itinerario(
  p_itinerario  jsonb,
  p_destino     text,
  p_dias        integer
)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  c_max_actividades_dia constant integer := 15;
  c_max_json_bytes      constant integer := 100000;

  v_dias_json  jsonb;
  v_dia        jsonb;
  v_dia_ord    bigint;
  v_act        jsonb;
  v_hora       jsonb;
  v_desc       jsonb;
  v_costo      jsonb;
  v_total      numeric(10,2) := 0;
begin
  if p_itinerario is null or jsonb_typeof(p_itinerario) <> 'object' then
    raise exception 'El itinerario debe ser un objeto JSON.' using errcode = '22023';
  end if;

  if octet_length(p_itinerario::text) > c_max_json_bytes then
    raise exception 'El itinerario excede el tamaño permitido.' using errcode = '22023';
  end if;

  if p_itinerario->>'destino' is distinct from btrim(p_destino)
     or jsonb_typeof(p_itinerario->'dias') is distinct from 'number'
     or (p_itinerario->>'dias') is distinct from p_dias::text
  then
    raise exception 'El destino o la duración del itinerario no coinciden con el viaje.' using errcode = '22023';
  end if;

  v_dias_json := p_itinerario->'itinerario';
  if jsonb_typeof(v_dias_json) is distinct from 'array'
     or jsonb_array_length(v_dias_json) <> p_dias
  then
    raise exception 'El itinerario debe tener exactamente % días.', p_dias using errcode = '22023';
  end if;

  for v_dia, v_dia_ord in
    select e.value, e.ord from jsonb_array_elements(v_dias_json) with ordinality as e(value, ord)
  loop
    -- Los días deben venir en orden: 1, 2, …, N
    if jsonb_typeof(v_dia) <> 'object'
       or jsonb_typeof(v_dia->'dia') is distinct from 'number'
       or (v_dia->>'dia') <> v_dia_ord::text
    then
      raise exception 'Día % no válido o fuera de orden.', v_dia_ord using errcode = '22023';
    end if;

    if jsonb_typeof(v_dia->'actividades') is distinct from 'array'
       or jsonb_array_length(v_dia->'actividades') not between 1 and c_max_actividades_dia
    then
      raise exception 'El día % debe tener entre 1 y % actividades.', v_dia_ord, c_max_actividades_dia
        using errcode = '22023';
    end if;

    for v_act in select a.value from jsonb_array_elements(v_dia->'actividades') as a(value)
    loop
      if jsonb_typeof(v_act) <> 'object' then
        raise exception 'Actividad no válida en el día %.', v_dia_ord using errcode = '22023';
      end if;

      -- nombre: obligatorio
      if jsonb_typeof(v_act->'nombre') is distinct from 'string'
         or char_length(btrim(v_act->>'nombre')) not between 1 and 200
      then
        raise exception 'Actividad sin nombre válido en el día %.', v_dia_ord using errcode = '22023';
      end if;

      -- hora_sugerida: opcional, formato HH:MM
      v_hora := v_act->'hora_sugerida';
      if v_hora is not null and jsonb_typeof(v_hora) <> 'null'
         and (jsonb_typeof(v_hora) <> 'string'
              or (v_hora #>> '{}') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
      then
        raise exception 'Hora sugerida no válida en el día %.', v_dia_ord using errcode = '22023';
      end if;

      -- descripcion: opcional, texto
      v_desc := v_act->'descripcion';
      if v_desc is not null and jsonb_typeof(v_desc) <> 'null'
         and (jsonb_typeof(v_desc) <> 'string' or char_length(v_desc #>> '{}') > 1000)
      then
        raise exception 'Descripción no válida en el día %.', v_dia_ord using errcode = '22023';
      end if;

      -- costo_no_estimado: booleano explícito y coherente con costo_estimado
      if jsonb_typeof(v_act->'costo_no_estimado') is distinct from 'boolean' then
        raise exception 'Falta costo_no_estimado en una actividad del día %.', v_dia_ord using errcode = '22023';
      end if;

      v_costo := v_act->'costo_estimado';
      if (v_act->>'costo_no_estimado')::boolean then
        -- No estimado: nunca se imputa como cero
        if v_costo is not null and jsonb_typeof(v_costo) <> 'null' then
          raise exception 'Una actividad no estimada no debe tener costo (día %).', v_dia_ord using errcode = '22023';
        end if;
      else
        if jsonb_typeof(v_costo) is distinct from 'number' then
          raise exception 'Costo estimado no válido en el día %.', v_dia_ord using errcode = '22023';
        end if;
        if (v_costo #>> '{}')::numeric < 0 then
          raise exception 'Costo estimado negativo en el día %.', v_dia_ord using errcode = '22023';
        end if;
        v_total := v_total + round((v_costo #>> '{}')::numeric, 2);
      end if;
    end loop;
  end loop;

  return v_total;
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. GENERACIONES_LOG — nuevas columnas y permisos de lectura
-- -----------------------------------------------------------------------------

alter table public.generaciones_log
  add column solicitud     jsonb,          -- {destino, dias, presupuesto, intereses}
  add column itinerario    jsonb,          -- itinerario validado por el servidor
  add column modelo        text,           -- modelo de Gemini que respondió
  add column completado_en timestamptz,    -- cuándo terminó la generación
  add column usado_en      timestamptz,    -- cuándo se consumió el token
  add column viaje_id      uuid references public.viajes (id) on delete set null,
  -- Una generación exitosa siempre tiene token, vencimiento, itinerario y hash
  add constraint generaciones_log_exito_completo check (
    estado <> 'exito'
    or (token_generacion is not null and expira_en is not null
        and itinerario is not null and hash_itinerario is not null)
  ),
  -- Un token solo se marca usado junto con el viaje que generó
  add constraint generaciones_log_uso_coherente check (
    not token_usado or (usado_en is not null and estado = 'exito')
  );

comment on table public.generaciones_log is
  'Intentos de generación con IA (rate limit 5/día America/Lima). '
  'Solo escriben las funciones del servidor; el cliente solo lee columnas no sensibles.';

-- El cliente solo puede leer columnas no sensibles de sus propias filas (RLS).
-- token_generacion, hash_itinerario e itinerario no son legibles desde la API.
revoke select on table public.generaciones_log from authenticated;
grant select (id, user_id, estado, created_at, completado_en, token_usado, viaje_id)
  on table public.generaciones_log to authenticated;

-- (Las escrituras ya estaban revocadas a anon/authenticated en la 001; se
--  reafirma por defensa en profundidad.)
revoke insert, update, delete, truncate on table public.generaciones_log from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. INICIAR_GENERACION — reserva atómica del cupo diario (C4)
-- -----------------------------------------------------------------------------
-- La invoca la Edge Function con service_role, pasando el user_id obtenido de
-- un JWT verificado. Valida la solicitud ANTES de consumir cupo (los datos
-- inválidos no cuentan). Luego, en la misma transacción:
--   advisory lock por usuario → contar intentos del día (Lima) → reservar.
-- El lock se mantiene hasta el COMMIT, por lo que dos solicitudes simultáneas
-- del mismo usuario se serializan: la segunda cuenta la reserva de la primera.

create function public.iniciar_generacion(
  p_user_id      uuid,
  p_destino      text,
  p_dias         integer,
  p_presupuesto  numeric,
  p_intereses    text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_limite_diario constant integer := 5;
  v_inicio_dia    timestamptz;
  v_usados        integer;
  v_log_id        uuid;
begin
  if p_user_id is null
     or not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'Usuario no válido.' using errcode = '42501';
  end if;

  perform private.validar_solicitud(p_destino, p_dias, p_presupuesto, p_intereses);

  -- Serializa las solicitudes de este usuario hasta el fin de la transacción
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('tripgenius:generacion:' || p_user_id::text, 0)
  );

  -- Medianoche de hoy en hora de Perú
  v_inicio_dia := pg_catalog.date_trunc('day', pg_catalog.now() at time zone 'America/Lima')
                  at time zone 'America/Lima';

  -- Cuentan todos los intentos: pendientes, exitosos y fallidos
  select count(*) into v_usados
  from public.generaciones_log g
  where g.user_id = p_user_id
    and g.created_at >= v_inicio_dia;

  if v_usados >= c_limite_diario then
    raise exception 'Alcanzaste el límite de % generaciones por hoy. Vuelve mañana.', c_limite_diario
      using errcode = 'PT429';
  end if;

  insert into public.generaciones_log (user_id, estado, solicitud)
  values (
    p_user_id,
    'pendiente',
    jsonb_build_object(
      'destino',     btrim(p_destino),
      'dias',        p_dias,
      'presupuesto', round(p_presupuesto, 2),
      'intereses',   to_jsonb(p_intereses)
    )
  )
  returning id into v_log_id;

  return jsonb_build_object(
    'log_id',             v_log_id,
    'intentos_usados',    v_usados + 1,
    'intentos_restantes', c_limite_diario - (v_usados + 1)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. COMPLETAR_GENERACION — registra el resultado y emite el token (C2)
-- -----------------------------------------------------------------------------
-- La invoca la Edge Function con service_role después de llamar a Gemini.
--   p_estado = 'exito'           → valida el itinerario contra la solicitud
--                                  guardada; si es válido, lo guarda con los
--                                  totales del servidor y emite un token de
--                                  un solo uso (30 min). Si no es válido,
--                                  registra 'fallo_validacion'.
--   p_estado = 'fallo_proveedor' → Gemini falló o superó el tiempo de espera.
--   p_estado = 'fallo_validacion'→ la Edge Function ya detectó JSON inválido.
-- Devuelve {ok, estado, token?, expira_en?, itinerario?, motivo?}.

create function public.completar_generacion(
  p_log_id      uuid,
  p_user_id     uuid,
  p_estado      text,
  p_itinerario  jsonb default null,
  p_modelo      text  default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_vigencia constant interval := interval '30 minutes';
  v_log         public.generaciones_log%rowtype;
  v_destino     text;
  v_dias        integer;
  v_presupuesto numeric(10,2);
  v_total       numeric(10,2);
  v_itinerario  jsonb;
  v_token       uuid;
  v_expira      timestamptz;
begin
  if p_estado not in ('exito', 'fallo_proveedor', 'fallo_validacion') then
    raise exception 'Estado no válido.' using errcode = '22023';
  end if;

  -- Bloquea el intento: debe ser del usuario y seguir pendiente
  select * into v_log
  from public.generaciones_log g
  where g.id = p_log_id and g.user_id = p_user_id
  for update;

  if not found or v_log.estado <> 'pendiente' then
    raise exception 'Generación no encontrada o ya completada.' using errcode = 'PT403';
  end if;

  if p_estado <> 'exito' then
    update public.generaciones_log
       set estado = p_estado, modelo = p_modelo, completado_en = pg_catalog.now()
     where id = p_log_id;
    return jsonb_build_object('ok', false, 'estado', p_estado);
  end if;

  v_destino     := v_log.solicitud->>'destino';
  v_dias        := (v_log.solicitud->>'dias')::integer;
  v_presupuesto := (v_log.solicitud->>'presupuesto')::numeric;

  -- Valida la respuesta de la IA contra lo que el usuario pidió
  begin
    v_total := private.validar_itinerario(p_itinerario, v_destino, v_dias);
  exception when sqlstate '22023' then
    update public.generaciones_log
       set estado = 'fallo_validacion', modelo = p_modelo, completado_en = pg_catalog.now()
     where id = p_log_id;
    return jsonb_build_object('ok', false, 'estado', 'fallo_validacion', 'motivo', sqlerrm);
  end;

  -- Totales y advertencia calculados por el servidor (se ignoran los de la IA)
  v_itinerario := p_itinerario || jsonb_build_object(
    'presupuesto_ingresado',   v_presupuesto,
    'costo_total_estimado',    v_total,
    'advertencia_presupuesto', v_total > v_presupuesto,
    'intereses',               v_log.solicitud->'intereses'
  );
  v_token  := pg_catalog.gen_random_uuid();
  v_expira := pg_catalog.now() + c_vigencia;

  update public.generaciones_log
     set estado           = 'exito',
         itinerario       = v_itinerario,
         hash_itinerario  = pg_catalog.encode(
                              pg_catalog.sha256(pg_catalog.convert_to(v_itinerario::text, 'UTF8')), 'hex'),
         token_generacion = v_token,
         expira_en        = v_expira,
         modelo           = p_modelo,
         completado_en    = pg_catalog.now()
   where id = p_log_id;

  return jsonb_build_object(
    'ok',         true,
    'estado',     'exito',
    'token',      v_token,
    'expira_en',  v_expira,
    'itinerario', v_itinerario
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. GUARDAR_ITINERARIO_COMPLETO(p_token) — sustituye a la firma del Hito 2
-- -----------------------------------------------------------------------------
-- El navegador solo envía el token. En UNA transacción:
--   1. identidad con auth.uid() (C1)
--   2. bloquea la fila del token (FOR UPDATE): un doble clic o dos pestañas
--      se serializan y la segunda ve el token ya consumido
--   3. verifica propiedad, estado, vigencia, uso único e integridad (hash)
--   4. revalida el itinerario guardado e inserta viaje + itinerario + actividades
--   5. consume el token
-- Cualquier error revierte todo, incluido el consumo del token.

-- 5.1 Firma antigua (JSON enviado por el navegador): se revoca y se elimina
revoke all on function public.guardar_itinerario_completo(text, integer, numeric, text[], jsonb)
  from public, anon, authenticated;
drop function public.guardar_itinerario_completo(text, integer, numeric, text[], jsonb);

-- 5.2 Nueva firma
create function public.guardar_itinerario_completo(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id        uuid;
  v_log            public.generaciones_log%rowtype;
  v_destino        text;
  v_dias           integer;
  v_presupuesto    numeric(10,2);
  v_intereses      text[];
  v_total          numeric(10,2);
  v_viaje_id       uuid;
  v_itinerario_id  uuid;
begin
  -- 1. Identidad: solo del JWT (C1)
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Sesión no válida. Inicia sesión de nuevo.' using errcode = '42501';
  end if;

  if p_token is null then
    raise exception 'Sesión de generación inválida. Genera el itinerario de nuevo.' using errcode = 'PT403';
  end if;

  -- 2. Bloqueo del token
  select * into v_log
  from public.generaciones_log g
  where g.token_generacion = p_token
  for update;

  -- 3. Propiedad, estado e integridad. Token inexistente o ajeno → mismo
  --    mensaje, para no revelar si existe.
  if not found or v_log.user_id <> v_user_id or v_log.estado <> 'exito'
     or v_log.itinerario is null
     or v_log.hash_itinerario is distinct from pg_catalog.encode(
          pg_catalog.sha256(pg_catalog.convert_to(v_log.itinerario::text, 'UTF8')), 'hex')
  then
    raise exception 'Sesión de generación inválida. Genera el itinerario de nuevo.' using errcode = 'PT403';
  end if;

  if v_log.token_usado then
    raise exception 'Este itinerario ya fue guardado.' using errcode = 'PT409';
  end if;

  if v_log.expira_en <= pg_catalog.now() then
    raise exception 'La generación expiró. Genera el itinerario de nuevo.' using errcode = 'PT403';
  end if;

  -- 4. Revalidación (defensa en profundidad) e inserciones
  v_destino     := v_log.solicitud->>'destino';
  v_dias        := (v_log.solicitud->>'dias')::integer;
  v_presupuesto := (v_log.solicitud->>'presupuesto')::numeric;
  select array_agg(x) into v_intereses
  from jsonb_array_elements_text(v_log.solicitud->'intereses') as x;

  perform private.validar_solicitud(v_destino, v_dias, v_presupuesto, v_intereses);
  v_total := private.validar_itinerario(v_log.itinerario, v_destino, v_dias);

  insert into public.viajes (user_id, destino, dias, presupuesto, intereses)
  values (v_user_id, v_destino, v_dias, v_presupuesto, v_intereses)
  returning id into v_viaje_id;

  insert into public.itinerarios (viaje_id, user_id, costo_total_estimado, advertencia_presupuesto, json_raw)
  values (v_viaje_id, v_user_id, v_total, v_total > v_presupuesto, v_log.itinerario)
  returning id into v_itinerario_id;

  insert into public.actividades
    (itinerario_id, dia, hora_sugerida, nombre, descripcion, costo_estimado, costo_no_estimado)
  select
    v_itinerario_id,
    (d.value->>'dia')::integer,
    nullif(a.value->>'hora_sugerida', ''),
    btrim(a.value->>'nombre'),
    a.value->>'descripcion',
    case when (a.value->>'costo_no_estimado')::boolean then null
         else round((a.value->>'costo_estimado')::numeric, 2) end,
    (a.value->>'costo_no_estimado')::boolean
  from jsonb_array_elements(v_log.itinerario->'itinerario') as d(value)
  cross join lateral jsonb_array_elements(d.value->'actividades') as a(value);

  -- 5. Consumo del token (se revierte si algo de lo anterior falla)
  update public.generaciones_log
     set token_usado = true, usado_en = pg_catalog.now(), viaje_id = v_viaje_id
   where id = v_log.id;

  return jsonb_build_object('viaje_id', v_viaje_id, 'itinerario_id', v_itinerario_id);
end;
$$;

comment on function public.guardar_itinerario_completo(uuid) is
  'Hito 3: guarda el itinerario generado por TripGenius usando solo su token de un solo uso. '
  'Verifica, bloquea y consume el token en la misma transacción que las inserciones.';

-- -----------------------------------------------------------------------------
-- 6. PERMISOS DE EJECUCIÓN
-- -----------------------------------------------------------------------------
-- Supabase concede EXECUTE por defecto a anon/authenticated en funciones nuevas
-- de `public`: se revoca todo y se concede explícitamente.

revoke all on function public.iniciar_generacion(uuid, text, integer, numeric, text[])
  from public, anon, authenticated;
revoke all on function public.completar_generacion(uuid, uuid, text, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.guardar_itinerario_completo(uuid)
  from public, anon;

grant execute on function public.iniciar_generacion(uuid, text, integer, numeric, text[]) to service_role;
grant execute on function public.completar_generacion(uuid, uuid, text, jsonb, text)      to service_role;
grant execute on function public.guardar_itinerario_completo(uuid)                       to authenticated;

commit;
