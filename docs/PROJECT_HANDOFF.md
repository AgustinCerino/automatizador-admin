# Project Handoff — Automatizador Admin

## 1. Propósito del documento

Este documento registra el estado técnico verificable del repositorio `automatizador-admin` al `2026-07-02`, a partir de inspección directa de archivos, configuración, rutas FastAPI, modelos SQLAlchemy, scripts y comandos ejecutados sin modificar código fuente.

La planificación funcional, el orden de futuras tareas y los criterios de alcance se definen fuera del repositorio. Una conversación nueva de Codex no debe elegir ni alterar por iniciativa propia la siguiente tarea. Antes de implementar una nueva tarea, Codex debe recibir el requerimiento o prompt correspondiente.

Este documento describe el estado técnico verificable, no define la hoja de ruta funcional. La planificación del proyecto se mantiene fuera de este documento y debe ser provista explícitamente en el prompt de trabajo o en un documento de planificación externo validado. Codex no debe inferir prioridades, crear fases, reordenar tareas ni convertir limitaciones técnicas en decisiones de producto.

Si existiera un archivo futuro como `docs/PROJECT_ROADMAP.md`, solo deberá usarse como fuente de planificación cuando haya sido creado o validado explícitamente por la planificación externa. Codex no debe crearlo, completarlo ni modificarlo basándose únicamente en inferencias del código.

Si existe conflicto entre este documento y el código actual, el código actual prevalece para describir el estado técnico. Este documento no reemplaza la inspección previa a cada cambio.

## 2. Alcance y objetivo funcional actual

**Objetivo confirmado por el código**

El backend expone una API FastAPI titulada `Automatizador Administrativo Web`, confirmada en `backend/app/core/config.py` mediante `Settings.project_name` y usada en `backend/app/main.py` al crear `FastAPI(title=settings.project_name)`.

El código implementa módulos backend para clientes, procesos, ejecuciones, archivos, conciliaciones y transformación Excel. Evidencia: routers incluidos en `backend/app/main.py`, modelos en `backend/app/models/`, esquemas en `backend/app/schemas/` y servicios en `backend/app/services/`.

La persistencia usa PostgreSQL vía SQLAlchemy. Evidencia: `backend/app/core/config.py` define `database_url` con ejemplo `postgresql+psycopg2://...`, `backend/app/database/session.py` crea `engine` con `create_engine(settings.database_url, pool_pre_ping=True)`, y `backend/requirements.txt` declara `SQLAlchemy>=2.0` y `psycopg2-binary`.

**Objetivo aparente o parcial**

El código sugiere una aplicación para automatización administrativa basada en procesos configurables. El alcance funcional verificable incluye conciliación de archivos Excel/CSV, carga y preview de archivos, revisión manual, exportación Excel de resultados e inspección/configuración de transformación Excel. Evidencia: rutas `backend/app/api/routes/conciliaciones.py`, `backend/app/api/routes/archivos.py`, `backend/app/api/routes/transformaciones_excel.py` y servicios asociados.

La ejecución real de transformaciones Excel no fue encontrada en rutas o servicios inspeccionados. Evidencia: `backend/app/api/routes/transformaciones_excel.py` contiene endpoints de inspección y configuración, pero no endpoint de ejecución. Estado: `NO ENCONTRADO EN EL CÓDIGO INSPECCIONADO`.

**Aspectos que no se pueden confirmar**

El repositorio contiene `docs/PROJECT_ROADMAP.md`, este handoff y `backend/docs/TRANSFORMACION_EXCEL.md`. Las afirmaciones históricas de ausencia documental corresponden al momento inicial en que se creó este handoff y quedan reemplazadas por la actualización técnica de la sección 3.1.

## 3. Estado verificado del repositorio

**Git**

| Elemento | Resultado | Evidencia |
| --- | --- | --- |
| Rama actual | `main` | `git branch --show-current` |
| Estado antes de documentar | Sin archivos modificados reportados | `git status --short` sin salida antes de crear este documento |
| Estado observado durante la elaboración del handoff, antes de su commit | `?? docs/` | `git status --short` ejecutado después de crear `docs/PROJECT_HANDOFF.md` |
| Estado observado del archivo handoff antes de su commit | `?? docs/PROJECT_HANDOFF.md` | `git status --short docs\PROJECT_HANDOFF.md` |
| Tracking de `docs/PROJECT_HANDOFF.md` | Sin seguimiento en Git | `git ls-files docs\PROJECT_HANDOFF.md` sin salida |
| Últimos commits inspeccionados | `f4b01ae Add Excel transformation execution configuration endpoints`; `eff87b5 Add advanced Excel transformation file inspection`; `e0b7d32 Add Excel transformation configuration contract`; `2eb22bc Add Excel export for reconciliation results`; `55d2377 Add manual review and execution approval flow` | `git log --oneline -5` |

**Estructura general**

| Ruta | Estado | Evidencia |
| --- | --- | --- |
| `backend/` | Backend FastAPI principal | `rg --files -g '!backend/.venv/**'` |
| `backend/app/` | Código de aplicación | `backend/app/main.py`, `backend/app/api/routes/`, `backend/app/models/`, `backend/app/schemas/`, `backend/app/services/` |
| `backend/scripts/` | Scripts operativos | `backend/scripts/create_tables.py`, `backend/scripts/seed_initial_data.py` |
| `backend/alembic/` | Configuración Alembic existente | `backend/alembic/env.py`, `backend/alembic/script.py.mako`, `backend/alembic.ini` |
| `backend/storage/` | Storage local existente en entorno; ignorado por Git | `.gitignore` incluye `backend/storage/`; inspección del árbol mostró `backend/storage/` |
| Frontend | `NO ENCONTRADO EN EL CÓDIGO INSPECCIONADO` | `rg --files` no listó carpeta/frontend source; `.gitignore` solo contiene patrones Node/frontend |

**Archivos principales del backend**

| Categoría | Archivos |
| --- | --- |
| Entrada | `backend/app/main.py` |
| Configuración | `backend/app/core/config.py`, `backend/app/core/security.py`, `backend/.env.example`, `backend/requirements.txt`, `backend/alembic.ini` |
| Persistencia | `backend/app/database/base.py`, `backend/app/database/session.py` |
| Routers | `backend/app/api/routes/health.py`, `auth.py`, `clientes.py`, `procesos.py`, `ejecuciones.py`, `archivos.py`, `conciliaciones.py`, `transformaciones_excel.py` |
| Modelos | `backend/app/models/cliente.py`, `usuario.py`, `proceso.py`, `configuracion_proceso.py`, `ejecucion_proceso.py`, `archivo.py`, `resultado_conciliacion.py` |
| Schemas | `backend/app/schemas/*.py` |
| Servicios | `backend/app/services/*.py` |
| Scripts | `backend/scripts/create_tables.py`, `backend/scripts/seed_initial_data.py` |

**Documentación existente**

Antes de esta tarea no se encontraron `README*` ni `docs/**`. Evidencia: comando `rg --files -g 'README*' -g 'docs/**' -g '!backend/.venv/**'` sin salida. Este archivo `docs/PROJECT_HANDOFF.md` se crea en esta tarea.

**Dependencias declaradas**

Archivo fuente: `backend/requirements.txt`.

```txt
fastapi
uvicorn[standard]
pydantic-settings
SQLAlchemy>=2.0
psycopg2-binary
alembic
passlib[bcrypt]
bcrypt<4.1
python-jose[cryptography]
python-multipart
pandas
openpyxl
xlrd
python-dotenv
httpx
```

## 3.1 Actualización técnica: cierre de Transformación Excel

Esta actualización reemplaza las observaciones históricas posteriores que indican que no existían ejecución, generación o pruebas. El módulo `TRANSFORMACION_EXCEL` está implementado en backend con inspección, configuración, dry-run, motor compartido, writer XLSX, generación y descarga, plantillas, resumen operativo, trazabilidad y hardening. La referencia técnica detallada es `backend/docs/TRANSFORMACION_EXCEL.md`.

Estados usados por el flujo: `CARGADO`, `CONFIGURADO`, `VALIDADO`, `PROCESANDO`, `COMPLETADO` y `ERROR`, respetando además los terminales existentes `CANCELADO`, `APROBADO` y `RECHAZADO`. La información nueva de integridad se persiste en `EjecucionProceso.resumen_json`; no se modificaron modelos, tablas ni migraciones.

La seguridad del módulo está centralizada en `backend/app/services/transformacion_excel_security_service.py`: tamaño real, dimensiones, preflight ZIP para XLSX, resolución canónica dentro de storage y checksums deterministas. Los defaults configurables son 50 MB, 200000 filas, 300 columnas, 50 hojas, 250 MB descomprimidos, relación 100 y 30 minutos para detectar `PROCESANDO` abandonado. Las variables están en `backend/app/core/config.py` y `backend/.env.example`.

