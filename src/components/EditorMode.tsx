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
          Dungeons
        </button>
        <input
          className="route-name"
          value={route.name}
          onChange={(e) => onName(e.target.value)}
          aria-label="Route name"
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
              Floor {f}
            </button>
          ))}
        </div>
        <label className="chk">
          <input type="checkbox" checked={showPath} onChange={onTogglePath} />
          Path
        </label>
        <button type="button" className="btn" onClick={onImport}>
          Import
        </button>
        <button type="button" className="btn" onClick={onExport}>
          Export
        </button>
        <button type="button" className="btn" onClick={onSave}>
          Save
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
        Click an NPC to add or remove it from pull {route.currentPull}. Scroll to zoom, drag to pan.
      </p>
    </div>
  );
}
