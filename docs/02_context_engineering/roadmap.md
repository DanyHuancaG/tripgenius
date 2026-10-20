# Roadmap — TripGenius MVP

> **Programa:** Especialización en Vibe Coding · DMC Institute
> **Metodología:** Vibe Coding con agentes de IA
> **Plan base:** `docs/02_context_engineering/plan_arquitectura.md`
> **Planes por hito:** `docs/03_frontend/plan_hito1.md` · `docs/04_backend_supabase/plan_hito2.md` · `docs/05_integracion_ia/plan_hito_03.md` · `docs/06_despliegue/plan_hito_04.md` (pendiente de aprobación)

---

## Estado general

```
✅ Hito 1 — Frontend Mock        COMPLETADO
✅ Hito 2 — Persistencia         COMPLETADO
✅ Hito 3 — IA Integrada         COMPLETADO
🟡 Hito 4 — Publicación          EN CURSO
```

---

## 🖼 Hito 1 — Frontend Mock
**Estado: ✅ Completado — Aprobado por el responsable (19 Oct 2026)**

### Correcciones previas a la aprobación
- Registro: validación de correo, contraseña (mín. 8) y confirmación; el formulario no se procesaba por un `return` temprano en `auth.js`.
- Crear viaje: validación de destino dentro del Perú (lista referencial; validación definitiva en servidor en Hito 3).
- Itinerario generado con los datos del formulario (actividades genéricas simuladas).
- Guardado simulado en el navegador (`js/mock-store.js`, localStorage): el viaje aparece en Mis viajes y persiste al cerrar sesión. Se reemplaza por Supabase en Hito 2.
- Prueba end-to-end automatizada en Chrome: 24/24 comprobaciones OK + login.

### Tareas
- [x] Crear las 5 vistas HTML en `src/`
- [x] Aplicar Tailwind CSS con paleta azul profundo + turquesa + blanco
- [x] Navegación funcional entre páginas sin backend
- [x] Datos de itinerario simulados (Cusco 3 días)
- [x] 4 estados de UI en cada vista: cargando · vacío · éxito · error
- [x] Botones `[Mock]` para probar cada estado
- [x] Validaciones de formulario en frontend
- [x] Chips de intereses seleccionables
- [x] Advertencia de presupuesto excedido con diferencial en S/
- [x] Disclaimer de estimaciones referenciales
- [x] `supabase-client.js` placeholder para Hito 2

### Criterio de salida
Flujo visual completo navegable: Login → Registro → Mis viajes → Crear viaje → Itinerario → Guardar → Mis viajes.

### Archivos creados
```
src/
├── index.html
├── register.html
├── dashboard.html
├── crear-viaje.html
├── itinerario.html
└── js/
    ├── mock-store.js
    ├── auth.js
    ├── viaje.js
    ├── itinerario.js
    ├── mis-viajes.js
    └── supabase-client.js
```

---

## 🗄 Hito 2 — Persistencia (Supabase)
**Estado: ✅ Completado — verificado por el responsable y con pruebas de seguridad en el proyecto real (20 Oct 2026)**

### Decisiones aprobadas para este hito
- **Decisión 1 (temporal):** el frontend invoca directamente la RPC `guardar_itinerario_completo` con la sesión del usuario. ⚠ Debe restringirse o rediseñarse en el Hito 3 (ver más abajo).
- **Decisión 2:** se elimina la política `viajes_insert_own`; toda escritura pasa por la RPC transaccional.

### Condiciones de seguridad previas (del plan v3)
- [x] **C1:** Función RPC usa `auth.uid()` del servidor, sin `p_user_id` como parámetro
- [x] **C1:** `SECURITY DEFINER` con `SET search_path = ''` (más estricto que `public, pg_temp`) y objetos calificados por esquema
- [x] **C3:** `generaciones_log` sin permisos de escritura para el cliente

### Tareas
- [x] Crear proyecto en Supabase (`slymqwtupzmhfifhhgzp`)
- [x] Configurar Supabase Auth (email + confirmación, contraseña mín. 8, Site URL `http://127.0.0.1:5500`)
- [x] Ejecutar `supabase/migrations/001_schema_inicial.sql` (SQL Editor → Success)
  - [x] Tabla `generaciones_log` (con campos de token C2)
  - [x] Tabla `viajes` con CHECK (dias BETWEEN 2 AND 5)
  - [x] Tabla `itinerarios` con UNIQUE(viaje_id) + FK compuesta (viaje_id, user_id)
  - [x] Tabla `actividades`