Las pruebas unitarias usan `unittest` en `backend/tests/`. Las integrales están en `backend/tests/integration/`, requieren una PostgreSQL exclusiva mediante `TEST_DATABASE_URL`, rechazan usar exactamente `DATABASE_URL`, trabajan con transacciones revertibles y storage temporal, y se omiten sin abrir una conexión cuando falta esa variable. La ejecución local verificada tras el hardening descubrió 127 pruebas y terminó correctamente con dos omisiones controladas: la suite integral por ausencia de `TEST_DATABASE_URL` y el caso de symlink porque el entorno Windows no permitió crearlo.

El frontend continúa pendiente y es el próximo bloque definido en `docs/PROJECT_ROADMAP.md`.

## 4. Stack tecnológico y dependencias

| Tecnología | Evidencia | Versión declarada |
| --- | --- | --- |
| Python | Archivos `.py`; scripts en `backend/scripts/`; entorno local `backend/.venv/` observado | `NO VERIFICADO EN REPOSITORIO` |
| FastAPI | `backend/requirements.txt`; imports en routers y `backend/app/main.py` | No declarada |
| Uvicorn | `backend/requirements.txt` | No declarada |
| Pydantic v2 / pydantic-settings | `backend/requirements.txt`; `BaseSettings`, `SettingsConfigDict` en `backend/app/core/config.py`; `ConfigDict`, `model_validator`, `field_validator` en schemas | No declarada |
| SQLAlchemy | `backend/requirements.txt`; `DeclarativeBase`, `Mapped`, `mapped_column`, `select` en código | `>=2.0` |
| PostgreSQL driver | `backend/requirements.txt`; `DATABASE_URL` con `postgresql+psycopg2` en `backend/.env.example` | `psycopg2-binary`, sin versión |
| Alembic | `backend/requirements.txt`; `backend/alembic.ini`; `backend/alembic/env.py` | No declarada |
| JWT | `python-jose[cryptography]` en `backend/requirements.txt`; `jose.jwt` en `backend/app/core/security.py` | No declarada |
| Hashing de contraseñas | `passlib[bcrypt]`, `bcrypt<4.1` en `backend/requirements.txt`; `CryptContext` en `backend/app/core/security.py` | `bcrypt<4.1` |
| Multipart upload/form | `python-multipart` en `backend/requirements.txt`; `UploadFile`, `Form`, `OAuth2PasswordRequestForm` en rutas | No declarada |
| Pandas | `backend/requirements.txt`; servicios `file_preview_service.py`, `conciliacion_service.py`, `transformacion_excel_inspeccion_service.py` | No declarada |
| Excel | `openpyxl`, `xlrd` en `backend/requirements.txt`; `openpyxl.Workbook` en `conciliacion_export_service.py` | No declarada |
| Dotenv | `python-dotenv` en `backend/requirements.txt` | No declarada |

Archivos no encontrados: `pyproject.toml`, `package.json`, `docker-compose.yml`, `Makefile`, `README*`. Evidencia: `rg --files -g 'README*' -g 'Makefile' -g 'pyproject.toml' -g 'package.json' -g 'docker-compose.yml' -g '!backend/.venv/**'` sin resultados.

## 5. Arquitectura actual

| Componente | Ruta | Responsabilidad | Integraciones | Estado |
| --- | --- | --- | --- | --- |
| Punto de entrada | `backend/app/main.py` | Crea la app FastAPI e incluye routers | `settings.project_name`; routers de API | Implementado |
| Configuración | `backend/app/core/config.py` | Define `Settings` con variables de entorno | `pydantic-settings`; usado por app, DB y seguridad | Implementado |
| Seguridad | `backend/app/core/security.py` | Hash bcrypt; crear/decodificar JWT | `settings`; `python-jose`; `passlib` | Implementado |
| DB base | `backend/app/database/base.py` | Define una única clase `Base(DeclarativeBase)` | Modelos SQLAlchemy | Implementado |
| DB session | `backend/app/database/session.py` | Define `engine`, `SessionLocal`, `get_db` | `settings.database_url`; routers FastAPI | Implementado |
| Routers API | `backend/app/api/routes/` | Agrupan endpoints por dominio | `get_db`, schemas, modelos, servicios, auth | Implementado |
| Modelos ORM | `backend/app/models/` | Definen tablas SQLAlchemy | `Base.metadata`; relaciones ORM | Implementado |
| Schemas | `backend/app/schemas/` | Contratos Pydantic de entrada/salida | Routers y servicios | Implementado |
| Servicios | `backend/app/services/` | Lógica de archivos, conciliación, revisión, exportación y transformación Excel | Modelos, pandas, openpyxl, filesystem | Implementado |
| Alembic | `backend/alembic/env.py`, `backend/alembic.ini` | Configura metadata y URL desde settings | `Base.metadata`, `settings.database_url`, `app.models` | Configurado; sin migraciones versionadas inspeccionadas |
| Scripts | `backend/scripts/create_tables.py`, `backend/scripts/seed_initial_data.py` | Crear tablas con `create_all`; cargar datos iniciales | `Base`, `engine`, `SessionLocal`, modelos | Implementado |
| Manejo de archivos | `backend/app/services/file_service.py`, `backend/app/services/file_preview_service.py` | Guardar uploads en storage local y previsualizar CSV/XLS/XLSX | `backend/storage/`; pandas | Implementado |
| Pruebas | N/A | Suite automatizada | N/A | `NO ENCONTRADO EN EL CÓDIGO INSPECCIONADO` |

La arquitectura es monolítica dentro de `backend/app/`, separada por capas simples: rutas HTTP, schemas Pydantic, servicios de dominio, modelos ORM, configuración y sesión de base de datos.

## 6. Base de datos y migraciones

**Configuración de conexión**

`backend/app/core/config.py` define `database_url` y lo lee desde `.env` mediante `SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")`. `backend/app/database/session.py` usa `create_engine(settings.database_url, pool_pre_ping=True)` y `sessionmaker(..., class_=Session)`.

`backend/.env.example` contiene el ejemplo `DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/automatizador_admin`. No se exponen valores de `backend/.env`.

**Metadata definida en código**

Comando ejecutado desde `backend/`: `.\.venv\Scripts\python.exe -c "import app.models; from app.database.base import Base; print(sorted(Base.metadata.tables.keys()))"`.

Resultado: `['archivos', 'clientes', 'configuraciones_proceso', 'ejecuciones_proceso', 'procesos', 'resultados_conciliacion', 'usuarios']`.

**Tablas definidas por modelos ORM**

| Tabla | Modelo | Columnas y restricciones definidas en código | Relaciones ORM |
| --- | --- | --- | --- |
| `clientes` | `backend/app/models/cliente.py::Cliente` | `id` PK autoincrement; `nombre` `String(150)` not null; `cuit` `String(20)` nullable; `estado` `String(30)` not null default/server_default `ACTIVO`; `created_at` `DateTime(timezone=True)` server_default `func.now()`; `updated_at` `DateTime(timezone=True)` nullable `onupdate=func.now()` | `usuarios`, `procesos` |
| `usuarios` | `backend/app/models/usuario.py::Usuario` | `id` PK autoincrement; `cliente_id` FK `clientes.id` not null; `nombre` `String(150)` not null; `email` `String(150)` not null `unique=True`, `index=True`; `password_hash` `String(255)` not null; `rol` `String(50)` not null; `estado` default/server_default `ACTIVO`; timestamps | `cliente`, `ejecuciones` |
| `procesos` | `backend/app/models/proceso.py::Proceso` | `id` PK autoincrement; `cliente_id` FK `clientes.id` not null; `nombre` `String(150)` not null; `tipo` `String(80)` not null; `descripcion` `Text` nullable; `estado` default/server_default `ACTIVO`; timestamps | `cliente`, `configuraciones`, `ejecuciones` |
| `configuraciones_proceso` | `backend/app/models/configuracion_proceso.py::ConfiguracionProceso` | `id` PK autoincrement; `proceso_id` FK `procesos.id` not null; `nombre` `String(150)` not null; `config_json` `JSON` not null; `activo` `Boolean` not null default/server_default true; timestamps | `proceso` |
| `ejecuciones_proceso` | `backend/app/models/ejecucion_proceso.py::EjecucionProceso` | `id` PK autoincrement; `proceso_id` FK `procesos.id` not null; `usuario_id` FK `usuarios.id` not null; `estado` `String(40)` not null default/server_default `CARGADO`; `resumen_json` `JSON` nullable; `error_message` `Text` nullable; `started_at` server_default `func.now()`; `finished_at` nullable; `created_at` server_default `func.now()` | `proceso`, `usuario`, `archivos`, `resultados_conciliacion` |
| `archivos` | `backend/app/models/archivo.py::Archivo` | `id` PK autoincrement; `ejecucion_id` FK `ejecuciones_proceso.id` not null; `tipo_archivo` `String(80)` not null; `nombre_original` `String(255)` not null; `ruta_storage` `String(500)` not null; `extension` `String(20)` nullable; `mime_type` `String(100)` nullable; `size_bytes` `Integer` nullable; `checksum` `String(255)` nullable; `uploaded_at` server_default `func.now()` | `ejecucion` |
| `resultados_conciliacion` | `backend/app/models/resultado_conciliacion.py::ResultadoConciliacion` | `id` PK autoincrement; `ejecucion_id` FK `ejecuciones_proceso.id` not null; `clave_referencia` `String(255)` nullable; `estado_resultado` `String(50)` not null; `datos_archivo_a_json` `JSON` nullable; `datos_archivo_b_json` `JSON` nullable; `diferencia_importe` `Numeric(15, 2)` nullable; `requiere_revision` `Boolean` not null default/server_default false; `observacion` `Text` nullable; timestamps | `ejecucion` |

