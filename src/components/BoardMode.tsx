import type { Dungeon, Route } from "../types";
import { formatPct, packSummary, pct, pullForces, routeForces } from "../lib/route";
import { MapCanvas } from "./MapCanvas";

type Props = {
  dungeon: Dungeon;
  route: Route;
  showPath: boolean;
  onSelectPull: (n: number) => void;
  onEditor: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
};

export function BoardMode({ dungeon, route, showPath, onSelectPull, onEditor, sidebarOpen, onToggleSidebar }: Props) {
  const pull = route.pulls[route.currentPull - 1];
  const done = routeForces(dungeon, route, route.currentPull);
  const total = routeForces(dungeon, route);
  const remaining = Math.max(0, dungeon.totalCount - done);
  const next = route.pulls[route.currentPull];
  const over = total > dungeon.totalCount;
  const totalPct = pct(total, dungeon.totalCount);

  return (
    <div className="board">
      <header className="board-top">
        <div>
          <p className="kicker">{dungeon.englishName}</p>
          <h1>{route.name}</h1>
        </div>
        <div className={`forces ${over ? "over" : totalPct >= 100 ? "ok" : ""}`}>
          <strong>{formatPct(totalPct)}</strong>
          <span>
            {total} / {dungeon.totalCount}
          </span>
        </div>
        <button type="button" className="btn ghost" onClick={onToggleSidebar}>
          Pulls
        </button>
        <button type="button" className="btn ghost" onClick={onEditor}>
          Editor · Esc
        </button>
      </header>

      <div className={`board-main ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
        <MapCanvas
          dungeon={dungeon}
          route={route}
          interactive={false}
          showPath={showPath}
          onSelectPull={onSelectPull}
        />
        <section className={`board-pull ${sidebarOpen ? "" : "collapsed"}`}>
          <button type="button" className="sidebar-toggle" onClick={onToggleSidebar} aria-label={sidebarOpen ? "Hide pulls" : "Show pulls"}>
            {sidebarOpen ? "]" : "["}
          </button>
          <p className="kicker">Current pull</p>
          <h2>
            PULL <span style={{ color: pull?.color }}>{route.currentPull}</span>
            <small>
              / {route.pulls.length}
            </small>
          </h2>
          <p className="packs">{pull ? packSummary(dungeon, pull) : "—"}</p>
          {pull?.note ? <p className="note">{pull.note}</p> : <p className="note mute">No note</p>}
          <dl>
            <div>
              <dt>This pull</dt>
              <dd>{formatPct(pct(pull ? pullForces(dungeon, pull) : 0, dungeon.totalCount))}</dd>
            </div>
            <div>
              <dt>Remaining after</dt>
              <dd>{formatPct(pct(remaining, dungeon.totalCount))}</dd>
            </div>
          </dl>
          <div className="next">
            <p className="kicker">Next</p>
            {next ? (
              <>
                <strong>Pull {route.currentPull + 1}</strong>
                <span>{packSummary(dungeon, next)}</span>
                {next.note && <em>{next.note}</em>}
              </>
            ) : (
              <span className="mute">Last pull</span>
            )}
          </div>
          <p className="keys">← → or J K to step · F fullscreen · 1-9 jump · ] pulls</p>
        </section>
      </div>
    </div>
  );
}
