import Library from "@/components/games/library";
import { getGames } from "@/lib/games";

export default async function Biblioteca() {
  const games = await getGames();
  return <Library games={games} />;
}
