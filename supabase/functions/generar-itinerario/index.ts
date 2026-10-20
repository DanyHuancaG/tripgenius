/**
 * Edge Function: generar-itinerario — TripGenius (Hito 3)
 *
 * POST { destino, dias, presupuesto, intereses } + Authorization: Bearer <JWT>
 *   200 { itinerario, token, expira_en, intentos_restantes }
 *   400 datos inválidos · 401 sesión no válida · 422 respuesta de IA inválida
 *   429 límite diario · 503 IA no disponible
 *
 * Flujo:
 *   1. verifica el JWT con Supabase Auth → user_id
 *   2. verifica qué modelos están habilitados (condición 7), antes de consumir cupo o tokens
 *   3. iniciar_generacion(): valida y reserva el cupo de forma atómica (C4)
 *   4. llama a Gemini (Interactions API) con un esquema JSON obligatorio:
 *      modelo principal y, si está saturado (429/500/503/timeout), el de respaldo
 *   5. completar_generacion(): valida, guarda y emite un token de un solo uso (C2)
 *
 * Secrets: GEMINI_API_KEY (obligatorio); GEMINI_MODEL, GEMINI_MODEL_RESPALDO y
 * ALLOWED_ORIGINS (opcionales).
 * SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { SYSTEM_PROMPT, instruccionUsuario } from './prompt.ts';
import { esquemaItinerario } from './esquema.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_MODEL   = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.8-flash';
// Respaldo aprobado (20 Oct 2026) para cuando el principal está saturado
const GEMINI_MODEL_RESPALDO = Deno.env.get('GEMINI_MODEL_RESPALDO') ?? 'gemini-3.6-flash';
const GEMINI_BASE    = 'https://generativelanguage.googleapis.com/v1beta';
// Flash-Lite tarda ~40 s en este itinerario: 60 s por modelo, con un
// presupuesto total por debajo del límite de 150 s de las Edge Functions
const TIMEOUT_MS        = 60_000;
const PRESUPUESTO_TOTAL = 110_000;
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://127.0.0.1:5500,http://localhost:5500')
  .split(',').map(o => o.trim()).filter(Boolean);

// Cliente con service_role: solo para las funciones del servidor (iniciar/completar)
const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// ── Utilidades HTTP ──────────────────────────────────────────────────────────

function corsHeaders(origin: string | null): Record<string, string> {
  const h: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

function responder(status: number, body: unknown, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json; charset=utf-8' },
  });
}

// ── Gemini ───────────────────────────────────────────────────────────────────

// Condición 7: cada modelo debe existir y estar habilitado para la API Key.
// Se consulta una vez por instancia (no consume tokens); solo se recuerdan los éxitos.
const modelosVerificados = new Set<string>();

async function verificarModelo(modelo: string): Promise<boolean> {
  if (modelosVerificados.has(modelo)) return true;
  try {
    const r = await fetch(`${GEMINI_BASE}/models/${encodeURIComponent(modelo)}`, {
      headers: { 'x-goog-api-key': GEMINI_API_KEY },
      signal: AbortSignal.timeout(8_000),
    });
    if (r.ok) modelosVerificados.add(modelo);
    else console.error(`Modelo ${modelo} no disponible: HTTP ${r.status}`);
  } catch (e) {
    console.error(`No se pudo verificar el modelo ${modelo}:`, (e as Error).message);
  }
  return modelosVerificados.has(modelo);
}

/** Modelos habilitados, en orden de preferencia: principal y luego respaldo */
async function modelosDisponibles(): Promise<string[]> {
  const candidatos = [...new Set([GEMINI_MODEL, GEMINI_MODEL_RESPALDO].filter(Boolean))];
  const ok = await Promise.all(candidatos.map(verificarModelo));
  return candidatos.filter((_, i) => ok[i]);
}

/** Texto generado: esquema actual (steps) o el anterior (outputs) */
function extraerTexto(data: any): string | null {
  const desde = (bloques: any[]) =>
    bloques.flatMap((b: any) => Array.isArray(b?.content) ? b.content : [b])
      .map((c: any) => (typeof c?.text === 'string' ? c.text : ''))
      .join('');
  if (Array.isArray(data?.steps)) {
    const salida = data.steps.filter((s: any) => s?.type === 'model_output');
    const texto = desde(salida);
    if (texto) return texto;
  }
  if (Array.isArray(data?.outputs)) {
    const texto = desde(data.outputs.filter((o: any) => o?.type !== 'thought'));
    if (texto) return texto;
  }
  return null;
}

type Solicitud = { destino: string; dias: number; presupuesto: number; intereses: string[] };
type ResultadoGemini =
  | { tipo: 'ok'; json: unknown }
  | { tipo: 'fallo_proveedor'; detalle: string; reintentable?: boolean }
  | { tipo: 'fallo_validacion'; detalle: string };

/**
 * Prueba los modelos en orden: si uno está saturado o falla la red (429, 500,
 * 503, timeout), pasa al siguiente. Todo cuenta como un solo intento del cupo.
 * Devuelve el resultado y el modelo que lo produjo (se registra en el log).
 */
async function llamarGemini(s: Solicitud, modelos: string[]): Promise<{ resultado: ResultadoGemini; modelo: string }> {
  let resultado: ResultadoGemini = { tipo: 'fallo_proveedor', detalle: 'sin modelos' };
  let modelo = modelos[0];
  const limite = Date.now() + PRESUPUESTO_TOTAL;
  for (modelo of modelos) {
    const restante = Math.min(TIMEOUT_MS, limite - Date.now());
    if (restante < 10_000) break;   // no queda tiempo útil para otro modelo
    resultado = await llamarGeminiUnaVez(s, modelo, restante);
    if (resultado.tipo !== 'fallo_proveedor' || !resultado.reintentable) break;
    console.warn(`Gemini ${modelo} saturado o sin respuesta (${resultado.detalle.slice(0, 120)})`);
  }
  return { resultado, modelo };
}

