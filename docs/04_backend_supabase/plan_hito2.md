# Plan del Hito 2: Persistencia con Supabase

> **Estado:** ✅ Completado (20 Oct 2026)
> **Plan base:** `docs/02_context_engineering/plan_arquitectura.md` (v3) · **Seguimiento:** `docs/02_context_engineering/roadmap.md`
> **Proyecto Supabase:** `slymqwtupzmhfifhhgzp`

---

## 1. Objetivo

Reemplazar el login, el registro y el guardado simulados por Supabase real, con los datos aislados por usuario mediante RLS.

**Criterio de salida:** login real → dashboard → guardar viaje → cerrar sesión → volver → consultar viaje.

El itinerario que se guarda **sigue siendo simulado**: se genera con los datos del formulario. La IA real corresponde al Hito 3.

## 2. Decisiones aprobadas

| # | Decisión | Motivo |
|---|---|---|
| 1 | **Temporal:** el frontend invoca directamente la RPC `guardar_itinerario_completo` con la sesión del usuario | La Edge Function `guardar-itinerario` y el token C2 son del Hito 3 |
| 2 | Se **elimina** la política `viajes_insert_own`. Toda escritura pasa por la RPC transaccional | Evita viajes sin itinerario y deja un solo punto de entrada para escribir |

### Texto de aprobación del responsable

> Apruebo el Plan del Hito 2 y confirmo las decisiones 1 y 2. Antes de generar el SQL definitivo:
> 1. La RPC debe obtener la identidad mediante `auth.uid()`, sin confiar en un `user_id` del navegador.
> 2. `SECURITY DEFINER` con `search_path` restringido, objetos referenciados por esquema y permisos de ejecución controlados.
> 3. Validar duración, presupuesto, intereses, días del itinerario, actividades y costos desde PostgreSQL.
> 4. Garantizar atomicidad: si falla cualquier inserción, no persiste ningún registro parcial.
> 5. Mantener RLS para proteger la información de cada usuario.
> 6. Documentar que el acceso directo a la RPC deberá restringirse o rediseñarse en el Hito 3.
> 7. Mantener Gemini y las Edge Functions fuera del alcance de este hito.

## 3. Base de datos: `supabase/migrations/001_schema_inicial.sql`

| Tabla | Restricciones principales | RLS / permisos |
|---|---|---|
| `generaciones_log` | `estado` en una lista cerrada, `token_generacion` UNIQUE | Solo SELECT de las filas propias. Sin escritura para el cliente (C3) |
| `viajes` | `dias` 2–5, `presupuesto` > 0, intereses de la lista cerrada (1–5), destino de 2 a 80 caracteres | Solo SELECT de lo propio |
| `itinerarios` | `UNIQUE(viaje_id)`, FK compuesta `(viaje_id, user_id)` → `viajes` | Solo SELECT de lo propio |
| `actividades` | Hora `HH:MM`. Coherencia entre `costo_no_estimado` y `costo_estimado` (un costo no estimado nunca vale 0) | SELECT si el itinerario es del usuario |

Supabase concede todos los privilegios por defecto a `anon` y `authenticated`. La migración los revoca y solo concede `SELECT` a `authenticated`.

### RPC `guardar_itinerario_completo(p_destino, p_dias, p_presupuesto, p_intereses, p_itinerario)`

- Obtiene la identidad con `auth.uid()` y no tiene parámetro de usuario (C1).
- `SECURITY DEFINER`, `SET search_path = ''` y todos los objetos calificados por esquema.
- `EXECUTE` revocado a `public` y `anon`, y concedido a `authenticated`.
- Valida:
  - destino de la lista del Perú;
  - días 2–5 y presupuesto > 0;
  - intereses válidos y sin repetir;
  - días del JSON en orden 1..N, con 1–15 actividades por día;
  - nombre, hora, descripción y costos;
  - tamaño del JSON de hasta 100 KB.
- **Recalcula en el servidor** el costo total y la advertencia de presupuesto, e ignora los valores que envía el cliente.
- Es atómica: cualquier error revierte todo.
- Devuelve `{viaje_id, itinerario_id}`.

### Desviaciones respecto al plan v3

