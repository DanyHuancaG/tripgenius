/**
 * comun.js — TripGenius
 * Utilidades compartidas entre vistas.
 */

/** Etiquetas visibles de cada interés (en BD se guarda la clave) */
const ETIQUETAS_INTERES = {
  cultura: 'Cultura', aventura: 'Aventura', gastronomia: 'Gastronomía',
  naturaleza: 'Naturaleza', familiar: 'Familiar',
};

const etiquetaInteres = (clave) => ETIQUETAS_INTERES[clave] || clave;

/** Escapa texto antes de insertarlo con innerHTML (datos de BD o de la IA) */
const escapeHtml = (txt) => String(txt ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const formatoSoles = (n) => `S/ ${Number(n).toFixed(2)}`;
