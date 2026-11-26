import { notFound } from "next/navigation";
import { getGame } from "@/lib/games";
import FroggerPlayer from "../frogger-player";

const GAME_ID = "frogger";

export default async function FroggerPlayerPage() {
  const game = await getGame(GAME_ID);
  if (!game) notFound();

  return (
    <div className="av-player fade-in">
      <FroggerPlayer gameId={game.id} title={game.title} />
    </div>
  );
}
