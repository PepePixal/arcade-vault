---
name: add-game
description: "Trigger: añadir juego, nuevo juego, integrar juego, started-games, /add-game. Genera SOLO la spec para integrar un juego nuevo en Arcade Vault, venga o no de references/started-games/."
license: Apache-2.0
disable-model-invocation: true
argument-hint: 'nombre del juego o carpeta en references/started-games/'
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*)
metadata:
  author: "arcade-vault"
  version: "1.1"
---

## Contrato de activación

Úsala cuando el usuario quiera añadir un juego a Arcade Vault. El resultado es un único archivo de spec en `specs/`. Nunca código.

Contexto (se lee, nunca se adivina):
- Fecha: !`date +%F`
- Specs existentes: !`ls specs/ 2>/dev/null || echo "aún no hay specs"`
- Juegos de partida: !`ls references/started-games/ 2>/dev/null || echo "ninguno"`

## Reglas duras

- Antes de nada, lee `.claude/skills/spec/SKILL.md` y `.claude/skills/spec/template.md`. Sigue sus fases, el orden de secciones, la numeración `NN-slug.md`, el estado `Borrador`, el manejo de la fecha y la siembra de `specs/.spec-config.yml`.
- Escribe solo `specs/NN-slug.md`. Nada de código, migraciones ni propuestas de implementación después.
- La spec se escribe en español, igual que las specs 01–13. Responde en el idioma del usuario.
- Nunca asumas decisiones que el usuario no confirmó. Pregunta en bloques de 3–5 con `AskUserQuestion`, recomendación primero.
- Si el juego abarca varios dominios, propón dividirlo en varias specs.
- Cada `Depends on: SPEC NN` debe existir en `specs/`.

## Puertas de decisión

| Situación | Acción |
|-----------|--------|
| `$ARGUMENTS` coincide con una carpeta de `started-games/` | Lee su README, `index.html`, JS y CSS; extrae controles, puntuación, vidas, niveles y assets |
| La carpeta es un placeholder (p. ej. README dice "no implementado") o no hay coincidencia | Trátalo como juego desde cero; pregunta reglas, controles y puntuación |
| La integración existente sigue siendo por juego | La spec sigue el patrón de Asteroides; pregunta solo si un reproductor genérico es una bifurcación real |
| El juego no tiene vidas o niveles | Pregunta cómo se adapta el HUD de la plataforma; `scores.level` debe ser `>= 1` |

## Pasos de ejecución

1. Lee `CLAUDE.md` y `AGENTS.md` (Next.js 16: consulta `node_modules/next/dist/docs/`).
2. Lee `references/integration-blueprint.md`, luego las specs que lista y el código de integración actual al que apunta.
3. Resuelve el origen del juego según la tabla de decisión.
4. Haz las preguntas de aclaración (identidad, mapeo al HUD, controles, assets, alcance) hasta conocer archivos, primer y último paso, y verificación.
5. Escribe la spec con el blueprint adaptado al juego: criterios de aceptación booleanos, decisiones (tomadas y descartadas) y riesgos.
6. Guárdala como `Borrador` y detente.

## Contrato de salida

Informa: ruta de la spec creada, que está en `Borrador`, y el siguiente paso (`/spec-impl NN-slug` tras revisarla). Nada más.

## Referencias

- `references/integration-blueprint.md` — qué toca la integración de un juego, esquema actual y riesgos conocidos.