1. `search_path = ''` en lugar de `public, pg_temp`. Es más estricto y es lo que recomienda Supabase.
2. No se reciben `p_costo_total` ni `p_advertencia`: los calcula el servidor.
3. Devuelve `viaje_id` además de `itinerario_id`, porque el frontend lo necesita para el detalle.
4. No tiene `p_token_gen`: se añade en el Hito 3 (C2).
5. FK compuesta `(viaje_id, user_id)`, que garantiza que el dueño del itinerario sea el mismo que el del viaje.
6. Límites que no estaban en los documentos: 15 actividades por día, nombre de 200 caracteres, descripción de 1000 y JSON de 100 KB.

## 4. Configuración del proyecto (hecha por el responsable)

- Auth: confirmación de correo activada, contraseña mínima de 8 caracteres y registros anónimos desactivados.
- URL Configuration: Site URL `http://127.0.0.1:5500` y Redirect `http://127.0.0.1:5500/**`.
- Migración ejecutada desde el SQL Editor (resultado: *Success*).
- Usuarios de prueba creados ya confirmados.

## 5. Frontend

| Archivo | Cambio |
|---|---|
| `js/supabase-client.js` | Cliente con la URL y la **publishable key**, que es pública. Incluye `Sesion.requerir()`, que manda al login a quien no tiene sesión |
| `js/auth.js` | `signUp`, `signInWithPassword` y `signOut` reales. Mensajes neutros (no revelan si falló el correo o la contraseña, ni si un correo ya existe). Avisa si el correo no está confirmado |
| `js/itinerario.js` | Guarda con la RPC y lee el detalle desde `viajes` → `itinerarios` → `actividades`. Si el viaje no existe o es ajeno, muestra "No encontramos este viaje" |
| `js/mis-viajes.js` | Lista real del usuario, ordenada por fecha. Se quitaron los viajes de ejemplo |
| `js/comun.js` (nuevo) | Etiquetas de intereses, `escapeHtml` (protección XSS) y formato en S/ |
| `js/mock-store.js` | Solo conserva el borrador del itinerario generado (sessionStorage) |
| HTML | `supabase-js@2.49.4` por CDN con versión fija. Las páginas privadas arrancan ocultas hasta confirmar la sesión. Se quitó "[Mock] Simular login exitoso" |
| `.gitignore` (nuevo) | `.env*`, `node_modules` y temporales de Supabase |

## 6. Pruebas

| Prueba | Entorno | Resultado |
|---|---|---|
| Migración, 19 validaciones, atomicidad (fallo forzado en la última actividad), RLS A/B, escrituras directas y CHECK de tabla | PostgreSQL local simulado (PGlite) | ✅ 47/47 |
| Visitante sin login: leer, insertar y ejecutar la RPC | Supabase real (API REST) | ✅ 401 permission denied |
| Registro de usuario nuevo + crear y guardar un viaje | Supabase real (manual, responsable) | ✅ |
| Flujo completo con 2 usuarios: sin sesión → login; login incorrecto; crear → guardar → cerrar sesión → volver → consultar; B no ve ni la lista ni la URL de A | Supabase real (Chrome automatizado) | ✅ 20/20 |
| RLS A/B (lista, por id, itinerarios, actividades), UPDATE y DELETE ajenos, INSERT directo, `generaciones_log`, RPC que ignora un `user_id` ajeno, validación en servidor | Supabase real (API con JWT de 2 usuarios) | ✅ 16/16 |

Las pruebas dejaron datos de prueba en el proyecto: 2 viajes a Arequipa de `usuario.c` y 1 viaje a Lima ("Prueba RLS") de `usuario.b`.

## 7. Pendientes que pasan al Hito 3

1. **Restringir o rediseñar el acceso directo a la RPC.** Hoy un usuario autenticado puede guardar un itinerario que no generó TripGenius: se validan los datos, pero no su origen. Si una Edge Function invoca la RPC con `service_role`, `auth.uid()` devuelve NULL; habrá que reenviar el JWT del usuario.
2. La lista de destinos del Perú está duplicada en `src/js/viaje.js` y en la RPC. Hay que mantenerlas sincronizadas.
