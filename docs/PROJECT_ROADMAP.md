Project Roadmap — Automatizador Admin

Versión: 1.0
Estado: Planificación funcional autorizada
Fecha de referencia: 2026-07-02
Documento técnico asociado: docs/PROJECT_HANDOFF.md

1. Propósito y jerarquía documental

Este documento define la planificación funcional autorizada del proyecto automatizador-admin.

Su objetivo es evitar que una conversación de Codex:

infiera prioridades a partir del código;
convierta una limitación técnica en una decisión de producto;
cree funcionalidades, etapas o requisitos no solicitados;
altere el orden de las tareas acordadas;
expanda el MVP sin una decisión explícita de planificación.

La relación entre los documentos del proyecto es la siguiente:

Documento	Fuente de verdad	Uso permitido
docs/PROJECT_ROADMAP.md	Planificación funcional autorizada	Define alcance, prioridades, tareas, criterios de aceptación y exclusiones
docs/PROJECT_HANDOFF.md	Estado técnico verificable del repositorio	Describe código, modelos, rutas, servicios, configuración, riesgos y restricciones técnicas
Código actual del repositorio	Implementación efectiva	Prevalece para describir el comportamiento técnico real
Prompt de tarea vigente	Instrucción operativa puntual	Define exactamente qué debe implementar Codex en cada intervención

Si existe una contradicción entre este roadmap y el código actual, Codex debe:

identificarla;
describir el impacto técnico;
no modificar el alcance funcional por cuenta propia;
esperar o solicitar una decisión explícita mediante un nuevo prompt de planificación.

Codex no debe crear, editar ni reordenar este roadmap por inferencia del código. Solo podrá actualizarlo cuando una tarea externa lo solicite explícitamente.

2. Visión del producto

automatizador-admin es una plataforma web para administrar automatizaciones administrativas configurables por cliente.

El producto debe permitir que distintos clientes tengan procesos con:

entradas de archivos diferentes;
reglas de procesamiento diferentes;
revisiones humanas cuando sean necesarias;
salidas adaptadas al proceso configurado.

El primer MVP se concentra en procesos administrativos basados en archivos, principalmente Excel y CSV.

La propuesta funcional general es:

Cliente
→ Proceso configurado
→ Ejecución
→ Carga de archivos
→ Inspección y validación
→ Reglas configuradas
→ Procesamiento
→ Revisión humana, cuando corresponda
→ Archivo o resultado de salida
3. Alcance funcional del MVP
3.1 Capacidades incluidas

El MVP contempla los siguientes dominios funcionales:

Gestión de clientes.
Gestión de usuarios administrativos.
Gestión de procesos asociados a clientes.
Gestión de ejecuciones de proceso.
Carga y almacenamiento local de archivos.
Previsualización de archivos CSV, XLS y XLSX.
Conciliación configurable entre archivos.
Revisión manual de resultados de conciliación.
Aprobación o rechazo administrativo de ejecuciones de conciliación.
Exportación de resultados de conciliación a Excel.
Transformación Excel/CSV mediante un ETL liviano y controlado.
Persistencia de configuración de transformación por ejecución.
3.2 Tipos de proceso actualmente autorizados
Tipo de proceso	Propósito funcional
CONCILIACION_EXCEL	Comparar dos archivos mediante columnas de referencia e importe, generar resultados, permitir revisión manual y exportar el resultado
TRANSFORMACION_EXCEL	Transformar un archivo CSV/XLS/XLSX según una configuración limitada, validada y persistida por ejecución

No se autoriza crear nuevos tipos de proceso sin una tarea externa explícita de planificación.

4. Alcance específico de Transformación Excel

Transformación Excel no debe ser una herramienta genérica de automatización de planillas ni un editor libre de fórmulas.

El módulo se define como un ETL liviano, controlado y auditable, con reglas limitadas y previsibles.

4.1 Operaciones de columnas permitidas

Solo se autorizan estas cinco operaciones:

Operación	Propósito
SOURCE	Copiar el valor de una columna de origen
CONSTANT	Asignar un valor fijo a una columna de salida
CONCAT	Concatenar valores o textos definidos por la configuración
ARITHMETIC	Ejecutar una operación aritmética controlada sobre valores configurados
VALUE_MAP	Reemplazar valores según un mapa explícito de equivalencias

No se autoriza agregar operaciones nuevas sin una decisión de planificación explícita.

4.2 Operaciones sobre filas permitidas

La configuración de transformación podrá incluir:

filtros de filas;
deduplicación;
ordenamiento.

Límites del MVP:

Elemento	Límite
Filtros	Máximo 5
Criterios de ordenamiento	Máximo 3
Deduplicación	Permitida según la configuración validada
4.3 Entradas admitidas

El módulo de Transformación Excel debe trabajar únicamente con:

.csv
.xls
.xlsx

Cada ejecución de transformación corresponde a un único archivo fuente.

La implementación debe verificar cómo identifica el repositorio actual ese archivo fuente dentro de la ejecución y de la configuración ya persistida. Si la estructura actual no permite identificarlo de manera inequívoca, Codex debe informar el bloqueo antes de crear campos, tablas, rutas o contratos nuevos.