- [x] Habilitar RLS en las 4 tablas (solo SELECT de lo propio; escrituras revocadas al cliente)
- [x] Probar políticas RLS con 2 usuarios distintos en el proyecto real (`usuario.c` y `usuario.b`)
- [x] Crear función RPC `guardar_itinerario_completo` (valida entradas, recalcula costo total y advertencia en servidor, transacción atómica)
- [x] Conectar login, registro y cierre de sesión reales al frontend (`auth.js`)
- [x] Conectar guardado y consulta de viajes al frontend (`itinerario.js`, `mis-viajes.js`)
- [x] Inicializar `supabase-client.js` con URL y clave pública (publishable key)
- [x] Proteger páginas privadas: sin sesión → login
- [x] Crear `.gitignore` (`.env*`, `node_modules`)

### Criterio de salida
Login real → dashboard → guardar viaje → cerrar sesión → volver → consultar viaje.
✅ Verificado manualmente por el responsable: registro de usuario nuevo y guardado de viaje persistido en Supabase.

### Pruebas realizadas
| Prueba | Dónde | Resultado |
|---|---|---|
| Migración, validaciones, atomicidad, RLS A/B, escrituras directas (47 casos) | PostgreSQL local simulado (PGlite) | ✅ 47/47 |
| Visitante sin login: leer, insertar y ejecutar la RPC | Supabase real (API REST) | ✅ 401 permission denied |
| Páginas privadas sin sesión → login; login incorrecto → mensaje neutro | Supabase real (Chrome automatizado) | ✅ |
| Registro de usuario + crear y guardar viaje | Supabase real (manual, responsable) | ✅ |
| Flujo completo: login → crear → guardar → cerrar sesión → volver → consultar; B no ve lista ni URL de A | Supabase real (Chrome automatizado, 2 usuarios) | ✅ 20/20 |
| RLS A/B, UPDATE/DELETE ajenos, INSERT directo, `generaciones_log`, RPC con JWT, validación en servidor | Supabase real (API con JWT de 2 usuarios) | ✅ 16/16 |

### Pruebas de seguridad obligatorias
- [x] Llamar al RPC con JWT de usuario A → solo usa `auth.uid()` del JWT *(real: un `user_id` ajeno en el JSON se ignora)*
- [x] Consultar viajes con otro usuario → RLS devuelve vacío *(real: lista, consulta por id, itinerarios y actividades)*
- [x] Intentar INSERT directo en `generaciones_log` desde el cliente → rechazado *(real: INSERT y UPDATE → permission denied)*

### ⚠ Pendiente para el Hito 3
- Restringir o rediseñar el acceso directo a la RPC: hoy un usuario autenticado puede guardar un itinerario que no fue generado por TripGenius (se validan los datos, no su origen). Opciones: token de generación C2 verificado dentro de la transacción y/o revocar `EXECUTE` a `authenticated` dejando solo la Edge Function. Si la Edge Function usa `service_role`, `auth.uid()` devuelve NULL: debe reenviar el JWT del usuario.
- La lista de destinos del Perú está duplicada en `src/js/viaje.js` y en la RPC: mantener sincronizadas.

---

## 🤖 Hito 3 — IA Integrada
**Estado: ✅ Completado — aprobado por el responsable (20 Oct 2026)**
**Plan detallado:** `docs/05_integracion_ia/plan_hito_03.md`

### Decisiones (aprobadas)
- [x] **P1 / D-B:** principal `gemini-3.1-flash-lite` + respaldo automático `gemini-3.8-flash` (decisión del responsable, por la saturación del nivel gratuito). Timeout de 60 s por modelo
- [x] **P2 / D-C:** API Key solo en Supabase Secrets; rotación periódica y ante exposición
- [x] **D-A:** guardar enviando solo el token; el servidor recupera el itinerario original (sin Edge Function `guardar-itinerario`)
- [x] **D-D:** límite de 5 por día calendario `America/Lima` · **D-E:** error + reintento, sin fallback simulado · **D-F:** despliegue con Supabase CLI
- [x] Condición 8: pruebas directamente en el proyecto principal (decisión del responsable)

### Condiciones de seguridad (del plan v3)
- [x] **C2:** token de un solo uso (30 min) + hash SHA-256, verificado, bloqueado y consumido en la misma transacción que el guardado
- [x] **C4:** advisory lock + conteo + reserva atómica del cupo en `iniciar_generacion`

