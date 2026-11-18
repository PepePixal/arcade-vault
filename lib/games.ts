// Game catalog, read from the `games` table. Server only: it uses the cookie-based
// Supabase server client, so import it from server components and never from
// client components.
import type { Game, GameCategory } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

const GAME_COLUMNS = "id, title, short_description, long_description, category, cover, color";

const CATEGORIES: readonly string[] = ["ARCADE", "PUZZLE", "SHOOTER", "VERSUS"];
const COLORS: readonly string[] = ["cyan", "magenta", "green", "yellow"];

// The table has check constraints for these two columns, but the generated types
// expose them as plain strings, so each value is narrowed here.
function isCategory(value: string): value is GameCategory {
  return CATEGORIES.includes(value);
}

function isColor(value: string): value is Game["color"] {
  return COLORS.includes(value);
}

interface GameRow {
  id: string;
  title: string;
  short_description: string;
  long_description: string;
  category: string;
  cover: string;
  color: string;
}

/** Maps a `games` row to a Game, or null when category or color is out of range. */
function toGame(row: GameRow): Game | null {
  if (!isCategory(row.category) || !isColor(row.color)) return null;
  return {
    id: row.id,
    title: row.title,
    short: row.short_description,
    long: row.long_description,
    cat: row.category,
    cover: row.cover,
    color: row.color,
  };
}

/** All games, oldest first. Throws when Supabase fails. */
export async function getGames(): Promise<Game[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select(GAME_COLUMNS)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;

  return data.flatMap((row) => {
    const game = toGame(row);
    return game ? [game] : [];
  });
}

/** One game by id, or null when it does not exist. Throws when Supabase fails. */
export async function getGame(id: string): Promise<Game | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select(GAME_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;

  return data ? toGame(data) : null;
}
