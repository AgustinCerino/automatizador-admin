# Automatizador Administrativo — Frontend

Interfaz web administrativa para organizar el acceso a procesos, ejecuciones y plantillas. Incluye el shell responsive, el sistema visual, autenticación con sesión HttpOnly y el primer flujo vertical real de procesos y ejecuciones.

## Stack

- Next.js 16 con App Router y Turbopack.
- React 19 y TypeScript en modo estricto.
- Tailwind CSS 4 y componentes shadcn/ui.
- TanStack Query para estado remoto.
- Vitest y React Testing Library para pruebas unitarias.
- `openapi-typescript` para generar tipos desde el contrato FastAPI.

## Requisitos

- Una rama compatible de Node.js: 20.19+, 22.13+ o 24+.
- npm incluido con una versión compatible de Node.js.
- El backend activo para actualizar el contrato y los tipos de API.

El proyecto se verificó inicialmente con Node.js 24 y npm 11.

## Configuración local

Copiá `.env.local.example` como `.env.local` y ajustá la URL si el backend no utiliza el valor local predeterminado:

```dotenv
BACKEND_URL=http://127.0.0.1:8000
```

`BACKEND_URL` es exclusiva del servidor: no usa el prefijo `NEXT_PUBLIC_` y no debe incluir secretos. Los Route Handlers de Next.js y el exportador de OpenAPI la consumen sin exponerla al navegador.

## Arquitectura HTTP

El navegador no llama directamente a FastAPI:

```text
Navegador -> BFF de Next.js -> FastAPI
             ├── /api/backend/health -> /health
             ├── /api/auth/login     -> /auth/login y /auth/me
             ├── /api/auth/session   -> /auth/me
             ├── /api/auth/logout    -> borra la cookie local
             ├── /api/backend/procesos
             ├── /api/backend/ejecuciones
             └── /api/backend/transformaciones/{ejecucionId}/resumen
```

- `src/lib/api/client.ts` es el cliente del navegador y sólo acepta rutas internas bajo `/api/`.
- `src/lib/api/server.ts` es el cliente marcado como `server-only` que resuelve `BACKEND_URL` y aplica timeout y controles de destino.
- Los Route Handlers bajo `src/app/api/` forman el BFF y son el único punto HTTP que usa el navegador.
- `src/lib/api/errors.ts` normaliza respuestas fallidas a un contrato seguro para la interfaz.

La pantalla de inicio consulta el health real con TanStack Query y muestra si el servidor está conectado.

## Procesos y ejecuciones

Las rutas `/procesos` y `/ejecuciones` consultan procesos reales mediante TanStack Query. Cada proceso enlaza a `/procesos/{procesoId}/ejecuciones`, donde se muestra su contexto, el historial real y la acción para crear una ejecución. La creación envía al BFF únicamente `proceso_id`; FastAPI determina el usuario autenticado y el estado inicial.

El BFF autenticado incorpora estas rutas explícitas:

- `GET /api/backend/procesos`.
- `GET /api/backend/procesos/{procesoId}`.
- `GET /api/backend/procesos/{procesoId}/ejecuciones`.
- `POST /api/backend/ejecuciones`.
- `GET /api/backend/ejecuciones/{ejecucionId}`.

Cada handler valida la cookie mediante `/auth/me` una sola vez, deriva `cliente_id` del usuario actual y comprueba la pertenencia del proceso antes de exponer o crear ejecuciones. El navegador no puede seleccionar `cliente_id`, `usuario_id`, rol ni estado. Un `401` de FastAPI elimina la cookie y produce el código controlado `SESSION_EXPIRED`; los Client Components limpian TanStack Query y vuelven a `/login` sin aplicar esa política al formulario de login.

Las ejecuciones de procesos `TRANSFORMACION_EXCEL` navegan a `/transformaciones/{ejecucionId}`. Esa ruta contiene un workspace operativo de solo lectura que consulta `GET /transformaciones-excel/{ejecucion_id}/resumen` mediante el Route Handler autenticado `GET /api/backend/transformaciones/{ejecucionId}/resumen`.

