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
        <p className="kicker">Midnight Season 2 · 12.1</p>
        <h1>MDT Board</h1>
        <p className="lede">
          Local-first Mythic+ route viewer and editor for a second monitor. Paste an MDT string or
          build pulls on the map, then switch to fullscreen board during the key.
        </p>
        <div className="actions" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button type="button" className="btn primary" onClick={onImport}>
            Paste MDT string
          </button>
          <button type="button" className="btn" onClick={onSample}>
            Altar of Fangs example
          </button>
        </div>
      </header>

      <section>
        <h2>Live pool</h2>
        <div className="dungeon-grid">
          {dungeons.map((d) => (
            <button key={d.dungeonIndex} type="button" className="dungeon-card" onClick={() => onNew(d.dungeonIndex)}>
              <img src={d.maps[d.floors[0]]} alt="" />
              <div>
                <strong>{d.englishName}</strong>
                <span>
                  {d.totalCount} count · {d.cloneCount} NPCs · idx {d.dungeonIndex}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>Saved routes</h2>
        {saved.length === 0 ? (
          <p className="mute">No local routes yet.</p>
        ) : (
          <ul className="saved">
            {saved.map((r) => {
              const dungeon = getDungeon(r.dungeonIdx);
              return (
                <li key={r.id}>
                  <button type="button" onClick={() => onOpen(r)}>
                    <strong>{r.name}</strong>
                    <span>
                      {dungeon?.englishName ?? `Dungeon ${r.dungeonIdx}`} · {r.pulls.length} pulls
                    </span>
                  </button>
                  <button type="button" className="danger" onClick={() => onDelete(r.id)}>
                    Delete
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
