/**
 * viaje.js — TripGenius
 * Formulario de creación de viaje y generación del itinerario con IA
 * (Edge Function generar-itinerario → Gemini).
 */

/**
 * Destinos aceptados en el MVP (solo Perú). El servidor valida la misma lista
 * en private.destinos_peru() (supabase/migrations/002_generacion_ia.sql):
 * mantener ambas sincronizadas.
 */
const DESTINOS_PERU = [
  'Lima', 'Callao', 'Cusco', 'Machu Picchu', 'Valle Sagrado', 'Ollantaytambo', 'Pisac',
  'Arequipa', 'Valle del Colca', 'Colca', 'Puno', 'Lago Titicaca', 'Iquitos', 'Loreto',
  'Trujillo', 'La Libertad', 'Huanchaco', 'Chiclayo', 'Lambayeque', 'Piura', 'Máncora',
  'Tumbes', 'Punta Sal', 'Zorritos', 'Cajamarca', 'Chachapoyas', 'Amazonas', 'Kuélap',
  'Huaraz', 'Áncash', 'Chavín', 'Ica', 'Paracas', 'Pisco', 'Huacachina', 'Nazca', 'Chincha',
  'Lunahuaná', 'Cañete', 'Ayacucho', 'Huancayo', 'Junín', 'Tarma', 'Oxapampa', 'Pozuzo',
  'Pasco', 'Huánuco', 'Huancavelica', 'Tarapoto', 'San Martín', 'Moyobamba',
  'Puerto Maldonado', 'Madre de Dios', 'Tambopata', 'Tacna', 'Moquegua', 'Ilo',
  'Abancay', 'Apurímac', 'Andahuaylas', 'Pucallpa', 'Ucayali',
];

/** Minúsculas, sin tildes ni espacios extra */
const normalizar = (txt) =>
  txt.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Devuelve el nombre oficial del destino si está en el Perú, o null */
const buscarDestinoPeru = (texto) => {
  // Acepta "Cusco", "cusco, peru" o "Cusco - Perú"
  const base = normalizar(texto).replace(/[,\-]?\s*peru$/, '').trim();
  return DESTINOS_PERU.find(d => normalizar(d) === base) || null;
};

const Viaje = {

  /** Muestra el estado de generando (spinner en botón) */
  simularGenerando() {
    const btn     = document.getElementById('generar-btn');
    const text    = document.getElementById('btn-text');
    const spinner = document.getElementById('btn-spinner');
    if (!btn) return;
    text.textContent = 'Generando tu itinerario…';
    spinner.classList.remove('hidden');
    btn.disabled = true;
    btn.classList.add('opacity-75', 'cursor-not-allowed');
  },

  /** Muestra un error y resetea el botón (el formulario se conserva) */
  simularError(mensaje = 'No se pudo generar el itinerario. Intenta de nuevo.') {
    Viaje._resetBtn();
    document.getElementById('ratelimit-banner')?.classList.add('hidden');
    const banner = document.getElementById('error-banner');
    const msg    = document.getElementById('error-msg');
    if (banner) {
      msg.textContent = mensaje;
      banner.classList.remove('hidden');
    }
  },

  /** Muestra el error de rate limit */
  simularRateLimit() {
    Viaje._resetBtn();
    document.getElementById('error-banner')?.classList.add('hidden');
    document.getElementById('ratelimit-banner')?.classList.remove('hidden');
  },

  /**
   * Llama a la Edge Function generar-itinerario. Generar y guardar son
   * operaciones separadas (D10): el resultado queda como borrador con su token.
   */
  async generar(solicitud) {
    document.getElementById('error-banner')?.classList.add('hidden');
    document.getElementById('ratelimit-banner')?.classList.add('hidden');
    Viaje.simularGenerando();   // el botón queda deshabilitado: evita solicitudes repetidas

    const { data, error } = await sb.functions.invoke('generar-itinerario', { body: solicitud });

    if (!error) {
      MockStore.guardarBorrador({ ...data.itinerario, token: data.token, expira_en: data.expira_en });
      window.location.href = 'itinerario.html';
      return;
    }

    // Respuesta HTTP de error: leer estado y mensaje del servidor
    const status = error.context?.status;
    const cuerpo = await error.context?.json?.().catch(() => null);
    const quedan = Number.isInteger(cuerpo?.intentos_restantes)
      ? ` Te quedan ${cuerpo.intentos_restantes} generaciones hoy.` : '';

    if (status === 429) {
      Viaje.simularRateLimit();
    } else if (status === 401) {
      Viaje.simularError('Tu sesión expiró. Inicia sesión de nuevo.');
    } else if (status === 400 && cuerpo?.error) {
      Viaje.simularError(cuerpo.error);
    } else if (status === 422 || status === 503) {
      Viaje.simularError(`${cuerpo?.error || 'No se pudo generar el itinerario.'}${quedan}`);
    } else {
      Viaje.simularError('No se pudo conectar con el servicio. Revisa tu conexión e intenta de nuevo.');
    }
  },

  _resetBtn() {
    const btn     = document.getElementById('generar-btn');
    const text    = document.getElementById('btn-text');
    const spinner = document.getElementById('btn-spinner');
    if (!btn) return;
    text.textContent = 'Generar itinerario con IA';
    spinner.classList.add('hidden');
    btn.disabled = false;
    btn.classList.remove('opacity-75', 'cursor-not-allowed');
  },
};

