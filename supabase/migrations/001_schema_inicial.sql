-- =============================================================================
-- TripGenius — 001_schema_inicial.sql
-- Hito 2 — Persistencia (Supabase)
--
-- Contenido:
--   1. Tablas: generaciones_log, viajes, itinerarios, actividades
--   2. Permisos (GRANT/REVOKE) y Row Level Security
--   3. RPC public.guardar_itinerario_completo (transacción atómica)
--
-- Condiciones de seguridad cubiertas:
--   C1 — La RPC obtiene la identidad con auth.uid(); SECURITY DEFINER con
--        search_path vacío y todos los objetos calificados por esquema.
--   C3 — generaciones_log sin permisos de escritura para el cliente.
--
-- ⚠ PENDIENTE HITO 3 (decisión 1, aprobada solo de forma temporal):
--   En el Hito 2 el frontend invoca la RPC directamente con la sesión del
--   usuario. Esto permite que un usuario autenticado guarde un itinerario que
--   no fue generado por TripGenius (los datos se validan, pero su origen no).
--   En el Hito 3 se debe restringir o rediseñar el acceso:
--     - añadir el token de generación de un solo uso + hash SHA-256 (C2),
--       verificado dentro de la transacción;
--     - y/o revocar EXECUTE a `authenticated` para que solo la Edge Function
--       `guardar-itinerario` pueda invocarla. Si la Edge Function usa
--       service_role, auth.uid() devuelve NULL: deberá reenviar el JWT del
--       usuario o rediseñarse la obtención de identidad sin romper C1.
--
-- Fuera de alcance de este hito: Gemini, Edge Functions, token C2, rate limit.
-- Ejecutar en: Supabase Dashboard → SQL Editor.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. TABLAS
-- -----------------------------------------------------------------------------

-- 1.1 generaciones_log — registro de intentos de generación (se usa en Hito 3)
create table public.generaciones_log (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users (id) on delete cascade,
  estado            text        not null
                    check (estado in ('pendiente', 'exito', 'fallo_proveedor', 'fallo_validacion')),
  token_generacion  uuid        unique,
  hash_itinerario   text,
  expira_en         timestamptz,
  token_usado       boolean     not null default false,
  created_at        timestamptz not null default now()
);

create index generaciones_log_user_fecha_idx
  on public.generaciones_log (user_id, created_at desc);

-- 1.2 viajes — preferencias del viaje
create table public.viajes (
  id           uuid          primary key default gen_random_uuid(),
  user_id      uuid          not null references auth.users (id) on delete cascade,
  destino      text          not null check (char_length(destino) between 2 and 80),
  dias         integer       not null check (dias between 2 and 5),
  presupuesto  numeric(10,2) not null check (presupuesto > 0),
  intereses    text[]        not null
               check (
                 cardinality(intereses) between 1 and 5
                 and intereses <@ array['cultura', 'aventura', 'gastronomia', 'naturaleza', 'familiar']::text[]
               ),
  created_at   timestamptz   not null default now(),
  -- Permite que itinerarios referencie (id, user_id) y garantice el mismo dueño
  unique (id, user_id)
);

create index viajes_user_fecha_idx on public.viajes (user_id, created_at desc);

-- 1.3 itinerarios — relación 1:1 con viajes
create table public.itinerarios (
  id                       uuid          primary key default gen_random_uuid(),
  viaje_id                 uuid          not null unique,
  user_id                  uuid          not null references auth.users (id) on delete cascade,
  costo_total_estimado     numeric(10,2) not null default 0 check (costo_total_estimado >= 0),
  advertencia_presupuesto  boolean       not null default false,
  json_raw                 jsonb         not null,
  created_at               timestamptz   not null default now(),
  -- FK compuesta: el itinerario pertenece al mismo usuario que el viaje
  foreign key (viaje_id, user_id) references public.viajes (id, user_id) on delete cascade
);

create index itinerarios_user_idx on public.itinerarios (user_id);

