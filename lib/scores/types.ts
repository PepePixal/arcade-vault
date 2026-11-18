export interface ScoreEntry {
  id: string; // crypto.randomUUID()
  gameId: string; // games.id, e.g. "asteroides"
  name: string; // 1–12 characters, uppercase, already normalized
  score: number; // integer >= 0
  level: number; // level reached
  createdAt: string; // ISO 8601
}

export interface GlobalRankingRow {
  rank: number;
  name: string;
  total: number; // sum of the best score per game
  games: number; // number of games with at least one score
}

export interface GameStats {
  best: number | null; // best saved score, null when there is none
  plays: number; // number of saved games (0 when there are none)
}

export type NewScore = Omit<ScoreEntry, "id" | "createdAt">;
