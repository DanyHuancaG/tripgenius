# TripGenius — Aplicación web

Frontend estático (HTML, Tailwind CSS por CDN y JavaScript) conectado a Supabase:

- **Supabase Auth**: registro, login y cierre de sesión.
- **PostgreSQL con RLS**: viajes, itinerarios y actividades de cada usuario.
- **Edge Function `generar-itinerario`**: genera el itinerario con Gemini, desde el servidor.

## Cómo abrirla en local

Ábrela con **Live Server** en VS Code, en `http://127.0.0.1:5500/src/index.html`. No uses doble clic (`file://`): el login y la IA necesitan una dirección `http://` autorizada en Supabase y en CORS.

## Estructura

```
src/
├── index.html         → Login (HU-01)
├── register.html      → Registro (HU-02)
├── dashboard.html     → Mis viajes (HU-06)
├── crear-viaje.html   → Configurar viaje y generar con IA (HU-03, HU-04)
├── itinerario.html    → Itinerario, presupuesto y guardado (HU-04, HU-05, HU-06)
└── js/
    ├── supabase-client.js   → Cliente Supabase (clave pública) + control de sesión
    ├── comun.js             → escapeHtml, etiquetas de intereses, formato S/
    ├── mock-store.js        → Borrador del itinerario generado (sessionStorage)
    ├── auth.js              → Login, registro y cierre de sesión
    ├── viaje.js             → Formulario y llamada a la IA
    ├── itinerario.js        → Mostrar y guardar el itinerario (con token)
    └── mis-viajes.js        → Lista de viajes guardados
```

## Seguridad

- La clave de `supabase-client.js` es la **publishable key**, pública por diseño: los datos se protegen con RLS y permisos en PostgreSQL.
- La API Key de Gemini **no** está en el frontend: vive en los Supabase Secrets y solo la usa la Edge Function.
- Los itinerarios solo se pueden guardar con un **token de un solo uso** emitido por el servidor al generarlos.

## Botones [Mock]

Algunas páginas tienen botones `[Mock]` al pie para mostrar estados de la interfaz (cargando, vacío, error) durante una demostración. No llaman al servidor.
