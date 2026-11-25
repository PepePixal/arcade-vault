"use client";

import { SKIN_IDS, SKIN_LABELS, type SkinId } from "@/lib/skins";

interface SkinSelectProps {
  value: SkinId;
  onChange: (id: SkinId) => void;
}

/**
 * Native skin selector for the mobile HUD (same contract as SkinPicker).
 * The real <select> sits transparent over a pixel-font label: it keeps a 16px
 * font so iOS does not zoom on focus, while the label matches the platform.
 */
export default function SkinSelect({ value, onChange }: SkinSelectProps) {
  return (
    <label className="gp-skin">
      <span className="gp-skin-value" aria-hidden="true">
        {SKIN_LABELS[value]}
      </span>
      <select
        aria-label="Skin"
        value={value}
        onChange={(e) => {
          // Release focus so Space/Enter keep going to the game.
          e.currentTarget.blur();
          onChange(e.currentTarget.value as SkinId);
        }}
      >
        {SKIN_IDS.map((id) => (
          <option key={id} value={id}>
            {SKIN_LABELS[id]}
          </option>
        ))}
      </select>
    </label>
  );
}
