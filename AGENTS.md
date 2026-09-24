# Automatizador Admin — Agent Instructions

## Project purpose

`automatizador-admin` es una aplicación web para automatizar procesos administrativos que requieren carga de archivos, validaciones, transformación de datos, intervención del usuario y generación de resultados.

El proyecto se desarrolla de forma incremental siguiendo un roadmap de tareas numeradas.

## Architecture

### Backend

* Python 3.12
* FastAPI
* SQLAlchemy
* PostgreSQL
* Alembic
* `unittest` (biblioteca estándar; suite en `backend/tests`)

### Frontend

* Next.js
* React
* TypeScript
* App Router y Route Handlers
* Vitest, ESLint y `tsc`

### Environment

* Desarrollo local en Windows 11.
* Shell habitual: PowerShell.
* No usar Docker salvo que una tarea futura lo solicite explícitamente.

## Sources of truth

Antes de tareas relevantes, consultar las secciones necesarias de:

* `docs/PROJECT_HANDOFF.md`
* `docs/PROJECT_ROADMAP.md`
* el código real involucrado.

No leer estos documentos completos automáticamente para tareas pequeñas o localizadas.

El código real prevalece para describir el comportamiento implementado. Si contradice la documentación, señalar la discrepancia. El roadmap define planificación y el pedido vigente delimita la tarea.

## General development principles

1. Respetar la arquitectura existente.
2. Mantener los cambios limitados al alcance explícito de la tarea.
3. No realizar refactors generales o mejoras no solicitadas.
4. No agregar dependencias salvo que sean realmente necesarias.
5. Mantener compatibilidad con funcionalidades existentes.
6. Reutilizar patrones, servicios, componentes y convenciones ya presentes en el repositorio.
7. Evitar duplicación innecesaria.
8. Mantener separación clara de responsabilidades.
9. Preferir soluciones simples y mantenibles antes que abstracciones prematuras.
10. No cambiar contratos públicos, endpoints, modelos de datos o estructuras persistentes sin una razón asociada directamente a la tarea.
11. Evitar cambios cosméticos fuera de alcance; reportar la deuda técnica por separado.

## Repository exploration

No realizar una auditoría completa del repositorio para cada tarea.

Antes de modificar código:

1. Identificar los archivos directamente relacionados.
2. Inspeccionar implementaciones similares existentes.
3. Ampliar la exploración únicamente cuando una dependencia real lo requiera.

Evitar leer carpetas o módulos completos sin necesidad.

## Scope control

Si durante una tarea se detectan problemas no relacionados:

* no corregirlos automáticamente;
* mencionarlos al finalizar como observaciones o pendientes;
* corregirlos sólo si bloquean directamente la tarea actual.

No ampliar silenciosamente el alcance.

## Implementation workflow

Para tareas no triviales, presentar un plan breve y seguir este orden:

1. Inspeccionar el objetivo, los archivos involucrados y los patrones existentes.
2. Planificar una solución simple, explícita y mantenible.
3. Implementar el mínimo cambio; agregar o actualizar tests si cambia el comportamiento.
4. Ejecutar las validaciones relevantes.
5. Revisar el diff, corregir errores introducidos y entregar un resumen verificable.

## Backend

* Mantener separadas rutas FastAPI, schemas Pydantic, servicios y persistencia SQLAlchemy; usar los patrones existentes de PostgreSQL.
* Validar entradas y responder con errores controlados sin exponer detalles internos.
* Preservar contratos HTTP existentes y la autorización del usuario, su rol y `cliente_id` cuando corresponda.
* Revisar transacciones, integridad referencial e impacto sobre datos existentes al modificar persistencia.
* Todo cambio de esquema requiere modelos SQLAlchemy y una migración Alembic nueva. No editar migraciones históricas para representar cambios posteriores.

## Frontend

