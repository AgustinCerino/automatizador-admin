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
* Pytest

### Frontend

* Next.js
* React
* TypeScript

### Environment

* Desarrollo local en Windows 11.
* Shell habitual: PowerShell.
* No usar Docker salvo que una tarea futura lo solicite explícitamente.

## Source of truth

Antes de realizar cambios estructurales importantes consultar, cuando sea necesario:

* `docs/PROJECT_HANDOFF.md`
* `docs/PROJECT_ROADMAP.md`

No leer estos documentos completos automáticamente para tareas pequeñas o localizadas.

Consultar únicamente las secciones necesarias para resolver la tarea actual.

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

Para cada tarea:

1. Entender el objetivo y los criterios de aceptación.
2. Identificar el mínimo conjunto de archivos necesarios.
3. Revisar implementaciones equivalentes existentes.
4. Implementar el cambio.
5. Agregar o actualizar tests cuando cambie comportamiento.
6. Ejecutar validaciones relevantes.
7. Revisar el diff final.
8. Corregir errores introducidos por el cambio.

## Validation

Antes de considerar una tarea terminada ejecutar, según corresponda:

* tests directamente relacionados;
* suite de tests razonablemente afectada;
* lint;
* type checking;
* build;
* validaciones específicas del módulo.

No ejecutar suites costosas o irrelevantes si una validación más localizada es suficiente.

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

No borrar datos existentes salvo indicación explícita de la tarea.

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

## Error handling

Mantener el esquema de manejo de errores existente.

No exponer:

* stack traces;
* información sensible;
* detalles internos innecesarios;

a clientes de la API.

## Documentation

Actualizar documentación únicamente cuando el cambio modifique:

* arquitectura;
* configuración;
* contratos públicos;
* procedimientos de ejecución;
* decisiones técnicas relevantes.

No actualizar documentación por cambios internos menores.

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
