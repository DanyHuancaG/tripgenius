/**
 * mis-viajes.js — TripGenius
 * Lista los viajes guardados del usuario en Supabase (RLS filtra por usuario).
 */

const MisViajes = {

  /** Muestra uno de los cuatro estados de UI */
  mostrarEstado(estado) {
    const ids = ['loading', 'empty', 'list', 'error'];
    ids.forEach(id => {
      const el = document.getElementById(`state-${id}`);
      if (el) el.classList.add('hidden');
    });
    const target = document.getElementById(`state-${estado}`);
    if (target) target.classList.remove('hidden');
  },

  /** Genera las tarjetas de viajes */
  renderizarViajes(viajes) {
    const container = document.getElementById('state-list');
    if (!container) return;

    container.innerHTML = viajes.map(v => {
      const it    = Array.isArray(v.itinerarios) ? v.itinerarios[0] : v.itinerarios;
      const costo = Number(it?.costo_total_estimado ?? 0);
      const excede = !!it?.advertencia_presupuesto;
      const fecha = new Date(v.created_at)
        .toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });

      return `
      <a href="itinerario.html?id=${encodeURIComponent(v.id)}"
        class="block bg-white rounded-2xl shadow-md hover:shadow-lg transition p-5 cursor-pointer">
        <!-- Destino y días -->
        <div class="flex items-start justify-between mb-3">
          <div>
            <h2 class="text-lg font-bold text-primary">${escapeHtml(v.destino)}</h2>
            <p class="text-xs text-gray-400">${v.dias} días · ${fecha}</p>
          </div>
          ${excede
            ? `<span class="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-1 rounded-full">⚠ Excede presupuesto</span>`
            : `<span class="text-xs bg-green-100 text-green-700 font-semibold px-2 py-1 rounded-full">✓ Dentro del presupuesto</span>`
          }
        </div>

        <!-- Intereses -->
        <div class="flex flex-wrap gap-1 mb-4">
          ${v.intereses.map(i =>
            `<span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">${escapeHtml(etiquetaInteres(i))}</span>`
          ).join('')}
        </div>

        <!-- Presupuesto vs costo -->
        <div class="border-t pt-3 flex justify-between text-sm">
          <div>
            <p class="text-xs text-gray-400">Presupuesto</p>
            <p class="font-semibold text-gray-700">${formatoSoles(v.presupuesto)}</p>
          </div>
          <div class="text-right">
            <p class="text-xs text-gray-400">Costo estimado</p>
            <p class="font-semibold ${excede ? 'text-amber-600' : 'text-green-600'}">
              ${formatoSoles(costo)}
            </p>
          </div>
        </div>
      </a>`;
    }).join('');
  },

  /** Consulta los viajes del usuario en sesión */
  async cargar() {
    MisViajes.mostrarEstado('loading');

    const { data, error } = await sb
      .from('viajes')
      .select('id, destino, dias, presupuesto, intereses, created_at, itinerarios ( costo_total_estimado, advertencia_presupuesto )')
      .order('created_at', { ascending: false });

    if (error) {
      MisViajes.mostrarEstado('error');
      return;
    }
    if (data.length === 0) {
      MisViajes.mostrarEstado('empty');
      return;
    }
    MisViajes.renderizarViajes(data);
    MisViajes.mostrarEstado('list');
  },
};

// Inicio: exige sesión, muestra el correo y carga los viajes
document.addEventListener('DOMContentLoaded', async () => {
  const session = await Sesion.requerir();
  if (!session) return;
  document.getElementById('user-name').textContent = session.user.email;
  MisViajes.cargar();
});
