# Automatizador Administrativo — Frontend

Interfaz web administrativa para organizar el acceso a procesos, ejecuciones y plantillas. Incluye el shell responsive, el sistema visual, autenticación con sesión HttpOnly y la integración HTTP con el estado real del backend.

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
             └── /api/auth/logout    -> borra la cookie local
```

- `src/lib/api/client.ts` es el cliente del navegador y sólo acepta rutas internas bajo `/api/`.
- `src/lib/api/server.ts` es el cliente marcado como `server-only` que resuelve `BACKEND_URL` y aplica timeout y controles de destino.
- Los Route Handlers bajo `src/app/api/` forman el BFF y son el único punto HTTP que usa el navegador.
- `src/lib/api/errors.ts` normaliza respuestas fallidas a un contrato seguro para la interfaz.

La pantalla de inicio consulta el health real con TanStack Query y muestra si el servidor está conectado.

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
├── features/system/          # Consulta y estado visual del backend
├── lib/api/                  # Clientes HTTP, errores y forwarding seguro
├── lib/query/                # QueryClient, claves y política de reintentos
├── test/                     # Configuración común de pruebas
└── types/generated/          # Tipos generados; no editar manualmente
```
