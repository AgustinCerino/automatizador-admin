# Workflow de desarrollo

## Desarrollo local

En Windows PowerShell, desde `backend/`, crear un entorno Python 3.12 e instalar las dependencias declaradas en `requirements.txt`:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Configurar `DATABASE_URL` y `SECRET_KEY` según `backend/.env.example`; el backend escucha en `http://127.0.0.1:8000`. Con la aplicación en marcha, `Invoke-RestMethod http://127.0.0.1:8000/health` consulta el health check. La ruta sólo confirma que el servidor responde; no comprueba PostgreSQL.

Desde otra terminal, en `frontend/`:

```powershell
cd frontend
Copy-Item .env.local.example .env.local
npm.cmd ci
npm.cmd run dev
```

El frontend escucha normalmente en `http://localhost:3000`; `BACKEND_URL` en `.env.local` apunta al backend y permanece del lado servidor. Se usa `npm.cmd` para evitar el bloqueo de `npm.ps1` por la política de ejecución de PowerShell.

Los scripts existentes `backend/scripts/create_tables.py` y `backend/scripts/seed_initial_data.py` crean tablas y datos iniciales, respectivamente: modifican la base y no son parte de la validación. Alembic está configurado en `backend/alembic.ini` y `backend/alembic/env.py`, pero `backend/alembic/versions/` no tiene revisiones versionadas. Antes de un cambio de esquema, definir la estrategia de migración; usar `python -m alembic ...` con el entorno backend, sin editar migraciones históricas.

## Autenticación entre navegador y backend

El formulario del navegador envía credenciales a `POST /api/auth/login` de Next.js. Ese Route Handler llama a `POST /auth/login` de FastAPI. FastAPI comprueba las credenciales y emite un JWT; Next.js lo guarda en la cookie de sesión `automatizador_session`, con `HttpOnly` y `SameSite=Lax` (`Secure` en producción). El cuerpo JSON de la respuesta al navegador incluye el usuario, no el token.

Para consultar la sesión y usar Route Handlers protegidos, Next.js lee la cookie del lado servidor, consulta `GET /auth/me` y reenvía el JWT a FastAPI mediante `Authorization: Bearer <token>`. FastAPI decodifica el JWT, comprueba el usuario activo y aplica los controles de rol donde corresponden. El navegador usa la cookie en sus solicitudes a Next.js; no recibe el JWT en JavaScript ni llama directamente a FastAPI en este flujo.

## Antes y durante una tarea

Leer los `AGENTS.md` aplicables y las secciones relevantes de `PROJECT_HANDOFF.md` y `PROJECT_ROADMAP.md`. El código involucrado determina el comportamiento implementado; señalar cualquier discrepancia con los documentos.

Para tareas no triviales: inspeccionar los archivos y patrones relacionados, presentar un plan breve, implementar el cambio mínimo, validar y revisar el diff. Actualizar el handoff sólo por cambios técnicos relevantes y el roadmap sólo por cambios de planificación o estado de tareas.

## Validación general

Desde la raíz del repositorio, durante el desarrollo iterativo usar el modo rápido para obtener feedback sin esperar el build:

```powershell
.\scripts\validate.ps1 -Quick
```

Para cambios únicamente backend o frontend, limitar los checks al componente afectado:

```powershell
.\scripts\validate.ps1 -Backend
.\scripts\validate.ps1 -Frontend
```

Antes de cerrar una tarea, ejecutar siempre la validación completa, incluido el build de Next.js:

```powershell
.\scripts\validate.ps1
```

El modo `-Quick` no reemplaza la validación completa de cierre. `-Quick`, `-Backend` y `-Frontend` son mutuamente excluyentes.

Si PowerShell bloquea scripts en la sesión actual, ejecutarlo con una excepción limitada a ese proceso:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\validate.ps1
```

El script comprueba sólo las herramientas necesarias para el modo elegido. En los modos con backend muestra el intérprete seleccionado (`backend/.venv`, `.venv` raíz o Python global), comprueba que funcione y exige Python 3.12; en los modos con frontend comprueba `npm.cmd` y las dependencias locales. La validación completa (FULL, sin parámetros) ejecuta en este orden:

1. En `backend/`: `python -B -m unittest discover -s tests -p "test_*.py"` con el intérprete de `backend/.venv`, del `.venv` raíz o el Python disponible. `-B` evita reescribir archivos `.pyc` versionados.
2. En `frontend/`: `npm.cmd run lint` (ESLint).
3. En `frontend/`: `npm.cmd run typecheck` (`tsc --noEmit`).
4. En `frontend/`: `npm.cmd run test:run` (Vitest sin modo interactivo).
5. En `frontend/`: `npm.cmd run build` (Next.js).

`-Quick` ejecuta los pasos 1 a 4; `-Backend` sólo el paso 1; `-Frontend` sólo los pasos 2 a 5.

Muestra cada etapa, se detiene ante un fallo y devuelve código distinto de cero. Restaura el directorio de trabajo al salir. Las pruebas de integración backend se omiten si no está definida `TEST_DATABASE_URL`; cuando se ejecuten, debe apuntar a una base PostgreSQL exclusiva y distinta de `DATABASE_URL`. No se ejecutan migraciones, seed ni generación de tipos OpenAPI: esta última requiere un backend activo y modifica archivos versionados.

El build actual de Next.js descarga las fuentes Geist desde Google Fonts; puede fallar sin acceso a ese servicio. Ese fallo debe informarse, no omitirse de la validación FULL.

No hay Ruff, MyPy ni Pytest configurados en el backend. La suite existente usa `unittest`; no se agregan herramientas nuevas por este workflow.

## Revisión con segundo agente

El agente implementador realiza el cambio y ejecuta las validaciones relevantes. El agente revisor trabaja en un contexto separado e inicialmente no modifica código. Examina el diff contra `main`, errores, regresiones, seguridad, autorización, integridad de datos, contratos frontend/backend, tests faltantes y cambios fuera de alcance. Presenta sus hallazgos primero; sólo modifica archivos después si el usuario lo solicita.

## Validación funcional y cierre

Para cambios visibles, levantar backend y frontend, recorrer en el navegador el flujo afectado y comprobar estados normales y errores relevantes. Las pruebas automáticas y la lectura estática no reemplazan esta comprobación.

Antes de un commit, ejecutar las validaciones pertinentes, revisar seguridad y casos límite, y consultar `git status` y `git diff`. No hacer commit ni push automáticamente.
