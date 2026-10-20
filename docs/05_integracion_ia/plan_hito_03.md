# Plan del Hito 3: IA integrada (Claude + Gemini de respaldo)

> **Estado:** ✅ Completado — aprobado por el responsable (20 Oct 2026).
> **Autorizaciones:** actividad 1 (migración); después, Edge Function + despliegue CLI + frontend; modelo de respaldo; ejecución directa en el proyecto principal.
> **Plan base:** `docs/02_context_engineering/plan_arquitectura.md` (v3) · **Antecedente:** `docs/04_backend_supabase/plan_hito2.md` (sección 7)

---

## 1. Objetivo

Reemplazar el itinerario simulado por uno generado con IA desde el servidor (Claude como principal y Gemini de respaldo; ver sección 2.1), validado y con límite de uso. Además, cerrar el pendiente del Hito 2: que solo se puedan guardar itinerarios generados de verdad por TripGenius.

**Criterio de salida:** login → configurar → generar con IA real → visualizar → guardar → consultar.

## 2. Decisiones aprobadas

| # | Decisión | Valor aprobado |
|---|---|---|
| D-A | Integridad del guardado (C2) | **Opción A:** el servidor guarda el itinerario validado junto a un token de un solo uso. Para guardar, el cliente envía **solo el token** y la RPC recupera el itinerario original desde el servidor. La Edge Function `guardar-itinerario` deja de hacer falta |
| D-B | P1: modelo | **Claude `claude-opus-5-5`** como principal (`ANTHROPIC_MODEL`) y Gemini de respaldo (`GEMINI_MODEL`, `GEMINI_MODEL_RESPALDO`). Inicialmente se aprobó Gemini 3.8 Flash; modificado en la sección 2.1 |
| D-C | P2: API Key | En Supabase Secrets, con rotación periódica |
| D-D | Día del límite | Día calendario en `America/Lima` |
| D-E | Fallback | Error controlado y reintento sin perder el formulario. **No** se usan itinerarios simulados como fallback |
| D-F | Despliegue | Supabase CLI |

### Texto de aprobación del responsable (condiciones obligatorias)

> 1. La RPC debe verificar, bloquear y consumir el token de generación dentro de la misma transacción que guarda viajes, itinerarios y actividades. Si falla cualquier operación, todo debe revertirse.
> 2. Elimina la antigua posibilidad de guardar itinerarios enviando JSON desde el navegador. Revoca los permisos de ejecución de las firmas antiguas de la RPC.
> 3. Las funciones privilegiadas de generación y guardado deben tener permisos restringidos. Verifica identidad, propiedad y vigencia del token. Usa search_path seguro y referencias SQL calificadas por esquema.
> 4. El rate limit debe utilizar una función PostgreSQL con conteo y reserva atómica del cupo. Evita comprobaciones e inserciones independientes que permitan superar el límite con solicitudes simultáneas.
> 5. Mantén el registro de generaciones protegido contra modificaciones directas del cliente.
> 6. Utiliza la zona horaria America/Lima para calcular los límites diarios de cinco solicitudes.
> 7. Verifica que el modelo Gemini elegido esté habilitado para el proyecto antes de consumir la API.
> 8. Para las pruebas integradas, utiliza un entorno de desarrollo seguro. No ejecutes migraciones destructivas sin mostrarme antes el SQL.
> 9. Conserva las pruebas del Hito 2 y añade pruebas de regresión para comprobar que la autenticación y el acceso por usuario siguen funcionando.

## 2.1 Cambio de proveedor de IA (20 Oct 2026, durante el Hito 4)

> **Decisión del responsable:** pasar a **Anthropic (Claude) como proveedor principal**, porque el nivel gratuito de Gemini se saturó de forma repetida (503 "high demand" en Flash-Lite y 3.8 Flash), también desde la URL pública con otros usuarios. Modifica **D6 / D-B**. Gemini se mantiene como respaldo automático.

