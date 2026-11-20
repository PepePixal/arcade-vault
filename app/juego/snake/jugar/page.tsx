import { notFound } from "next/navigation";
import { getGame } from "@/lib/games";
import SnakePlayer from "../snake-player";

const GAME_ID = "snake";

export default async function SnakePlayerPage() {
  const game = await getGame(GAME_ID);
  if (!game) notFound();

  return (
    <div className="av-player fade-in">
      <SnakePlayer gameId={game.id} title={game.title} />
    </div>
  );
}
