# Historial del roadmap

Archivado el 2026-08-10 durante la reconstrucción documental. Este archivo preserva especificaciones históricas que ya no forman parte del roadmap operativo vigente.

7. Registro histórico del alcance previo de Tarea 17

La sección siguiente conserva el alcance que guió el primer bloque de ejecución. Fue superada por las Tareas 17 a 22 verificadas arriba y no representa la tarea vigente.

Tarea 17 — Ejecutar una transformación Excel configurada
7.1 Objetivo

Implementar la ejecución real de una transformación Excel previamente configurada para una ejecución de tipo TRANSFORMACION_EXCEL.

La tarea debe procesar el archivo fuente asociado a la ejecución, aplicar exclusivamente las operaciones y reglas permitidas, generar un archivo .xlsx de salida y dejar el resultado vinculado a la ejecución correspondiente.

7.2 Resultado funcional esperado

A partir de:

una ejecución existente;
un archivo fuente CSV/XLS/XLSX asociado a esa ejecución;
una configuración válida ya guardada;
una transformación compuesta únicamente por operaciones autorizadas;

el sistema debe generar una salida XLSX transformada y registrar el resultado de manera trazable.

7.3 Endpoint autorizado

La ruta funcional planificada para esta tarea es:

POST /transformaciones-excel/{ejecucion_id}/ejecutar

El endpoint debe requerir autenticación JWT.

Antes de implementarlo, Codex debe verificar:

el patrón de rutas existente;
los schemas actuales;
el mecanismo real de obtención del archivo fuente;
el mecanismo real de persistencia de archivos;
los estados actuales de las ejecuciones;
la configuración guardada dentro de la ejecución.

No debe inventar un modelo, campo, tabla, relación o endpoint adicional salvo que el prompt de ejecución lo autorice expresamente.

7.4 Comportamientos obligatorios

La implementación debe:

Validar que la ejecución exista.
Validar que la ejecución corresponda a un proceso TRANSFORMACION_EXCEL.
Validar que exista una configuración de transformación persistida.
Validar que exista un archivo fuente compatible asociado a la ejecución.
Validar que el archivo fuente sea CSV, XLS o XLSX.
Aplicar solamente SOURCE, CONSTANT, CONCAT, ARITHMETIC y VALUE_MAP.
Respetar el límite máximo de 5 filtros.
Respetar el límite máximo de 3 criterios de ordenamiento.
Aplicar deduplicación solo cuando esté configurada.
Generar una salida XLSX.
Mantener intacto el archivo fuente.
Registrar de forma trazable la salida generada dentro de la ejecución.
Devolver una respuesta que identifique claramente el resultado generado.
Actualizar el estado o resumen de ejecución únicamente mediante los mecanismos ya existentes o explícitamente autorizados.
Evitar registros inconsistentes o archivos huérfanos cuando la operación falle.
7.5 Errores que deben manejarse

La tarea debe contemplar al menos estos escenarios:

Escenario	Resultado esperado
Ejecución inexistente	Error controlado de recurso inexistente
Proceso distinto de TRANSFORMACION_EXCEL	Error controlado de validación funcional
Configuración inexistente	Error controlado indicando que primero debe guardarse la configuración
Archivo fuente inexistente	Error controlado indicando que falta el archivo de entrada
Extensión no compatible	Error controlado de archivo no soportado
Configuración inválida o incompleta	Error controlado sin generar salida parcial
Operación fuera de las cinco permitidas	Error controlado de validación
Más de 5 filtros	Error controlado de validación
Más de 3 ordenamientos	Error controlado de validación
Error de lectura de archivo	Error controlado y trazable
Error al generar salida XLSX	Error controlado sin dejar una ejecución incoherente
7.6 Restricciones técnicas de la tarea

Esta tarea no autoriza:

crear tablas nuevas;
modificar columnas existentes;
generar o aplicar migraciones Alembic;
cambiar la estrategia actual entre create_all y Alembic;
incorporar un motor de fórmulas libre;
incorporar macros;
modificar conciliación;
agregar frontend;
crear un sistema de plantillas reutilizables;
agregar un planificador de ejecuciones;
agregar OCR, PDF o integraciones externas;
introducir una suite de testing nueva como trabajo separado.

Si durante la inspección Codex determina que el comportamiento solicitado requiere un cambio de esquema, debe detenerse antes de modificar modelos o base de datos y reportar:

qué información falta;
qué componente existente no alcanza;
qué cambio de esquema sería necesario;
por qué no puede resolverse de manera segura con las estructuras actuales.
7.7 Criterios de aceptación de Tarea 17

La tarea estará terminada únicamente cuando se cumpla todo lo siguiente:

Existe el endpoint POST /transformaciones-excel/{ejecucion_id}/ejecutar.

El endpoint exige JWT.

El endpoint rechaza ejecuciones inexistentes.

El endpoint rechaza procesos que no sean TRANSFORMACION_EXCEL.

El endpoint exige una configuración persistida.

El endpoint exige un archivo fuente compatible.

Se procesa correctamente al menos un archivo XLSX real.

La salida generada es un archivo XLSX válido y legible.

La salida permanece vinculada a la ejecución que la generó.

El archivo fuente no se altera.

Se verifican al menos las cinco operaciones permitidas, individualmente o mediante casos de prueba manuales combinados.

Se verifican filtros, deduplicación y ordenamiento cuando estén presentes en la configuración.

Los límites de filtros y ordenamientos se validan.

Los errores no dejan archivos o registros inconsistentes.

No se modifica el esquema de base de datos.

No se altera el comportamiento de conciliación.

Se actualiza docs/PROJECT_HANDOFF.md con el nuevo endpoint, servicios, comportamiento verificado, comandos de prueba realizados y riesgos observados.

Se actualiza este roadmap exclusivamente para marcar Tarea 17 como completada, sin modificar alcance ni prioridades.

8. Validación manual mínima de Tarea 17

Al finalizar la implementación, Codex debe informar resultados concretos de una prueba manual controlada.

La validación mínima debe comprobar:

Creación o uso de una ejecución de tipo TRANSFORMACION_EXCEL.
Carga o reutilización de un archivo XLSX de prueba.
Inspección de la estructura del archivo.
Guardado de una configuración válida.
Ejecución de la transformación.
Generación de salida XLSX.
Verificación de contenido del archivo de salida.
Confirmación de que el archivo fuente sigue intacto.
Verificación de al menos un error controlado.
Confirmación de que no se modificaron tablas, modelos ni migraciones.

No se autoriza declarar la tarea terminada solo porque el endpoint fue creado o porque Swagger muestra una respuesta exitosa.

9. Próximo bloque planificado

El backend de Transformación Excel queda técnicamente cerrado en Tarea 22. El siguiente bloque planificado es el frontend. Su alcance concreto requiere un prompt operativo externo y no se infiere en este roadmap.

9.1 Registro histórico posterior a Tarea 17

No hay una tarea funcional posterior autorizada automáticamente.

Una vez finalizada Tarea 17, se debe:

verificar el resultado técnico;
actualizar el handoff;
revisar el comportamiento real del flujo de salida;
definir desde planificación externa la siguiente tarea.

Posibles áreas futuras, todavía no autorizadas como siguiente tarea:

descarga o recuperación explícita de archivos transformados;
historial de ejecuciones de transformación;
auditoría detallada;
pruebas automatizadas;
administración de configuraciones reutilizables;
interfaz frontend;
gestión avanzada de permisos;
estrategia formal de migraciones;
despliegue y operación en entornos compartidos.

Codex no debe seleccionar ninguna de esas áreas por iniciativa propia.

