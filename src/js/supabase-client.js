/**
 * supabase-client.js — TripGenius
 * Inicialización del cliente Supabase con la clave PÚBLICA (publishable key).
 * Es segura en el frontend: los datos están protegidos por RLS y permisos.
 * Las claves sensibles (secret / service_role, API Key de IA) NUNCA van aquí.
 */

const SUPABASE_URL = 'https://slymqwtupzmhfifhhgzp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ROyFZBtrQJhbzcdUBjQOxA_MbU6cFqi';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const Sesion = {

  /**
   * Para páginas privadas: si no hay sesión, redirige al login.
   * Las páginas privadas arrancan con el <body> oculto y se muestran aquí.
   */
  async requerir() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      window.location.replace('index.html');
      return null;
    }
    // Si se cierra la sesión (p. ej. en otra pestaña), salir de la página privada
    sb.auth.onAuthStateChange((evento) => {
      if (evento === 'SIGNED_OUT') window.location.replace('index.html');
    });
    document.body.style.visibility = 'visible';
    return session;
  },

  /** Para login/registro: si ya hay sesión, ir directo a Mis viajes */
  async redirigirSiActiva() {
    const { data: { session } } = await sb.auth.getSession();
    if (session) window.location.replace('dashboard.html');
  },
};
