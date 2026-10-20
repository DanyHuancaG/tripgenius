# Plan del Hito 4: GitHub y publicación

> **Estado:** ✅ Aprobado con condiciones (20 Oct 2026). **Autorizado hasta ahora:** solo la revisión de seguridad y de rutas de publicación. No incluye crear el repositorio ni publicar.

## Aprobación del responsable

Decisiones confirmadas:
- Hosting: GitHub Pages.
- Repositorio `DanyHuancaG/tripgenius`, público.
- GitHub Actions publicando exclusivamente `src/`.
- Incluir código y documentación tras revisar que no contengan información privada.
- Mantener temporalmente el origen local en CORS.

Condiciones obligatorias:

> 1. Revisar todas las rutas absolutas y relativas para que funcionen correctamente bajo `/tripgenius/`, incluyendo navegación, recursos estáticos, autenticación y consulta de itinerarios.
> 2. Configurar Supabase Auth con la Site URL pública y las Redirect URLs correspondientes. Mantener las URLs locales de desarrollo autorizadas.
> 3. Configurar CORS utilizando el origen `https://danyhuancag.github.io`, sin la ruta `/tripgenius/`.
> 4. Revisar los archivos actuales y el historial de Git, si existe, para detectar secretos, credenciales, datos personales o evidencias sensibles. No publicar hasta completar la revisión.
> 5. Cambiar o desactivar las contraseñas débiles de las cuentas de prueba antes de hacer pública la aplicación.
> 6. Configurar GitHub Actions con permisos mínimos y publicar únicamente la carpeta `src/`.
> 7. Mantener intactas las políticas RLS, la validación del token de generación y el límite de cinco generaciones diarias.
> 8. Verificar el flujo completo desde la URL pública, incluyendo registro, confirmación de correo, login, generación con Gemini, guardado, cierre de sesión, recuperación de datos y aislamiento entre usuarios.
> 9. Preparar una demostración con una cuenta de prueba válida y un itinerario real previamente guardado por si se alcanza el límite de Gemini.
> 10. Registrar las pruebas y evidencias del despliegue.

**Orden autorizado:** primero la revisión de seguridad y de rutas; mostrar los resultados; no desplegar públicamente sin una nueva aprobación. Sin funcionalidades nuevas.
> **Plan base:** `docs/02_context_engineering/plan_arquitectura.md` · **Seguimiento:** `docs/02_context_engineering/roadmap.md`

---

## 1. Objetivo

Versionar el proyecto en GitHub y publicar la app en una **URL pública** (GitHub Pages), para que cualquier persona con una cuenta la use desde cualquier lugar, sin depender del PC del responsable.

**Criterio de salida (roadmap):** MVP accesible en una URL pública, con el flujo completo y el aislamiento de datos entre usuarios verificados.

## 2. Arquitectura de publicación

```
GitHub (repositorio público DanyHuancaG/tripgenius)
  ├── código: src/, supabase/, docs/
  └── GitHub Actions ──publica src/──► GitHub Pages
                                       https://danyhuancag.github.io/tripgenius/
                                              │  (HTML + JS estáticos)
                                              ▼
                                  Supabase (sin cambios: Auth, BD, Edge Function, Gemini)
```

El frontend es estático. Supabase y la Edge Function no se mueven: solo se autoriza la nueva URL.

## 3. Decisiones que debe tomar el responsable

