"use client";

import type { MouseEvent } from "react";
import SkinSelect from "@/components/games/skin-select";
import VirtualGamepad, { type VirtualKey } from "@/components/games/virtual-gamepad";
import type { SkinId } from "@/lib/skins";

interface MobileGameControlsProps {
  actionA: VirtualKey | null;
  skin: SkinId;
  onSkinChange: (id: SkinId) => void;
  isPaused: boolean;
  isGameOver: boolean;
  onTogglePause: () => void;
  onEnd: () => void;
}

// Keep focus off the HUD buttons so Space/Enter never re-click them.
const keepFocus = (e: MouseEvent<HTMLButtonElement>) => e.preventDefault();

/** Mobile controls below the canvas: virtual gamepad plus the Skin · PAUSA · FIN row. */
export default function MobileGameControls({
  actionA,
  skin,
  onSkinChange,
  isPaused,
  isGameOver,
  onTogglePause,
  onEnd,
}: MobileGameControlsProps) {
  return (
    <div className="md:hidden">
      <div className="gp-mobile">
        <VirtualGamepad actionA={actionA} />
        <div className="gp-hud">
          <SkinSelect value={skin} onChange={onSkinChange} />
          <button
            type="button"
            className="btn yellow"
            onMouseDown={keepFocus}
            onClick={(e) => {
              e.currentTarget.blur();
              onTogglePause();
            }}
            disabled={isGameOver}
            aria-pressed={isPaused}
          >
            {isPaused ? "REANUDAR" : "PAUSA"}
          </button>
          <button
            type="button"
            className="btn magenta"
            onMouseDown={keepFocus}
            onClick={(e) => {
              e.currentTarget.blur();
              onEnd();
            }}
            disabled={isGameOver}
          >
            FIN
          </button>
        </div>
      </div>
    </div>
  );
}
