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

Leer los `AGENTS.md` aplicables y únicamente las secciones relevantes de `PROJECT_HANDOFF.md` y `PROJECT_ROADMAP.md`. Inspeccionar sólo los archivos afectados, sus dependencias directas y los contratos relacionados; ampliar la búsqueda únicamente cuando aparezca una dependencia real. El código involucrado determina el comportamiento implementado; señalar cualquier discrepancia con los documentos.

Para tareas no triviales: inspeccionar los archivos y patrones relacionados, presentar un plan breve, implementar el cambio mínimo, validar y revisar el diff. Actualizar el handoff sólo por cambios técnicos relevantes y el roadmap sólo por cambios de planificación o estado de tareas.

Los prompts futuros deben ser breves y basarse en las reglas persistentes de los `AGENTS.md`, sin repetir arquitectura, stack ni instrucciones ya documentadas.

## Uso de Codex

Codex en VS Code se utiliza para inspección de código, implementación, tests focalizados, lint, typecheck, build, análisis de `git diff` y revisión técnica de seguridad, contratos, backend, frontend y base de datos. Por defecto no usa navegador, Computer Use ni realiza validaciones visuales. Si una tarea requiere navegación real o validación visual, se informa como pendiente para Codex Desktop.

Codex Desktop se utiliza para navegar sobre `localhost`, validación visual y responsive, UX, interacción real con formularios, F5, browser back/forward, descargas visuales, Computer Use, inspección visual de estados loading/error y pruebas manuales de flujos. Las pruebas realizadas en Desktop no se repiten desde VS Code salvo que exista un motivo técnico concreto.

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

Cuando la tarea esté estable y antes del cierre, ejecutar una vez la validación completa, incluido el build de Next.js:

```powershell
.\scripts\validate.ps1
```

El modo `-Quick` no reemplaza la validación completa de cierre. `-Quick`, `-Backend` y `-Frontend` son mutuamente excluyentes. No repetir FULL después de una revisión que no haya modificado archivos. Si después del FULL sólo cambia documentación, no repetir tests funcionales salvo que exista una razón concreta. En tareas exclusivamente documentales, aplicar la validación documental indicada por la tarea.

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

## Reviewer independiente

No ejecutar automáticamente un reviewer independiente completo para toda tarea. Es especialmente recomendable en cambios relacionados con autenticación, autorización, aislamiento multicliente, seguridad, contratos API, persistencia, migraciones, transacciones, concurrencia, uploads/downloads, operaciones destructivas o cambios transversales relevantes.

Para cambios pequeños, visuales o localizados pueden ser suficientes los tests focalizados, la validación automática y la validación visual en Desktop cuando corresponda.

Cuando exista reviewer, debe trabajar únicamente sobre `git diff`, archivos directamente relacionados, contratos afectados y tests correspondientes. Inicialmente no modifica archivos, no repite validación visual y no ejecuta FULL salvo que necesite verificar un hallazgo concreto.

## Validación funcional y cierre

Para cambios visibles, Codex Desktop debe levantar backend y frontend, recorrer en el navegador el flujo afectado y comprobar estados normales y errores relevantes. Las pruebas automáticas y la lectura estática no reemplazan esta comprobación. Desde VS Code, esta validación se informa como pendiente para Desktop.

Antes de un commit, ejecutar las validaciones pertinentes, revisar seguridad y casos límite, y consultar `git status` y `git diff`. No hacer commit ni push automáticamente.

El principio general es optimizar contexto y usage eliminando trabajo redundante, sin reducir seguridad, integridad de datos, aislamiento multicliente, calidad de tests, trazabilidad ni mantenibilidad.