* Respetar Next.js App Router, React, TypeScript, Route Handlers y la estructura existente de `src/app`, `src/features`, `src/components` y `src/lib`.
* Mantener la separación entre Server y Client Components; no trasladar secretos ni llamadas server-side al navegador.
* Reducir el uso de `any` y derivar tipos de los contratos reales. Conservar el diseño y la interacción existentes.
* Las restricciones del frontend mejoran la experiencia, pero la validación y autorización deben hacerse en el backend.

## Validation

Antes de considerar una tarea terminada ejecutar, según corresponda:

* tests directamente relacionados;
* suite de tests razonablemente afectada;
* lint;
* type checking;
* build;
* validaciones específicas del módulo.

Durante el desarrollo, usar validaciones localizadas o `.\scripts\validate.ps1 -Quick` para obtener feedback. Antes de cerrar una tarea, ejecutar `.\scripts\validate.ps1` (FULL, incluido el build); si el entorno lo impide, informar exactamente qué quedó sin ejecutar y por qué.

No declarar una tarea completa sólo porque el código parezca compilar. Ejecutar los checks existentes pertinentes y distinguir lo ejecutado de lo no ejecutado. Nunca afirmar que algo fue probado si no se ejecutó.

Para cambios visibles, levantar la aplicación local cuando corresponda y probar en navegador el flujo afectado, sus estados normales y errores relevantes. La inspección estática no sustituye esta validación funcional.

Si una validación no puede ejecutarse, indicar claramente:

* cuál;
* por qué;
* qué riesgo queda pendiente.

## Database changes

Cualquier modificación persistente del esquema debe realizarse utilizando SQLAlchemy y Alembic.

No modificar manualmente la estructura de PostgreSQL como sustituto de una migración.

Las migraciones deben:

* representar únicamente el cambio necesario;
* tener upgrade y downgrade coherentes cuando corresponda;
* ser revisadas antes de ejecutarse.
* crearse como revisiones nuevas; no editar revisiones históricas para cambios posteriores.

No borrar datos existentes salvo indicación explícita de la tarea.
Antes de alterar persistencia, revisar integridad referencial, límites de transacción e impacto en los datos actuales. Alembic está configurado, pero hoy no hay revisiones versionadas; definir la estrategia antes de cambiar el esquema.

## Security

No introducir:

* credenciales;
* tokens;
* secretos;
* claves privadas;
* contraseñas;
* datos sensibles;

dentro del código fuente.

Usar variables de entorno y las convenciones existentes del proyecto.

No debilitar autenticación, autorización o validaciones para hacer pasar tests.
No registrar tokens, contraseñas, cookies ni datos sensibles en logs. Verificar autorización en el backend; las restricciones de UI no son una barrera de seguridad. En operaciones sobre archivos, comprobar formato y ruta segura, y revisar pertenencia, rol, estado y permisos según corresponda.

## Error handling

Mantener el esquema de manejo de errores existente.

No exponer:

* stack traces;
* información sensible;
* detalles internos innecesarios;

a clientes de la API.

## Documentation

Actualizar `docs/PROJECT_HANDOFF.md` sólo cuando el cambio modifique:

* arquitectura;
* configuración;
* contratos públicos;
* procedimientos de ejecución;
* decisiones técnicas relevantes.

Actualizar `docs/PROJECT_ROADMAP.md` sólo cuando cambien estado, alcance, prioridad u orden de una tarea, o se autorice una nueva. No actualizar estos documentos por cambios internos menores o triviales.

## Completion report

Al terminar una tarea informar de forma breve:

1. archivos creados o modificados;
2. comportamiento implementado;
3. validaciones ejecutadas;
4. resultado de esas validaciones;
5. riesgos, supuestos o pendientes reales.

No generar un resumen extenso si la tarea fue pequeña.

## Git

No realizar commits ni push automáticamente salvo solicitud explícita.

Antes de finalizar revisar el diff para detectar:

* cambios accidentales;
* archivos no relacionados;
* código temporal;
* logs;
* debugging residual;
* secretos;
* archivos generados innecesarios.

Revisar también regresiones, seguridad, casos límite y tests faltantes. Mostrar los archivos modificados y las validaciones en el informe final.
