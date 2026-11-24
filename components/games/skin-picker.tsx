"use client";

import type { MouseEvent } from "react";
import { SKIN_IDS, SKIN_LABELS, type SkinId } from "@/lib/skins";

interface SkinPickerProps {
  value: SkinId;
  onChange: (id: SkinId) => void;
}

/** Three-way skin toggle for the player HUD. Reuses the `.chip` toggle style, with a green active state (`.skin-chip`). */
export default function SkinPicker({ value, onChange }: SkinPickerProps) {
  // Games are keyboard driven: never let a click move focus to the picker,
  // so Space/Enter keep going to the game instead of re-clicking a button.
  const keepFocus = (e: MouseEvent<HTMLButtonElement>) => e.preventDefault();

  return (
    <div role="group" aria-label="Skin" style={{ display: "flex", gap: 6 }}>
      {SKIN_IDS.map((id) => {
        const active = id === value;
        return (
          <button
            key={id}
            type="button"
            className={active ? "chip skin-chip active" : "chip skin-chip"}
            aria-pressed={active}
            onMouseDown={keepFocus}
            onClick={(e) => {
              e.currentTarget.blur();
              if (!active) onChange(id);
            }}
          >
            {SKIN_LABELS[id]}
          </button>
        );
      })}
    </div>
  );
}
