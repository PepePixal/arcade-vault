// Public score API, backed by Supabase. Components depend only on these async
// functions, never on the storage backend. Only the last used player name stays
// in localStorage, as a browser-local preference.
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type { GameStats, GlobalRankingRow, NewScore, ScoreEntry } from "./types";

export type { GameStats, GlobalRankingRow, NewScore, ScoreEntry } from "./types";

// gameId -> score table. A game without an entry has no saved scores (mock games).
// Adding a game also means extending the `global_scores` view with its table.
const SCORE_TABLES = {
  asteroides: "scores_asteroides",
} as const satisfies Record<string, keyof Database["public"]["Tables"]>;

type ScoreGameId = keyof typeof SCORE_TABLES;
type ScoreTable = (typeof SCORE_TABLES)[ScoreGameId];

function getScoreTable(gameId: string): ScoreTable | null {
  return Object.prototype.hasOwnProperty.call(SCORE_TABLES, gameId)
    ? SCORE_TABLES[gameId as ScoreGameId]
    : null;
}

// Shared shape of a row from a score table (non-null) and from `global_scores`
// (every column nullable in the generated types).
interface ScoreRow {
  id: string | null;
  name: string | null;
  score: number | null;
  level: number | null;
  created_at: string | null;
}

/** Maps a database row to a ScoreEntry, or null when the row is incomplete. */
function toScoreEntry(gameId: string | null, row: ScoreRow): ScoreEntry | null {
  if (
    gameId === null ||
    row.id === null ||
    row.name === null ||
    row.score === null ||
    row.level === null ||
    row.created_at === null
  ) {
    return null;
  }
  return {
    id: row.id,
    gameId,
    name: row.name,
    score: row.score,
    level: row.level,
    createdAt: row.created_at,
  };
}

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

function byScoreDescThenOldest(a: ScoreEntry, b: ScoreEntry): number {
  if (b.score !== a.score) return b.score - a.score;
  return a.createdAt.localeCompare(b.createdAt);
}

export async function saveScore(entry: NewScore): Promise<ScoreEntry> {
  const name = normalizeName(entry.name);
  if (!name) throw new Error("Player name is required");

  const table = getScoreTable(entry.gameId);
  if (!table) throw new Error(`No score table for game "${entry.gameId}"`);

  const { data, error } = await createClient()
    .from(table)
    .insert({
      name,
      score: Math.max(0, Math.floor(entry.score)),
      level: Math.max(1, Math.floor(entry.level)),
    })
    .select()
    .single();
  if (error) throw error;

  const saved = toScoreEntry(entry.gameId, data);
  if (!saved) throw new Error("Saved score came back incomplete");
  return saved;
}

export async function getGameScores(gameId: string, limit = 10): Promise<ScoreEntry[]> {
  const table = getScoreTable(gameId);
  if (!table) return [];

  const { data, error } = await createClient()
    .from(table)
    .select("id, name, score, level, created_at")
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;

  return data.flatMap((row) => {
    const entry = toScoreEntry(gameId, row);
    return entry ? [entry] : [];
  });
}

export async function getGameStats(gameId: string): Promise<GameStats> {
  const table = getScoreTable(gameId);
  if (!table) return { best: null, plays: 0 };

  const supabase = createClient();
  const [count, top] = await Promise.all([
    supabase.from(table).select("id", { count: "exact", head: true }),
    supabase.from(table).select("score").order("score", { ascending: false }).limit(1),
  ]);
  if (count.error) throw count.error;
  if (top.error) throw top.error;

  const plays = count.count ?? 0;
  if (plays === 0) return { best: null, plays: 0 };
  return { best: top.data[0]?.score ?? null, plays };
}

/**
 * Ranks players over the given entries: per player (normalized name), the sum of
 * their best score in each game. Ties are broken by who reached that total
 * first, i.e. the earliest moment at which all of their per-game bests already
 * existed. Shared by the global and the daily ranking so the rule lives once.
 */
function rankPlayers(entries: ScoreEntry[], limit: number): GlobalRankingRow[] {
  // player -> gameId -> best entry
  const bests = new Map<string, Map<string, ScoreEntry>>();

  for (const entry of entries) {
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

// PostgREST caps a single response (1000 rows by default), so rankings read the
// view page by page to really rank every saved score.
const RANKING_PAGE_SIZE = 1000;

/** Every saved score across all games, optionally only those created since a date. */
async function fetchAllScores(since?: Date): Promise<ScoreEntry[]> {
  const supabase = createClient();
  const entries: ScoreEntry[] = [];

  for (let from = 0; ; from += RANKING_PAGE_SIZE) {
    let query = supabase
      .from("global_scores")
      .select("game_id, id, name, score, level, created_at");
    if (since) query = query.gte("created_at", since.toISOString());

    const { data, error } = await query
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + RANKING_PAGE_SIZE - 1);
    if (error) throw error;

    for (const row of data) {
      const entry = toScoreEntry(row.game_id, row);
      if (entry) entries.push(entry);
    }
    if (data.length < RANKING_PAGE_SIZE) return entries;
  }
}

export async function getGlobalRanking(limit = 10): Promise<GlobalRankingRow[]> {
  return rankPlayers(await fetchAllScores(), limit);
}

/** Same ranking rule as the global one, over entries saved since 00:00 local time today. */
export async function getTodayRanking(limit = 5): Promise<GlobalRankingRow[]> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return rankPlayers(await fetchAllScores(startOfToday), limit);
}

/** Latest saved scores across all games, newest first. */
export async function getRecentScores(limit = 7): Promise<ScoreEntry[]> {
  const { data, error } = await createClient()
    .from("global_scores")
    .select("game_id, id, name, score, level, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return data.flatMap((row) => {
    const entry = toScoreEntry(row.game_id, row);
    return entry ? [entry] : [];
  });
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