| # | Decisión | Opciones | Recomendación |
|---|---|---|---|
| **P3** | Hosting | GitHub Pages · Vercel · Netlify | **GitHub Pages** (elegido por el responsable) |
| **H4-A** | Nombre y visibilidad del repositorio | `tripgenius`, público o privado | **`tripgenius`, público**: Pages gratuito lo exige en cuentas Free. No hay secretos en el código (sección 5) |
| **H4-B** | Cómo publicar la carpeta `src/` | **A:** GitHub Actions publica `src/` tal cual · **B:** mover la app a la raíz o a `/docs` | **A:** no cambia la estructura aprobada. Pages solo sirve la raíz o `/docs`, y `/docs` ya está ocupado por la documentación |
| **H4-C** | Qué se sube | Todo menos lo ignorado · solo `src/` | **Todo** (`src/`, `supabase/`, `docs/`, `CLAUDE.md`, `README.md`), para que el docente revise el código y la documentación. Se excluye `supabase/.temp/` (ya está en `.gitignore`) |
| **H4-D** | Origen de la red local (`http://<IP de la red local>:5500`) en CORS | Mantener · quitar | **Mantener** mientras se pruebe en local; quitarlo después del Demo Day |

## 4. Actividades

| # | Actividad | Quién |
|---|---|---|
| 1 | Inicializar Git, revisar `git status` y el contenido exacto que se va a subir | Agente |
| 2 | **Escaneo de secretos** antes del primer commit (ver sección 5). Si aparece algo, se detiene todo | Agente |
| 3 | Actualizar `src/README.md` (todavía describe el "mock") y el `README.md` raíz con el link público y cómo usar la app | Agente |
| 4 | Crear `.github/workflows/pages.yml`: publica `src/` con las acciones oficiales de Pages, en versiones fijas | Agente |
| 5 | Primer commit y creación del repositorio público con `gh repo create`. Activar Pages con el origen "GitHub Actions" | Agente (con el `gh` ya autenticado) |
| 6 | Añadir `https://danyhuancag.github.io` a `ALLOWED_ORIGINS` y volver a desplegar la función | Agente |
| 7 | En Supabase → URL Configuration: **Site URL** = URL de Pages y añadir `https://danyhuancag.github.io/tripgenius/**` en **Redirect URLs** (se mantiene la de Live Server) | **Responsable** (panel) |
| 8 | Pruebas en la URL pública (sección 6) | Agente |
| 9 | Actualizar el roadmap y este plan; preparar una guía breve para el Demo Day (cómo crear cuentas de prueba, qué mostrar si Gemini se satura) | Agente |

## 5. Seguridad antes de publicar

- **Escaneo de secretos** sobre todo lo que se subiría:
  - patrones de claves de Google (`AIza…`, `AQ.…`);
  - `sb_secret_`, `service_role` con JWT y `GEMINI_API_KEY=`;
  - archivos `.env`.
- **Qué es público y está permitido:**
  - la URL de Supabase;
  - la **publishable key**, porque los datos están protegidos por RLS y permisos (probado en los Hitos 2 y 3).
- **Qué nunca va al repositorio:**
  - la API Key de Gemini, que vive solo en Supabase Secrets;
  - la `service_role` o secret key;
  - la contraseña de la base de datos;
  - el token del CLI, que está en el llavero de Windows.
- **Scripts de prueba con contraseñas de los usuarios de prueba:** están fuera del proyecto (carpeta temporal) y **no se suben**.
- **Recomendación:** después de publicar, cambiar las contraseñas de los usuarios de prueba (`usuario.b`, `.c`, `.d`), porque se compartieron en el chat y algunas son débiles.

## 6. Pruebas planificadas

**Nominales (URL pública)**
- La página carga por HTTPS, sin errores de JavaScript ni rutas rotas (`js/…`).
- Login → crear viaje → generar con IA → guardar → Mis viajes → cerrar sesión → volver → detalle.

**De error**
- Páginas privadas sin sesión → login.
- Credenciales incorrectas → mensaje neutro.

**De seguridad**
- CORS: la URL de Pages se acepta y un origen ajeno se rechaza.
- B no ve los viajes de A, ni en la lista ni por URL.
- El repositorio publicado no contiene secretos (escaneo del contenido ya subido).

**Regresión:** las suites de API de los Hitos 2 y 3 (RLS, `generaciones_log` protegido, token 403/409).

