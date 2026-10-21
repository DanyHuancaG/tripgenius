# Prompt de sistema: generación de itinerarios

> **Fuente de verdad:** `supabase/functions/generar-itinerario/prompt.ts`. Este documento explica el diseño; si hay diferencias, vale el código.

## Configuración

El mismo prompt (`SYSTEM_PROMPT` e `instruccionUsuario`) se envía a todos los modelos. Orden de uso: **Claude (principal) → Gemini principal → Gemini respaldo**. Si un modelo falla (saturado, sin saldo, timeout, rechazo o JSON no parseable), se prueba el siguiente; todo cuenta como un solo intento del cupo diario.

### Claude (principal, desde el Hito 4)

| Parámetro | Valor |
|---|---|
| API | Anthropic Messages API (`@anthropic-ai/sdk`, `beta.messages.create`) |
| Modelo | `claude-opus-5-5` (secret `ANTHROPIC_MODEL`; ese es también el valor por defecto en el código) |
| Salida | `output_config.format`: `json_schema` con `esquemaItinerarioClaude` de `esquema.ts` (destino y días fijados con enum) |
| `max_tokens` | 16000 |
| `effort` | `low`: tarea acotada, menos razonamiento y respuesta más rápida |
| Respaldo del servidor | `fallbacks: 'default'` (beta `server-side-fallback-2026-07-01`) ante rechazos de seguridad; no se usa con Haiku. Se registra el modelo que respondió de verdad |
| Fallo | `refusal`, `max_tokens`, error HTTP/red o JSON no parseable → pasa a Gemini |

### Gemini (respaldo)

| Parámetro | Valor |
|---|---|
| API | Gemini Interactions API (`POST /v1beta/interactions`) |
| Modelos | Principal `gemini-3.1-flash-lite` (secret `GEMINI_MODEL`) y respaldo `gemini-3.8-flash` (secret `GEMINI_MODEL_RESPALDO`). En el código, los valores por defecto son 3.8 Flash y 3.6 Flash; los secrets los sobrescriben |
| Salida | `response_format`: `application/json` con `esquemaItinerario` de `esquema.ts` (destino y días fijados con enum) |
| `max_output_tokens` | 8192. Mitiga los bucles de repetición reportados en la salida estructurada |
| `thinking_level` | `low`, para reducir latencia y costo |
| `store` | `false`: Google no guarda la interacción |

### Común

| Parámetro | Valor |
|---|---|
| Verificación previa | Antes de reservar cupo, se comprueba que cada modelo exista y esté habilitado para su API Key (sin consumir tokens) |
| Timeout | Hasta 60 s por modelo, con un presupuesto total de 110 s (límite de las Edge Functions: 150 s) |
| CORS (`ALLOWED_ORIGINS`) | `http://127.0.0.1:5500`, `http://localhost:5500` y `http://<IP de la red local>:5500` (acceso desde otros equipos de la red local, 20 Oct 2026). Al publicar (Hito 4) se añade la URL pública |

## Reglas del prompt de sistema

1. Solo el destino indicado (Perú) y exactamente N días, numerados en orden.
2. De 3 a 7 actividades por día, ordenadas por hora en formato `HH:MM` de 24 h.
3. Costos en PEN. El presupuesto es el total de la estancia y **no incluye el transporte hasta o desde el destino**. Puede incluir transporte local, entradas, comidas y alojamiento.
4. Costo desconocido → `costo_estimado: null` y `costo_no_estimado: true`. **Nunca 0** para ocultar un costo desconocido.
5. Intentar no superar el presupuesto, sin inventar precios irreales.
6. Priorizar los intereses del viajero.
7. Español neutro y textos breves.
8. Sin reservas, enlaces, teléfonos ni precios presentados como confirmados.
9. `nota_descargo` fija: "Horarios, tarifas y disponibilidad son estimaciones referenciales, no verificadas en tiempo real."

## Mensaje de usuario (plantilla)

```
Genera un itinerario con estos datos:
- Destino: {destino} (Perú)
- Duración: {dias} días
- Presupuesto total de la estancia: S/ {presupuesto} (sin transporte hasta o desde el destino)
- Intereses: {intereses}
```

## Seguridad frente a la manipulación del prompt

El usuario **no envía texto libre**. Antes de llamar a la IA, `iniciar_generacion` valida en PostgreSQL que:
- el destino pertenezca a una lista cerrada del Perú;
- los días sean un entero entre 2 y 5;
- el presupuesto sea un número positivo;
- los intereses pertenezcan a una lista cerrada.

La respuesta de la IA se trata como datos no confiables:
- `private.validar_itinerario` la valida contra la solicitud original;
- el servidor recalcula los totales;
- el frontend escapa todo el texto al mostrarlo (`escapeHtml`).

## Supuesto pendiente de confirmar

El formulario no pregunta cuántas personas viajan, así que el prompt trata el presupuesto como **el total de la estancia** y pide estimar los costos de cada actividad para ese viaje. El prompt **incluye el alojamiento** como gasto de la estancia. Si el responsable decide otra cosa, solo cambia `prompt.ts`.
