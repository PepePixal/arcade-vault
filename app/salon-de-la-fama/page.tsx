import Link from "next/link";
import HallOfFame from "@/components/hall-of-fame";
import { GAMES } from "@/lib/data";

export default function HallOfFamePage() {
  const games = GAMES.map((g) => ({ id: g.id, title: g.title }));

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <HallOfFame games={games} />

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/juego" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