**Aplicación real en la base local**

Comando ejecutado desde `backend/`: `.\.venv\Scripts\python.exe -c "from sqlalchemy import inspect; from app.database.session import engine; print(sorted(inspect(engine).get_table_names()))"`.

Resultado: `['alembic_version', 'archivos', 'clientes', 'configuraciones_proceso', 'ejecuciones_proceso', 'procesos', 'resultados_conciliacion', 'usuarios']`.

Nivel: `VERIFICADO PARCIALMENTE`. Se verificó la existencia de tablas por inspector SQLAlchemy en el entorno actual, pero no se compararon columna por columna contra los modelos.

**Alembic**

`backend/alembic/env.py` importa `settings`, `Base` y `app.models`, asigna `target_metadata = Base.metadata` y configura `sqlalchemy.url` con `settings.database_url`. También contiene `print("ALEMBIC TABLES:", list(target_metadata.tables.keys()))`.

`backend/alembic/versions/` contiene `.gitkeep` y `__pycache__`; no se encontraron archivos de revisión versionados. Evidencia: `Get-ChildItem -Force backend\alembic\versions`.

La tabla `alembic_version` existe en la base local, pero `select version_num from alembic_version` devolvió `[]`. Migración actual aplicada: `NO VERIFICADO EN REPOSITORIO`.

**Scripts de seed**

`backend/scripts/seed_initial_data.py` crea o reutiliza de forma idempotente:

| Entidad | Datos verificables | Evidencia |
| --- | --- | --- |
| Cliente Demo | `nombre="Cliente Demo"`, `cuit="20-00000000-0"`, `estado="ACTIVO"` | `get_or_create_cliente` |
| Usuario Admin Demo | `email="admin@demo.com"`, password inicial hasheada con `get_password_hash("admin123")`, `rol="ADMIN"`, `estado="ACTIVO"` | `get_or_create_usuario_admin` |
| Proceso Conciliación Excel | `tipo="CONCILIACION_EXCEL"`, descripción de comparación de planillas Excel | `get_or_create_proceso` |
| Configuración inicial Conciliación Excel | `config_json=DEMO_CONFIG`, `activo=True` | `get_or_create_configuracion` |
| Proceso Transformación Excel | `tipo="TRANSFORMACION_EXCEL"`, descripción de transformación de archivos Excel o CSV | `get_or_create_proceso_transformacion_excel` |

## Estado operativo del esquema de base de datos

Esta sección describe exclusivamente el estado verificable del esquema al momento de esta revisión documental. No define estrategia futura de migraciones.

| Aspecto | Estado | Evidencia | Etiqueta |
| --- | --- | --- | --- |
| Modelos SQLAlchemy registrados | `Base.metadata` registra `archivos`, `clientes`, `configuraciones_proceso`, `ejecuciones_proceso`, `procesos`, `resultados_conciliacion`, `usuarios` | Comando desde `backend/`: `.\.venv\Scripts\python.exe -c "import app.models; from app.database.base import Base; print(sorted(Base.metadata.tables.keys()))"` | `DEFINIDO EN MODELOS` |
| Base local inspeccionada | La base local expone `alembic_version`, `archivos`, `clientes`, `configuraciones_proceso`, `ejecuciones_proceso`, `procesos`, `resultados_conciliacion`, `usuarios` | Comando desde `backend/`: `.\.venv\Scripts\python.exe -c "from sqlalchemy import inspect; from app.database.session import engine; print(sorted(inspect(engine).get_table_names()))"` | `VERIFICADO EN BASE LOCAL` |
| Creación operativa de tablas | Existe script que ejecuta `Base.metadata.create_all(bind=engine)` | `backend/scripts/create_tables.py` | `DEFINIDO EN MODELOS` |
| Configuración Alembic | Alembic importa `Base`, `app.models`, configura `target_metadata = Base.metadata` y usa `settings.database_url` | `backend/alembic/env.py`, `backend/alembic.ini` | `VERIFICADO EN MIGRACIONES` |
| Revisiones Alembic versionadas | No se encontraron archivos de revisión; `backend/alembic/versions/` contiene `.gitkeep` y `__pycache__` | `Get-ChildItem -Force backend\alembic\versions` | `VERIFICADO EN MIGRACIONES` |
| Tabla `alembic_version` | La tabla existe en base local, pero `select version_num from alembic_version` devolvió `[]` | Comando de lectura vía SQLAlchemy desde `backend/` | `VERIFICADO EN BASE LOCAL` |
| Columnas aplicadas en base local | No se compararon columna por columna contra los modelos durante esta revisión | Sin comando de comparación de columnas ejecutado | `NO VERIFICADO` |
| Estrategia operativa futura de migraciones | No hay decisión documentada en el repositorio | No hay README/roadmap/migraciones versionadas inspeccionadas | `NO VERIFICADO` |

> Restricción operativa: no crear, generar, aplicar ni asumir migraciones Alembic sin una tarea externa explícita que defina la estrategia de evolución del esquema. La presencia de Alembic configurado no demuestra que Alembic sea actualmente la fuente operativa de verdad del esquema.

> Antes de cambiar modelos, columnas, relaciones, tipos, índices o restricciones, la conversación de Codex debe identificar el impacto sobre la base local existente, los datos seed, `create_all`, Alembic y compatibilidad con entornos previos. No debe tomar una decisión de migración por cuenta propia.

## 7. API y endpoints

Todos los routers son incluidos desde `backend/app/main.py`. Las rutas automáticas de documentación pertenecen a FastAPI y aparecen al inspeccionar `app.routes`.

