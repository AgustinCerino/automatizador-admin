# Automatizador Admin — Backend Agent Instructions

Estas instrucciones complementan el `/AGENTS.md` raíz.

## Backend stack

* Python 3.12
* FastAPI
* SQLAlchemy
* PostgreSQL
* Alembic
* Pydantic
* Pytest

El backend corre localmente en:

`http://127.0.0.1:8000`

Health check:

`GET /health`

## Architecture principles

Mantener separación entre:

* rutas HTTP;
* schemas de entrada/salida;
* lógica de negocio;
* persistencia;
* modelos SQLAlchemy;
* servicios auxiliares;
* generación o transformación de archivos.

Las rutas deben mantenerse delgadas.

No colocar lógica compleja de negocio directamente en endpoints si puede residir en un service.

## Existing patterns

Antes de crear una nueva estructura:

1. buscar módulos similares;
2. reutilizar patrones existentes;
3. mantener nombres y organización coherentes con el proyecto.

No introducir una arquitectura alternativa dentro de un único módulo.

## API development

Al modificar o crear endpoints:

* respetar convenciones existentes de routing;
* utilizar schemas Pydantic;
* validar correctamente entradas;
* devolver códigos HTTP apropiados;
* mantener contratos consistentes;
* utilizar el sistema existente de autenticación/autorización.

No cambiar contratos existentes salvo que la tarea lo requiera explícitamente.

## Authentication and authorization

El proyecto dispone de autenticación basada en Bearer token.

Endpoints relevantes existentes:

* `POST /auth/login`
* `GET /auth/me`

No:

* saltar autenticación para simplificar desarrollo;
* confiar en datos enviados por el cliente cuando puedan derivarse del usuario autenticado;
* exponer información perteneciente a otro cliente.

Respetar el aislamiento por `cliente_id`.

## Database

Los modelos SQLAlchemy son la representación del esquema de aplicación.

Los cambios estructurales deben acompañarse de migraciones Alembic.

Antes de crear una migración:

1. revisar modelos existentes;
2. determinar impacto sobre datos existentes;
3. evitar cambios destructivos innecesarios.

Usar:

`python -m alembic ...`

en lugar de asumir que el ejecutable global `alembic` está disponible.

## Queries

Evitar:

* consultas N+1;
* cargas completas innecesarias;
* queries duplicadas;
* consultas sin filtro cuando existe un alcance por cliente.

Priorizar claridad y corrección antes que microoptimizaciones.

## Multi-tenant considerations

Las entidades pertenecientes a clientes deben mantenerse correctamente aisladas.

Cuando corresponda, cualquier consulta debe considerar:

`cliente_id`

No permitir acceso cruzado entre clientes como efecto secundario de una nueva funcionalidad.

## Services

La lógica reutilizable o compleja debe residir en servicios.

Los servicios deben:

* tener responsabilidades concretas;
* recibir dependencias explícitas;
* evitar efectos secundarios ocultos;
* producir errores controlables por la capa API.

No crear clases o capas nuevas si una función clara dentro del patrón existente es suficiente.

## Excel transformation module

Existe un módulo de Transformación Excel.

Antes de modificarlo revisar las implementaciones existentes relacionadas con:

* pipeline;
* validation service;
* generation service;
* XLSX writer;
* schemas;
* routes;
* tests.

No duplicar lógica existente entre validación, transformación y generación.

Mantener separadas:

1. lectura/parsing;
2. validación;
3. transformación;
4. generación del archivo final.

## File handling

Al procesar archivos:

* validar formato;
* manejar entradas inválidas;
* evitar confiar únicamente en extensión;
* evitar archivos temporales persistentes innecesarios;
* cerrar correctamente recursos;
* no asumir que una carga siempre contiene datos válidos.

## Exceptions

Usar la estrategia de excepciones existente.

No devolver directamente excepciones internas al cliente.

Convertir fallos de dominio o validación a respuestas API coherentes.

## Tests

Agregar o modificar tests cuando cambie comportamiento.

Priorizar:

* comportamiento observable;
* casos límite;
* validaciones;
* errores esperados;
* permisos cuando corresponda.

Para bugs:

1. reproducir el fallo mediante un test cuando sea razonable;
2. implementar la corrección;
3. verificar que el test pase.

No modificar tests simplemente para aceptar una implementación incorrecta.

## Validation before completion

Según el alcance ejecutar:

* tests del archivo o módulo modificado;
* tests del endpoint afectado;
* tests de integración relevantes;
* suite backend completa cuando el cambio sea transversal.

Revisar también:

* imports;
* errores de tipado evidentes;
* migraciones;
* cambios accidentales de esquema.

## Dependencies

No agregar paquetes Python salvo necesidad concreta.

Antes de agregar una dependencia comprobar si:

* Python estándar;
* FastAPI;
* SQLAlchemy;
* Pydantic;
* paquetes ya instalados;

pueden resolver el problema.

## Backward compatibility

Mantener compatibilidad con:

* clientes API existentes;
* frontend existente;
* datos persistidos;
* scripts actuales;

salvo cambio explícitamente solicitado.

## Completion report

Al terminar indicar:

* archivos backend afectados;
* endpoints o servicios modificados;
* cambios de base de datos, si existen;
* tests ejecutados;
* resultado;
* posibles impactos sobre frontend o migraciones.
