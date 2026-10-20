# Prompt de sistema: generación de itinerarios

> **Fuente de verdad:** `supabase/functions/generar-itinerario/prompt.ts`. Este documento explica el diseño; si hay diferencias, vale el código.

## Configuración

| Parámetro | Valor |
|---|---|
| API | **Principal:** Anthropic Messages API (`@anthropic-ai/sdk`), `output_config.format` json_schema, `effort: low`. **Respaldo:** Gemini Interactions API (`POST /v1beta/interactions`) |
| Modelo | Claude `claude-opus-5-5` (secret `ANTHROPIC_MODEL`) → Gemini: principal `gemini-3.1-flash-lite` (secret `GEMINI_MODEL`) y respaldo `gemini-3.8-flash` (secret `GEMINI_MODEL_RESPALDO`). En el código, los valores por defecto son 3.8 Flash y 3.6 Flash; los secrets los sobrescriben |
| Salida | `response_format`: `application/json` con el esquema de `esquema.ts` (destino y días fijados con enum) |
| `max_output_tokens` | 8192. Mitiga los bucles de repetición reportados en la salida estructurada |
| `thinking_level` | `low`, para reducir latencia y costo |
| `store` | `false`: Google no guarda la interacción |
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

El usuario **no envía texto libre**. Antes de llamar a Gemini, `iniciar_generacion` valida en PostgreSQL que:
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