**Limitación de las pruebas:** cada generación consume cupo de un usuario (5 por día). Se usará una cuenta con cupo disponible.

## 7. Resultados de la revisión previa (20 Oct 2026)

### 7.1 Seguridad (condición 4)

| Revisión | Resultado |
|---|---|
| Historial de Git | No existe (el proyecto aún no es un repositorio): no hay secretos en commits anteriores |
| Archivos a publicar | 37. Se excluye `supabase/.temp/` (ref del proyecto e ID de organización), ya ignorado en `.gitignore` |
| Claves de Google (`AIza…`, `AQ.…`) | ✅ Ninguna |
| `sb_secret_`, `service_role`, JWT | ✅ Ninguno (solo aparece el texto de este plan que describe qué buscar) |
| Asignaciones `API_KEY=`, `PASSWORD=`, `TOKEN=` | ✅ Ninguna |
| Contraseñas de prueba | ⚠ Una contraseña de prueba aparecía en este plan → **eliminada** (además, ya fue cambiada) |
| Correos personales | ✅ Ninguno (solo el placeholder `tucorreo@ejemplo.com`) |
| Clave pública | `sb_publishable_…` en `src/js/supabase-client.js`: permitida por diseño |
| IP de la red local | ⚠ Aparecía en 2 documentos. Es una dirección de red local, no accesible desde internet; bajo riesgo. **Decisión del responsable:** reemplazada por "IP de la red local". Sigue configurada en el secret `ALLOWED_ORIGINS` de Supabase, que no está en el repositorio |

### 7.2 Rutas bajo `/tripgenius/` (condición 1)

Revisión estática:
- Sin rutas absolutas `/…` en HTML ni en JS. Toda la navegación es relativa (`dashboard.html`, `itinerario.html?id=…`, `js/…`).
- Los recursos externos usan URLs completas (CDN, Supabase).
- Las 11 referencias locales existen con las mismas mayúsculas y minúsculas (Pages distingue entre ellas).

Prueba dinámica, simulando Pages (`src/` servido en `http://127.0.0.1:5597/tripgenius/`, Chrome): **11/12**
- ✅ `/tripgenius/` carga el login, sin necesidad de escribir `index.html`.
- ✅ Sin sesión, las páginas privadas redirigen a `/tripgenius/index.html`.
- ✅ `emailRedirectTo` = `…/tripgenius/index.html`, cubierto por la Redirect URL `…/tripgenius/**`.
- ✅ Login → dashboard → detalle de un viaje guardado desde Supabase → crear viaje → cerrar sesión, todo dentro de `/tripgenius/`.
- ✅ Sin errores de JavaScript.
- ⚠ Única petición fuera de la ruta: `/favicon.ico`, que el navegador pide automáticamente. Es solo estético (la pestaña sin icono) y no afecta al funcionamiento.
- No se probó la generación con IA en esta simulación: CORS solo acepta los orígenes configurados. Se probará en la URL pública (condición 8).

### 7.3 Pendientes antes de publicar

| # | Pendiente | Quién |
|---|---|---|
| 1 | Cambiar o desactivar las contraseñas de `usuario.b`, `usuario.c` y `usuario.d` (condición 5) | ✅ Hecho por el responsable (20 Oct 2026). Verificado: las contraseñas antiguas de b, c y d se rechazan (`invalid_credentials`). Las nuevas no se compartieron. `usuario.a` también se actualizó, según el responsable |
| 2 | Actualizar `src/README.md` (dice "Frontend Mock") y la sección "Estado actual" de `CLAUDE.md` (dice "Aplicación aún no implementada"), que se publicarán | ✅ Actualizados (autorizado por el responsable) |
| 3 | Decidir si se mantiene la IP privada en la documentación | ✅ Reemplazada por "IP de la red local" |

## 8. Ejecución del despliegue (20 Oct 2026)

Revisión aprobada por el responsable ("SI DALE").

