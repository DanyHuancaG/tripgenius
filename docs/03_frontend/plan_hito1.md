# Plan del Hito 1: Frontend Mock

> **Estado:** ✅ Completado y aprobado por el responsable (19 Oct 2026)
> **Plan base:** `docs/02_context_engineering/plan_arquitectura.md` (v3) · **Seguimiento:** `docs/02_context_engineering/roadmap.md`

---

## 1. Objetivo

Construir una interfaz web estática, sin backend, que permita recorrer el flujo completo del MVP con datos simulados:

Login → Registro → Mis viajes → Crear viaje → Itinerario → Guardar → Mis viajes.

## 2. Alcance

- 5 vistas HTML con Tailwind CSS (CDN) y la paleta del plan: azul profundo `#1E3A5F`, turquesa `#2EC4B6` y blanco.
- Cuatro estados de UI por vista: cargando, vacío, éxito y error.
- Botones `[Mock]` para mostrar cada estado sin backend.
- Validaciones de formulario en el frontend.
- Disclaimer de estimaciones no verificadas y advertencia de presupuesto excedido con la diferencia en S/.
- `supabase-client.js` como archivo de reserva para el Hito 2.

**Fuera de alcance:** autenticación real, base de datos e IA.

## 3. Archivos

```
src/
├── index.html          Login (HU-01)
├── register.html       Registro (HU-02)
├── dashboard.html      Mis viajes (HU-06)
├── crear-viaje.html    Configurar viaje (HU-03)
├── itinerario.html     Itinerario + guardar (HU-04, HU-05)
└── js/
    ├── auth.js · viaje.js · itinerario.js · mis-viajes.js
    ├── mock-store.js   (añadido en la revisión)
    └── supabase-client.js
```

## 4. Revisión antes de la aprobación

En la revisión aparecieron estos defectos, que se corrigieron antes de aprobar:

| # | Problema | Criterio afectado | Corrección |
|---|---|---|---|
| 1 | El registro no validaba nada: un `return` temprano en `auth.js` impedía que se ejecutara su código | HU-02 crit. 2 | Validación de correo, contraseña de al menos 8 caracteres y confirmación |
| 2 | Se aceptaba cualquier destino, incluso fuera del Perú | HU-03 crit. 4 | Lista referencial de unos 60 destinos del Perú. Admite tildes, mayúsculas y "Cusco, Perú" |
| 3 | El itinerario siempre mostraba "Cusco, 3 días" | Coherencia de la demo | El itinerario simulado se genera con los datos del formulario |
| 4 | "Guardar" no persistía y la lista era fija | HU-06 (simulado) | Guardado simulado en el navegador (`mock-store.js`), reemplazado por Supabase en el Hito 2 |

Quedó como limitación aceptada para el Hito 2: las páginas privadas se podían abrir sin login.

## 5. Pruebas

Prueba end-to-end automatizada en Chrome (Playwright): **24/24 comprobaciones**, más una prueba aparte del login.

- Registro: vacío, correo inválido, contraseña corta y contraseñas distintas, todos rechazados; registro válido muestra la confirmación.
- Crear viaje: destino fuera del Perú y presupuesto 0 rechazados.
- El itinerario refleja destino, días, intereses y presupuesto. Muestra la advertencia de exceso e identifica los costos "No estimado".
- Guardar → aparece en Mis viajes → persiste tras cerrar sesión → se puede abrir su detalle.
- No regresión: los botones `[Mock]` siguen funcionando y no hay errores de JavaScript.

## 6. Aprobación

El responsable aprobó el Hito 1 el 19 Oct 2026. Las evidencias (capturas) se descartaron por decisión del responsable; la carpeta `evidencias/` se eliminó del proyecto el 20 Oct 2026.
