import type { Dungeon, Route } from "../types";
import { formatPct, packSummary, pct, pullForces, routeForces } from "../lib/route";

type Props = {
  dungeon: Dungeon;
  route: Route;
  compact?: boolean;
  onSelect: (n: number) => void;
  onAdd?: () => void;
  onDelete?: (index: number) => void;
  onMove?: (from: number, to: number) => void;
  onNote?: (index: number, note: string) => void;
};

export function PullSidebar({
  dungeon,
  route,
  compact,
  onSelect,
  onAdd,
  onDelete,
  onMove,
  onNote,
}: Props) {
  return (
    <aside className={`pull-side ${compact ? "compact" : ""}`}>
      <header>
        <h2>Pulls</h2>
        {onAdd && (
          <button type="button" className="btn ghost" onClick={onAdd}>
            + Pull
          </button>
        )}
      </header>
      <ol>
        {route.pulls.map((pull, i) => {
          const n = i + 1;
          const forces = pullForces(dungeon, pull);
          const cum = routeForces(dungeon, route, n);
          const active = n === route.currentPull;
          return (
            <li key={n} className={active ? "active" : ""}>
              <button type="button" className="pull-hit" onClick={() => onSelect(n)}>
                <span className="num" style={{ background: pull.color }}>
                  {n}
                </span>
                <span className="meta">
                  <strong>{packSummary(dungeon, pull)}</strong>
                  <em>
                    {formatPct(pct(forces, dungeon.totalCount))} · total {formatPct(pct(cum, dungeon.totalCount))}
                  </em>
                  {pull.note && <small>{pull.note}</small>}
                </span>
              </button>
              {!compact && (
                <div className="row-actions">
                  {onMove && (
                    <>
                      <button type="button" disabled={i === 0} onClick={() => onMove(i, i - 1)}>
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={i === route.pulls.length - 1}
                        onClick={() => onMove(i, i + 1)}
                      >
                        ↓
                      </button>
                    </>
                  )}
                  {onDelete && (
                    <button type="button" className="danger" onClick={() => onDelete(i)}>
                      ×
                    </button>
                  )}
                </div>
              )}
              {!compact && onNote && active && (
                <textarea
                  value={pull.note}
                  placeholder="Pull note (CC, lust, skip…)"
                  onChange={(e) => onNote(i, e.target.value)}
                  rows={2}
                />
              )}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