| Método | Ruta | Archivo/router | Auth/autorización | Parámetros relevantes | Entrada | Salida | Entidad/servicio | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/health` | `backend/app/api/routes/health.py` | Pública | Ninguno | Ninguna | `dict[str, str]` con `status` | Health check | VERIFICADO DIRECTAMENTE |
| POST | `/auth/login` | `backend/app/api/routes/auth.py` | Pública | Ninguno | `LoginRequest` JSON | `TokenResponse` | `authenticate_user`, JWT | VERIFICADO DIRECTAMENTE |
| POST | `/auth/token` | `backend/app/api/routes/auth.py` | Pública | Form OAuth2 | `OAuth2PasswordRequestForm`; `username` usado como email | `TokenResponse` | Swagger OAuth2 password flow | VERIFICADO DIRECTAMENTE |
| GET | `/auth/me` | `backend/app/api/routes/auth.py` | `get_current_user` | Bearer token | Ninguna | `UsuarioRead` | Usuario autenticado | VERIFICADO DIRECTAMENTE |
| GET | `/clientes` | `backend/app/api/routes/clientes.py` | `get_current_user` | Ninguno | Ninguna | `list[ClienteRead]` | `Cliente` | VERIFICADO DIRECTAMENTE |
| POST | `/clientes` | `backend/app/api/routes/clientes.py` | `require_admin` | Ninguno | `ClienteCreate` | `ClienteRead`, 201 | `Cliente` | VERIFICADO DIRECTAMENTE |
| GET | `/clientes/{cliente_id}` | `backend/app/api/routes/clientes.py` | `get_current_user` | `cliente_id` | Ninguna | `ClienteRead` | `Cliente` | VERIFICADO DIRECTAMENTE |
| PATCH | `/clientes/{cliente_id}` | `backend/app/api/routes/clientes.py` | `require_admin` | `cliente_id` | `ClienteUpdate` | `ClienteRead` | `Cliente` | VERIFICADO DIRECTAMENTE |
| DELETE | `/clientes/{cliente_id}` | `backend/app/api/routes/clientes.py` | `require_admin` | `cliente_id` | Ninguna | `ClienteRead` | Soft delete por `estado="INACTIVO"` | VERIFICADO DIRECTAMENTE |
| GET | `/procesos` | `backend/app/api/routes/procesos.py` | `get_current_user` | Query `cliente_id` opcional | Ninguna | `list[ProcesoRead]` | `Proceso` | VERIFICADO DIRECTAMENTE |
| POST | `/procesos` | `backend/app/api/routes/procesos.py` | `require_admin` | Ninguno | `ProcesoCreate` | `ProcesoRead`, 201 | `Proceso`; valida cliente | VERIFICADO DIRECTAMENTE |
| GET | `/procesos/{proceso_id}` | `backend/app/api/routes/procesos.py` | `get_current_user` | `proceso_id` | Ninguna | `ProcesoRead` | `Proceso` | VERIFICADO DIRECTAMENTE |
| PATCH | `/procesos/{proceso_id}` | `backend/app/api/routes/procesos.py` | `require_admin` | `proceso_id` | `ProcesoUpdate` | `ProcesoRead` | `Proceso` | VERIFICADO DIRECTAMENTE |
| DELETE | `/procesos/{proceso_id}` | `backend/app/api/routes/procesos.py` | `require_admin` | `proceso_id` | Ninguna | `ProcesoRead` | Soft delete por `estado="INACTIVO"` | VERIFICADO DIRECTAMENTE |
| GET | `/ejecuciones` | `backend/app/api/routes/ejecuciones.py` | `get_current_user` | Query `proceso_id`, `estado` opcionales | Ninguna | `list[EjecucionProcesoRead]` | `EjecucionProceso` | VERIFICADO DIRECTAMENTE |
| POST | `/ejecuciones` | `backend/app/api/routes/ejecuciones.py` | `get_current_user` | Ninguno | `EjecucionProcesoCreate` | `EjecucionProcesoRead`, 201 | Crea con `usuario_id=current_user.id`, `estado="CARGADO"` | VERIFICADO DIRECTAMENTE |
| GET | `/ejecuciones/{ejecucion_id}` | `backend/app/api/routes/ejecuciones.py` | `get_current_user` | `ejecucion_id` | Ninguna | `EjecucionProcesoRead` | `EjecucionProceso` | VERIFICADO DIRECTAMENTE |
| PATCH | `/ejecuciones/{ejecucion_id}` | `backend/app/api/routes/ejecuciones.py` | `require_admin` | `ejecucion_id` | `EjecucionProcesoUpdate` | `EjecucionProcesoRead` | `EjecucionProceso` | VERIFICADO DIRECTAMENTE |
| DELETE | `/ejecuciones/{ejecucion_id}` | `backend/app/api/routes/ejecuciones.py` | `require_admin` | `ejecucion_id` | Ninguna | `EjecucionProcesoRead` | Soft delete por `estado="CANCELADO"` | VERIFICADO DIRECTAMENTE |
| POST | `/archivos/upload` | `backend/app/api/routes/archivos.py` | `get_current_user` | Multipart `ejecucion_id`, `tipo_archivo`, `file` | `UploadFile` y `Form` | `ArchivoRead`, 201 | `save_upload_file`; `Archivo` | VERIFICADO DIRECTAMENTE |
| GET | `/archivos/ejecucion/{ejecucion_id}` | `backend/app/api/routes/archivos.py` | `get_current_user` | `ejecucion_id` | Ninguna | `list[ArchivoRead]` | `Archivo` | VERIFICADO DIRECTAMENTE |
| GET | `/archivos/{archivo_id}/preview` | `backend/app/api/routes/archivos.py` | `get_current_user` | `archivo_id`, query `limit` 1..100 default 20 | Ninguna | `ArchivoPreviewRead` | `build_file_preview` | VERIFICADO DIRECTAMENTE |
| PATCH | `/conciliaciones/resultados/{resultado_id}/revision` | `backend/app/api/routes/conciliaciones.py` | `get_current_user` | `resultado_id` | `ResultadoRevisionUpdate` | `ResultadoConciliacionRead` | `update_resultado_revision` | VERIFICADO DIRECTAMENTE |
| POST | `/conciliaciones/{ejecucion_id}/mapping` | `backend/app/api/routes/conciliaciones.py` | `get_current_user` | `ejecucion_id` | `ConciliacionMappingCreate` | `ConciliacionMappingRead` | `save_conciliacion_mapping` | VERIFICADO DIRECTAMENTE |
| GET | `/conciliaciones/{ejecucion_id}/mapping` | `backend/app/api/routes/conciliaciones.py` | `get_current_user` | `ejecucion_id` | Ninguna | `ConciliacionMappingRead` | `get_conciliacion_mapping` | VERIFICADO DIRECTAMENTE |
| POST | `/conciliaciones/{ejecucion_id}/ejecutar` | `backend/app/api/routes/conciliaciones.py` | `get_current_user` | `ejecucion_id` | Ninguna | `ConciliacionResumenRead` | `execute_reconciliation` | VERIFICADO DIRECTAMENTE |
| GET | `/conciliaciones/{ejecucion_id}/resultados` | `backend/app/api/routes/conciliaciones.py` | `get_current_user` | `ejecucion_id`, query `estado_resultado` opcional | Ninguna | `list[ResultadoConciliacionRead]` | `list_reconciliation_results` | VERIFICADO DIRECTAMENTE |
| GET | `/conciliaciones/{ejecucion_id}/exportar` | `backend/app/api/routes/conciliaciones.py` | `get_current_user` | `ejecucion_id` | Ninguna | `FileResponse` `.xlsx` | `export_reconciliation_results` | VERIFICADO DIRECTAMENTE |
| GET | `/conciliaciones/{ejecucion_id}/revision-resumen` | `backend/app/api/routes/conciliaciones.py` | `get_current_user` | `ejecucion_id` | Ninguna | `RevisionResumenRead` | `get_revision_summary` | VERIFICADO DIRECTAMENTE |
| POST | `/conciliaciones/{ejecucion_id}/aprobar` | `backend/app/api/routes/conciliaciones.py` | `require_admin` | `ejecucion_id` | Ninguna | `RevisionResumenRead` | `approve_execution` | VERIFICADO DIRECTAMENTE |
| POST | `/conciliaciones/{ejecucion_id}/rechazar` | `backend/app/api/routes/conciliaciones.py` | `require_admin` | `ejecucion_id` | `RechazarEjecucionRequest` opcional | `RevisionResumenRead` | `reject_execution` | VERIFICADO DIRECTAMENTE |
| GET | `/transformaciones-excel/archivos/{archivo_id}/estructura` | `backend/app/api/routes/transformaciones_excel.py` | `get_current_user` | `archivo_id`, query `sheet_name`, `header_row`, `limit` | Ninguna | `TransformacionExcelStructureRead` | `build_transformacion_excel_structure` | VERIFICADO DIRECTAMENTE |
| POST | `/transformaciones-excel/{ejecucion_id}/configuracion` | `backend/app/api/routes/transformaciones_excel.py` | `get_current_user` | `ejecucion_id` | `TransformacionExcelConfig` | `TransformacionExcelConfigRead` | `save_transformacion_config` | VERIFICADO DIRECTAMENTE |
| GET | `/transformaciones-excel/{ejecucion_id}/configuracion` | `backend/app/api/routes/transformaciones_excel.py` | `get_current_user` | `ejecucion_id` | Ninguna | `TransformacionExcelConfigRead` | `get_saved_transformacion_config` | VERIFICADO DIRECTAMENTE |
| POST | `/transformaciones-excel/{ejecucion_id}/validar` | `backend/app/api/routes/transformaciones_excel.py` | `get_current_user` | `ejecucion_id`, query `preview_limit` | Ninguna | `TransformacionExcelValidationRead` | `validate_transformacion_execution` | VERIFICADO DIRECTAMENTE |
| POST | `/transformaciones-excel/{ejecucion_id}/generar` | `backend/app/api/routes/transformaciones_excel.py` | `get_current_user` | `ejecucion_id` | Ninguna | `TransformacionExcelGenerationRead` | `generate_transformacion_result` | VERIFICADO DIRECTAMENTE |
| GET | `/transformaciones-excel/{ejecucion_id}/resultado` | `backend/app/api/routes/transformaciones_excel.py` | `get_current_user` | `ejecucion_id` | Ninguna | `TransformacionExcelGenerationRead` | `get_transformacion_result` | VERIFICADO DIRECTAMENTE |
| GET | `/transformaciones-excel/{ejecucion_id}/resultado/descargar` | `backend/app/api/routes/transformaciones_excel.py` | `get_current_user` | `ejecucion_id` | Ninguna | `FileResponse` XLSX | `get_transformacion_result_download` | VERIFICADO DIRECTAMENTE |
| GET | `/transformaciones-excel/{ejecucion_id}/resumen` | `backend/app/api/routes/transformaciones_excel.py` | `get_current_user` | `ejecucion_id` | Ninguna | `TransformacionExcelOperationalSummaryRead` | `get_transformacion_operational_summary` | VERIFICADO DIRECTAMENTE |
| GET | `/transformaciones-excel/{ejecucion_id}/trazabilidad` | `backend/app/api/routes/transformaciones_excel.py` | `get_current_user` | `ejecucion_id`, query `limit` | Ninguna | `TransformacionExcelTraceListRead` | `get_transformacion_trace_list` | VERIFICADO DIRECTAMENTE |
| GET | `/transformaciones-excel/procesos/{proceso_id}/plantillas` | `backend/app/api/routes/transformaciones_excel.py` | `get_current_user` | `proceso_id`, query `incluir_inactivas` | Ninguna | `TransformacionExcelTemplateListRead` | `list_process_templates` | VERIFICADO DIRECTAMENTE |
| GET, PUT, DELETE | `/transformaciones-excel/plantillas/{plantilla_id}` | `backend/app/api/routes/transformaciones_excel.py` | GET `get_current_user`; PUT/DELETE `require_admin` | `plantilla_id` | Update en PUT | Plantilla o 204 | Servicios de plantilla | VERIFICADO DIRECTAMENTE |
| POST | `/transformaciones-excel/{ejecucion_id}/plantillas` | `backend/app/api/routes/transformaciones_excel.py` | `require_admin` | `ejecucion_id` | `TransformacionExcelTemplateCreate` | `TransformacionExcelTemplateRead`, 201 | `create_template_from_execution` | VERIFICADO DIRECTAMENTE |
| POST | `/transformaciones-excel/{ejecucion_id}/plantillas/{plantilla_id}/aplicar` | `backend/app/api/routes/transformaciones_excel.py` | `get_current_user` | `ejecucion_id`, `plantilla_id` | `TransformacionExcelTemplateApply` | `TransformacionExcelConfigRead` | `apply_template_to_execution` | VERIFICADO DIRECTAMENTE |
| GET | `/docs` | FastAPI automático | Pública | Ninguno | N/A | Swagger UI | FastAPI | VERIFICADO DIRECTAMENTE |
| GET | `/docs/oauth2-redirect` | FastAPI automático | Pública | Ninguno | N/A | OAuth2 redirect UI | FastAPI | VERIFICADO DIRECTAMENTE |
| GET | `/redoc` | FastAPI automático | Pública | Ninguno | N/A | ReDoc | FastAPI | VERIFICADO DIRECTAMENTE |
| GET | `/openapi.json` | FastAPI automático | Pública | Ninguno | N/A | OpenAPI JSON | FastAPI | VERIFICADO DIRECTAMENTE |

## 8. Autenticación, autorización y seguridad

**Mecanismo de autenticación**

La autenticación usa JWT Bearer. Evidencia: `backend/app/core/security.py` usa `jose.jwt.encode` y `jwt.decode`; `backend/app/api/routes/auth.py` define `oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")`.