| Paso | Resultado |
|---|---|
| `.github/workflows/pages.yml` | `permissions: {}` global. El job `build` solo tiene `contents: read`; el job `deploy` solo `pages: write` + `id-token: write`. Acciones fijadas por SHA (`checkout` v7.0.1, `upload-pages-artifact` v5.0.0, `deploy-pages` v5.0.1). `persist-credentials: false`. Publica `path: src`. Se quitó `configure-pages`, innecesaria sin un generador de sitios |
| Primer commit `068ffc8` | 38 archivos. `supabase/.temp/` excluido. Escaneo del contenido preparado: sin secretos, contraseñas, IPs privadas ni datos personales. Autor con el correo *noreply* de GitHub, no el correo personal |
| CORS (condición 3) | `ALLOWED_ORIGINS` + `https://danyhuancag.github.io` (sin ruta). Verificado: se acepta Pages, se mantienen los orígenes locales y se rechaza `https://danyhuancag.github.io.evil.example` |
| Repositorio | https://github.com/DanyHuancaG/tripgenius (público). Pages con `build_type: workflow` |
| Ejecución del flujo | Run `39453099196`: build ✓, deploy ✓ |
| Solo `src/` publicado (condición 6) | 200 en `/tripgenius/`, las 5 páginas, `js/*` y `README.md` (el de `src/`). **404** en `CLAUDE.md`, `docs/…`, `supabase/…`, `.github/…` y `src/…` |

### 8.1 Pruebas en la URL pública (condición 8), primera ronda (20 Oct 2026)

Chrome automatizado contra `https://danyhuancag.github.io/tripgenius/`, con `usuario.e`. Dos ejecuciones:

| Prueba | Resultado |
|---|---|
| Carga por HTTPS bajo `/tripgenius/` | ✅ |
| Sin sesión → login (dashboard, crear viaje, itinerario) | ✅ |
| Credenciales incorrectas → mensaje neutro | ✅ |
| Login → Mis viajes con el correo del usuario | ✅ |
| Botón deshabilitado mientras genera | ✅ |
| Petición a la Edge Function desde Pages (CORS) | ✅ La petición llega a la función (no hay bloqueo de CORS) |
| **Generación con Gemini** | ⚠ **503 controlado en las 2 ejecuciones** (Gemini saturado). Se mostró el mensaje con los intentos restantes y se conservó el formulario |
| Guardar → Mis viajes → cerrar sesión → volver → recuperar | ⏳ Pendiente: depende de una generación exitosa |
| API con JWT: viaje ajeno por id → vacío; solo viajes propios; INSERT directo en `viajes` y en `generaciones_log` rechazado; `token_generacion` ilegible; `iniciar_generacion` desde el cliente rechazado; token inventado → 403; visitante sin login sin acceso | ✅ 8/8 |
| Límite diario (condición 7) | ✅ Intacto: cuenta los intentos fallidos (2 de 5) |
| Sin errores JS | ✅ |
| Registro + confirmación de correo desde la URL pública | ⏳ La hace el responsable con su correo real. Primer intento rechazado por el límite de correos de Supabase (`over_email_send_rate_limit`, unos 2 por hora para todo el proyecto). **Decisión del responsable:** esperar 1 hora y hacer un único intento (sin SMTP propio) |

## 8.2 Cambio de alcance aprobado: autocompletado y validación inmediata del destino

> **Aprobado por el responsable (20 Oct 2026)** como excepción explícita a "sin funcionalidades nuevas". Motivo: el campo Destino aceptaba texto libre y solo avisaba al pulsar "Generar".

