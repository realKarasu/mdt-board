import type { DungeonSummary, Route } from "../types";
import { getDungeon } from "../lib/dungeons";

type Props = {
  dungeons: DungeonSummary[];
  saved: Route[];
  onNew: (dungeonIdx: number) => void;
  onOpen: (route: Route) => void;
  onDelete: (id: string) => void;
  onImport: () => void;
  onSample: () => void;
};

export function Picker({ dungeons, saved, onNew, onOpen, onDelete, onImport, onSample }: Props) {
  return (
    <div className="picker">
      <header>
        <p className="kicker">Midnight Saison 2 · 12.1</p>
        <h1>MDT Board</h1>
        <p className="lede">
          Viewer / éditeur de routes Mythic+ pour second écran. Importe une chaîne MDT ou construis tes pulls, puis
          passe en board plein écran pendant la key.
        </p>
        <div className="actions" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button type="button" className="btn primary" onClick={onImport}>
            Coller une chaîne MDT
          </button>
          <button type="button" className="btn" onClick={onSample}>
            Exemple Autel des Crocs
          </button>
        </div>
      </header>

      <section>
        <h2>Pool live</h2>
        <div className="dungeon-grid">
          {dungeons.map((d) => (
            <button key={d.dungeonIndex} type="button" className="dungeon-card" onClick={() => onNew(d.dungeonIndex)}>
              <img src={d.maps[d.floors[0]]} alt="" />
              <div>
                <strong>{d.nameFr}</strong>
                <span>
                  {d.totalCount} forces · {d.cloneCount} PNJ · idx {d.dungeonIndex}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>Routes sauvées</h2>
        {saved.length === 0 ? (
          <p className="mute">Aucune route en local pour l'instant.</p>
        ) : (
          <ul className="saved">
            {saved.map((r) => {
              const dungeon = getDungeon(r.dungeonIdx);
              return (
                <li key={r.id}>
                  <button type="button" onClick={() => onOpen(r)}>
                    <strong>{r.name}</strong>
                    <span>
                      {dungeon?.nameFr ?? `Donjon ${r.dungeonIdx}`} · {r.pulls.length} pulls
                    </span>
                  </button>
                  <button type="button" className="danger" onClick={() => onDelete(r.id)}>
                    Supprimer
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
