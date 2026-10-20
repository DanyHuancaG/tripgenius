/**
 * itinerario.js — TripGenius
 * Muestra el itinerario recién generado por la IA (borrador con token) o uno
 * guardado en Supabase. Guarda con la RPC guardar_itinerario_completo(p_token):
 * el navegador solo envía el token; el servidor recupera el itinerario original.
 */

const Itinerario = {

  /** Itinerario que se está mostrando en la vista */
  actual: null,

  /** Renderiza el itinerario completo en la vista */
  renderizar(data) {
    document.getElementById('itin-titulo').textContent = `${data.destino} · ${data.dias} días`;
    document.getElementById('itin-intereses').textContent =
      `Intereses: ${data.intereses.map(etiquetaInteres).join(' · ')}`;
    document.getElementById('itin-presupuesto').textContent = formatoSoles(data.presupuesto_ingresado);
    document.getElementById('itin-costo').textContent       = formatoSoles(data.costo_total_estimado);

    if (data.advertencia_presupuesto) Itinerario.mostrarAdvertencia(data);

    // Textos escapados: pueden venir de la BD o (en Hito 3) de la IA
    document.getElementById('dias-container').innerHTML = data.itinerario.map(dia => `
      <div class="bg-white rounded-2xl shadow-md overflow-hidden">
        <!-- Cabecera del día -->
        <div class="bg-primary px-6 py-3 flex items-center gap-2">
          <span class="text-white font-bold text-base">Día ${dia.dia}</span>
          <span class="text-white opacity-60 text-sm">${dia.actividades.length} actividades</span>
        </div>

        <!-- Actividades -->
        <div class="divide-y divide-gray-100">
          ${dia.actividades.map(act => `
            <div class="activity-card px-6 py-4 flex gap-4">
              <!-- Hora -->
              <div class="flex-shrink-0 w-14 text-right">
                <span class="text-xs font-semibold text-turquoise">${escapeHtml(act.hora_sugerida || '—')}</span>
              </div>
              <!-- Contenido -->
              <div class="flex-1">
                <h3 class="font-semibold text-gray-800 text-sm">${escapeHtml(act.nombre)}</h3>
                <p class="text-gray-500 text-xs mt-0.5">${escapeHtml(act.descripcion)}</p>
              </div>
              <!-- Costo -->
              <div class="flex-shrink-0 text-right">
                ${act.costo_no_estimado
                  ? `<span class="text-xs text-gray-400 italic">No estimado</span>`
                  : `<span class="text-sm font-semibold text-gray-700">${formatoSoles(act.costo_estimado)}</span>`
                }
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Subtotal del día -->
        <div class="px-6 py-3 bg-gray-50 flex justify-end">
          <span class="text-xs text-gray-500 font-semibold">
            Subtotal estimado:
            ${formatoSoles(dia.actividades
              .filter(a => !a.costo_no_estimado && a.costo_estimado !== null)
              .reduce((sum, a) => sum + Number(a.costo_estimado), 0))}
          </span>
        </div>
      </div>
    `).join('');

    Itinerario.mostrarEstado('contenido');
  },

  /** Alterna entre: cargando · contenido · no-encontrado */
  mostrarEstado(estado) {
    ['cargando', 'contenido', 'no-encontrado'].forEach(id =>
      document.getElementById(`itin-${id}`)?.classList.toggle('hidden', id !== estado));
  },

  /** Muestra el banner de advertencia de presupuesto excedido */
  mostrarAdvertencia(data = { presupuesto_ingresado: 800, costo_total_estimado: 920 }) {
    const banner = document.getElementById('budget-warning');
    const diff   = document.getElementById('budget-diff');
    if (!banner) return;
    const exceso = (data.costo_total_estimado - data.presupuesto_ingresado).toFixed(2);
    banner.classList.remove('hidden');
    if (diff) diff.textContent = `El itinerario excede tu presupuesto en S/ ${exceso}. Los costos son referenciales.`;
  },

  /** Lee un viaje guardado (RLS: solo devuelve los del usuario en sesión) */
  async cargarGuardado(viajeId) {
    Itinerario.mostrarEstado('cargando');

    const { data: v, error } = await sb
      .from('viajes')
      .select(`id, destino, dias, presupuesto, intereses,
               itinerarios ( costo_total_estimado, advertencia_presupuesto,
                             actividades ( dia, hora_sugerida, nombre, descripcion,
                                           costo_estimado, costo_no_estimado ) )`)
      .eq('id', viajeId)
      .maybeSingle();

    const it = Array.isArray(v?.itinerarios) ? v.itinerarios[0] : v?.itinerarios;
    if (error || !v || !it) {
      Itinerario.mostrarEstado('no-encontrado');
      return;
    }

    // Agrupar por día y ordenar por hora sugerida (HU-05)
    const itinerario = Array.from({ length: v.dias }, (_, i) => ({
      dia: i + 1,
      actividades: it.actividades
        .filter(a => a.dia === i + 1)
        .sort((a, b) => (a.hora_sugerida || '99:99').localeCompare(b.hora_sugerida || '99:99')),
    }));

    Itinerario.actual = {
      destino: v.destino,
      dias: v.dias,
      presupuesto_ingresado: Number(v.presupuesto),
      costo_total_estimado: Number(it.costo_total_estimado),
      advertencia_presupuesto: it.advertencia_presupuesto,
      intereses: v.intereses,
      itinerario,
    };
    Itinerario.renderizar(Itinerario.actual);
    Itinerario.marcarComoGuardado();
  },

  /** Simula estado guardando */
  simularGuardando() {
    const btn     = document.getElementById('guardar-btn');
    const text    = document.getElementById('guardar-btn-text');
    const spinner = document.getElementById('guardar-spinner');
    if (!btn) return;
    text.textContent = 'Guardando…';
    spinner.classList.remove('hidden');
    btn.disabled = true;
    btn.classList.add('opacity-75', 'cursor-not-allowed');
  },

  /** Error al guardar: el itinerario sigue visible y se puede reintentar */
  simularErrorGuardado(mensaje = 'No se pudo guardar el itinerario. Intenta de nuevo.') {
    Itinerario._resetGuardarBtn();
    document.getElementById('save-error-msg').textContent = mensaje;
    document.getElementById('save-error')?.classList.remove('hidden');
  },

  /** Guardado exitoso → toast → Mis viajes */
  simularExitoGuardado() {
    Itinerario.simularGuardando();
    document.getElementById('toast-exito')?.classList.remove('hidden');
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 1500);
  },

  /**
   * Guarda viaje + itinerario + actividades en una transacción (RPC).
   * Solo se envía el token: el servidor usa el itinerario que validó al generarlo.
   */
  async guardar() {
    document.getElementById('save-error')?.classList.add('hidden');
    Itinerario.simularGuardando();

    const { error } = await sb.rpc('guardar_itinerario_completo', { p_token: Itinerario.actual?.token ?? null });

    if (error) {
      // PT403 (token inválido/vencido) y PT409 (ya guardado): mensajes del servidor, seguros de mostrar
      Itinerario.simularErrorGuardado(['PT403', 'PT409', '22023'].includes(error.code)
        ? `No se pudo guardar: ${error.message}`
        : 'No se pudo guardar el itinerario. Intenta de nuevo.');
      return;
    }
    MockStore.borrarBorrador();
    Itinerario.simularExitoGuardado();
  },

  /** Al consultar un viaje ya guardado, el botón Guardar no aplica */
  marcarComoGuardado() {
    const btn = document.getElementById('guardar-btn');
    if (!btn) return;
    document.getElementById('guardar-btn-text').textContent = 'Viaje guardado';
    btn.disabled = true;
    btn.classList.add('opacity-60', 'cursor-not-allowed');
  },

  _resetGuardarBtn() {
    const btn     = document.getElementById('guardar-btn');
    const text    = document.getElementById('guardar-btn-text');
    const spinner = document.getElementById('guardar-spinner');
    if (!btn) return;
    text.textContent = 'Guardar itinerario';
    spinner.classList.add('hidden');
    btn.disabled = false;
    btn.classList.remove('opacity-75', 'cursor-not-allowed');
  },
};

// ?id=<viaje> → viaje guardado en Supabase; sin id → itinerario recién generado
document.addEventListener('DOMContentLoaded', async () => {
  if (!(await Sesion.requerir())) return;

  const id = new URLSearchParams(window.location.search).get('id');
  if (id) {
    Itinerario.cargarGuardado(id);
    return;
  }
  // Sin itinerario generado no hay nada que mostrar (no se usan datos simulados)
  const borrador = MockStore.obtenerBorrador();
  if (!borrador?.token) {
    window.location.replace('crear-viaje.html');
    return;
  }
  Itinerario.actual = borrador;
  Itinerario.renderizar(borrador);
});
