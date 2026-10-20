/**
 * auth.js — TripGenius
 * Login, registro y cierre de sesión con Supabase Auth.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Botón con spinner: estado ocupado / normal */
const setCargando = (btnId, cargando, textoCargando, textoNormal) => {
  const btn     = document.getElementById(btnId);
  const text    = document.getElementById('btn-text');
  const spinner = document.getElementById('btn-spinner');
  if (!btn) return;
  text.textContent = cargando ? textoCargando : textoNormal;
  spinner.classList.toggle('hidden', !cargando);
  btn.disabled = cargando;
  btn.classList.toggle('opacity-75', cargando);
};

const mostrarError = (mensaje) => {
  const banner = document.getElementById('error-banner');
  const msg    = document.getElementById('error-msg');
  if (msg && mensaje) msg.textContent = mensaje;
  banner?.classList.remove('hidden');
};

const Auth = {

  /** [Mock] Muestra el banner de error sin llamar a Supabase */
  simularError() {
    mostrarError('Correo o contraseña incorrectos.');
  },

  async iniciarSesion(email, password) {
    document.getElementById('error-banner')?.classList.add('hidden');
    setCargando('login-btn', true, 'Iniciando sesión…', 'Iniciar sesión');

    const { error } = await sb.auth.signInWithPassword({ email, password });

    if (!error) {
      window.location.replace('dashboard.html');
      return;
    }
    setCargando('login-btn', false, '', 'Iniciar sesión');
    if (error.code === 'email_not_confirmed') {
      mostrarError('Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.');
    } else if (error.code === 'invalid_credentials') {
      // No se revela si falló el correo o la contraseña
      mostrarError('Correo o contraseña incorrectos.');
    } else {
      mostrarError('No se pudo iniciar sesión. Revisa tu conexión e intenta de nuevo.');
    }
  },

  /** Cierra sesión → redirige al login */
  async cerrarSesion() {
    MockStore.borrarBorrador();   // mock-store.js se carga en todas las páginas privadas
    await sb.auth.signOut();
    window.location.replace('index.html');
  },
};

/** ── Registro ── */
const Register = {

  simularError() {
    document.getElementById('success-banner')?.classList.add('hidden');
    mostrarError('No se pudo crear la cuenta. Intenta de nuevo.');
  },

  simularExito() {
    document.getElementById('error-banner')?.classList.add('hidden');
    document.getElementById('success-banner')?.classList.remove('hidden');
  },

  async registrar(email, password) {
    document.getElementById('error-banner')?.classList.add('hidden');
    setCargando('register-btn', true, 'Creando cuenta…', 'Crear cuenta');

    const { error } = await sb.auth.signUp({
      email,
      password,
      // El enlace del correo de confirmación vuelve al login de esta app
      options: { emailRedirectTo: new URL('index.html', window.location.href).href },
    });

    setCargando('register-btn', false, '', 'Crear cuenta');

    // Si el correo ya existe, Supabase no devuelve error: se muestra el mismo
    // mensaje para no revelar qué correos están registrados (HU-02 crit. 3).
    if (!error) {
      document.getElementById('register-form').reset();
      Register.simularExito();
      return;
    }
    if (error.code === 'weak_password') {
      mostrarError('La contraseña no cumple la política de seguridad (mínimo 8 caracteres).');
    } else if (error.code === 'over_email_send_rate_limit' || error.status === 429) {
      mostrarError('Se alcanzó el límite de correos de registro. Intenta de nuevo más tarde.');
    } else {
      mostrarError('No se pudo crear la cuenta. Intenta de nuevo.');
    }
  },
};

/** ── Formularios ── */
document.addEventListener('DOMContentLoaded', () => {

  /** Login */
  const loginForm = document.getElementById('login-form');

  loginForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    let valid = true;

    const email    = document.getElementById('email');
    const password = document.getElementById('password');
    const emailErr = document.getElementById('email-error');
    const passErr  = document.getElementById('password-error');

    // Validar email
    if (!EMAIL_REGEX.test(email.value.trim())) {
      email.classList.add('border-red-400');
      emailErr.classList.remove('hidden');
      valid = false;
    } else {
      email.classList.remove('border-red-400');
      emailErr.classList.add('hidden');
    }

    // Validar contraseña
    if (!password.value) {
      password.classList.add('border-red-400');
      passErr.classList.remove('hidden');
      valid = false;
    } else {
      password.classList.remove('border-red-400');
      passErr.classList.add('hidden');
    }

    if (valid) Auth.iniciarSesion(email.value.trim(), password.value);
  });

  /** Registro */
  const registerForm = document.getElementById('register-form');

  registerForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    let valid = true;

    const email      = document.getElementById('email');
    const password   = document.getElementById('password');
    const confirm    = document.getElementById('confirm-password');
    const emailErr   = document.getElementById('email-error');
    const passErr    = document.getElementById('password-error');
    const confirmErr = document.getElementById('confirm-error');

    const marcar = (input, errEl, hayError) => {
      input.classList.toggle('border-red-400', hayError);
      errEl.classList.toggle('hidden', !hayError);
      if (hayError) valid = false;
    };

    marcar(email, emailErr, !EMAIL_REGEX.test(email.value.trim()));
    marcar(password, passErr, password.value.length < 8);
    marcar(confirm, confirmErr, !confirm.value || confirm.value !== password.value);

    // No se envía la solicitud si hay errores
    document.getElementById('success-banner')?.classList.add('hidden');
    if (valid) Register.registrar(email.value.trim(), password.value);
  });

  // En login y registro: si ya hay sesión, ir directo a Mis viajes
  if (loginForm || registerForm) Sesion.redirigirSiActiva();
});
