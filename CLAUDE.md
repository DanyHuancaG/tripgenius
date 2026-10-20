# TripGenius — Contexto maestro de desarrollo

> Proyecto académico de la Especialización en Vibe Coding — DMC Institute. Versión 1.0 del contexto (Sesión 2). No autoriza implementación automática.

## Propósito del producto
TripGenius ayuda a un viajero autenticado a generar, visualizar y guardar un itinerario de **2 a 5 días** para destinos turísticos **dentro del Perú**, a partir de destino, duración, presupuesto e intereses. El presupuesto está en **PEN (S/)** y excluye el traslado hasta el destino.

## Alcance aprobado del MVP
- Registro, login y cierre de sesión.
- Configuración del viaje (destino, días, presupuesto e intereses).
- Generación mediante IA de actividades, horarios sugeridos y costos estimados por día.
- Presentación del itinerario y resumen de presupuesto.
- Guardado y consulta de itinerarios del usuario.

**Fuera de alcance:** compra y reservas, pagos, mapas interactivos, navegación GPS, optimización de rutas, disponibilidad o tarifas en tiempo real.

## Documentos de referencia
Antes de planificar o modificar código, consulta:
- `docs/01_idea_blueprint/product_brief.md`
- `docs/01_idea_blueprint/historias_usuario.md`
- `docs/01_idea_blueprint/criterios_aceptacion.md`
- `docs/01_idea_blueprint/user_flow.md`
- `docs/01_idea_blueprint/arquitectura.md`

No inventes requerimientos ni cambies el alcance sin consultar al responsable.

## Tecnologías de referencia del curso
- UI: HTML5, Tailwind CSS, JavaScript.
- Datos y autenticación: Supabase, PostgreSQL, Supabase Auth y RLS.
- IA: proveedor por elegir; llamada solo desde backend seguro o función server-side.
- Versionado/publicación: GitHub y Vercel (u hosting compatible).

## Reglas de diseño
- Interfaz en español, responsive y con navegación sencilla.
- Componentes visuales consistentes; definir colores, tipografía y espaciado antes de programar.
- Estados visibles: carga, vacío, éxito y error.
- Los importes y horarios generados deben etiquetarse como **estimaciones no verificadas**.

## Reglas de seguridad y datos
- Nunca incluir secretos de IA o claves administrativas de Supabase en el frontend o Git.
- Credenciales en secretos/variables del servidor, con `.env` excluido de Git.
- Proteger datos personales mediante autenticación y RLS; probar acceso autorizado/no autorizado.
- Validar entradas y respuesta JSON en el servidor; no confiar en la IA para decisiones de seguridad.

## Modo de trabajo del agente
1. **UNDERSTAND:** leer documentos y archivos pertinentes.
2. **PLAN:** explicar objetivo, impacto, archivos y tablas afectados, enfoque y pruebas. Esperar aprobación humana.
3. **EXECUTE:** implementar cambios concretos en la etapa autorizada.
4. **TEST:** ejecutar pruebas nominales, de error y no regresión.
5. **REVIEW:** mostrar diffs, resultados y limitaciones; documentar lo realizado.

No afirmar que algo está probado sin ejecutar la prueba correspondiente. En caso de contradicción documental, preguntar antes de avanzar.

## Roadmap académico
1. Frontend Mock interactivo.
2. Supabase: autenticación, tablas, RLS y persistencia.
3. Generación de itinerarios mediante IA real, JSON validado y fallback.
4. GitHub, despliegue y Demo Day.

## Estado actual
- Sesión 1: Product Brief y Blueprint aprobados conceptualmente.
- Sesión 2: contexto y plan de arquitectura aprobados (`docs/02_context_engineering/plan_arquitectura.md`, v3 con condiciones C1–C4).
- Hito 1 — Frontend Mock: ✅ completado (`docs/03_frontend/plan_hito1.md`).
- Hito 2 — Supabase (Auth, tablas, RLS, RPC): ✅ completado (`docs/04_backend_supabase/plan_hito2.md`).
- Hito 3 — IA con Gemini (Edge Function, token de un solo uso, límite de 5 al día): ✅ completado (`docs/05_integracion_ia/plan_hito_03.md`).
- Hito 4 — GitHub y publicación en GitHub Pages: en curso (`docs/06_despliegue/plan_hito_04.md`).
- Seguimiento general: `docs/02_context_engineering/roadmap.md`.