/**
 * Valida el destino contra la lista del Perú, marca el campo y, si es válido,
 * lo normaliza al nombre oficial ("cusco, peru" → "Cusco").
 * Devuelve el destino oficial o null.
 */
const validarDestino = () => {
  const destino    = document.getElementById('destino');
  const destinoErr = document.getElementById('destino-error');
  const destinoPeru = buscarDestinoPeru(destino.value);
  let mensaje = null;
  if (!destino.value.trim()) {
    mensaje = 'Ingresa un destino dentro del Perú.';
  } else if (!destinoPeru) {
    mensaje = 'Elige un destino de la lista. Por ahora TripGenius solo cubre destinos del Perú (ej: Cusco, Arequipa, Iquitos).';
  } else {
    destino.value = destinoPeru;
  }
  destino.classList.toggle('border-red-400', !!mensaje);
  destinoErr.classList.toggle('hidden', !mensaje);
  if (mensaje) destinoErr.textContent = mensaje;
  return destinoPeru;
};

/** ── Validación del formulario ── */
document.addEventListener('DOMContentLoaded', () => {
  Sesion.requerir();   // página privada

  const form = document.getElementById('viaje-form');
  if (!form) return;

  // Autocompletado: sugerencias con los destinos que acepta el servidor
  document.getElementById('destinos-peru').innerHTML =
    [...DESTINOS_PERU].sort((a, b) => a.localeCompare(b, 'es'))
      .map(d => `<option value="${escapeHtml(d)}"></option>`).join('');

  // Aviso inmediato al salir del campo (si se escribió algo)
  document.getElementById('destino').addEventListener('blur', (e) => {
    if (e.target.value.trim()) validarDestino();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let valid = true;

    // Destino
    const destinoPeru = validarDestino();
    if (!destinoPeru) valid = false;

    // Días
    const dias    = document.getElementById('dias');
    const diasErr = document.getElementById('dias-error');
    if (!dias.value) {
      dias.classList.add('border-red-400');
      diasErr.classList.remove('hidden');
      valid = false;
    } else {
      dias.classList.remove('border-red-400');
      diasErr.classList.add('hidden');
    }

    // Presupuesto
    const presupuesto    = document.getElementById('presupuesto');
    const presupuestoErr = document.getElementById('presupuesto-error');
    if (!presupuesto.value || parseFloat(presupuesto.value) <= 0) {
      presupuesto.classList.add('border-red-400');
      presupuestoErr.classList.remove('hidden');
      valid = false;
    } else {
      presupuesto.classList.remove('border-red-400');
      presupuestoErr.classList.add('hidden');
    }

    // Intereses
    const checked      = document.querySelectorAll('.chip input:checked');
    const interesesErr = document.getElementById('intereses-error');
    if (checked.length === 0) {
      interesesErr.classList.remove('hidden');
      valid = false;
    } else {
      interesesErr.classList.add('hidden');
    }

    if (!valid) return;

    Viaje.generar({
      destino:     destinoPeru,
      dias:        parseInt(dias.value, 10),
      presupuesto: parseFloat(presupuesto.value),
      intereses:   [...checked].map(c => c.value),
    });
  });
});
