# Automatizador Administrativo — Frontend

Interfaz web administrativa para organizar el acceso a procesos, ejecuciones y plantillas. Incluye el shell responsive, el sistema visual y la primera integración HTTP con el estado real del backend.

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
Navegador -> /api/backend/health (Next.js) -> /health (FastAPI)
```

- `src/lib/api/client.ts` es el cliente del navegador y sólo acepta rutas internas bajo `/api/`.
- `src/lib/api/server.ts` es el cliente marcado como `server-only` que resuelve `BACKEND_URL` y aplica timeout y controles de destino.
- `src/app/api/backend/health/route.ts` es el único Route Handler BFF actual.
- `src/lib/api/errors.ts` normaliza respuestas fallidas a un contrato seguro para la interfaz.

La pantalla de inicio consulta el health real con TanStack Query y muestra si el servidor está conectado. La autenticación y protección de rutas continúan pendientes para la tarea siguiente.

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