El workspace usa TanStack Query y presenta las cuatro etapas `Archivo`, `Configuración`, `Validación` y `Resultado`. FastAPI sigue siendo la fuente de verdad para `action_required`, las capacidades `can_*`, los problemas operativos y sus contadores; el navegador no interpreta `resumen_json` ni vuelve a calcular permisos. Los estados soportados de próxima acción son `CONFIGURE`, `VALIDATE`, `FIX_ERRORS`, `GENERATE`, `WAIT`, `DOWNLOAD`, `REGENERATE`, `REVIEW_ERROR` y `NONE`.

Mientras `estado_ejecucion` es `PROCESANDO`, la consulta actualiza el resumen aproximadamente cada tres segundos y detiene el polling al recibir cualquier otro estado. La pantalla representa el archivo fuente, la existencia de configuración y plantilla, las métricas de validación, el resultado generado y los issues `ERROR`/`WARNING`, sin exponer rutas de storage ni datos técnicos internos.

Las acciones de carga, configuración, validación y generación se incorporan en los siguientes cortes verticales. Este workspace tampoco activa todavía descarga, edición/aplicación de plantillas ni trazabilidad detallada, aunque el resumen deje disponibles capacidades para esos flujos futuros. Otros tipos de proceso permanecen en su historial porque todavía no existe una vista funcional genérica autorizada.

El backend permite listar ejecuciones sin filtro, pero ese endpoint no aplica aislamiento por cliente. Por ese motivo, la página global `/ejecuciones` ofrece navegación mediante los procesos reales del cliente en lugar de exponer una tabla global insegura.

## Autenticación y sesión

El formulario público de `/login` envía las credenciales a `POST /api/auth/login`. El BFF las reenvía a `POST /auth/login` de FastAPI, guarda el JWT recibido en una cookie y valida inmediatamente la identidad contra `GET /auth/me`. La respuesta al navegador contiene únicamente el usuario seguro; nunca incluye el token.

La cookie se llama `automatizador_session` y tiene estas propiedades:

- `HttpOnly` y `SameSite=Lax`.
- `Secure` sólo en producción y `Path=/`.
- Es una cookie de sesión: no declara `Max-Age` ni `Expires`.
- No declara `Domain`.

El JWT nunca se guarda en `localStorage`, `sessionStorage` ni estado accesible desde JavaScript. FastAPI sigue siendo la autoridad de autenticación: tanto `GET /api/auth/session` como el layout protegido validan la cookie consultando `/auth/me`, sin decodificar ni confiar localmente en el JWT. `BACKEND_URL` continúa siendo una variable exclusiva del servidor.

El layout `(protected)` exige una sesión válida para `/`, `/procesos`, `/ejecuciones` y `/plantillas`; `/login` y los Route Handlers públicos quedan fuera de ese grupo. El shell recibe el usuario ya validado y muestra su nombre o correo y su rol, sin exponer identificadores internos ni el token. El layout redirige de forma simple a `/login` porque los layouts de Next.js no reciben el pathname solicitado; el retorno opcional sigue disponible para accesos explícitos mediante `/login?next=/ruta` y siempre se sanitiza antes de navegar.

Un token inválido o vencido se trata como una sesión no autenticada; el endpoint de sesión puede borrar la cookie inválida. En cambio, una caída o un error técnico de FastAPI produce un error controlado y no elimina la cookie ni se interpreta como cierre de sesión.

`POST /api/auth/logout` es idempotente y sólo borra la cookie local. El backend no dispone de un endpoint de logout ni de refresh tokens, por lo que no se realiza una llamada adicional a FastAPI. Los endpoints que cambian la cookie validan el origen de la solicitud.

Si falla un intento de login, el formulario conserva el correo para facilitar la corrección y limpia la contraseña. Los errores de credenciales y de indisponibilidad del servidor se muestran sin revelar información sensible.

## Contrato OpenAPI y tipos

Con el backend activo desde `../backend`:

```bash
python -m uvicorn app.main:app --reload
```

Regenerá el snapshot y los tipos desde `frontend`:

```bash
npm run api:types
```

Ese comando:

1. descarga el OpenAPI real en `openapi/openapi.json`;
2. genera `src/types/generated/api.ts` con `openapi-typescript`.

Ambos archivos se versionan. El archivo TypeScript generado no se edita manualmente. `npm run api:schema` y `npm run api:generate` permiten ejecutar cada etapa por separado. La compilación no consulta al backend ni regenera tipos automáticamente.

## Instalación y desarrollo

```bash
npm install
npm run dev
```

`npm run test` inicia Vitest en modo interactivo. El servidor de desarrollo queda disponible en `http://localhost:3000` por defecto.

## Prueba manual de autenticación

1. Iniciá FastAPI y luego ejecutá `npm run dev` desde `frontend`.
2. Abrí una ruta protegida sin sesión y comprobá que redirige a `/login`.
3. Iniciá sesión con credenciales válidas, recargá la página y verificá que el shell muestre el usuario real.
4. En las herramientas del navegador, comprobá que `automatizador_session` sea HttpOnly y que las respuestas de login y sesión no contengan el JWT.
5. Cerrá sesión y confirmá que la cookie desaparezca y que una ruta protegida vuelva a redirigir a `/login`.
6. Probá una contraseña incorrecta: el correo debe conservarse, la contraseña debe limpiarse y el mensaje no debe indicar si la cuenta existe.
7. Con una cookie existente, detené FastAPI y recargá una ruta protegida o consultá la sesión: debe aparecer un error técnico controlado y la cookie no debe borrarse.

## Prueba manual de procesos y ejecuciones

1. Iniciá sesión y abrí `/procesos`; deben aparecer los procesos reales del cliente autenticado.
2. Abrí un proceso y verificá que `/procesos/{procesoId}/ejecuciones` muestre su nombre e historial real.
3. Creá una ejecución y comprobá que tenga ID y estado reales, sin enviar `cliente_id`, `usuario_id` ni `estado` desde el navegador.
4. Para un proceso `TRANSFORMACION_EXCEL`, abrí la ejecución y verificá la ruta `/transformaciones/{ejecucionId}`.
5. Recargá esa ruta y luego cerrá sesión; las páginas protegidas deben volver a exigir login.

## Prueba manual del workspace de transformación

1. Abrí ejecuciones reales de `TRANSFORMACION_EXCEL` en distintos estados disponibles.
2. Confirmá que la cabecera, las cuatro etapas y la próxima acción coincidan con el resumen de FastAPI.
3. Verificá los casos sin archivo/configuración, validado, completado y error cuando existan, sin modificar el backend para fabricar estados.
4. En una ejecución `PROCESANDO`, comprobá que el resumen se actualice sin recargar la página y que el polling se detenga al cambiar de estado.
5. Confirmá en la pestaña de red que el navegador sólo consulta `/api/backend/transformaciones/{ejecucionId}/resumen`, nunca el puerto de FastAPI directamente.
6. Verificá que no aparezcan botones de carga, configuración, validación, generación, descarga o plantillas en este corte.

## Validación

```bash
npm run api:types
npm run lint
npm run typecheck
npm run test:run
npm run build
```

## Estructura principal

```text
openapi/                    # Snapshot OpenAPI versionado
scripts/                    # Exportador reproducible del contrato
src/
├── app/                      # Layouts, páginas, providers y Route Handlers
├── components/               # Componentes visuales compartidos
├── features/processes/       # API browser, queries y cards de procesos
├── features/executions/      # API browser, queries, tabla y creación
├── features/transformations/ # Resumen operativo, query, presentación y workspace
├── features/system/          # Consulta y estado visual del backend
├── lib/api/                  # Clientes HTTP, errores y forwarding seguro
├── lib/query/                # QueryClient, claves y política de reintentos
├── test/                     # Configuración común de pruebas
└── types/generated/          # Tipos generados; no editar manualmente
```
