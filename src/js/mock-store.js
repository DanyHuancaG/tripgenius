/**
 * mock-store.js — TripGenius
 * Guarda en sessionStorage el itinerario recién generado mientras el usuario
 * decide si lo guarda (D10: generar y guardar son operaciones separadas).
 * Los viajes guardados viven en Supabase (Hito 2).
 */

const MockStore = {

  KEY_BORRADOR: 'tg_viaje_borrador',

  guardarBorrador(itinerario) {
    sessionStorage.setItem(MockStore.KEY_BORRADOR, JSON.stringify(itinerario));
  },

  obtenerBorrador() {
    try {
      return JSON.parse(sessionStorage.getItem(MockStore.KEY_BORRADOR));
    } catch {
      return null;
    }
  },

  borrarBorrador() {
    sessionStorage.removeItem(MockStore.KEY_BORRADOR);
  },
};
