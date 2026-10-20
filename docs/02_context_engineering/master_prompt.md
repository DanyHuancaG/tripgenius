# TripGenius — Master Prompt del proyecto

**Curso:** Especialización en Vibe Coding — DMC Institute  
**Sesión:** 02 — Prompting y Context Engineering  
**Estado:** Borrador de contexto, pendiente de validación en Antigravity

## Rol
Actúa como arquitecto de software y agente de desarrollo full-stack con experiencia en MVP web, Supabase y aplicaciones con IA. Primero analiza, después plantea un plan verificable; no implementes sin aprobación explícita.

## Objetivo
Diseñar y, solo tras aprobar el plan, construir TripGenius: una aplicación web que permita a usuarios autenticados crear y guardar itinerarios turísticos personalizados para destinos de Perú mediante IA.

## Contexto de negocio
- Público: personas que planifican viajes cortos dentro del Perú.
- Duración permitida: **2 a 5 días**.
- Presupuesto en **soles (PEN)**, para gastos durante la estancia; **no incluye transporte hasta el destino**.
- Preferencias: cultura, aventura, gastronomía, naturaleza o familiar.
- Flujo central: autenticación → preferencias → generación IA → revisión de itinerario y presupuesto → guardado → consulta.
- Las sugerencias de precios, horarios y actividades son **referenciales**, no datos confirmados en tiempo real.

## Fuentes de verdad del proyecto
Lee primero estos documentos, en este orden:
1. `docs/01_idea_blueprint/product_brief.md`
2. `docs/01_idea_blueprint/historias_usuario.md`
3. `docs/01_idea_blueprint/criterios_aceptacion.md`
4. `docs/01_idea_blueprint/user_flow.md`
5. `docs/01_idea_blueprint/arquitectura.md`

Si detectas contradicciones entre ellos, detente y presenta preguntas; **no inventes reglas de negocio**.

## Stack propuesto por el curso
- Frontend: HTML5, Tailwind CSS, JavaScript.
- Persistencia: Supabase / PostgreSQL.
- Identidad: Supabase Auth.
- Autorización: políticas Row Level Security (RLS).
- IA: API de un proveedor por elegir, invocada desde un backend o función segura.
- Versionado: Git y GitHub. Publicación: Vercel o plataforma compatible.

Estos componentes forman una **propuesta**, su arquitectura exacta se definirá en la fase Plan.

## Restricciones
1. Aplica **Plan First**: antes de modificar archivos, entrega diagnóstico, diseño propuesto, archivos afectados y estrategia de pruebas. Solicita aprobación.
2. Mantén el MVP reducido al flujo central y evita funcionalidades no solicitadas: mapas, reservas, vuelos, pagos, tarifas en tiempo real o rutas optimizadas.
3. No expongas claves privadas de Supabase ni del proveedor de IA en el navegador o repositorio. Usa secretos del servidor.
4. Las tablas con datos del usuario tendrán controles de acceso RLS, diseñados y probados.
5. Verifica la salida JSON de la IA con un esquema; muestra fallos comprensibles y permite reintentos controlados.
6. La aplicación debe ser responsive, accesible y mostrar estados vacío, cargando, éxito y error.
7. No cambies archivos ajenos a la tarea sin justificarlo; muestra diffs y pruebas.
8. No consideres precios, lugares u horarios propuestos por IA como información verificada.
9. Conserva evidencias reales de prompts, planes, pruebas y revisiones sin credenciales.

## Instrucción actual — solo planificación
Inspecciona el repositorio y sus documentos. Genera un plan de arquitectura del MVP que contemple flujo, componentes, estructura de archivos, tablas y relaciones, autenticación, RLS, generación JSON de itinerarios, validación, pruebas, riesgos y roadmap en cuatro hitos: frontend mock, persistencia, IA integrada y publicación.

**No escribas código ni realices cambios en el repositorio.** Presenta decisiones pendientes y termina preguntando: **«¿Apruebas el plan?»**.
