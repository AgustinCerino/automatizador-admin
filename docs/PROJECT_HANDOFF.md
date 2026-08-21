# Project Handoff — Automatizador Admin

## Propósito del snapshot

Actualizado el **2026-08-21**. Este documento es un snapshot técnico compacto y operativo del estado verificable del repositorio. Ante una contradicción, el código actual prevalece para describir el comportamiento implementado.

El detalle histórico previo se conserva en [`docs/archive/PROJECT_HANDOFF_2026-07-02.md`](archive/PROJECT_HANDOFF_2026-07-02.md).

## Arquitectura actual

| Componente | Estado verificable |
| --- | --- |
| Backend | Aplicación monolítica FastAPI en `backend/app`, organizada en rutas, schemas Pydantic, servicios y modelos SQLAlchemy. |
| Persistencia | PostgreSQL mediante SQLAlchemy; Alembic está configurado. |
| Frontend | Next.js App Router en `frontend/src`, con React y TypeScript. |
| Integración | El navegador consume Route Handlers de Next.js; estos se comunican server-side con FastAPI. |
| Archivos | Storage local bajo `backend/storage` (ignorado por Git). |
| Autenticación | JWT emitido por FastAPI; Next.js mantiene el token en una cookie `HttpOnly` y lo reenvía server-side. |

## Backend

El backend usa Python 3.12, FastAPI, SQLAlchemy 2, PostgreSQL, Alembic, Pydantic, JWT (`python-jose`), `passlib`/bcrypt, pandas y openpyxl.

Sus módulos principales son clientes, autenticación, procesos, ejecuciones, archivos, conciliaciones y Transformación Excel. Los routers están en `backend/app/api/routes/`; la lógica de dominio, en `backend/app/services/`.

Capacidades verificables:

- autenticación JWT (`POST /auth/login`, `GET /auth/me`) y aislamiento por `cliente_id`;
- carga y preview de CSV/XLS/XLSX;
- conciliación Excel, selección persistente de Archivo A/B en `resumen_json` mediante `GET/PUT /conciliaciones/{ejecucion_id}/archivos`, mapping compatible, revisión manual, aprobación/rechazo y exportación XLSX;
- Transformación Excel: inspección, configuración persistida, dry-run, pipeline de transformación, generación/descarga de XLSX, plantillas, resumen operativo, trazabilidad y controles de seguridad.

Para el detalle especializado de Transformación Excel, consultar [`backend/docs/TRANSFORMACION_EXCEL.md`](../backend/docs/TRANSFORMACION_EXCEL.md) sólo cuando la tarea afecte ese módulo.

### Pruebas backend

Hay pruebas unitarias de Conciliación y Transformación Excel en `backend/tests/`, además de pruebas de integración en `backend/tests/integration/`. Las integrales requieren `TEST_DATABASE_URL` con una base PostgreSQL exclusiva, rechazan que coincida con `DATABASE_URL`, y se omiten si esa variable no está configurada.

## Frontend

El frontend verificado está en `frontend/` y usa:

- Next.js **16.3.0**, React **19.2.8** y TypeScript;
- App Router en `frontend/src/app`;
- Tailwind CSS 4, componentes Radix/shadcn, React Hook Form, Zod y TanStack React Query;
- Vitest y Testing Library para pruebas.

La estructura principal separa rutas (`src/app`), funcionalidades por dominio (`src/features`), componentes reutilizables (`src/components`) y acceso server-side a API/autenticación (`src/lib/api`, `src/lib/auth`). El layout protegido provee navegación lateral, cabecera y componentes de estado; el sistema visual está orientado a herramientas administrativas.

Rutas de interfaz implementadas: login, inicio protegido, procesos, ejecuciones, ejecuciones por proceso, plantillas, espacio operativo de transformaciones y workspace de Conciliación Excel en `/conciliaciones/[ejecucionId]`. Se encuentran implementadas Route Handlers para login, logout y sesión; health; procesos; ejecuciones; operaciones de archivos, estructura y resumen de transformaciones; y listado, carga, selección persistente y preview de archivos de conciliación. Las rutas dinámicas de backend delegan en manejadores compartidos de `src/lib/api`.

El navegador no accede a FastAPI directamente en estos flujos. El login llama `POST /api/auth/login`; el Route Handler solicita `/auth/login` y `/auth/me` a FastAPI, valida la respuesta y guarda el JWT en una cookie `HttpOnly`. Los Route Handlers autenticados leen esa cookie y agregan el Bearer token al request server-side. La sesión puede consultarse en `GET /api/auth/session` y cerrarse en `POST /api/auth/logout`.