async function llamarGeminiUnaVez(s: Solicitud, modelo: string, timeoutMs: number): Promise<ResultadoGemini> {
  let r: Response;
  try {
    r = await fetch(`${GEMINI_BASE}/interactions`, {
      method: 'POST',
      headers: { 'x-goog-api-key': GEMINI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelo,
        system_instruction: SYSTEM_PROMPT,
        input: instruccionUsuario(s),
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: esquemaItinerario(s.destino, s.dias),
        },
        // Límite de salida: mitiga bucles de repetición del modo estructurado
        generation_config: { max_output_tokens: 8192, thinking_level: 'low' },
        store: false,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    return { tipo: 'fallo_proveedor', detalle: `red/timeout: ${(e as Error).name}`, reintentable: true };
  }

  if (!r.ok) {
    const cuerpo = (await r.text()).slice(0, 300);
    return { tipo: 'fallo_proveedor', detalle: `HTTP ${r.status}: ${cuerpo}`, reintentable: [429, 500, 503].includes(r.status) };
  }

  const data = await r.json().catch(() => null);
  if (data?.status && data.status !== 'completed') {
    return { tipo: 'fallo_proveedor', detalle: `status ${data.status}` };
  }
  const texto = extraerTexto(data);
  if (!texto) return { tipo: 'fallo_validacion', detalle: 'respuesta sin texto' };

  try {
    return { tipo: 'ok', json: JSON.parse(texto) };
  } catch {
    return { tipo: 'fallo_validacion', detalle: 'JSON no parseable' };
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return responder(405, { error: 'Método no permitido.' }, origin);

  // 1. Identidad: JWT verificado por Supabase Auth
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth, error: authError } = jwt ? await admin.auth.getUser(jwt) : { data: null, error: true };
  const userId = auth?.user?.id;
  if (authError || !userId) {
    return responder(401, { error: 'Tu sesión expiró. Inicia sesión de nuevo.' }, origin);
  }

  // Forma básica del cuerpo (la validación completa la hace PostgreSQL)
  const body = await req.json().catch(() => null);
  const s: Solicitud = {
    destino: typeof body?.destino === 'string' ? body.destino.trim() : '',
    dias: Number.isInteger(body?.dias) ? body.dias : NaN,
    presupuesto: typeof body?.presupuesto === 'number' ? body.presupuesto : NaN,
    intereses: Array.isArray(body?.intereses) && body.intereses.every((i: unknown) => typeof i === 'string')
      ? body.intereses : [],
  };
  if (!s.destino || Number.isNaN(s.dias) || Number.isNaN(s.presupuesto) || s.intereses.length === 0) {
    return responder(400, { error: 'Datos del viaje incompletos.' }, origin);
  }

  // 2. Modelos habilitados (antes de consumir cupo o tokens)
  const modelos = GEMINI_API_KEY ? await modelosDisponibles() : [];
  if (modelos.length === 0) {
    return responder(503, { error: 'El servicio de IA no está disponible. Intenta más tarde.' }, origin);
  }

  // 3. Reserva atómica del cupo diario
  const { data: inicio, error: iniErr } = await admin.rpc('iniciar_generacion', {
    p_user_id: userId,
    p_destino: s.destino,
    p_dias: s.dias,
    p_presupuesto: s.presupuesto,
    p_intereses: s.intereses,
  });
  if (iniErr) {
    if (iniErr.code === 'PT429') return responder(429, { error: iniErr.message }, origin);
    if (iniErr.code === '22023') return responder(400, { error: iniErr.message }, origin);
    console.error('iniciar_generacion:', iniErr.code, iniErr.message);
    return responder(500, { error: 'No se pudo iniciar la generación.' }, origin);
  }

  // 4. Gemini
  const { resultado, modelo } = await llamarGemini(s, modelos);
  if (resultado.tipo !== 'ok') console.error(`Gemini ${resultado.tipo} (${modelo}): ${resultado.detalle}`);

  // 5. Registrar resultado (y validar + emitir token si fue exitoso)
  const { data: fin, error: finErr } = await admin.rpc('completar_generacion', {
    p_log_id: inicio.log_id,
    p_user_id: userId,
    p_estado: resultado.tipo === 'ok' ? 'exito' : resultado.tipo,
    p_itinerario: resultado.tipo === 'ok' ? resultado.json : null,
    p_modelo: modelo,
  });
  if (finErr) {
    console.error('completar_generacion:', finErr.code, finErr.message);
    return responder(500, { error: 'No se pudo completar la generación.' }, origin);
  }

  const restantes = inicio.intentos_restantes;
  if (resultado.tipo === 'fallo_proveedor') {
    return responder(503, { error: 'No se pudo generar el itinerario. Intenta de nuevo.', intentos_restantes: restantes }, origin);
  }
  if (!fin.ok) {
    if (fin.motivo) console.error('Validación del itinerario:', fin.motivo);
    return responder(422, { error: 'La IA devolvió una respuesta inesperada. Intenta de nuevo.', intentos_restantes: restantes }, origin);
  }

  return responder(200, {
    itinerario: fin.itinerario,
    token: fin.token,
    expira_en: fin.expira_en,
    intentos_restantes: restantes,
  }, origin);
});
