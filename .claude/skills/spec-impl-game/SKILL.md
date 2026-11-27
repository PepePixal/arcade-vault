---
name: spec-impl-game
description: "Trigger: /spec-impl-game. Implementa la spec aprobada de un juego nuevo siguiendo /spec-impl y después ejecuta, en secuencia, los agentes skin-designer y mobile-porter sobre ese juego."
disable-model-invocation: true
argument-hint: <NN-spec-name>
allowed-tools: Read, Glob, Grep, Edit, Write, AskUserQuestion, Agent, Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git log:*), Bash(git diff:*), Bash(git stash:*), Bash(cat:*), Bash(ls:*)
metadata:
  author: "arcade-vault"
  version: "1.0"
---

# /spec-impl-game — Implementar un juego nuevo + skins + móvil

## Contexto de sesión

Estado del repositorio:
!`git status --short`

Rama actual:
!`git branch --show-current`

Specs disponibles:
!`ls specs/ 2>/dev/null || echo "La carpeta specs/ no existe"`

Configuración de ramas:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (por defecto, sin archivo de config)"`

---

## Reglas duras

- Antes de nada, lee `.claude/skills/spec-impl/SKILL.md` y sigue sus **Fases 1–4 al pie de la letra** con el argumento `$ARGUMENTS`: localizar la spec, validar que su estado significa "Aprobado", crear/cambiar a la rama `spec-NN-slug`, mostrar el resumen e implementar paso a paso con pausa para revisar el diff.
- No intentes invocar `/spec-impl` con la herramienta Skill: tiene `disable-model-invocation: true`. Reutilízala leyendo su `SKILL.md`.
- **Excepción única** a `/spec-impl`: el mensaje final de su Fase 4 ("All steps of the plan are implemented…") no cierra esta skill. Al terminar el último paso continúa con la Fase 5.
- Si la Fase 2 bloquea (la spec no está aprobada), si la implementación se detiene o si el usuario la cancela, **no lances ningún agente**.
- Los agentes se ejecutan **en secuencia, nunca en paralelo**: primero `skin-designer`, esperas su reporte completo, y solo después `mobile-porter`. Nunca los lances en el mismo mensaje.
- Nunca hagas commits, ni tú ni los agentes. El commit es decisión del usuario.
- Respondes en el idioma del usuario. Código, identificadores y comentarios en inglés; textos de UI en español.

---

## Fase 5 — Determinar el juego

1. Obtén el `<id>` del juego implementado: la carpeta `app/juego/<id>/` creada o modificada en la Fase 4 y el `id` insertado en `public.games` por la migración de la spec. Ambos deben coincidir.
2. Si el `<id>` no es inequívoco (no hay carpeta nueva, hay varias o no coinciden), pregunta al usuario con `AskUserQuestion` y detente hasta tener la respuesta.
3. Muestra:

   ```
   ✅ Implementación de la spec terminada.

   Juego:  <id>
   Siguiente: skin-designer (skins clasico, neon y retro) y después mobile-porter (layout móvil).

   ¿Lanzo skin-designer sobre <id>?
   ```

4. Espera confirmación explícita antes de seguir.

---

## Fase 6 — Agentes en secuencia

### 6.1 skin-designer

Lanza el agente `skin-designer` con un prompt que incluya:

- El juego a implementar, explícito: `<id>` (el agente no edita nada si no se le nombra el juego y faltan varios).
- La spec de origen: `specs/NN-slug.md`.
- Que no haga commits y que ejecute `npm run lint`, `npx tsc --noEmit` y `npm run build`.

Cuando termine, resume su reporte al usuario: tabla de auditoría, archivos tocados, paletas con contraste y resultado real de lint/tsc/build.

- Si quedan fallos de verificación sin resolver o el agente se detuvo pidiendo una decisión, detente y pregunta al usuario antes de seguir. No lances `mobile-porter`.
- Si todo está bien, di: `Skins implementados en <id>. ¿Revisás el diff y sigo con mobile-porter?` y espera confirmación.

### 6.2 mobile-porter

Lanza el agente `mobile-porter` con un prompt que incluya:

- El mismo juego, explícito: `<id>`.
- Que el player ya tiene `SkinPicker` tras el paso anterior, así que debe pasar el mismo `skin` / `changeSkin` a `MobileGameControls`.
- Que no haga commits y que ejecute `npm run lint`, `npx tsc --noEmit` y `npm run build`.

Cuando termine, resume su reporte: tabla de auditoría, archivos tocados, `ACTION_A` elegido y por qué, y resultado real de lint/tsc/build.

- Si el agente reporta el motor como incompatible, transmítelo tal cual. No toques `engine.ts`: eso requiere una spec nueva.

---

## Contrato de salida

Al final entrega, de forma concisa:

```
✅ Juego <id> implementado, con skins y versión móvil.

Spec:   specs/NN-slug.md
Rama:   spec-NN-slug

Archivos por fase:
  - Implementación (spec): ...
  - skin-designer: ...
  - mobile-porter: ...

Verificación: lint / tsc / build → <resultado real>
```

Después:

1. Checklist manual de skins (del reporte de `skin-designer`).
2. Checklist manual móvil en viewport 390×844 (del reporte de `mobile-porter`).
3. Siguiente paso: verificar los criterios de aceptación de la spec uno a uno; si pasan, cambiar su estado a "Implementado", hacer el commit y abrir el PR a `main` (decisiones del usuario).