-- 1.4 actividades
create table public.actividades (
  id                 uuid          primary key default gen_random_uuid(),
  itinerario_id      uuid          not null references public.itinerarios (id) on delete cascade,
  dia                integer       not null check (dia between 1 and 5),
  hora_sugerida      text          check (hora_sugerida ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  nombre             text          not null check (char_length(nombre) between 1 and 200),
  descripcion        text          check (char_length(descripcion) <= 1000),
  costo_estimado     numeric(10,2) check (costo_estimado >= 0),
  costo_no_estimado  boolean       not null default false,
  -- Un costo no estimado nunca se guarda como cero
  check (
    (costo_no_estimado and costo_estimado is null)
    or (not costo_no_estimado and costo_estimado is not null)
  )
);

create index actividades_itinerario_dia_idx
  on public.actividades (itinerario_id, dia, hora_sugerida);

-- -----------------------------------------------------------------------------
-- 2. PERMISOS Y ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
-- Supabase concede por defecto todos los privilegios sobre tablas de `public`
-- a anon y authenticated. Se revocan y se concede solo lectura a usuarios
-- autenticados; toda escritura pasa por la RPC (decisión 2).

revoke all on table
  public.generaciones_log, public.viajes, public.itinerarios, public.actividades
  from anon, authenticated;

grant select on table
  public.generaciones_log, public.viajes, public.itinerarios, public.actividades
  to authenticated;

alter table public.generaciones_log enable row level security;
alter table public.viajes           enable row level security;
alter table public.itinerarios      enable row level security;
alter table public.actividades      enable row level security;

-- 2.1 generaciones_log — solo lectura de lo propio (C3).
--     Sin políticas de INSERT/UPDATE/DELETE: solo service_role (Hito 3).
create policy gen_log_select_own on public.generaciones_log
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- 2.2 viajes — solo lectura de lo propio (sin viajes_insert_own, decisión 2)
create policy viajes_select_own on public.viajes
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- 2.3 itinerarios
create policy itinerarios_select_own on public.itinerarios
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- 2.4 actividades — visibles si el itinerario es del usuario
create policy actividades_select_own on public.actividades
  for select to authenticated
  using (
    exists (
      select 1
      from public.itinerarios i
      where i.id = actividades.itinerario_id
        and i.user_id = (select auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- 3. RPC — guardar_itinerario_completo
-- -----------------------------------------------------------------------------
-- Guarda viaje + itinerario + actividades en una única transacción. Cualquier
-- RAISE EXCEPTION revierte todo: no quedan registros parciales.
--
-- p_itinerario: JSON del itinerario (formato de la Sección 9 del plan):
--   { "destino": text, "dias": int,
--     "itinerario": [ { "dia": 1, "actividades": [ {
--         "hora_sugerida": "HH:MM" | null, "nombre": text,
--         "descripcion": text | null, "costo_estimado": number | null,
--         "costo_no_estimado": boolean } ] } ] }
--
-- El costo total y la advertencia de presupuesto se recalculan en el servidor;
-- los valores que envíe el cliente se ignoran.
--
-- Devuelve: { "viaje_id": uuid, "itinerario_id": uuid }

create function public.guardar_itinerario_completo(
  p_destino      text,
  p_dias         integer,
  p_presupuesto  numeric,
  p_intereses    text[],
  p_itinerario   jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Debe mantenerse sincronizada con DESTINOS_PERU en src/js/viaje.js
  c_destinos constant text[] := array[
    'Lima', 'Callao', 'Cusco', 'Machu Picchu', 'Valle Sagrado', 'Ollantaytambo', 'Pisac',
    'Arequipa', 'Valle del Colca', 'Colca', 'Puno', 'Lago Titicaca', 'Iquitos', 'Loreto',
    'Trujillo', 'La Libertad', 'Huanchaco', 'Chiclayo', 'Lambayeque', 'Piura', 'Máncora',
    'Tumbes', 'Punta Sal', 'Zorritos', 'Cajamarca', 'Chachapoyas', 'Amazonas', 'Kuélap',
    'Huaraz', 'Áncash', 'Chavín', 'Ica', 'Paracas', 'Pisco', 'Huacachina', 'Nazca', 'Chincha',
    'Lunahuaná', 'Cañete', 'Ayacucho', 'Huancayo', 'Junín', 'Tarma', 'Oxapampa', 'Pozuzo',
    'Pasco', 'Huánuco', 'Huancavelica', 'Tarapoto', 'San Martín', 'Moyobamba',
    'Puerto Maldonado', 'Madre de Dios', 'Tambopata', 'Tacna', 'Moquegua', 'Ilo',
    'Abancay', 'Apurímac', 'Andahuaylas', 'Pucallpa', 'Ucayali'
  ];
  c_intereses constant text[] := array['cultura', 'aventura', 'gastronomia', 'naturaleza', 'familiar'];
  c_max_actividades_dia constant integer := 15;
  c_max_json_bytes      constant integer := 100000;

  v_user_id        uuid;
  v_dias_json      jsonb;
  v_dia            jsonb;
  v_dia_ord        bigint;
  v_act            jsonb;
  v_hora           jsonb;
  v_desc           jsonb;
  v_costo          jsonb;
  v_total          numeric(10,2) := 0;
  v_advertencia    boolean;
  v_viaje_id       uuid;
  v_itinerario_id  uuid;
begin
  -- ── Identidad: solo del JWT, nunca del navegador (C1) ──
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Sesión no válida. Inicia sesión de nuevo.' using errcode = '42501';
  end if;

  -- ── Preferencias del viaje ──
  if p_destino is null or not (btrim(p_destino) = any (c_destinos)) then
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
     or not (p_intereses <@ c_intereses)
     or cardinality(p_intereses) <> (select count(distinct x) from unnest(p_intereses) as x)
  then
    raise exception 'Intereses no válidos.' using errcode = '22023';
  end if;

  -- ── Estructura del itinerario ──
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

  -- ── Validación de días y actividades + cálculo del costo total ──
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

  v_advertencia := v_total > p_presupuesto;

  -- ── Inserciones (misma transacción) ──
  insert into public.viajes (user_id, destino, dias, presupuesto, intereses)
  values (v_user_id, btrim(p_destino), p_dias, round(p_presupuesto, 2), p_intereses)
  returning id into v_viaje_id;

  insert into public.itinerarios (viaje_id, user_id, costo_total_estimado, advertencia_presupuesto, json_raw)
  values (
    v_viaje_id,
    v_user_id,
    v_total,
    v_advertencia,
    -- Se guardan los totales calculados por el servidor, no los del cliente
    p_itinerario
      || jsonb_build_object(
           'presupuesto_ingresado',   round(p_presupuesto, 2),
           'costo_total_estimado',    v_total,
           'advertencia_presupuesto', v_advertencia
         )
  )
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
  from jsonb_array_elements(v_dias_json) as d(value)
  cross join lateral jsonb_array_elements(d.value->'actividades') as a(value);

  return jsonb_build_object('viaje_id', v_viaje_id, 'itinerario_id', v_itinerario_id);
end;
$$;

comment on function public.guardar_itinerario_completo(text, integer, numeric, text[], jsonb) is
  'Hito 2: guarda viaje + itinerario + actividades de forma atómica usando auth.uid(). '
  'TEMPORAL: invocable por authenticated. En Hito 3 restringir/rediseñar (token C2 o solo Edge Function).';

-- Permisos de ejecución: solo usuarios autenticados (Supabase concede EXECUTE
-- a anon por defecto en funciones nuevas de `public`).
revoke all on function public.guardar_itinerario_completo(text, integer, numeric, text[], jsonb)
  from public, anon;
grant execute on function public.guardar_itinerario_completo(text, integer, numeric, text[], jsonb)
  to authenticated;

commit;