| Aspecto | Detalle |
|---|---|
| Autocompletado | `<datalist id="destinos-peru">` nativo, sin librerías, con los 62 destinos de `DESTINOS_PERU`, ordenados alfabéticamente |
| Validación inmediata | Al salir del campo (`blur`), si el texto no es un destino de la lista: borde rojo y "Elige un destino de la lista…" |
| Normalización | Se corrige al nombre oficial: "cusco, peru" → "Cusco"; "mancora" → "Máncora" |
| Bloqueo | Sin cambios: no se envía la solicitud con un destino inválido. El servidor sigue validando con `private.destinos_peru()` |
| Archivos | `src/crear-viaje.html` (datalist + carga de `comun.js`) y `src/js/viaje.js` (`validarDestino()`) |
| Sin cambios en | Base de datos, RLS, Edge Function, token y límite diario |
| Pruebas | 18/18 en Chrome simulando Pages. Sugerencias, aviso para "París", "Ciudad Inventada" y "asdfgh", normalización, bloqueo al enviar (sin llamada a la IA), envío con el nombre oficial y formulario conservado. La llamada a la IA se interceptó, sin consumir cupo. La lista del frontend es **idéntica** a la del servidor (62 = 62) |

## 8.3 Cambio de alcance aprobado: Claude como proveedor de IA

> **Aprobado por el responsable (20 Oct 2026).** Motivo: en las pruebas desde la URL pública, Gemini (nivel gratuito) devolvió 503 de forma repetida, también a otros usuarios. Detalle técnico en `docs/05_integracion_ia/plan_hito_03.md` (sección 2.1).

- Solo cambia la Edge Function (`index.ts`, `esquema.ts`). Base de datos, RLS, token, límite diario y frontend sin cambios (condición 7).
- La clave `ANTHROPIC_API_KEY` vive solo en Supabase Secrets; no está en el repositorio.
- La respuesta 200 incluye `diagnostico: {modelo, tokens}`, sin datos sensibles, para medir el costo.

**Pruebas reales desde la Edge Function (con origen de Pages):**

| Modelo | Tiempo | Tokens (entrada / salida) | Costo real aprox. | Calidad observada |
|---|---|---|---|---|
| **Claude Opus 5.5** | 30,1 s | 1.655 / 1.892 | **US$ 0,045** | La más completa y realista: incluye alojamiento y entradas (boleto turístico); total S/ 868 de S/ 900 |
| Claude Sonnet 5.5 | 16,1 s | 1.655 / 1.733 | US$ 0,021 | Muy buena y variada, pero no incluyó alojamiento; total S/ 690 |
| Claude Haiku 5.5 | 11,6 s | 1.655 / 1.664 | US$ 0,001 | Correcta, pero con errores: puso S/ 0 en sitios que requieren boleto turístico (Catedral, Qorikancha, Pisac); total S/ 397, subestimado |

**Viaje de respaldo para la demo (condición 9):** el itinerario de Opus 5.5 se guardó con su token en la cuenta `usuario.e` → **Cusco, 3 días, 19 actividades, S/ 868** (`viaje_id 7836a5c8-…`).

**Modelo activo tras la comparativa:** `claude-opus-5-5`, pendiente de la elección final del responsable. Se cambia con el secret `ANTHROPIC_MODEL`, sin tocar código.

## 9. Limitaciones conocidas al publicar

| Limitación | Efecto | Mitigación |
|---|---|---|
| Correo integrado de Supabase (unos 2 por hora) | Pocos usuarios pueden registrarse solos al día | Crear cuentas desde el panel con *Auto Confirm User*, o SMTP propio (fuera del alcance) |
| Saldo de Anthropic (US$ 5 de prepago) | Con Opus 5.5, unos 110 itinerarios; con Sonnet, unos 240 | Si se agota, la función pasa sola a Gemini. Revisar el saldo en console.anthropic.com antes de la demo |
| Gemini en nivel gratuito (ahora de respaldo) | Saturación frecuente (503) | Solo se usa si Claude falla |
| Tailwind por CDN | Aviso en consola "should not be used in production" | Aceptable para un MVP académico; no afecta al funcionamiento |
| Repositorio público | El código es visible | Sin secretos; la seguridad depende de Auth y RLS, no de ocultar el código |
