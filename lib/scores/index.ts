// Public score API. Components depend only on these async functions, never on
// the storage backend, so the localStorage implementation can later be swapped
// for Supabase without touching callers.
import type { GameStats, GlobalRankingRow, NewScore, ScoreEntry } from "./types";

export type { GameStats, GlobalRankingRow, NewScore, ScoreEntry } from "./types";

const SCORES_KEY = "arcade-vault:scores:v1";
const PLAYER_NAME_KEY = "arcade-vault:player-name:v1";

export const NAME_MAX_LENGTH = 12;
export const DEFAULT_PLAYER_NAME = "INVITADO";

/** Uppercases, drops disallowed characters, caps length. Does not trim. */
export function sanitizeName(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9 -]/g, "")
    .slice(0, NAME_MAX_LENGTH);
}

/** Final form used for storage and player identity. */
export function normalizeName(raw: string): string {
  return sanitizeName(raw).trim();
}

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function isScoreEntry(value: unknown): value is ScoreEntry {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.gameId === "string" &&
    typeof v.name === "string" &&
    v.name.length > 0 &&
    typeof v.score === "number" &&
    Number.isFinite(v.score) &&
    v.score >= 0 &&
    typeof v.level === "number" &&
    Number.isFinite(v.level) &&
    typeof v.createdAt === "string"
  );
}

function readAll(): ScoreEntry[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(SCORES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isScoreEntry);
  } catch {
    return [];
  }
}

function writeAll(entries: ScoreEntry[]): void {
  const storage = getStorage();
  if (!storage) throw new Error("Score storage is unavailable");
  storage.setItem(SCORES_KEY, JSON.stringify(entries));
}

function byScoreDescThenOldest(a: ScoreEntry, b: ScoreEntry): number {
  if (b.score !== a.score) return b.score - a.score;
  return a.createdAt.localeCompare(b.createdAt);
}

export async function saveScore(entry: NewScore): Promise<ScoreEntry> {
  const name = normalizeName(entry.name);
  if (!name) throw new Error("Player name is required");

  const saved: ScoreEntry = {
    id: crypto.randomUUID(),
    gameId: entry.gameId,
    name,
    score: Math.max(0, Math.floor(entry.score)),
    level: Math.max(1, Math.floor(entry.level)),
    createdAt: new Date().toISOString(),
  };

  writeAll([...readAll(), saved]);
  return saved;
}

export async function getGameScores(gameId: string, limit = 10): Promise<ScoreEntry[]> {
  return readAll()
    .filter((e) => e.gameId === gameId)
    .sort(byScoreDescThenOldest)
    .slice(0, limit);
}

export async function getGameStats(gameId: string): Promise<GameStats> {
  const entries = readAll().filter((e) => e.gameId === gameId);
  if (entries.length === 0) return { best: null, plays: 0 };
  return {
    best: entries.reduce((max, e) => Math.max(max, e.score), 0),
    plays: entries.length,
  };
}

/**
 * Global ranking: per player (normalized name), the sum of their best score in
 * each game. Ties are broken by who reached that total first, i.e. the earliest
 * moment at which all of their per-game bests already existed.
 */
export async function getGlobalRanking(limit = 10): Promise<GlobalRankingRow[]> {
  // player -> gameId -> best entry
  const bests = new Map<string, Map<string, ScoreEntry>>();

  for (const entry of readAll()) {
    const name = normalizeName(entry.name);
    if (!name) continue;
    let perGame = bests.get(name);
    if (!perGame) {
      perGame = new Map();
      bests.set(name, perGame);
    }
    const current = perGame.get(entry.gameId);
    if (!current || byScoreDescThenOldest(entry, current) < 0) {
      perGame.set(entry.gameId, entry);
    }
  }

  const rows = [...bests.entries()].map(([name, perGame]) => {
    const entries = [...perGame.values()];
    return {
      name,
      total: entries.reduce((sum, e) => sum + e.score, 0),
      games: entries.length,
      reachedAt: entries.reduce((latest, e) => (e.createdAt > latest ? e.createdAt : latest), ""),
    };
  });

  rows.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.reachedAt.localeCompare(b.reachedAt);
  });

  return rows.slice(0, limit).map((r, i) => ({
    rank: i + 1,
    name: r.name,
    total: r.total,
    games: r.games,
  }));
}

export function getLastPlayerName(): string {
  const storage = getStorage();
  if (!storage) return DEFAULT_PLAYER_NAME;
  try {
    const stored = normalizeName(storage.getItem(PLAYER_NAME_KEY) ?? "");
    return stored || DEFAULT_PLAYER_NAME;
  } catch {
    return DEFAULT_PLAYER_NAME;
  }
}

export function setLastPlayerName(name: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(PLAYER_NAME_KEY, normalizeName(name));
  } catch {
    // Remembering the name is a convenience; ignore storage failures.
  }
}
