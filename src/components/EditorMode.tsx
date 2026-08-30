import type { Dungeon, Route } from "../types";
import { formatPct, pct, routeForces } from "../lib/route";
import { MapCanvas } from "./MapCanvas";
import { PullSidebar } from "./PullSidebar";

type Props = {
  dungeon: Dungeon;
  route: Route;
  showPath: boolean;
  onName: (name: string) => void;
  onTogglePath: () => void;
  onSelectPull: (n: number) => void;
  onToggleClone: (ref: { enemyId: number; cloneIdx: number }) => void;
  onAddPull: () => void;
  onDeletePull: (index: number) => void;
  onMovePull: (from: number, to: number) => void;
  onNote: (index: number, note: string) => void;
  onFloor: (floor: number) => void;
  onBoard: () => void;
  onImport: () => void;
  onExport: () => void;
  onSave: () => void;
  onHome: () => void;
};

export function EditorMode({
  dungeon,
  route,
  showPath,
  onName,
  onTogglePath,
  onSelectPull,
  onToggleClone,
  onAddPull,
  onDeletePull,
  onMovePull,
  onNote,
  onFloor,
  onBoard,
  onImport,
  onExport,
  onSave,
  onHome,
}: Props) {
  const total = routeForces(dungeon, route);
  const totalPct = pct(total, dungeon.totalCount);
  const over = total > dungeon.totalCount;

  return (
    <div className="editor">
      <header className="editor-top">
        <button type="button" className="btn ghost" onClick={onHome}>
          Donjons
        </button>
        <input
          className="route-name"
          value={route.name}
          onChange={(e) => onName(e.target.value)}
          aria-label="Nom de la route"
        />
        <div className={`forces ${over ? "over" : totalPct >= 100 ? "ok" : ""}`}>
          <strong>{formatPct(totalPct)}</strong>
          <span>
            {total}/{dungeon.totalCount}
          </span>
        </div>
        <div className="floors">
          {dungeon.floors.map((f) => (
            <button
              key={f}
              type="button"
              className={f === route.currentSublevel ? "on" : ""}
              onClick={() => onFloor(f)}
            >
              Étage {f}
            </button>
          ))}
        </div>
        <label className="chk">
          <input type="checkbox" checked={showPath} onChange={onTogglePath} />
          Chemin
        </label>
        <button type="button" className="btn" onClick={onImport}>
          Importer
        </button>
        <button type="button" className="btn" onClick={onExport}>
          Exporter
        </button>
        <button type="button" className="btn" onClick={onSave}>
          Sauver
        </button>
        <button type="button" className="btn primary" onClick={onBoard}>
          Board
        </button>
      </header>
      <div className="editor-main">
        <MapCanvas
          dungeon={dungeon}
          route={route}
          interactive
          showPath={showPath}
          onToggleClone={onToggleClone}
          onSelectPull={onSelectPull}
        />
        <PullSidebar
          dungeon={dungeon}
          route={route}
          onSelect={onSelectPull}
          onAdd={onAddPull}
          onDelete={onDeletePull}
          onMove={onMovePull}
          onNote={onNote}
        />
      </div>
      <p className="hint">
        Clic sur un PNJ pour l'ajouter ou le retirer du pull {route.currentPull}. Molette pour zoomer, glisser pour
        déplacer.
      </p>
    </div>
  );
}