`POST /auth/login` recibe JSON `LoginRequest` con `email` y `password`. `POST /auth/token` recibe `OAuth2PasswordRequestForm` y usa `form_data.username` como email. Ambos llaman `authenticate_user` y devuelven `TokenResponse`.

**Tokens**

`create_access_token(data, expires_delta=None)` agrega `exp` y firma con `settings.secret_key` y `settings.algorithm`. `decode_access_token(token)` valida con el algoritmo configurado. Evidencia: `backend/app/core/security.py`.

El subject del token se carga como `sub=str(user.id)`. Evidencia: `build_token_response` en `backend/app/api/routes/auth.py`.

**Protección de endpoints**

`get_current_user` valida token, existencia del usuario y `estado == "ACTIVO"`. Devuelve 401 para credenciales inválidas y 403 para usuario inactivo. Evidencia: `backend/app/api/routes/auth.py`.

`require_admin` valida `current_user.rol == "ADMIN"` y devuelve 403 si no cumple. Evidencia: `backend/app/api/routes/auth.py`.

No se encontraron scopes OAuth2 ni permisos granulares por recurso más allá de `ADMIN`. Estado: `NO ENCONTRADO EN EL CÓDIGO INSPECCIONADO`.

**Contraseñas**

Las contraseñas se hashean con passlib bcrypt. Evidencia: `pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")`, `get_password_hash` y `verify_password` en `backend/app/core/security.py`. El seed usa `get_password_hash("admin123")` en `backend/scripts/seed_initial_data.py`; no se guarda ese password en texto plano en el modelo.

**Variables sensibles**

Variables esperadas: `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `DATABASE_URL`. Evidencia: `backend/app/core/config.py` y `backend/.env.example`.

`backend/app/core/config.py` tiene defaults para esas variables. Riesgo: si no se define `SECRET_KEY` en entorno, usa `change-me-in-env`.

**CORS**

No se encontró configuración CORS en `backend/app/main.py` ni import de middleware CORS en rutas/servicios inspeccionados. Estado: `NO ENCONTRADO EN EL CÓDIGO INSPECCIONADO`.

## 9. Configuración local y variables de entorno

| Variable | Fuente | Propósito | Obligatoria según código | Valor de ejemplo seguro en repo |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | `backend/app/core/config.py`, `backend/.env.example` | URL de conexión SQLAlchemy/PostgreSQL | No estricta: hay default en `Settings`; requerida para entornos reales | `postgresql+psycopg2://postgres:postgres@localhost:5432/automatizador_admin` |
| `SECRET_KEY` | `backend/app/core/config.py`, `backend/.env.example` | Firma JWT | No estricta: hay default inseguro | `change-this-secret-key` |
| `ALGORITHM` | `backend/app/core/config.py`, `backend/.env.example` | Algoritmo JWT | No estricta: default `HS256` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `backend/app/core/config.py`, `backend/.env.example` | Expiración del access token | No estricta: default `60` | `60` |
| `TRANSFORMACION_EXCEL_MAX_FILE_SIZE_MB` | Config y `.env.example` | Tamaño físico máximo | No: default positivo | `50` |
| `TRANSFORMACION_EXCEL_MAX_ROWS` | Config y `.env.example` | Filas de datos máximas | No: default positivo | `200000` |
| `TRANSFORMACION_EXCEL_MAX_COLUMNS` | Config y `.env.example` | Columnas máximas | No: default positivo | `300` |
| `TRANSFORMACION_EXCEL_MAX_SHEETS` | Config y `.env.example` | Hojas XLSX máximas | No: default positivo | `50` |
| `TRANSFORMACION_EXCEL_MAX_XLSX_UNCOMPRESSED_MB` | Config y `.env.example` | Expansión XLSX máxima | No: default positivo | `250` |
| `TRANSFORMACION_EXCEL_MAX_XLSX_COMPRESSION_RATIO` | Config y `.env.example` | Relación de compresión máxima | No: default positivo | `100` |
| `TRANSFORMACION_EXCEL_STALE_PROCESSING_MINUTES` | Config y `.env.example` | Umbral operativo de `PROCESANDO` abandonado | No: default positivo | `30` |
| `TEST_DATABASE_URL` | Solo entorno de tests integrales | PostgreSQL exclusiva de testing | Sí para ejecutar integración; no tiene fallback | No se versiona valor |

`SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")` indica que el backend lee `.env` desde el directorio de ejecución. `.gitignore` ignora `.env` y `backend/.env`; no se documentan ni exponen valores reales.

No se encontró README general. La operación y testing del módulo de Transformación Excel están documentados en `backend/docs/TRANSFORMACION_EXCEL.md`.

## 10. Comandos verificables para operar el proyecto

Esta sección incluye solo comandos respaldados por scripts o configuración existente. Cuando no hay comando documentado, se marca explícitamente.

| Objetivo | Comando o estado | Fuente | Observación |
| --- | --- | --- | --- |
| Crear o activar entorno | `PENDIENTE DE CONFIRMACIÓN` | No hay README/Makefile/pyproject inspeccionado | Existe `backend/.venv/` en el entorno local, pero no hay instrucción documentada |
| Instalar dependencias | `PENDIENTE DE CONFIRMACIÓN` | `backend/requirements.txt` declara dependencias, pero no documenta comando | No se inventa variante de `pip` |
| Configurar variables de entorno | `PENDIENTE DE CONFIRMACIÓN` | `backend/.env.example`, `backend/app/core/config.py` | Hay variables esperadas; no hay comando documentado para copiar/crear `.env` |
| Levantar backend | `PENDIENTE DE CONFIRMACIÓN` | `backend/app/main.py` define app FastAPI; `uvicorn[standard]` está en requirements | No hay comando de ejecución documentado |
| Crear tablas sin Alembic | Desde `backend/`: `python scripts/create_tables.py` | `backend/scripts/create_tables.py` contiene `if __name__ == "__main__": main()` | Comando respaldado por script ejecutable; variante de intérprete puede depender del entorno |
| Ejecutar seed | Desde `backend/`: `python scripts/seed_initial_data.py` | `backend/scripts/seed_initial_data.py` contiene `if __name__ == "__main__": main()` | Comando respaldado por script ejecutable; variante de intérprete puede depender del entorno |
| Ejecutar migraciones | `PENDIENTE DE CONFIRMACIÓN` | `backend/alembic.ini`, `backend/alembic/env.py` existen | No hay migraciones versionadas en `backend/alembic/versions/`; no hay comando documentado |
| Ejecutar pruebas | Desde `backend/`: `.\\.venv\\Scripts\\python.exe -m unittest discover -s tests -p "test_*.py"` | `backend/tests/`, `backend/docs/TRANSFORMACION_EXCEL.md` | Ejecuta unitarias; la integral se omite si falta `TEST_DATABASE_URL` |
| Verificar salud de la aplicación | Endpoint `GET /health`; comando `PENDIENTE DE CONFIRMACIÓN` | `backend/app/api/routes/health.py` | No hay comando curl/http documentado |
| Inspeccionar base de datos | `PENDIENTE DE CONFIRMACIÓN` | No hay script dedicado; se usó inspección ad hoc durante este handoff | No documentado en repo |

