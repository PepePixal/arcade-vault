import { notFound } from "next/navigation";
import { getGame } from "@/lib/games";
import TetrisPlayer from "../tetris-player";

const GAME_ID = "tetris";

export default async function TetrisPlayerPage() {
  const game = await getGame(GAME_ID);
  if (!game) notFound();

  return (
    <div className="av-player fade-in">
      <TetrisPlayer gameId={game.id} title={game.title} />
    </div>
  );
}
