# SPEC 03 — Acerca de + Formulario de contacto

> **Status:** Completado
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-09-10
> **Objective:** Portar la pantalla "Acerca de" (misión, highlights, divisor animado) e implementar el formulario de contacto con envío real de correo vía Resend, desde `references/templates/home-about/about.jsx`.

## Scope

**In:**

- Nueva ruta `/acerca-de`: hero de misión, fila de 3 highlights, divisor animado, y sección de contacto con formulario.
- Formulario de contacto (nombre, correo, mensaje) con envío real de correo a través del servicio [Resend](https://resend.com) mediante un API route de Next.js (`app/api/contact/route.ts`).
- Validación de cliente: campos no vacíos (con animación "shake", igual que el template) + formato de correo electrónico válido antes de enviar.
- Tres estados del formulario: inicial, éxito (bloque `terminal-success`, igual que el template) y error (nuevo bloque terminal con estética de error, para fallos de red o de Resend).
- Animación "reveal on scroll" en la sección de contacto y el divisor, reutilizando las clases `.reveal`/`.in` y el mismo patrón de `IntersectionObserver` ya usado en Home (SPEC 02).
- Porte del CSS específico de "Acerca de" (`.about-*`, `.highlight*`, `.div-bar`, `.div-pixels`, `.contact-*`, `.terminal-success`, `.term-*`) desde `references/templates/home-about/styles.css` (líneas ~1071–1147) a `app/globals.css`.
- Nueva dependencia `resend` (SDK oficial) en `package.json`.
- Variables de entorno documentadas: `RESEND_API_KEY` (server-only) y `CONTACT_TO_EMAIL` (destino de los mensajes), vía `.env.local` (ya cubierto por `.gitignore`) y un archivo `.env.local.example` con los nombres de las variables sin valores reales.
- Actualización de `components/nav.tsx`: agregar link "Acerca de" (`/acerca-de`) en desktop y en el panel mobile.

**Out of scope (para specs futuras):**

- Verificación de dominio propio en Resend (se usa `onboarding@resend.dev` como remitente mientras tanto).
- Protección anti-spam (honeypot, captcha, rate limiting). Decisión explícita del usuario: queda fuera de este spec.
- Persistencia de los mensajes enviados (no se guardan en base de datos ni en ningún storage; solo se envían por correo).
- Plantillas de correo con diseño HTML avanzado (react-email, etc.); el correo se envía como texto plano/HTML simple con los datos del formulario.
- Cualquier cambio a las pantallas ya existentes (Home, Biblioteca, Detalle, Reproductor, Auth, Salón de la Fama) más allá de agregar el link en el Nav.

## Data model

Este spec no introduce entidades de datos persistentes (no hay base de datos ni mocks nuevos en `lib/data.ts`). Se define únicamente el contrato del API route:

```ts
// app/api/contact/route.ts — contrato

// Request body (JSON)
interface ContactRequestBody {
  name: string;
  email: string;
  message: string;
}

// Response (JSON)
type ContactResponse =
  | { ok: true }
  | { ok: false; error: string };
```

El endpoint valida en el servidor que `name`, `email` y `message` no estén vacíos y que `email` tenga formato válido, antes de llamar a Resend. Si la validación falla o Resend devuelve error, responde `{ ok: false, error }` con status `400` o `500` según corresponda.

## Implementation plan

1. Agregar la dependencia `resend` a `package.json` (`npm install resend`).
2. Crear `.env.local.example` con `RESEND_API_KEY=` y `CONTACT_TO_EMAIL=` (sin valores), y documentar en un comentario que `.env.local` real no se commitea.
3. Crear `app/api/contact/route.ts`: handler `POST` que valida `name`/`email`/`message`, instancia el cliente de Resend con `process.env.RESEND_API_KEY`, envía el correo (remitente `onboarding@resend.dev`, destino `process.env.CONTACT_TO_EMAIL`, asunto tipo "Nuevo mensaje de contacto — Arcade Vault", cuerpo con nombre/correo/mensaje) y devuelve `{ ok: true }` o `{ ok: false, error }`.
4. Portar a `app/globals.css` las clases de "Acerca de" listadas en Scope, desde `references/templates/home-about/styles.css` (sección `/* ===== ABOUT PAGE ===== */`), incluyendo el estado de error del bloque terminal (nueva variante en rojo/magenta reutilizando la estructura de `.terminal-success`, ya que el template no la define).
5. Crear `app/acerca-de/page.tsx` (client component) portando `about.jsx`: hero de misión, highlights, divisor, formulario de contacto con `useState` para `form`, `status` (`idle | sending | sent | error`) y `shake`.
6. Implementar `onSubmit`: valida campos vacíos y formato de email (shake si falla), si es válido hace `fetch('/api/contact', { method: 'POST', body: JSON.stringify(form) })`, muestra estado `sending` mientras espera, y según la respuesta pasa a `sent` (bloque terminal éxito, igual al template) o `error` (bloque terminal error, con botón para reintentar).
7. Aplicar animación reveal-on-scroll (mismo `IntersectionObserver`, mismo umbral `0.12`) a la sección de contacto y el divisor.
8. Actualizar `components/nav.tsx`: agregar link "Acerca de" (`/acerca-de`) en `links` (desktop) y en el panel mobile; actualizar `isActive` para incluir `"acerca"`.
9. Verificación final: `npm run dev`, recorrido manual por `/acerca-de` (envío exitoso si hay `RESEND_API_KEY` configurada, y estado de error si no la hay o si Resend falla), verificar que el link "Acerca de" del Nav funciona en desktop y mobile, `npm run lint`, `npx tsc --noEmit`.

## Acceptance criteria

- [ ] `/acerca-de` muestra el hero de misión, los 3 highlights, el divisor animado y la sección de contacto.
- [ ] El formulario no envía si `name`, `email` o `message` están vacíos, y dispara la animación `shake`.
- [ ] El formulario no envía si `email` tiene formato inválido (ej. "abc"), y dispara la animación `shake`.
- [ ] Al enviar un formulario válido con `RESEND_API_KEY` configurada correctamente, se muestra el bloque `terminal-success` con el nombre del remitente, y llega un correo real a `CONTACT_TO_EMAIL`.
- [ ] Si `POST /api/contact` responde error (sin `RESEND_API_KEY`, o falla de Resend), se muestra el bloque terminal de error con opción de reintentar, sin romper la página.
- [ ] La sección de contacto y el divisor aparecen con animación reveal al hacer scroll.
- [ ] El Nav muestra el link "Acerca de" apuntando a `/acerca-de`, marcado activo en esa ruta, en desktop y en el panel mobile.
- [ ] `.env.local.example` existe con `RESEND_API_KEY` y `CONTACT_TO_EMAIL` documentadas, y `.env.local` real no queda trackeado por git.
- [ ] `npm run lint` pasa sin errores.
- [ ] `npx tsc --noEmit` pasa sin errores.

## Decisions

- **Sí:** ruta `/acerca-de`, consistente con las rutas en español ya existentes (`/salon-de-la-fama`, `/juego`). Decisión del usuario.
- **No:** ruta `/about`. Se descartó por consistencia de idioma con el resto del sitio.
- **Sí:** remitente `onboarding@resend.dev` (dominio de pruebas de Resend). El usuario no tiene un dominio propio verificado todavía; permite implementar y probar el flujo real de envío sin bloquear el spec por configuración de DNS.
- **Sí:** destino de los correos `pepepixal@gmail.com`, vía variable de entorno `CONTACT_TO_EMAIL` (no hardcodeado en el código, para poder cambiarlo sin tocar código).
- **Sí:** agregar "Acerca de" al Nav en este mismo spec. SPEC 02 dejó explícitamente el link fuera "hasta que exista la página"; ahora existe.
- **Sí:** validación de formato de email en el cliente (además de campos no vacíos, que es lo único que hacía el template original). Mejora mínima y de bajo costo que evita envíos con correos claramente inválidos.
- **No:** protección anti-spam (honeypot, captcha, rate limiting). Decisión explícita del usuario para mantener el spec acotado; se puede agregar en un spec futuro si se detecta abuso real.
- **Sí:** estado de error explícito con bloque terminal (mismo lenguaje visual que el éxito, pero en rojo/magenta). El template no lo contemplaba porque no tenía backend real; como ahora sí hay una llamada de red que puede fallar, el usuario necesita feedback visual coherente con el resto de la UI.
- **No:** persistir los mensajes en base de datos. Fuera de alcance; el requerimiento es solo el envío por correo.
- **Sí:** `RESEND_API_KEY` y `CONTACT_TO_EMAIL` vía variables de entorno en `.env.local` (ya cubierto por `.gitignore` existente), con `.env.local.example` como documentación de qué variables se necesitan. El usuario todavía no generó la API key; el spec no bloquea por eso, pero el estado de error queda como comportamiento esperado hasta que la cargue.

## Identified risks

- Sin `RESEND_API_KEY` configurada, todo envío fallará y mostrará el estado de error. Es el comportamiento esperado hasta que el usuario genere su API key en resend.com y la cargue en `.env.local`; no bloquea el resto de la implementación ni la verificación de UI.
- El remitente de pruebas `onboarding@resend.dev` tiene límites de uso y de destinatarios en la cuenta gratuita de Resend (según su política vigente). Si se supera, los envíos fallarán mostrando el estado de error; migrar a un dominio propio verificado se deja para un spec futuro.
- Al no haber anti-spam, el endpoint puede recibir envíos automatizados si la URL se descubre. Riesgo aceptado explícitamente por el usuario para este spec.
