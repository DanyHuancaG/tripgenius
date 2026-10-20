# TripGenius — Criterios de aceptación

**DMC Institute — Sesión 1**  
**Entregable:** E01-03 — Criterios de aceptación  
**Estado:** Redactado para revisión  

Criterios comprobables de las seis historias de usuario. La duración de **2 a 5 días** es una propuesta pendiente de confirmación, no una regla aprobada.

## HU-01 — Iniciar sesión

1. **Dado** que tengo una cuenta, **cuando** ingreso credenciales válidas, **entonces** accedo al formulario de viaje.
2. **Dado** que las credenciales son incorrectas, **cuando** intento entrar, **entonces** veo un mensaje de error y no accedo al área privada.
3. **Dado** que no tengo sesión activa, **cuando** intento abrir una pantalla privada, **entonces** se me solicita iniciar sesión.
4. **Dado** que tengo una sesión activa, **cuando** cierro sesión, **entonces** se restringe nuevamente el acceso a las pantallas privadas.

## HU-02 — Crear una cuenta

1. **Dado** que ingreso un correo con formato válido y una contraseña que cumple la política configurada, **cuando** envío el registro, **entonces** el sistema tramita la creación de la cuenta.
2. **Dado** que el correo no tiene formato válido o faltan campos obligatorios, **cuando** intento registrarme, **entonces** recibo una indicación clara y no se envía una solicitud inválida.
3. **Dado** que el correo ya está registrado, **cuando** intento crear otra cuenta, **entonces** el sistema responde sin revelar información sensible.
4. **Dado** que Supabase requiere confirmar el correo, **cuando** el registro termina, **entonces** se informa que la confirmación es necesaria antes de entrar.

## HU-03 — Configurar un viaje

1. **Dado** que estoy autenticado, **cuando** abro «Crear viaje», **entonces** veo los campos destino del Perú, cantidad de días, presupuesto en soles e intereses.
2. **Dado** que completo datos válidos (duración de 2 a 5 días y presupuesto mayor que cero), **cuando** solicito generar un itinerario, **entonces** la aplicación procesa la solicitud.
3. **Dado** que falta un campo obligatorio, la duración está fuera del rango o el presupuesto no es positivo, **cuando** intento continuar, **entonces** se muestran errores específicos y se bloquea la generación.
4. **Dado** que ingreso un destino fuera del Perú, **cuando** intento continuar, **entonces** se informa que la cobertura del MVP está limitada al Perú.
5. **Dado** que configuro el presupuesto, **cuando** consulto su alcance, **entonces** se indica que no incluye transporte hasta o desde el destino.

## HU-04 — Generar un itinerario con IA

1. **Dado** que hay preferencias válidas, **cuando** presiono «Generar itinerario», **entonces** veo un indicador de procesamiento y se evita enviar la misma solicitud repetidamente mientras está en curso.
2. **Dado** que el modelo responde correctamente, **cuando** se valida la respuesta, **entonces** recibo exactamente la cantidad de días solicitada, con actividades, descripciones, horarios sugeridos y costos estimados.
3. **Dado** que el modelo devuelve datos incompletos o un formato incorrecto, **cuando** se valida la respuesta, **entonces** no se presenta como un itinerario correcto y aparece un error controlado.
4. **Dado** que falla el proveedor o supera el tiempo de espera, **cuando** termina la solicitud, **entonces** aparece un mensaje claro y puedo reintentar sin perder las preferencias.
5. **Dado** que se muestra un itinerario, **cuando** reviso las recomendaciones, **entonces** aparece un aviso de que horarios, tarifas y disponibilidad no están verificados en tiempo real.

## HU-05 — Consultar itinerario y presupuesto

1. **Dado** un itinerario válido, **cuando** abro sus detalles, **entonces** veo las actividades agrupadas por día y ordenadas por hora sugerida.
2. **Dado** un itinerario con costos estimados, **cuando** consulto el resumen, **entonces** veo la suma de actividades y otros gastos que el modelo haya incluido y su comparación con el presupuesto ingresado.
3. **Dado** que el costo estimado supera el presupuesto, **cuando** veo el resumen, **entonces** aparece una advertencia clara con la diferencia estimada; no se oculta el exceso.
4. **Dado** que falta una estimación de costo, **cuando** consulto el resumen, **entonces** se identifica como no estimado; no se asume costo cero.

## HU-06 — Guardar y consultar viajes

1. **Dado** un itinerario válido, **cuando** presiono «Guardar», **entonces** se almacena asociado a mi cuenta y recibo confirmación de éxito.
2. **Dado** que ya tengo viajes guardados, **cuando** abro «Mis viajes», **entonces** veo mis viajes y puedo entrar al detalle de cualquiera de ellos.
3. **Dado** que cierro sesión y vuelvo a entrar, **cuando** abro «Mis viajes», **entonces** recupero la información persistida.
4. **Dado** que intento acceder al viaje de otra persona mediante su identificador, **cuando** consulto o modifico sus datos, **entonces** el acceso se deniega conforme a las políticas de seguridad.
5. **Dado** un fallo al guardar, **cuando** se produce el error, **entonces** se informa que el guardado no se completó y no se muestra una confirmación falsa.

## Reglas transversales

- Solo usuarios autenticados pueden utilizar TripGenius.
- Los destinos del MVP están limitados al Perú.
- El presupuesto se expresa en PEN y no incluye transporte hasta o desde el destino.
- Costos, horarios y disponibilidad son orientativos, no verificados en tiempo real.
- Un usuario no puede consultar itinerarios de otros usuarios.
- Las claves de API de IA no deben exponerse en el frontend.
- La salida de IA se valida antes de mostrarla o guardarla.

**Pendiente de aprobación:** definir el rango de duración del viaje; se propusieron de 2 a 5 días.
