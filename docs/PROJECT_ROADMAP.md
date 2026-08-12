# Project Roadmap — Automatizador Admin

Estado: planificación funcional autorizada
Actualizado: **2026-08-10**
Documento técnico asociado: [`PROJECT_HANDOFF.md`](PROJECT_HANDOFF.md)

## Propósito y uso

Este documento es la fuente autorizada de planificación funcional: alcance, prioridades, tareas y exclusiones. El código actual prevalece para determinar si un comportamiento está implementado; el handoff es el snapshot técnico; el prompt vigente define el alcance puntual.

Respetar siempre los `AGENTS.md` aplicables. Consultar este roadmap sólo cuando sea necesario verificar el objetivo, alcance, estado o secuencia de una tarea. Consultar el handoff sólo cuando haga falta contexto técnico adicional. No leer documentos completos por defecto si una sección específica es suficiente.

Las reglas permanentes están en `AGENTS.md`, `backend/AGENTS.md` y `frontend/AGENTS.md`; el código actual describe la implementación real y el prompt vigente delimita cada intervención. No se deben inferir prioridades, crear tareas ni ampliar el MVP a partir del código.

## Visión y alcance MVP

`automatizador-admin` es una plataforma web para administrar automatizaciones administrativas configurables por cliente. El MVP cubre procesos basados principalmente en Excel y CSV: cliente → proceso configurado → ejecución → carga de archivos → validación/procesamiento → revisión humana cuando corresponda → resultado de salida.

Capacidades incluidas: gestión de clientes, usuarios administrativos, procesos y ejecuciones; carga y almacenamiento local; preview CSV/XLS/XLSX; conciliación configurable, revisión, aprobación/rechazo y exportación; Transformación Excel/CSV con configuración persistida por ejecución.

### Tipos de proceso autorizados

| Tipo | Propósito |
| --- | --- |
| `CONCILIACION_EXCEL` | Comparar archivos por referencia e importe, revisar resultados y exportarlos. |
| `TRANSFORMACION_EXCEL` | Transformar un CSV/XLS/XLSX mediante configuración limitada, validada y persistida. |

No se autorizan nuevos tipos de proceso sin una tarea explícita de planificación.

## Restricciones de Transformación Excel

Es un ETL liviano, controlado y auditable; no un editor libre de planillas. Operaciones de columnas permitidas: `SOURCE`, `CONSTANT`, `CONCAT`, `ARITHMETIC` y `VALUE_MAP`. Se admiten filtros (máximo 5), deduplicación y hasta 3 criterios de ordenamiento.

Cada ejecución trabaja con un único archivo fuente `.csv`, `.xls` o `.xlsx` y produce un `.xlsx`. El archivo fuente es inmutable; la salida debe ser trazable a la ejecución. La configuración debe estar validada y persistida antes de ejecutar.

Quedan excluidos fórmulas libres, macros, código arbitrario, joins entre archivos, OCR/PDF/imágenes, APIs externas, scripts Python por cliente, plantillas globales, diseñador de flujos, programación de ejecuciones y procesamiento masivo.

No expandir el esquema por defecto. Si una tarea requiere modelos, tablas o relaciones nuevas, se debe solicitar una decisión explícita sobre esquema y migraciones. No deben producirse regresiones en conciliación.

## Estado de hitos y tareas

| Hito o tarea | Estado | Resultado funcional resumido |
| --- | --- | --- |
| Base del backend | Completado | FastAPI, PostgreSQL, modelos principales, configuración y persistencia inicial. |
| Gestión administrativa | Completado | Clientes, usuarios, procesos, configuraciones y ejecuciones. |
| Autenticación y autorización | Completado | JWT, login y control de rol ADMIN. |
| Gestión de archivos | Completado | Carga, storage local y preview CSV/XLS/XLSX. |
| Conciliación Excel | Completado | Mapping, ejecución, revisión manual, aprobación/rechazo y exportación XLSX. |
| Tarea 14 — Base de Transformación Excel | Completado | Proceso, contrato de configuración y seed. |
| Tarea 15 — Inspección de estructura | Completado | Inspección de CSV/XLS/XLSX, preview y warnings. |
| Tarea 16 — Configuración persistida | Completado | Guardado y consulta de configuración por ejecución. |
| Tarea 17 — Dry-run y validación | Completado | Validación, métricas, preview y estados. |
| Tarea 18 — Motor de transformación | Completado | Pipeline, operaciones permitidas, filtros, deduplicación y ordenamiento. |
| Tarea 19 — Generación y descarga | Completado | Writer XLSX, salida, idempotencia y descarga. |
| Tarea 20 — Plantillas | Completado | Gestión y aplicación de plantillas con permisos existentes. |
| Tarea 21 — Operación y trazabilidad | Completado | Resumen, issues, capacidades, acciones y eventos sanitizados. |
| Tarea 22 — Hardening y cierre técnico | Completado | Límites, rutas seguras, integridad, concurrencia y pruebas. |
| Tarea 29 — Constructor básico de Transformación Excel | Completado | Constructor integrado para columnas `SOURCE` y `CONSTANT`, con inspección real, persistencia segura y resguardo de configuraciones avanzadas. |
| Tarea 30 — Operaciones avanzadas del constructor de Transformación Excel | Completado | Constructor integrado para `CONCAT`, `ARITHMETIC` y `VALUE_MAP`, con persistencia y recuperación de las cinco operaciones autorizadas. |
| Tarea 31 — Reglas de filas de Transformación Excel | Completado | Constructor integrado para filtros, deduplicación y ordenamiento con persistencia en la configuración de transformación. |

### Frontend posterior a Tarea 22

El repositorio y el historial Git verifican implementación frontend: shell y sistema visual, base API tipada, autenticación segura, procesos y ejecuciones, workspace operativo de Transformación Excel, y carga/inspección de archivo fuente. Los commits relevantes no asignan números de tarea ni existe documentación que los vincule de forma verificable a Tareas 23–28 u otras.

Por ello, fuera de la Tarea 29 autorizada explícitamente, **no hay tareas frontend numeradas posteriores a la Tarea 22 con estado verificable**. No se asignan retrospectivamente números ni se declara el próximo bloque funcional: su estado es **ESTADO NO VERIFICADO** hasta recibir planificación explícita.

El detalle histórico de la antigua Tarea 17, su validación manual y el registro histórico posterior se conserva en [`docs/archive/PROJECT_ROADMAP_HISTORY.md`](archive/PROJECT_ROADMAP_HISTORY.md).

## Control de alcance y actualización

Todo requisito fuera de este roadmap o del prompt vigente está fuera de alcance. Ante ambigüedad, se debe describir el impacto y solicitar decisión de planificación; no inventar una solución.

Actualizar este roadmap sólo cuando cambie el estado de una tarea, se autorice una nueva, cambie el alcance funcional, o se modifique explícitamente prioridad u orden. Los cambios internos menores, CSS, bugs localizados, tests aislados y refactors sin impacto funcional no requieren actualizarlo.
