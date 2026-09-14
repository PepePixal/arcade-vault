# SPEC 04 — Integración de Supabase en el proyecto

> **Status:** Aprobada
> **Depends on:** SPEC 01
> **Date:** 2026-09-14
> **Objective:** Conectar el proyecto Next.js a Supabase (SDK, clientes browser/server/middleware y variables de entorno) sin implementar ninguna feature concreta todavía.

## Scope

**In:**

- Dependencias `@supabase/supabase-js` y `@supabase/ssr` en `package.json`.
- Cliente de Supabase para uso en el navegador: `lib/supabase/client.ts` (`createBrowserClient`).
- Cliente de Supabase para Server Components y Route Handlers: `lib/supabase/server.ts` (`createServerClient` con manejo de cookies vía `next/headers`).
- Helper de refresco de sesión para middleware: `lib/supabase/middleware.ts` (`updateSession`), y `middleware.ts` en la raíz del proyecto que lo invoca sobre todas las rutas salvo assets estáticos.
- Variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`, agregadas a `.env.local.example` (sin valores) y a `.env.local` real (valores obtenidos del proyecto Supabase ya vinculado vía MCP, `project_ref=ddewgknmocwxditcnnpj`).
- Página temporal de verificación (`app/supabase-check/page.tsx`, server component) que ejecuta una llamada real contra Supabase (`supabase.auth.getSession()`) y muestra en pantalla si la conexión respondió correctamente o con error.

**Out of scope (para specs futuras):**

- Autenticación real en `/auth` (login, registro, logout, estado de sesión en el Nav).
- Cualquier tabla en la base de datos (`profiles`, `scores`, `games`, etc.) y sus políticas RLS.
- Persistencia real de puntuaciones (reemplazo de `seededScores`).
- Supabase Realtime.
- Supabase Edge Functions.
- Supabase Storage.
- Eliminar o modificar `app/supabase-check/page.tsx` — queda como está hasta que un spec futuro decida su destino (borrarla o convertirla en algo útil).

## Data model

Este spec no introduce entidades de datos ni tablas en Supabase (no hay `CREATE TABLE`). Solo se define la forma de los clientes SDK:

```ts
// lib/supabase/client.ts
export function createClient(): SupabaseClient; // createBrowserClient, para Client Components

// lib/supabase/server.ts
export async function createClient(): Promise<SupabaseClient>; // createServerClient, para Server Components y Route Handlers, usando cookies() de next/headers

// lib/supabase/middleware.ts
export async function updateSession(request: NextRequest): Promise<NextResponse>; // refresca el token de sesión y sincroniza cookies
```

## Implementation plan

1. Agregar las dependencias `@supabase/supabase-js` y `@supabase/ssr` a `package.json` (`npm install @supabase/supabase-js @supabase/ssr`).
2. Obtener la URL del proyecto y la publishable/anon key vía las herramientas MCP de Supabase (`get_project_url`, `get_publishable_keys`) y agregarlas a `.env.local` real como `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Documentar ambas (sin valores) en `.env.local.example`.
3. Crear `lib/supabase/client.ts`: cliente de navegador con `createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)`.
4. Crear `lib/supabase/server.ts`: cliente de servidor con `createServerClient`, usando `cookies()` de `next/headers` para `getAll`/`setAll`, envuelto en un `try/catch` vacío en `setAll` (patrón oficial de Supabase para Server Components, donde escribir cookies puede fallar y se delega al middleware).
5. Crear `lib/supabase/middleware.ts`: función `updateSession(request)` que crea un cliente de servidor con las cookies de la request, llama a `supabase.auth.getUser()` para refrescar el token, y devuelve la `NextResponse` con las cookies actualizadas.
6. Crear `middleware.ts` en la raíz del proyecto: invoca `updateSession` y define el `matcher` para excluir `_next/static`, `_next/image`, y archivos de `public/` (íconos, imágenes).
7. Crear `app/supabase-check/page.tsx` (server component): instancia el cliente de servidor, llama a `supabase.auth.getSession()`, y renderiza un bloque de texto simple indicando "Conexión con Supabase: OK" o el mensaje de error si la llamada falla.
8. Verificación final: `npm run dev`, visitar `/supabase-check` y confirmar que muestra el estado de conexión sin error, `npm run lint`, `npx tsc --noEmit`.

## Acceptance criteria

- [ ] `@supabase/supabase-js` y `@supabase/ssr` están en `package.json` y `node_modules`.
- [ ] `lib/supabase/client.ts`, `lib/supabase/server.ts` y `lib/supabase/middleware.ts` existen con las firmas descritas en Data model.
- [ ] `middleware.ts` en la raíz invoca `updateSession` y excluye assets estáticos vía `matcher`.
- [ ] `.env.local.example` documenta `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` sin valores reales.
- [ ] `.env.local` real contiene los valores reales de esas dos variables, y no queda trackeado por git.
- [ ] `/supabase-check` carga sin errores en consola y muestra "Conexión con Supabase: OK" (usando el proyecto ya vinculado vía MCP).
- [ ] `npm run lint` pasa sin errores.
- [ ] `npx tsc --noEmit` pasa sin errores.

## Decisions

- **Sí:** instalar `@supabase/ssr` junto con `@supabase/supabase-js` desde este spec, aunque todavía no haya Auth real. Decisión del usuario: evita rehacer los clientes cuando llegue el spec de Auth, porque `@supabase/ssr` es el patrón oficial de Supabase para App Router (cookies compartidas entre servidor, cliente y middleware).
- **Sí:** middleware de refresco de sesión (`updateSession`) desde este spec, aunque no haya sesiones reales todavía. Es parte del boilerplate estándar de `@supabase/ssr` y no depende de que exista Auth funcional — sin él, la sesión no se refresca automáticamente cuando se implemente Auth.
- **Sí:** página temporal `app/supabase-check/page.tsx` para verificar la integración con una llamada real, en vez de confiar solo en las herramientas MCP. Decisión del usuario: MCP prueba que el proyecto existe, pero no prueba que el SDK del lado de la app esté bien configurado (env vars correctas, cliente bien instanciado).
- **No:** ninguna tabla, RLS, ni lógica de Auth en este spec. Decisión explícita del usuario: cada función (Auth, persistencia de scores, etc.) se define en su propio spec futuro, una vez que la integración base esté verificada.
- **No:** Realtime ni Edge Functions en este spec. El usuario los planea para el futuro, pero no forman parte de la integración base.
- **Sí:** variables de entorno con prefijo `NEXT_PUBLIC_` para URL y anon key, consistente con el patrón ya usado en SPEC 03 (`RESEND_API_KEY`, `CONTACT_TO_EMAIL` vía `.env.local`) y con el hecho de que la anon key es segura de exponer en el cliente por diseño de Supabase (protegida por RLS, no por secreto).

## Identified risks

- La página `/supabase-check` queda accesible públicamente sin protección ni valor de producto una vez verificada la integración. Riesgo aceptado para este spec; un spec futuro debe decidir si se borra o se reutiliza.
- Si las políticas RLS del proyecto Supabase no están configuradas todavía (no hay tablas creadas), `auth.getSession()` igual debería responder sin error (sesión `null`), por lo que no bloquea la verificación de este spec.
