# Automatizador Administrativo — Frontend

Interfaz web administrativa para organizar el acceso a procesos, ejecuciones y plantillas. El estado actual incluye el shell responsive, el sistema visual y páginas iniciales sin datos de negocio; la conexión con el backend todavía no está implementada.

## Stack

- Next.js 16 con App Router y Turbopack.
- React 19 y TypeScript en modo estricto.
- Tailwind CSS 4 y componentes shadcn/ui.
- TanStack Query preparado para integraciones futuras.
- Vitest y React Testing Library para pruebas unitarias.

## Requisitos

- Una rama compatible de Node.js: 20.19+, 22.13+ o 24+.
- npm incluido con una versión compatible de Node.js.

El proyecto se verificó inicialmente con Node.js 24 y npm 11.

## Instalación y comandos

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run test:run
npm run build
```

`npm run test` inicia Vitest en modo interactivo. El servidor de desarrollo queda disponible en `http://localhost:3000` por defecto.

## Estructura principal

```text
src/
├── app/                  # Layout raíz, providers, rutas y estados globales
├── components/
│   ├── data-display/     # Componentes de presentación de datos
│   ├── feedback/         # Estados vacíos, errores y carga
│   ├── layout/           # Shell, sidebar, header y navegación móvil
│   └── ui/               # Componentes shadcn/ui
├── lib/
│   ├── query/            # Provider de TanStack Query
│   ├── navigation.ts     # Definición central de navegación
│   └── utils.ts          # Utilidades compartidas
└── test/                 # Configuración común de pruebas
```

## Estado actual

El shell administrativo y el sistema visual claro están implementados para escritorio y dispositivos móviles. Las rutas muestran contenido conceptual y estados vacíos, sin autenticación, datos simulados ni llamadas HTTP.

## Variable de entorno futura

El archivo `.env.local.example` documenta `BACKEND_URL` como variable exclusiva del servidor. Todavía no se consume. Para configuraciones locales futuras se usará `.env.local`, que permanece ignorado por Git.
