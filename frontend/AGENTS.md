<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Automatizador Admin — Frontend Agent Instructions

Estas instrucciones complementan el `/AGENTS.md` raíz.

## Frontend stack

* Next.js
* React
* TypeScript

El frontend corre localmente habitualmente en:

`http://localhost:3000`

El frontend se comunica con el backend FastAPI mediante Route Handlers / API server-side cuando corresponda.

Variable de entorno relevante:

`BACKEND_URL=http://127.0.0.1:8000`

`BACKEND_URL` es una variable exclusiva del servidor.

No convertirla en `NEXT_PUBLIC_BACKEND_URL` salvo que una decisión arquitectónica explícita lo requiera.

## General architecture

Mantener separación entre:

* páginas;
* componentes;
* lógica de presentación;
* acceso a API;
* estado;
* validaciones;
* utilidades.

Evitar colocar acceso HTTP duplicado directamente en múltiples componentes cuando ya existe una abstracción apropiada.

## Existing design

Antes de crear componentes nuevos:

1. revisar componentes equivalentes existentes;
2. reutilizar primitives y patrones existentes;
3. conservar consistencia visual y de interacción.

No crear una segunda implementación del mismo componente salvo razón concreta.

## React

Priorizar componentes:

* pequeños;
* predecibles;
* reutilizables cuando tenga sentido;
* con responsabilidades claras.

Evitar:

* estado duplicado;
* efectos innecesarios;
* lógica de negocio extensa en JSX;
* componentes excesivamente grandes;
* abstracciones prematuras.

Derivar valores en render cuando no sea necesario almacenarlos como estado.

## Next.js

Respetar las convenciones del router actualmente utilizado por el proyecto.

Antes de decidir entre server/client component revisar:

* necesidad de estado;
* event handlers;
* browser APIs;
* acceso seguro a variables de entorno;
* interacción con backend.

No añadir `"use client"` automáticamente a componentes que no lo necesitan.

## Backend communication

Centralizar y reutilizar las convenciones existentes para comunicarse con FastAPI.

No llamar directamente al backend desde el navegador cuando la arquitectura existente utilice Route Handlers para esa operación.

Mantener la separación:

Browser
→ Next.js
→ FastAPI

cuando ese sea el patrón existente.

## Environment variables

Nunca exponer al navegador variables o secretos destinados al servidor.

Usar `NEXT_PUBLIC_` únicamente para información explícitamente pública.

`BACKEND_URL` debe permanecer server-side.

## Authentication

Mantener el flujo de autenticación existente.

No:

* almacenar secretos de forma insegura;
* saltar Route Handlers sólo para simplificar una llamada;
* exponer tokens en logs;
* deshabilitar validaciones de autenticación para resolver errores.

Cuando exista un error de login, investigar la cadena completa:

Browser
→ Next.js Route Handler
→ FastAPI
→ respuesta

antes de modificar contratos.

## API errors

El frontend debe manejar explícitamente:

* errores de red;
* respuestas HTTP no exitosas;
* errores de validación;
* estados de carga;
* ausencia de datos cuando corresponda.

No ocultar errores reales mediante valores falsos o mocks permanentes.

Los mensajes visibles al usuario deben ser comprensibles y no exponer detalles internos.

## TypeScript

Evitar `any` salvo caso excepcional y justificado.

Preferir tipos derivados de contratos reales.

No duplicar interfaces incompatibles para representar el mismo objeto.

Cuando cambie una respuesta API revisar los tipos frontend relacionados.

## UI and design

El sistema visual debe mantenerse:

* limpio;
* profesional;
* consistente;
* enfocado en herramientas administrativas.

Priorizar:

* jerarquía visual;
* legibilidad;
* alineación;
* spacing consistente;
* estados claros;
* feedback al usuario.

Evitar introducir estilos aislados que contradigan el sistema visual existente.

## Forms

Los formularios deben contemplar:

* estado inicial;
* validación;
* loading;
* éxito;
* error;
* prevención razonable de envíos duplicados.

No depender únicamente de validación frontend cuando el backend también debe validar.

## Loading and asynchronous states

Toda acción asíncrona visible debe tener un estado comprensible.

Evitar:

* botones que aparentemente no hacen nada;
* múltiples submits simultáneos;
* cambios de pantalla antes de confirmar una operación.

## Accessibility

Mantener prácticas básicas:

* labels;
* elementos semánticos;
* navegación mediante teclado cuando corresponda;
* botones reales para acciones;
* texto alternativo en imágenes relevantes.

No reemplazar elementos interactivos semánticos por `div` únicamente por conveniencia visual.

## Responsive behavior

Las nuevas interfaces deben degradar razonablemente en resoluciones menores.

No diseñar únicamente para una resolución de escritorio específica salvo que la tarea lo indique expresamente.

## Testing

Cuando cambie comportamiento relevante:

* actualizar tests existentes;
* agregar tests si existe infraestructura apropiada.

Para bugs reproducibles:

1. identificar el comportamiento incorrecto;
2. agregar test cuando sea razonable;
3. corregirlo;
4. validar el resultado.

## Validation before completion

Según el cambio ejecutar:

* lint;
* TypeScript/typecheck;
* tests relevantes;
* build cuando el cambio pueda afectar compilación o routing.

Revisar warnings nuevos.

No declarar terminada una tarea con errores nuevos de build o typecheck relacionados con el cambio.

## Dependencies

No agregar paquetes npm salvo necesidad clara.

Antes de instalar uno revisar si:

* React;
* Next.js;
* APIs del navegador;
* utilidades ya existentes;

resuelven el problema.

Evitar dependencias grandes para problemas pequeños.

## Scope control

No rediseñar pantallas completas si la tarea sólo requiere una modificación localizada.

No modificar componentes compartidos sin comprobar el impacto sobre sus consumidores.

Si una mejora visual o arquitectónica queda fuera del alcance, mencionarla como observación.

## Completion report

Al terminar indicar:

* archivos frontend afectados;
* componentes o rutas modificados;
* comportamiento implementado;
* validaciones ejecutadas;
* resultado;
* dependencias con backend o configuraciones necesarias.

