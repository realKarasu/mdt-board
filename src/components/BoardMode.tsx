import type { Dungeon, Route } from "../types";
import { formatPct, packSummary, pct, pullForces, routeForces } from "../lib/route";
import { MapCanvas } from "./MapCanvas";

type Props = {
  dungeon: Dungeon;
  route: Route;
  showPath: boolean;
  onSelectPull: (n: number) => void;
  onEditor: () => void;
};

export function BoardMode({ dungeon, route, showPath, onSelectPull, onEditor }: Props) {
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
          <p className="kicker">{dungeon.nameFr}</p>
          <h1>{route.name}</h1>
        </div>
        <div className={`forces ${over ? "over" : totalPct >= 100 ? "ok" : ""}`}>
          <strong>{formatPct(totalPct)}</strong>
          <span>
            {total} / {dungeon.totalCount}
          </span>
        </div>
        <button type="button" className="btn ghost" onClick={onEditor}>
          Éditeur · Échap
        </button>
      </header>

      <div className="board-main">
        <MapCanvas
          dungeon={dungeon}
          route={route}
          interactive={false}
          showPath={showPath}
          onSelectPull={onSelectPull}
        />
        <section className="board-pull">
          <p className="kicker">Pull actuel</p>
          <h2>
            PULL <span style={{ color: pull?.color }}>{route.currentPull}</span>
            <small>
              / {route.pulls.length}
            </small>
          </h2>
          <p className="packs">{pull ? packSummary(dungeon, pull) : "—"}</p>
          {pull?.note ? <p className="note">{pull.note}</p> : <p className="note mute">Pas de note</p>}
          <dl>
            <div>
              <dt>Ce pull</dt>
              <dd>{formatPct(pct(pull ? pullForces(dungeon, pull) : 0, dungeon.totalCount))}</dd>
            </div>
            <div>
              <dt>Restant après</dt>
              <dd>{formatPct(pct(remaining, dungeon.totalCount))}</dd>
            </div>
          </dl>
          <div className="next">
            <p className="kicker">Prochain</p>
            {next ? (
              <>
                <strong>Pull {route.currentPull + 1}</strong>
                <span>{packSummary(dungeon, next)}</span>
                {next.note && <em>{next.note}</em>}
              </>
            ) : (
              <span className="mute">Dernier pull</span>
            )}
          </div>
          <p className="keys">← → ou J K pour avancer · F plein écran · 1-9 saut</p>
        </section>
      </div>
    </div>
  );
}