4.4 Salida estándar del MVP

La salida de una transformación exitosa se estandariza en un archivo .xlsx.

No forma parte del MVP preservar el formato de entrada como formato de salida. Por ejemplo:

una entrada CSV puede producir una salida XLSX;
una entrada XLS puede producir una salida XLSX;
una entrada XLSX puede producir una salida XLSX.

Esta decisión reduce complejidad de exportación, evita múltiples caminos de salida y unifica el resultado para el usuario.

4.5 Exclusiones explícitas

No forman parte del MVP de Transformación Excel:

fórmulas libres ingresadas por usuarios;
macros VBA;
ejecución de código arbitrario;
joins entre múltiples archivos;
OCR;
extracción desde PDF;
transformaciones sobre imágenes;
consultas a APIs externas;
scripts Python personalizados por cliente;
plantillas reutilizables globales entre clientes;
diseñador visual de flujos;
automatizaciones programadas;
procesamiento masivo de múltiples archivos en una sola ejecución.
5. Principios funcionales obligatorios
Configuración antes de ejecución
Una transformación debe tener una configuración válida y persistida antes de ejecutarse.
Procesamiento determinista
La misma entrada y la misma configuración deben producir el mismo resultado, salvo diferencias inherentes a valores de origen.
Archivo fuente inmutable
El archivo cargado originalmente no debe ser modificado por la transformación.
Salida trazable
El archivo resultante debe estar vinculado a la misma ejecución que originó el procesamiento.
Errores explícitos
Una ejecución inválida debe devolver un error comprensible y no dejar registros o archivos parcialmente generados.
Reglas limitadas
La configuración no debe convertirse en un lenguaje de programación libre.
Sin expansión de esquema por defecto
La funcionalidad debe utilizar las estructuras existentes siempre que sea viable. Si fuera necesario modificar modelos, tablas o relaciones, Codex debe detenerse y solicitar una decisión explícita sobre la estrategia de esquema y migraciones.
Sin regresiones en conciliación
El desarrollo de Transformación Excel no debe modificar el flujo existente de conciliación, revisión, aprobación, rechazo ni exportación.
6. Hitos funcionales completados

Los hitos anteriores se agrupan por capacidad funcional. No se retroasignan números de tarea que no estén documentados de forma completa.

Hito	Estado	Resultado funcional
Base del backend	Completado	Backend FastAPI, PostgreSQL, modelos principales, configuración y persistencia inicial
Gestión administrativa	Completado	Clientes, usuarios, procesos, configuraciones y ejecuciones
Autenticación y autorización	Completado	JWT, login, autenticación en Swagger y control de rol ADMIN
Gestión de archivos	Completado	Carga de archivos, almacenamiento local y preview CSV/XLS/XLSX
Conciliación Excel	Completado	Mapping, ejecución, resultados, revisión manual, aprobación/rechazo y exportación XLSX
Tarea 14 — Base de Transformación Excel	Completado	Proceso TRANSFORMACION_EXCEL, contrato de configuración y seed del proceso
Tarea 15 — Inspección de estructura	Completado	Inspección de CSV/XLS/XLSX: hojas, columnas, preview, tipos sugeridos, nulos, filas y warnings
Tarea 16 — Configuración persistida	Completado	Guardado y consulta de la configuración de transformación por ejecución
7. Tarea actual autorizada
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

9. Trabajo posterior a Tarea 17

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

10. Reglas de ejecución para Codex

Antes de cada tarea, Codex debe:

leer docs/PROJECT_ROADMAP.md;
leer docs/PROJECT_HANDOFF.md;
ejecutar inspecciones no destructivas sobre Git;
identificar los archivos concretos afectados;
verificar si la tarea requiere cambios de esquema;
explicar el impacto antes de implementar;
limitar el cambio al alcance del prompt;
no completar requisitos faltantes con supuestos;
no crear deuda técnica innecesaria;
actualizar documentación solo cuando el cambio técnico haya sido realmente implementado y verificado.
11. Definición de “tarea terminada”

Una tarea no se considera terminada cuando:

se escribieron archivos;
se creó un endpoint;
Swagger muestra la ruta;
no aparecen errores de importación;
el código parece coherente por inspección visual.

Una tarea se considera terminada cuando:

el comportamiento solicitado funciona;
los casos de error relevantes están controlados;
no existen regresiones conocidas en dominios no relacionados;
se realizó validación concreta;
el estado técnico fue documentado en PROJECT_HANDOFF.md;
el estado funcional fue actualizado en este roadmap, cuando el prompt lo autorice;
los cambios quedaron versionados en Git.
12. Regla final de control de alcance

Todo requerimiento que no esté expresamente incluido en este roadmap o en el prompt vigente debe considerarse fuera de alcance.

La respuesta correcta ante una ambigüedad no es inventar una solución: es identificar la ambigüedad, describir sus consecuencias y solicitar una decisión de planificación externa.