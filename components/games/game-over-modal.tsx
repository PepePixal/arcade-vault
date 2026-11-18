"use client";

import { useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { NAME_MAX_LENGTH, getLastPlayerName, normalizeName, sanitizeName } from "@/lib/scores";

type SaveState = "idle" | "saving" | "saved" | "error";

interface GameOverModalProps {
  score: number;
  /** Persists the score under the given (already normalized) name. */
  onSave: (name: string) => Promise<void>;
  onRestart: () => void;
  onExit: () => void;
}

export default function GameOverModal({ score, onSave, onRestart, onExit }: GameOverModalProps) {
  const titleId = useId();
  // The modal mounts fresh on every game over, so this resets per game.
  const [name, setName] = useState(() => getLastPlayerName());
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const normalized = normalizeName(name);
  const locked = saveState === "saving" || saveState === "saved";
  const canSave = normalized.length > 0 && !locked;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSave) return;
    setSaveState("saving");
    try {
      await onSave(normalized);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  // Keep keystrokes inside the dialog: the game page listens on window to block
  // page scroll with Space/arrows, which would otherwise swallow typed spaces.
  const stopKeys = (e: KeyboardEvent<HTMLDivElement>) => e.stopPropagation();

  return (
    <div className="modal-bd">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={stopKeys}
        onKeyUp={stopKeys}
      >
        <h2 id={titleId}>FIN DEL JUEGO</h2>
        <div className="final-label">PUNTUACIÓN FINAL</div>
        <div className="final">{score.toLocaleString("es-ES")}</div>

        <form className="input-row" onSubmit={handleSubmit}>
          <input
            value={name}
            onChange={(e) => setName(sanitizeName(e.target.value))}
            maxLength={NAME_MAX_LENGTH}
            disabled={locked}
            aria-label="Nombre del jugador"
            placeholder="TU NOMBRE"
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
          <button type="submit" className="btn yellow" disabled={!canSave}>
            {saveState === "saving" ? "GUARDANDO…" : "GUARDAR PUNTUACIÓN"}
          </button>
        </form>

        <div aria-live="polite">
          {saveState === "saved" && <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>}
          {saveState === "error" && (
            <p className="save-error">
              No se pudo guardar la puntuación. Comprueba tu conexión e inténtalo de nuevo.
            </p>
          )}
        </div>

        <div className="actions">
          <button type="button" className="btn" onClick={onRestart}>
            JUGAR DE NUEVO
          </button>
          <button type="button" className="btn magenta" onClick={onExit}>
            VOLVER AL VAULT
          </button>
        </div>
      </div>
    </div>
  );
}