`BACKEND_URL` es una variable exclusiva del servidor, usada por Route Handlers y por la exportación local de OpenAPI. El ejemplo vigente es `frontend/.env.local.example`:

```env
BACKEND_URL=http://127.0.0.1:8000
```

No debe exponerse como `NEXT_PUBLIC_BACKEND_URL` sin una decisión arquitectónica explícita. Los scripts disponibles son `npm run dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:run`, `api:schema`, `api:generate` y `api:types`.

Limitación verificable: el frontend actual cubre el shell, autenticación, consulta/creación de procesos y ejecuciones, el flujo operativo principal de Transformación Excel y la preparación de archivos de Conciliación Excel hasta la selección persistente de Archivo A/B. El mapping, la ejecución y los resultados de conciliación no forman parte del workspace implementado en la Tarea 35. No se infieren de este snapshot funcionalidades frontend adicionales ni tareas futuras autorizadas.

## Configuración local

Backend:

- `DATABASE_URL` configura la conexión PostgreSQL; ver `backend/.env.example`.
- `SECRET_KEY` tiene un valor por defecto de desarrollo (`change-me-in-env`) y debe configurarse de forma segura fuera del código para cualquier entorno no local.
- Los límites de seguridad de Transformación Excel se configuran desde `backend/app/core/config.py`.
- El backend se ejecuta localmente en `http://127.0.0.1:8000`; health check: `GET /health`.

Frontend:

- `BACKEND_URL` debe apuntar al backend y permanecer sólo en el servidor Next.js.
- El frontend se ejecuta normalmente en `http://localhost:3000`.

## Base de datos y migraciones

Alembic está configurado para usar la metadata SQLAlchemy y `DATABASE_URL`, pero `backend/alembic/versions/` sólo contiene `.gitkeep`: no hay revisiones versionadas verificables en el repositorio.

También existe `backend/scripts/create_tables.py`, que usa `Base.metadata.create_all`. Antes de cambiar el esquema se debe definir y seguir una estrategia coherente entre `create_all` y Alembic; no modificar la base manualmente como sustituto de una migración.

## Riesgos técnicos vigentes

- La coexistencia de `create_all` y Alembic sin revisiones versionadas hace riesgoso cambiar el esquema.
- El `SECRET_KEY` por defecto sólo es apto para desarrollo local.
- El storage es local y requiere una estrategia adicional para entornos compartidos o desplegados.
- El aislamiento multi-tenant por `cliente_id` debe preservarse en nuevas consultas y endpoints.
- Las pruebas de integración dependen de una PostgreSQL exclusiva mediante `TEST_DATABASE_URL`.
- La integración frontend/backend depende de que `BACKEND_URL`, la cookie de sesión y los Route Handlers mantengan el flujo server-side.

## Jerarquía documental y protocolo de lectura

1. `AGENTS.md`: reglas permanentes y globales para agentes.
2. `backend/AGENTS.md`: reglas específicas para modificaciones backend.
3. `frontend/AGENTS.md`: reglas específicas de frontend y bloque administrado por Next.js.
4. `docs/PROJECT_ROADMAP.md`: planificación funcional, orden y estado de tareas.
5. `docs/PROJECT_HANDOFF.md`: snapshot técnico actual para contexto adicional.
6. Código actual: fuente de verdad del comportamiento implementado.
7. Prompt vigente: alcance exacto de la intervención actual.

Siempre se deben respetar los `AGENTS.md` aplicables al archivo modificado. Se comienza por esos archivos y por los archivos directamente relacionados con la tarea. Consultar el roadmap sólo para verificar objetivo, alcance, estado o secuencia; consultar este handoff sólo cuando se necesite contexto arquitectónico, integración entre módulos, configuración, base de datos, seguridad o comportamiento transversal. La documentación especializada se lee sólo si la tarea afecta el módulo correspondiente.

No cargar documentos completos por defecto: leer únicamente las secciones necesarias y ampliar la inspección sólo ante una dependencia real.

## Actualización futura de esta documentación

Actualizar este handoff sólo si cambia la arquitectura, stack o dependencia relevante, configuración operativa, contrato público importante, modelo de datos, estrategia de seguridad, integración entre componentes, capacidad técnica relevante o riesgo técnico relevante.

Actualizar el roadmap sólo si cambia el estado de una tarea, se autoriza una nueva tarea, cambia el alcance funcional o se modifica explícitamente su prioridad u orden. Cambios internos pequeños, CSS, bugs localizados, tests aislados o refactors sin impacto documental no obligan a actualizar ninguno de los dos documentos.
