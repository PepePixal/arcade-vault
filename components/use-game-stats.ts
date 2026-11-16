"use client";

import { useEffect, useState } from "react";
import { getGameStats, type GameStats } from "@/lib/scores";

const EMPTY_STATS: GameStats = { best: null, plays: 0 };

/**
 * Loads the saved-score stats of a game after mount.
 * Returns null while loading, so server HTML and first client render match.
 */
export function useGameStats(gameId: string): GameStats | null {
  // Keyed by game so a stale result is never shown for a different gameId.
  const [result, setResult] = useState<{ gameId: string; stats: GameStats } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getGameStats(gameId)
      .catch(() => EMPTY_STATS)
      .then((stats) => {
        if (!cancelled) setResult({ gameId, stats });
      });
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  return result?.gameId === gameId ? result.stats : null;
}