| Aspecto | Valor |
|---|---|
| Orden de modelos | `ANTHROPIC_MODEL` (Claude) → `GEMINI_MODEL` (`gemini-3.1-flash-lite`) → `GEMINI_MODEL_RESPALDO` (`gemini-3.8-flash`). Si uno falla (saturado, sin saldo, timeout, rechazo), pasa al siguiente; cuenta como 1 intento del cupo |
| SDK | `npm:@anthropic-ai/sdk@0.131.0`, salida estructurada `output_config.format` (`json_schema`), `effort: low` |
| Esquema | `esquemaItinerarioClaude()`: `additionalProperties: false` y todo obligatorio; sin `minimum`, `maximum` ni `minItems` (no admitidos), que valida PostgreSQL |
| Rechazos de seguridad | `stop_reason: refusal` → siguiente modelo. En Opus y Sonnet, además, respaldo del servidor de Anthropic (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`); no existe para Haiku |
| Condición 7 | Antes de reservar cupo se verifica cada modelo (`models.retrieve` en Claude, `GET /models/{id}` en Gemini), sin consumir tokens |
| Secrets | `ANTHROPIC_API_KEY` (cargado por el responsable; US$ 5 de prepago) y `ANTHROPIC_MODEL = claude-opus-5-5` (**elegido por el responsable** tras la comparativa) |
| Sin cambios | Base de datos, RLS, token de un solo uso, límite de 5 al día y frontend |

**Comparativa real (Cusco, 3 días, S/ 900, cultura y gastronomía; una generación por modelo):**

| Modelo | Tiempo | Tokens (entrada / salida) | Costo real aprox. | Calidad observada |
|---|---|---|---|---|
| **Claude Opus 5.5** | 30,1 s | 1.655 / 1.892 | **US$ 0,045** | La más completa y realista: incluye alojamiento y entradas (boleto turístico); total S/ 868 de S/ 900 |
| Claude Sonnet 5.5 | 16,1 s | 1.655 / 1.733 | US$ 0,021 | Muy buena y variada, pero no incluyó alojamiento; total S/ 690 |
| Claude Haiku 5.5 | 11,6 s | 1.655 / 1.664 | US$ 0,001 | Correcta, pero con errores: puso S/ 0 en sitios que requieren boleto turístico (Catedral, Qorikancha, Pisac); total S/ 397, subestimado |

## 3. Arquitectura

```
Navegador ──(JWT)──► Edge Function generar-itinerario
                       │ 1. verifica el JWT (auth.getUser) → user_id
                       │ 2. rpc iniciar_generacion(user_id, solicitud)       [service_role]
                       │      advisory lock + conteo + reserva del cupo (C4)
                       │ 3. verifica que el modelo esté habilitado, llama a Claude, con Gemini de respaldo (JSON + esquema)
                       │ 4. rpc completar_generacion(log_id, user_id, …)    [service_role]
                       │      valida → guarda itinerario + token + hash (C2)
Navegador ◄── itinerario + token ──┘
   │
   └─(JWT)──► rpc guardar_itinerario_completo(p_token)                   [authenticated]
                verifica, bloquea y consume el token con auth.uid() (C1)
                → viajes / itinerarios / actividades, en una sola transacción
```

**Permisos de las funciones:**
- `iniciar_generacion` y `completar_generacion`: solo `service_role`, es decir, solo la Edge Function. Reciben el `user_id` que la Edge Function obtiene de un JWT verificado; el navegador no puede invocarlas.
- `guardar_itinerario_completo(p_token)`: solo `authenticated`. La identidad sale de `auth.uid()` y el cliente no envía el itinerario.
- Funciones auxiliares de validación: en el esquema `private`, que la API no expone.

## 4. Actividades

| # | Actividad | Estado |
|---|---|---|
| 1 | Migración `002_generacion_ia.sql` y pruebas locales | ✅ Preparada y probada en local (PGlite, 58/58) |
| 2 | Definir el entorno de desarrollo seguro para las pruebas integradas (condición 8) | ⚠ **Descartado por el responsable (20 Oct 2026):** las pruebas integradas se hacen directamente en el proyecto principal `slymqwtupzmhfifhhgzp`, sin proyecto de pruebas |
| 3 | El responsable ejecuta la migración 002 en el proyecto principal. ⚠ Hasta actualizar el frontend (actividad 7), "Guardar" deja de funcionar | ✅ Ejecutada (20 Oct 2026). Verificada en el proyecto real: 20/20 (permisos, firma antigua eliminada, `private` no expuesto, `generaciones_log` protegido, regresión de auth y RLS del Hito 2) |
| 4 | Edge Function `generar-itinerario` (`index.ts`, `prompt.ts`, `esquema.ts`), `supabase/config.toml`, `itinerary_schema.json` y `system_prompt_itinerario.md` | ✅ Escrita. Compila con `deno check`. Usa la Interactions API, porque generateContent figura como "Legacy" |
| 5 | El responsable crea la API Key y la carga como `GEMINI_API_KEY` | ✅ Cargada en Supabase Secrets (20 Oct 2026). La primera clave se mostró en una captura y se indicó rotarla (política D-C). **Decisión del responsable:** `GEMINI_MODEL_RESPALDO = gemini-3.1-flash-lite`, en lugar de `gemini-3.6-flash`, porque los modelos Flash estaban saturados |
| 6 | Verificar que el modelo esté habilitado, y su cuota y costo (condición 7). Despliegue por CLI | ✅ Desplegada con CLI (20 Oct 2026). La función verifica los modelos (`GET /models/{id}`, sin consumir tokens) antes de reservar cupo. **Modelo de respaldo aprobado por el responsable:** `gemini-3.6-flash` (secret opcional `GEMINI_MODEL_RESPALDO`), que se usa si el principal responde 429, 500 o 503 o no responde a tiempo. ⚠ El 20 Oct ambos modelos respondieron 503 "high demand" de forma sostenida |
| 7 | Frontend: `viaje.js` llama a la Edge Function; `itinerario.js` guarda con el token. Se elimina el generador simulado | ✅ Escrito. Se quitaron `generarItinerarioMock`, `MOCK_ITINERARIO` y el botón "[Mock] Éxito → itinerario" |
| 8 | Pruebas: nominales, de error, de seguridad, de concurrencia y de regresión del Hito 2 (condición 9) | 🟡 Parcial. ✅ Migración en el proyecto real (20/20). ✅ Errores: 401 sin JWT o JWT falso; 400 con datos incompletos, fuera del Perú o 6 días (sin consumir cupo); CORS. ✅ **C4 en el proyecto real (8/8):** 3 usados + 2 simultáneas → pasan las dos; 4 + 2 → una pasa y otra 429; 5 + 3 → todas 429; nunca se supera 5. ✅ Fallo del proveedor → 503 controlado, contado como 1 intento. ✅ **API con IA real (25/25):** Cusco 3 días → 12 actividades, formato y costos válidos, total del servidor, nota de descargo; token ajeno → 403; guardar → OK; reusar → 409; BD coherente; B no ve el viaje de A. ✅ **Navegador con IA real (22/22):** botón deshabilitado al generar; generar → ver → guardar → Mis viajes → cerrar sesión → volver → detalle; B no ve la lista ni la URL de A; regresión de auth y RLS del Hito 2; sin errores JS. ✅ La clave no aparece en el código ni en el frontend (grep). ⚠ Latencia inicial: 45–48 s. **Corrección (20 Oct 2026):** Flash-Lite necesitaba unos 40 s y el timeout de 25 s lo cortaba; se subió a 60 s por modelo (110 s en total). **Decisión del responsable:** Flash-Lite como principal (`GEMINI_MODEL=gemini-3.1-flash-lite`) y 3.8 Flash como respaldo. Resultado: generación en 10,2 s, 15 actividades, guardado, 403 y 409 OK |
| 9 | Actualizar el roadmap | ✅ |

## 5. Pruebas planificadas

**Nominales**
- Generar → itinerario con exactamente N días.
- Guardar → aparece en Mis viajes.
- Volver a entrar → el detalle se conserva.

**De error**
- IA caída o con timeout (Claude y Gemini) → 503, mensaje claro y formulario conservado.
- JSON inválido → 422 sin mostrar el itinerario.
- Sin JWT → 401.

**De seguridad**
- Token ajeno, vencido o ya usado → rechazado.
- RPC con la firma antigua (JSON del cliente) → no existe o no tiene permiso.
- INSERT o UPDATE en `generaciones_log` desde el cliente → rechazado.
- `iniciar_generacion` o `completar_generacion` invocadas por el cliente → rechazado.
- Las claves de Anthropic y Gemini no aparecen en el frontend ni en Git.

**Concurrencia (C4)**

| Intentos usados | Solicitudes simultáneas | Resultado esperado |
|---|---|---|
| 3 | 2 | Pasan las dos |
| 4 | 2 | Pasa una; la otra recibe 429 |
| 5 | cualquiera | Todas reciben 429 |

**Regresión (condición 9):** las suites del Hito 2 (20 pruebas en navegador y 16 en API), adaptadas a la nueva firma de la RPC, más las de autenticación y acceso por usuario.

## 6. Referencias

- [Structured outputs | Gemini API](https://ai.google.dev/gemini-api/docs/structured-output)
- [Gemini 3.8 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash)
- Riesgo conocido: en el foro de desarrolladores de Google se reporta que la salida estructurada puede entrar en un bucle de repetición dentro de los números. Se mitiga con un límite de tokens de salida y un timeout ([foro](https://discuss.ai.google.dev/t/structured-output-repetition-loop-inside-a-json-number-literal-runs-to-max-tokens-flash-vertex/175138)).
