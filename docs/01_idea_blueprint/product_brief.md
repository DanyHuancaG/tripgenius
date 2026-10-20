# PRODUCT BRIEF — TRIPGENIUS

**Proyecto:** TripGenius  
**Eslogan:** Planifica viajes inteligentes con IA  
**Tipo:** Aplicación web con inteligencia artificial  
**Metodología:** Vibe Coding  
**Versión:** 1.0 — Aprobada  
**Programa:** Especialización en Vibe Coding para Desarrollo de Aplicaciones — DMC Institute

## 1. Problema de negocio

Las personas que desean organizar viajes turísticos deben invertir tiempo investigando destinos, identificando lugares de interés, organizando actividades y estimando los gastos del viaje. La información suele estar dispersa en múltiples páginas web, dificultando la elaboración de un itinerario adaptado al presupuesto, la duración y los intereses del viajero.

**Problema principal:** La planificación manual de viajes requiere tiempo y dificulta organizar actividades y presupuestos de manera personalizada.

## 2. Usuario objetivo

Personas que desean realizar viajes turísticos dentro del Perú y buscan una herramienta sencilla para organizar sus actividades.

**Perfil del usuario:** viajeros individuales, parejas o familias; personas que organizan viajes cortos y cuentan con un presupuesto definido.

**Necesidades:** recomendaciones personalizadas, organización por días, costos aproximados y posibilidad de guardar itinerarios.

## 3. Propuesta de solución

TripGenius es una aplicación web que utiliza inteligencia artificial para generar itinerarios turísticos personalizados dentro del Perú. El usuario inicia sesión e ingresa destino, duración, presupuesto e intereses. La IA genera actividades organizadas por días, horarios sugeridos y costos estimados, y el usuario puede guardar y consultar su itinerario.

## 4. Funcionalidades principales del MVP

### F01. Configuración del viaje

- Destino turístico dentro del Perú.
- Duración del viaje.
- Presupuesto total en soles.
- Preferencias: cultura, aventura, gastronomía, naturaleza o familiar.

### F02. Generación de itinerario con IA

- Actividades personalizadas para cada día.
- Horarios sugeridos y descripciones.
- Costos aproximados y distribución referencial del presupuesto.
- Presentación visual del itinerario.

### F03. Gestión de itinerarios

- Guardar itinerarios generados.
- Consultar viajes anteriores.
- Volver a visualizar actividades y estimaciones.

**Funcionalidad transversal:** registro, inicio y cierre de sesión obligatorios.

## 5. Datos e inteligencia artificial

**Datos de entrada:** destino, días, presupuesto en soles e intereses turísticos.

**Datos almacenados:** usuarios, viajes, itinerarios, actividades recomendadas y costos estimados.

**IA:** un modelo de lenguaje mediante API generará propuestas personalizadas en formato JSON estructurado. El sistema validará el JSON antes de presentarlo o almacenarlo.

**Limitación:** costos y horarios son referenciales; no representan disponibilidad o tarifas verificadas en tiempo real.

## 6. Alcance del MVP

**Incluye:** autenticación, destinos del Perú, formulario de preferencias, generación mediante IA, visualización por días, estimación presupuestaria y guardado/consulta de viajes.

**No incluye:** reservas, pagos, precios en tiempo real, optimización GPS, integración con agencias o compra de entradas.

**Regla aprobada:** el presupuesto cubre gastos durante la estancia y **no** el transporte hasta el destino.

## 7. Criterios de éxito

1. El usuario puede registrarse e iniciar sesión.
2. Configura un viaje dentro del Perú.
3. La IA genera un itinerario con la duración solicitada.
4. Visualiza actividades organizadas por día.
5. Visualiza costos estimados y un resumen del presupuesto.
6. Guarda y recupera itinerarios.
7. Recibe mensajes claros si falla la generación.
8. Accede al MVP desde una URL pública.

## 8. Objetivo académico

Desarrollar y publicar una aplicación web mediante Vibe Coding, demostrando definición de requerimientos, planificación previa, uso de agentes de IA, frontend, backend, autenticación, persistencia, integración real de IA, pruebas, versionado y despliegue.

## 9. Indicadores de validación

- Flujo completo desde login hasta guardado del primer itinerario.
- Actividades relacionadas con el destino solicitado.
- Costos mostrados y totalizados correctamente.
- Persistencia tras cerrar sesión y volver a entrar.
- Manejo de errores de la API sin perder los datos ingresados.

---

**Estado:** Aprobado por el responsable del proyecto.  
**Entregable:** E01-01 — Product Brief.  
**Sesión:** 01 — De una Idea a una Aplicación con Vibe Coding.
