/**
 * Shared skin identifiers and per-game skin persistence.
 *
 * Every game offers the same three skins; each game defines its own palettes
 * in `app/juego/<id>/skins.ts`. Only the last chosen skin per game is stored,
 * in `localStorage`, following the same pattern as the last player name.
 */

export type SkinId = "clasico" | "neon" | "retro";

/** Display order; `clasico` first because it is the default. */
export const SKIN_IDS: readonly SkinId[] = ["clasico", "neon", "retro"];

export const SKIN_LABELS: Record<SkinId, string> = {
  clasico: "Clásico",
  neon: "Neón",
  retro: "Retro",
};

const DEFAULT_SKIN: SkinId = "clasico";
const SKIN_KEY_PREFIX = "arcade-vault:skin:";

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function isSkinId(value: unknown): value is SkinId {
  return typeof value === "string" && (SKIN_IDS as readonly string[]).includes(value);
}

export function getLastSkin(gameId: string): SkinId {
  const storage = getStorage();
  if (!storage) return DEFAULT_SKIN;
  try {
    const stored = storage.getItem(SKIN_KEY_PREFIX + gameId);
    return isSkinId(stored) ? stored : DEFAULT_SKIN;
  } catch {
    return DEFAULT_SKIN;
  }
}

export function setLastSkin(gameId: string, id: SkinId): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(SKIN_KEY_PREFIX + gameId, id);
  } catch {
    // Remembering the skin is a convenience; ignore storage failures.
  }
}