**Comandos y entorno verificados durante esta inspección**

Estos comandos se ejecutaron únicamente para lectura, ayuda o inspección. No son instrucciones oficiales de operación salvo que exista fuente de repositorio indicada en la tabla anterior.

| Shell / entorno | Directorio | Comando exacto | Resultado resumido | Finalidad | Portabilidad |
| --- | --- | --- | --- | --- | --- |
| Windows PowerShell | Raíz del repo | `git status --short` | `?? docs/` después de crear el handoff | Verificar estado actual del working tree | Portable como Git; salida de path puede variar |
| Windows PowerShell | Raíz del repo | `git status --short docs\PROJECT_HANDOFF.md` | `?? docs/PROJECT_HANDOFF.md` | Verificar estado específico del handoff | Windows por separador `\`; comando Git portable con ajuste de path |
| Windows PowerShell | Raíz del repo | `git ls-files docs\PROJECT_HANDOFF.md` | Sin salida | Confirmar que el handoff no está trackeado | Windows por separador `\`; comando Git portable con ajuste de path |
| Windows PowerShell | Raíz del repo | `git branch --show-current` | `main` | Confirmar rama actual | Portable como Git |
| Windows PowerShell | Raíz del repo | `git log --oneline -5` | Últimos cinco commits listados en sección 3 | Confirmar historial reciente | Portable como Git |
| Windows PowerShell | `backend/` | `.\.venv\Scripts\python.exe --version` | `Python 3.12.10` | Verificar intérprete usado en inspección local | Específico Windows/venv local |
| Windows PowerShell | `backend/` | `.\.venv\Scripts\python.exe -c "import app.models; from app.database.base import Base; print(sorted(Base.metadata.tables.keys()))"` | 7 tablas registradas en metadata | Verificar modelos registrados | Específico Windows por ruta de Python; código Python portable |
| Windows PowerShell | `backend/` | `.\.venv\Scripts\python.exe -c "from sqlalchemy import inspect; from app.database.session import engine; print(sorted(inspect(engine).get_table_names()))"` | 7 tablas de dominio + `alembic_version` | Inspeccionar tablas en base local | Específico Windows por ruta de Python; lectura de DB local |
| Windows PowerShell | `backend/` | `.\.venv\Scripts\python.exe -c "from sqlalchemy import text; from app.database.session import engine; conn=engine.connect(); print(conn.execute(text('select version_num from alembic_version')).fetchall()); conn.close()"` | `[]` | Verificar estado de tabla `alembic_version` | Específico Windows por ruta de Python; lectura de DB local |
| Windows PowerShell | Raíz del repo | `Get-ChildItem -Force backend\alembic\versions` | `.gitkeep` y `__pycache__` | Verificar revisiones Alembic versionadas | PowerShell/Windows |
| Windows PowerShell | Raíz del repo | `rg --files -g '!backend/.venv/**'` | Lista de archivos del repo sin venv | Inspeccionar estructura | Portable si `rg` está instalado |
| Windows PowerShell | `backend/` | `.\.venv\Scripts\python.exe -c "from app.main import app; [print(m + ' ' + p) for p, methods in sorted((r.path, sorted(r.methods - {'HEAD','OPTIONS'})) for r in app.routes if hasattr(r, 'methods')) for m in methods]"` | Endpoints listados en sección 7 | Verificar rutas FastAPI registradas | Específico Windows por ruta de Python; código Python portable |

## 11. Funcionalidades implementadas

| Funcionalidad | Descripción concreta | Archivos involucrados | Estado | Limitaciones observadas | Riesgo de regresión |
| --- | --- | --- | --- | --- | --- |
| Health check | `GET /health` devuelve `{"status": "ok"}` | `backend/app/api/routes/health.py`, `backend/app/main.py` | IMPLEMENTADA Y VERIFICADA EN CÓDIGO | No verifica DB ni dependencias externas | Bajo |
| Autenticación JWT | Login JSON, token Swagger OAuth2 y `/auth/me` | `backend/app/api/routes/auth.py`, `backend/app/core/security.py`, schemas auth/usuario | IMPLEMENTADA Y VERIFICADA EN CÓDIGO | Sin refresh token, scopes ni recuperación de contraseña | Medio |
| Autorización ADMIN | Endpoints de escritura de clientes/procesos/ejecuciones y aprobar/rechazar usan `require_admin` | Rutas de clientes, procesos, ejecuciones, conciliaciones; `auth.py` | IMPLEMENTADA Y VERIFICADA EN CÓDIGO | Roles limitados a comparación string `ADMIN` | Medio |
| Clientes | Listar, crear, leer, actualizar, desactivar | `backend/app/api/routes/clientes.py`, modelo/schema cliente | IMPLEMENTADA Y VERIFICADA EN CÓDIGO | DELETE no borra físicamente; no se observó filtro automático de inactivos | Medio |
| Procesos | Listar, crear, leer, actualizar, desactivar; valida cliente al crear/actualizar | `backend/app/api/routes/procesos.py`, modelo/schema proceso | IMPLEMENTADA Y VERIFICADA EN CÓDIGO | No se observó endpoint para configuraciones de proceso | Medio |
| Ejecuciones | CRUD básico con estado inicial `CARGADO` y cancelación lógica | `backend/app/api/routes/ejecuciones.py`, modelo/schema ejecución | IMPLEMENTADA Y VERIFICADA EN CÓDIGO | Reglas de pertenencia por cliente no están centralizadas en todos los endpoints | Medio |
| Carga de archivos | Upload multipart, storage local, checksum, metadata DB | `backend/app/api/routes/archivos.py`, `file_service.py`, modelo/schema archivo | IMPLEMENTADA Y VERIFICADA EN CÓDIGO | Extensiones permitidas incluyen `.pdf`, pero preview/conciliación solo soportan CSV/XLS/XLSX | Medio |
| Preview de archivos | Lee CSV/XLS/XLSX con pandas y serializa primeras filas | `backend/app/api/routes/archivos.py`, `file_preview_service.py`, `archivo_preview.py` | IMPLEMENTADA Y VERIFICADA EN CÓDIGO | CSV preview usa `pd.read_csv` sin autodetección avanzada; límite máximo 100 | Medio |
| Mapping de conciliación | Guarda mapping en `ejecuciones_proceso.resumen_json["conciliacion_mapping"]` | `conciliaciones.py`, `conciliacion_mapping_service.py`, `conciliacion_mapping.py` | IMPLEMENTADA Y VERIFICADA EN CÓDIGO | No hay tabla específica para mapping | Medio |
| Motor de conciliación | Compara archivos A/B por clave e importe, genera resultados | `conciliacion_service.py`, `ResultadoConciliacion` | IMPLEMENTADA Y VERIFICADA EN CÓDIGO | Reprocesar elimina resultados previos de la ejecución; reglas limitadas al mapping actual | Alto |
| Consulta de resultados | Lista resultados con filtro opcional por estado | `conciliaciones.py`, `conciliacion_service.py` | IMPLEMENTADA Y VERIFICADA EN CÓDIGO | No se observó paginación | Medio |
| Revisión manual | Actualiza observación y `requiere_revision`; resume pendientes/revisados | `conciliacion_revision_service.py`, `resultado_revision.py`, `conciliaciones.py` | IMPLEMENTADA Y VERIFICADA EN CÓDIGO | No registra usuario ni auditoría por cada revisión | Medio |
| Aprobación/rechazo | ADMIN aprueba si no hay pendientes; rechaza con motivo opcional | `conciliacion_revision_service.py`, `conciliaciones.py` | IMPLEMENTADA Y VERIFICADA EN CÓDIGO | Rechazo guarda motivo en `error_message` y `resumen_json["rechazo"]`; sin tabla de auditoría | Medio |
| Exportación Excel | Genera `.xlsx` con hojas de resumen y resultados en `backend/storage/processed/{ejecucion_id}/` | `conciliacion_export_service.py`, endpoint `/exportar` | IMPLEMENTADA Y VERIFICADA EN CÓDIGO | Usa storage local; OpenAPI puede no reflejar con precisión `FileResponse` | Medio |
| Inspección de estructura para transformación Excel | Detecta hojas, columnas, tipos, preview y warnings con límites de seguridad | `transformaciones_excel.py`, `transformacion_excel_inspeccion_service.py`, `transformacion_excel_security_service.py` | IMPLEMENTADA Y VERIFICADA EN CÓDIGO | XLS usa lector binario, sin controles ZIP aplicables a XLSX | Medio |
| Transformación Excel completa | Configuración, dry-run, pipeline, XLSX, plantillas, resumen, trazas, integridad y descarga | Router, schemas y servicios `transformacion_excel_*` | IMPLEMENTADA Y VERIFICADA EN CÓDIGO Y TESTS | Backend sin frontend; storage local; integración requiere PostgreSQL de test externa | Alto |
| Creación de tablas | Script usa `Base.metadata.create_all(bind=engine)` | `backend/scripts/create_tables.py` | IMPLEMENTADA Y VERIFICADA EN CÓDIGO | `create_all` no altera tablas existentes | Alto |
| Seed inicial | Crea/reutiliza Cliente Demo, Admin Demo, procesos y configuración de conciliación | `backend/scripts/seed_initial_data.py` | IMPLEMENTADA Y VERIFICADA EN CÓDIGO | Depende de DB accesible y schema existente | Medio |

## 12. Funcionalidades planificadas o pendientes

La hoja de ruta funcional vigente es `docs/PROJECT_ROADMAP.md`; las Tareas 14 a 22 figuran completadas y el frontend es el próximo bloque planificado.

No se encontraron marcadores `TODO` o `FIXME` relevantes fuera de dependencias/venv/storage. Evidencia: `rg -n "TODO|FIXME|PENDIENTE|pass|print\(" -g '!backend/.venv/**' -g '!backend/storage/**'` no devolvió TODO/FIXME reales; sí existe un `print` de debug en `backend/alembic/env.py`.

Elementos incompletos deducibles técnicamente, sin convertirlos en roadmap de producto:

| Elemento | Evidencia | Estado |
| --- | --- | --- |
| Migraciones Alembic versionadas | `backend/alembic/versions/` solo tiene `.gitkeep` y `__pycache__`; tabla `alembic_version` local sin filas | IMPLEMENTACIÓN PARCIAL |
| Frontend de Transformación Excel | No existe código frontend en el repositorio; siguiente bloque según roadmap | PENDIENTE |
| Tests integrales ejecutados contra PostgreSQL | Suite presente y aislada; `TEST_DATABASE_URL` no estaba configurada en esta verificación | PENDIENTE DE ENTORNO EXTERNO |
| Comandos documentados de setup/run/test | No hay README/Makefile/pyproject/package.json | `NO ENCONTRADO EN EL CÓDIGO INSPECCIONADO` |

> La prioridad, el orden y el alcance de las próximas tareas deben ser definidos por el prompt de planificación externo. Codex no debe seleccionar ni ampliar tareas por cuenta propia.

**Próximos pasos: regla documental**

La siguiente tarea debe llegar mediante un prompt externo de planificación o ejecución. Antes de implementarla, Codex debe inspeccionar los archivos afectados en el estado actual del repositorio.

Si la tarea implica modificar modelos, columnas, relaciones, tipos, índices, restricciones o datos iniciales, debe existir una decisión explícita sobre estrategia de migraciones antes de tocar el esquema.

La ejecución real de Transformación Excel está implementada. El siguiente bloque planificado es el frontend y requiere su prompt operativo específico.

## 13. Decisiones técnicas verificadas

| Decisión observada | Evidencia | Impacto técnico | Qué no puede concluirse |
| --- | --- | --- | --- |
| Backend en FastAPI modular por routers | `backend/app/main.py` incluye routers de `backend/app/api/routes/` | Permite agregar dominios por router | No se puede concluir arquitectura futura |
| SQLAlchemy 2.x con `DeclarativeBase`, `Mapped`, `mapped_column` | `backend/app/database/base.py`; modelos en `backend/app/models/` | Modelos modernos y metadata centralizada | No se puede concluir política de migraciones futuras |
| PostgreSQL vía psycopg2 | `backend/.env.example`, `backend/requirements.txt` | Driver concreto para DB actual | No se puede confirmar ambiente productivo |
| Uso temporal de `create_all` | `backend/scripts/create_tables.py` | Permite crear schema sin migraciones | No garantiza evolución segura de schema |
| Alembic configurado pero sin revisiones versionadas | `backend/alembic/env.py`, `backend/alembic/versions/` | Base preparada para migraciones | No se puede afirmar que Alembic sea flujo operativo actual |
| JWT Bearer con OAuth2 Swagger | `backend/app/api/routes/auth.py` | Swagger Authorize usa `/auth/token`; clientes pueden usar `/auth/login` JSON | No hay refresh token ni scopes |
| Hash bcrypt con passlib | `backend/app/core/security.py` | Contraseñas no se comparan en texto plano | No se puede concluir política de rotación o complejidad |
| Soft delete por estado en varias entidades | `clientes.py`, `procesos.py`, `ejecuciones.py` | Evita borrado físico en endpoints DELETE | No se observa política global de filtrado de inactivos |
| Storage local bajo `backend/storage/` | `file_service.py`, `conciliacion_export_service.py`, `.gitignore` | Uploads y exports dependen del filesystem local | No se puede concluir estrategia cloud/backups |
| Configuraciones dinámicas en `resumen_json` | `conciliacion_mapping_service.py`, `transformacion_excel_config_service.py` | Evita tablas nuevas para mapping/config | Puede complejizar consultas y versionado; no hay decisión documentada explícita |
| Transformación Excel usa contrato Pydantic discriminado y motor puro compartido | Schema y `backend/app/services/transformacion_excel_pipeline.py` | Valida y ejecuta `SOURCE`, `CONSTANT`, `CONCAT`, `ARITHMETIC`, `VALUE_MAP` | No define operaciones futuras fuera del MVP |

## 14. Riesgos, deuda técnica y precauciones

| Tipo | Riesgo / hipótesis / recomendación | Evidencia | Nivel |
| --- | --- | --- | --- |
| Riesgo confirmado | No hay migraciones Alembic versionadas para reproducir/evolucionar schema | `backend/alembic/versions/` sin revisiones; schema creado por `create_all` | Alto |
| Riesgo confirmado | `create_all` no aplica cambios a tablas existentes | `backend/scripts/create_tables.py` usa `Base.metadata.create_all(bind=engine)` | Alto |
| Riesgo controlado | Las pruebas integrales requieren una PostgreSQL exclusiva externa | `backend/tests/integration/`, `TEST_DATABASE_URL` | Medio |
| Riesgo confirmado | `SECRET_KEY` tiene default inseguro si no se sobreescribe | `backend/app/core/config.py` default `change-me-in-env` | Alto |
| Riesgo confirmado | Storage local puede perder archivos o variar por entorno | `backend/app/services/file_service.py`, `conciliacion_export_service.py`, `.gitignore` | Medio |
| Riesgo confirmado | `backend/alembic/env.py` imprime tablas al ejecutar Alembic | `print("ALEMBIC TABLES:", ...)` | Bajo |
| Riesgo confirmado | No se encontró configuración CORS | `backend/app/main.py` sin middleware CORS | Medio para integración frontend futura |
| Hipótesis técnica | La DB local podría diferir en columnas aunque tenga las tablas | Solo se inspeccionaron nombres de tablas aplicadas | Medio |
| Hipótesis técnica | Reglas de multi-cliente no están aplicadas de forma homogénea en todos los endpoints | Algunos servicios validan `cliente_id`, otros endpoints CRUD básicos no muestran filtro por cliente | Medio |
| Recomendación | Antes de cambiar modelos, decidir si se retoma Alembic o se mantiene `create_all` temporalmente | Estado actual de migraciones y scripts | Alta prioridad técnica |
| Recomendación | Configurar y ejecutar periódicamente la suite integral sobre una base terminada en `_test` | `backend/tests/integration/` | Alta prioridad técnica |

## 15. Protocolo obligatorio para el próximo chat de Codex

1. Leer por completo `docs/PROJECT_HANDOFF.md`.
2. Inspeccionar el estado actual de Git antes de cambiar archivos.
3. Leer los módulos relevantes para la tarea solicitada.
4. Verificar dependencias técnicas, modelos, migraciones, endpoints y pruebas afectadas.
5. No asumir que una funcionalidad está terminada solo porque aparece en el handoff.
6. No crear tablas, endpoints, campos, rutas, comandos o flujos no solicitados.
7. No modificar el alcance funcional definido en el prompt de planificación externo.
8. No inferir prioridades, fases, roadmap ni decisiones de producto a partir de limitaciones técnicas observadas en este documento.
9. Si existiera un archivo futuro como `docs/PROJECT_ROADMAP.md`, usarlo como fuente de planificación solo si fue creado o validado explícitamente por planificación externa; no crearlo, completarlo ni modificarlo por inferencia del código.
10. Explicar antes de implementar qué archivos y componentes serán afectados.
11. Si se necesita alterar el esquema de base de datos, evaluar primero impacto sobre base local, datos seed, `create_all`, Alembic, compatibilidad y rollback.
12. No generar ni aplicar migraciones Alembic sin una tarea externa explícita que defina la estrategia de evolución del esquema.
13. Al finalizar una tarea, actualizar este archivo si cambió el estado técnico verificable.

## 16. Lista de verificación antes de continuar

* [ ] Leí `docs/PROJECT_HANDOFF.md`.
* [ ] Verifiqué el estado actual del repositorio.
* [ ] Recibí el prompt externo que define la tarea a realizar.
* [ ] Identifiqué archivos, modelos, endpoints y migraciones afectados.
* [ ] Confirmé qué información está verificada y cuál no.
* [ ] No voy a inventar estructura técnica no solicitada.
* [ ] Voy a actualizar documentación si la tarea cambia el estado técnico.

## 17. Evidencia de verificación

| Elemento revisado | Archivo / comando / fuente | Resultado | Nivel de certeza | Observaciones |
| ----------------- | -------------------------- | --------- | ---------------- | ------------- |
| Rama Git | `git branch --show-current` | `main` | VERIFICADO DIRECTAMENTE | Ejecutado antes de escribir este documento |
| Estado Git inicial | `git status --short` | Sin salida | VERIFICADO DIRECTAMENTE | Antes de crear `docs/PROJECT_HANDOFF.md` |
| Estado Git posterior al handoff | `git status --short` | `?? docs/` | VERIFICADO DIRECTAMENTE | El working tree no está limpio porque el handoff no está commiteado |
| Estado específico del handoff | `git status --short docs\PROJECT_HANDOFF.md` | `?? docs/PROJECT_HANDOFF.md` | VERIFICADO DIRECTAMENTE | Archivo sin seguimiento |
| Tracking del handoff | `git ls-files docs\PROJECT_HANDOFF.md` | Sin salida | VERIFICADO DIRECTAMENTE | Confirma que no está trackeado |
| Historial reciente | `git log --oneline -5` | Cinco commits listados en sección 3 | VERIFICADO DIRECTAMENTE | No se inspeccionó diff completo |
| Árbol de archivos | `rg --files -g '!backend/.venv/**'` | Backend, scripts, alembic, storage y archivos sample | VERIFICADO DIRECTAMENTE | Excluye venv |
| Ausencia de README/docs previos | `rg --files -g 'README*' -g 'docs/**' -g '!backend/.venv/**'` | Sin resultados | VERIFICADO DIRECTAMENTE | Antes de crear este documento |
| Ausencia de Makefile/pyproject/package/docker | `rg --files -g 'README*' -g 'Makefile' -g 'pyproject.toml' -g 'package.json' -g 'docker-compose.yml'` | Sin resultados | VERIFICADO DIRECTAMENTE | Excluye venv |
| Dependencias | `backend/requirements.txt` | Lista de dependencias de sección 3/4 | VERIFICADO DIRECTAMENTE | Versiones solo donde están declaradas |
| Variables ejemplo | `backend/.env.example` | `DATABASE_URL`, `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES` | VERIFICADO DIRECTAMENTE | No se expuso `.env` real |
| Configuración Pydantic | `backend/app/core/config.py` | `Settings`, defaults y `.env` | VERIFICADO DIRECTAMENTE | Defaults verificados en código |
| Intérprete local usado en inspección | `.\.venv\Scripts\python.exe --version` desde `backend/` | `Python 3.12.10` | VERIFICADO DIRECTAMENTE | Versión del entorno local, no declarada en archivo de proyecto |
| Seguridad | `backend/app/core/security.py` | Hash bcrypt y JWT | VERIFICADO DIRECTAMENTE | No se ejecutó prueba de login |
| DB session | `backend/app/database/session.py` | `engine`, `SessionLocal`, `get_db` | VERIFICADO DIRECTAMENTE | No se midió pool ni performance |
| Base ORM | `backend/app/database/base.py` | `Base(DeclarativeBase)` | VERIFICADO DIRECTAMENTE | Base única importada por modelos |
| Modelos ORM | `backend/app/models/*.py` | 7 tablas de dominio | VERIFICADO DIRECTAMENTE | Columnas listadas desde código |
| Metadata SQLAlchemy | `.\.venv\Scripts\python.exe -c "import app.models; from app.database.base import Base; print(sorted(Base.metadata.tables.keys()))"` desde `backend/` | 7 tablas registradas | VERIFICADO DIRECTAMENTE | Usó entorno local |
| Tablas aplicadas en DB local | `.\.venv\Scripts\python.exe -c "from sqlalchemy import inspect; from app.database.session import engine; print(sorted(inspect(engine).get_table_names()))"` desde `backend/` | 7 tablas de dominio + `alembic_version` | VERIFICADO PARCIALMENTE | No compara columnas |
| Tabla Alembic | `select version_num from alembic_version` vía SQLAlchemy | `[]` | VERIFICADO DIRECTAMENTE | Tabla sin versión registrada |
| Alembic config | `backend/alembic/env.py`, `backend/alembic.ini` | Usa settings y `Base.metadata` | VERIFICADO DIRECTAMENTE | `env.py` tiene print de debug |
| Migraciones versionadas | `Get-ChildItem -Force backend\alembic\versions` | `.gitkeep` y `__pycache__` | VERIFICADO DIRECTAMENTE | Sin archivos revisionados |
| Uso de `create_all` | `backend/scripts/create_tables.py` | Ejecuta `Base.metadata.create_all(bind=engine)` | VERIFICADO DIRECTAMENTE | Script inspeccionado; no ejecutado en esta revisión |
| Restricción Alembic / `create_all` | `backend/alembic/versions`, `backend/scripts/create_tables.py`, tabla `alembic_version` | Alembic configurado, sin revisiones versionadas, base local con tabla `alembic_version` vacía, script `create_all` presente | VERIFICADO DIRECTAMENTE | La estrategia futura de migraciones sigue `NO VERIFICADO` |
| Scripts operativos | `backend/scripts/create_tables.py`, `backend/scripts/seed_initial_data.py` | `main()` ejecutable | VERIFICADO DIRECTAMENTE | No se ejecutaron en esta tarea |
| Routers incluidos | `backend/app/main.py` | Health, auth, clientes, procesos, ejecuciones, archivos, conciliaciones, transformaciones Excel | VERIFICADO DIRECTAMENTE | No hay CORS |
| Endpoints reales | `.\.venv\Scripts\python.exe -c "from app.main import app; ..."` desde `backend/` | Rutas listadas en sección 7 | VERIFICADO DIRECTAMENTE | Incluye rutas automáticas FastAPI |
| Auth y permisos | `backend/app/api/routes/auth.py` | `get_current_user`, `require_admin`, `/login`, `/token`, `/me` | VERIFICADO DIRECTAMENTE | Sin scopes |
| CRUD clientes/procesos/ejecuciones | Rutas correspondientes en `backend/app/api/routes/` | Endpoints y dependencias verificados | VERIFICADO DIRECTAMENTE | No se hicieron requests HTTP |
| Archivos y preview | `backend/app/api/routes/archivos.py`, `file_service.py`, `file_preview_service.py` | Upload/list/preview | VERIFICADO DIRECTAMENTE | No se modificaron archivos |
| Conciliación | `conciliaciones.py`, servicios de conciliación/mapping/revisión/export | Mapping, ejecución, resultados, revisión, export | VERIFICADO DIRECTAMENTE | No se ejecutó conciliación |
| Transformación Excel | `transformaciones_excel.py`, schemas y servicios `transformacion_excel_*` | Flujo backend completo y hardening | VERIFICADO DIRECTAMENTE | Frontend pendiente |
| Tests | `.\\.venv\\Scripts\\python.exe -m unittest discover -s tests -p "test_*.py"` desde `backend/` | 127 pruebas descubiertas; 2 omisiones controladas | VERIFICADO DIRECTAMENTE | Integración sin `TEST_DATABASE_URL`; symlink no permitido por el entorno Windows; no se conectó a desarrollo |
| TODO/FIXME | `rg -n "TODO|FIXME|PENDIENTE|pass|print\(" -g '!backend/.venv/**' -g '!backend/storage/**'` | Sin TODO/FIXME relevantes; print Alembic observado por lectura directa | VERIFICADO PARCIALMENTE | Búsqueda textual limitada |
| Datos definidos en modelos | `backend/app/models/*.py`, `Base.metadata` | 7 tablas de dominio definidas | VERIFICADO DIRECTAMENTE | Etiqueta documental: `DEFINIDO EN MODELOS` |
| Datos verificados en base local | Inspector SQLAlchemy y lectura de `alembic_version` | Tablas presentes; `alembic_version` sin filas | VERIFICADO PARCIALMENTE | Etiqueta documental: `VERIFICADO EN BASE LOCAL`; no compara columnas |
| Datos verificados en migraciones | `backend/alembic/env.py`, `backend/alembic/versions` | Configuración presente; revisiones versionadas ausentes | VERIFICADO DIRECTAMENTE | Etiqueta documental: `VERIFICADO EN MIGRACIONES` |
