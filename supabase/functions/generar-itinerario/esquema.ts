/**
 * Esquema JSON que Gemini debe respetar (salida estructurada).
 * Se ajusta a cada solicitud: destino y número de días fijados con enum,
 * minItems y maxItems, para que el modelo no pueda devolver otros valores.
 * Contrato general documentado en docs/05_integracion_ia/itinerary_schema.json.
 *
 * El servidor (private.validar_itinerario) vuelve a validar todo; este esquema
 * solo reduce las respuestas inválidas.
 */
export function esquemaItinerario(destino: string, dias: number) {
  return {
    type: 'object',
    properties: {
      destino: { type: 'string', enum: [destino] },
      dias: { type: 'integer', enum: [dias] },
      itinerario: {
        type: 'array',
        minItems: dias,
        maxItems: dias,
        items: {
          type: 'object',
          properties: {
            dia: { type: 'integer', minimum: 1, maximum: dias, description: 'Número de día, en orden: 1, 2, …' },
            actividades: {
              type: 'array',
              minItems: 3,
              maxItems: 7,
              items: {
                type: 'object',
                properties: {
                  hora_sugerida: { type: 'string', description: 'Hora de inicio en formato 24 h HH:MM, p. ej. "09:00".' },
                  nombre: { type: 'string', description: 'Nombre breve de la actividad (máx. 80 caracteres).' },
                  descripcion: { type: 'string', description: 'Descripción breve en español (máx. 200 caracteres).' },
                  costo_estimado: {
                    type: ['number', 'null'],
                    minimum: 0,
                    description: 'Costo estimado en soles (PEN). null si no se puede estimar.',
                  },
                  costo_no_estimado: {
                    type: 'boolean',
                    description: 'true solo si costo_estimado es null.',
                  },
                },
                required: ['hora_sugerida', 'nombre', 'descripcion', 'costo_estimado', 'costo_no_estimado'],
              },
            },
          },
          required: ['dia', 'actividades'],
        },
      },
      nota_descargo: { type: 'string' },
    },
    required: ['destino', 'dias', 'itinerario', 'nota_descargo'],
  };
}