### Tareas
- [x] Migración `supabase/migrations/002_generacion_ia.sql` (ejecutada): esquema `private`, `iniciar_generacion`, `completar_generacion`, `guardar_itinerario_completo(p_token)`; firma antigua eliminada
- [x] Secret `GEMINI_API_KEY` (+ `GEMINI_MODEL_RESPALDO`)
- [x] Edge Function `generar-itinerario` (JWT, verificación del modelo, cupo atómico, Gemini con esquema JSON, validación, token)
- [x] `itinerary_schema.json` y `system_prompt_itinerario.md` en `docs/05_integracion_ia/`
- [x] Frontend: `viaje.js` llama a `generar-itinerario`; `itinerario.js` guarda con el token; generador simulado eliminado
- [x] Advertencia si el costo estimado supera el presupuesto (calculada en el servidor)

### Criterio de salida
Flujo completo con IA real: login → configurar → generar → visualizar → guardar → consultar.
✅ Verificado en el navegador (Chrome automatizado contra Live Server, 22/22).

### Pruebas de seguridad obligatorias (C2, C3, C4)
- [x] Modificar el itinerario guardado → hash no coincide → 403 *(simulación local; en real el cliente ya no puede enviar JSON)*
- [x] Token expirado → 403 *(simulación local)*
- [x] Token usado dos veces → 409 *(real)* · token ajeno → 403 *(real)*
- [x] 3 intentos + 2 simultáneas → ambas pasan *(real)*
- [x] 4 intentos + 2 simultáneas → una pasa, otra 429 *(real)*
- [x] INSERT / UPDATE en `generaciones_log` desde el cliente → rechazado *(real)*

### Observaciones
- Latencia: 45–48 s con el timeout inicial de 25 s; 10,2 s tras subirlo a 60 s con Flash-Lite como principal.
- El registro desde la app está limitado por el correo integrado de Supabase (429 `over_email_send_rate_limit`); para pruebas y demo, crear usuarios desde el panel con *Auto Confirm User*.

---

## 🚀 Hito 4 — Publicación
**Estado: 🟡 En curso — app publicada; faltan pruebas que dependen de Gemini y del correo de registro**
**Plan detallado:** `docs/06_despliegue/plan_hito_04.md`

### Decisiones
- [x] **P3:** GitHub Pages (`https://danyhuancag.github.io/tripgenius/`), repositorio público `DanyHuancaG/tripgenius`
- [x] GitHub Actions publica solo `src/`, con permisos mínimos
- [x] **Cambio de alcance aprobado:** autocompletado y validación inmediata del destino (plan, sección 8.2)

### Tareas
- [x] Inicializar repositorio Git
- [x] Revisar `.gitignore` (`.env*`, secretos, `node_modules`, `supabase/.temp/`)
- [x] Subir a GitHub tras revisar que no haya secretos expuestos (escaneo del contenido preparado)
- [x] Cambiar las contraseñas débiles de las cuentas de prueba (b, c y d)
- [x] CORS con `https://danyhuancag.github.io`
- [ ] Supabase Auth: Site URL y Redirect URLs públicas (responsable)
- [x] Deploy y verificación de la URL pública (carga, rutas, solo `src/`)
- [ ] Smoke test completo end-to-end:
  - [x] Sin sesión → login · credenciales incorrectas · login · seguridad por API (8/8)
  - [ ] Generar con Gemini → guardar → cerrar sesión → volver → consultar (Gemini saturado: 503 controlado)
  - [ ] Registro + confirmación de correo (límite de correos de Supabase)
  - [x] Un usuario no puede ver los datos de otro
- [ ] Viaje real guardado como respaldo para el Demo Day
- [ ] Cambiar la contraseña de `usuario.e` al terminar las pruebas

### Criterio de salida
MVP accesible en URL pública. Flujo completo y aislamiento de datos verificados.

---

## Decisiones técnicas cerradas (referencia rápida)

| # | Decisión | Valor |
|---|---|---|
| D1 | Cobertura | Solo Perú |
| D2 | Duración | 2 a 5 días |
| D3 | Auth | Supabase Auth — obligatoria |
| D4 | Moneda | PEN — sin transporte al destino |
| D5 | Backend | Supabase Edge Functions |
| D6 | IA | Gemini Flash (configurable por env) |
| D7 | Rate limit | 5 solicitudes/usuario/día |
| D8 | Paleta | Azul profundo · Turquesa · Blanco |
| D9 | Persistencia | RPC PostgreSQL — transacción atómica |
| D10 | Flujo | Generar y guardar son operaciones separadas |

---

*Última actualización: 20 Oct 2026 — Hito 3 completado.*
