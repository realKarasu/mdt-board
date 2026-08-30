import { useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import type { Clone, CloneRef, Dungeon, Route } from "../types";
import { hullPath, hexAlpha } from "../lib/hull";
import { isPriorityMob, portraitSrc } from "../lib/portraits";
import { cloneOwner, findClone, pullCentroid } from "../lib/route";

type Props = {
  dungeon: Dungeon;
  route: Route;
  interactive: boolean;
  showPath: boolean;
  onToggleClone?: (ref: CloneRef) => void;
  onSelectPull?: (n: number) => void;
};

type Hover = {
  name: string;
  count: number;
  boss: boolean;
  x: number;
  y: number;
};

function toPct(dungeon: Dungeon, x: number, y: number) {
  return {
    left: (x / dungeon.mapWidth) * 100,
    top: (-y / dungeon.mapHeight) * 100,
  };
}

export function MapCanvas({
  dungeon,
  route,
  interactive,
  showPath,
  onToggleClone,
  onSelectPull,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const floor = route.currentSublevel;
  const mapSrc = dungeon.maps[floor] ?? dungeon.maps[dungeon.floors[0]];

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [dungeon.dungeonIndex, floor]);

  const clones = useMemo(() => {
    const list: {
      enemyId: number;
      clone: Clone;
      name: string;
      count: number;
      boss: boolean;
      displayId: number;
      skull: boolean;
    }[] = [];
    for (const enemy of dungeon.enemies) {
      for (const clone of enemy.clones) {
        if (clone.sublevel !== floor) continue;
        list.push({
          enemyId: enemy.id,
          clone,
          name: enemy.name,
          count: enemy.count,
          boss: enemy.isBoss,
          displayId: enemy.displayId,
          skull: isPriorityMob(enemy.count, enemy.isBoss, enemy.stealthDetect),
        });
      }
    }
    return list;
  }, [dungeon, floor]);

  const pullGeom = useMemo(() => {
    return route.pulls
      .map((pull, i) => {
        const pts = pull.clones
          .map((ref) => findClone(dungeon, ref))
          .filter((c): c is Clone => c != null && c.sublevel === floor)
          .map((c) => toPct(dungeon, c.x, c.y))
          .map((p) => ({ x: p.left, y: p.top }));
        const c = pullCentroid(dungeon, pull, floor);
        return {
          n: i + 1,
          color: pull.color,
          note: pull.note,
          pts,
          centroid: c ? toPct(dungeon, c.x, c.y) : null,
        };
      })
      .filter((p) => p.pts.length > 0);
  }, [route.pulls, dungeon, floor]);

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const next = Math.min(4.5, Math.max(0.7, zoom * (e.deltaY > 0 ? 0.9 : 1.12)));
    setZoom(next);
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    setPan({
      x: drag.current.px + (e.clientX - drag.current.x),
      y: drag.current.py + (e.clientY - drag.current.y),
    });
  }

  function onPointerUp() {
    drag.current = null;
  }

  const entrance =
    dungeon.entrance && dungeon.entrance.sublevel === floor
      ? toPct(dungeon, dungeon.entrance.x, dungeon.entrance.y)
      : null;

  return (
    <div
      ref={wrapRef}
      className="map-stage"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => {
        onPointerUp();
        setHover(null);
      }}
    >
      <div
        className="map-world"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        {mapSrc ? (
          <img src={mapSrc} alt={dungeon.englishName} className="map-image" draggable={false} />
        ) : (
          <div className="map-fallback">{dungeon.englishName}</div>
        )}

        <svg className="map-svg map-under" viewBox="0 0 100 100" preserveAspectRatio="none">
          {pullGeom.map((p) => {
            const active = p.n === route.currentPull;
            return (
              <path
                key={`hull-${p.n}`}
                d={hullPath(p.pts, active ? 2.4 : 2.05)}
                fill={hexAlpha(p.color, active ? 0.38 : 0.16)}
                stroke={hexAlpha(p.color, active ? 0.95 : 0.55)}
                strokeWidth={active ? 3 : 2.25}
                className={active ? "hull active" : "hull dim"}
              />
            );
          })}
          {showPath &&
            pullGeom.slice(0, -1).map((from, i) => {
              const to = pullGeom[i + 1];
              if (!from.centroid || !to.centroid) return null;
              const ax = from.centroid.left;
              const ay = from.centroid.top;
              const bx = to.centroid.left;
              const by = to.centroid.top;
              const mx = ax + (bx - ax) * 0.68;
              const my = ay + (by - ay) * 0.68;
              const ang = Math.atan2(by - ay, bx - ax);
              const ah = 1.15;
              const aw = 0.85;
              const p1 = `${mx + Math.cos(ang) * ah},${my + Math.sin(ang) * ah}`;
              const p2 = `${mx + Math.cos(ang + 2.4) * aw},${my + Math.sin(ang + 2.4) * aw}`;
              const p3 = `${mx + Math.cos(ang - 2.4) * aw},${my + Math.sin(ang - 2.4) * aw}`;
              const active = from.n === route.currentPull || to.n === route.currentPull;
              return (
                <g key={`seg-${from.n}`}>
                  <line
                    x1={ax}
                    y1={ay}
                    x2={bx}
                    y2={by}
                    stroke={to.color}
                    strokeWidth={active ? 6 : 4}
                    strokeLinecap="round"
                    opacity={active ? 0.95 : 0.55}
                  />
                  <polygon points={`${p1} ${p2} ${p3}`} fill="#fff" stroke="#111" strokeWidth={0.08} />
                </g>
              );
            })}
        </svg>

        <div className="portrait-layer">
          {clones.map((item) => {
            const owner = cloneOwner(route, { enemyId: item.enemyId, cloneIdx: item.clone.idx });
            const active = owner === route.currentPull;
            const pos = toPct(dungeon, item.clone.x, item.clone.y);
            const color = owner ? route.pulls[owner - 1].color : item.boss ? "#d4af37" : "#c4b8a4";
            const size = item.boss ? (active ? 5.1 : 4.4) : active ? 3.7 : 3.05;
            return (
              <button
                key={`${item.enemyId}-${item.clone.idx}`}
                type="button"
                className={`portrait ${item.boss ? "boss" : ""} ${active ? "active" : ""} ${owner && !active ? "dim" : ""}`}
                style={{
                  left: `${pos.left}%`,
                  top: `${pos.top}%`,
                  width: `${size}%`,
                  borderColor: color,
                  boxShadow: item.boss
                    ? `0 0 0 2px #1a1208, 0 0 0 3px ${color}, 0 0 10px ${hexAlpha(color, 0.55)}`
                    : `0 0 0 1px #1a1208, 0 0 0 2px ${color}`,
                }}
                onPointerDown={(e) => {
                  if (!interactive) return;
                  e.stopPropagation();
                  onToggleClone?.({ enemyId: item.enemyId, cloneIdx: item.clone.idx });
                }}
                onPointerEnter={(e) => {
                  e.stopPropagation();
                  setHover({
                    name: item.name,
                    count: item.count,
                    boss: item.boss,
                    x: e.clientX,
                    y: e.clientY,
                  });
                }}
                onPointerLeave={() => setHover(null)}
              >
                <img src={portraitSrc(item.displayId)} alt="" draggable={false} />
                {item.skull && <span className="skull" aria-hidden />}
              </button>
            );
          })}
        </div>

        <svg className="map-svg map-over" viewBox="0 0 100 100" preserveAspectRatio="none">
          {entrance && (
            <polygon
              className="entrance"
              points={diamond(entrance.left, entrance.top, 1.35)}
              fill="#3b82f6"
              stroke="#dbeafe"
              strokeWidth={0.22}
            />
          )}
          {pullGeom.map((p) => {
            if (!p.centroid) return null;
            const active = p.n === route.currentPull;
            return (
              <g
                key={`num-${p.n}`}
                className="pull-num"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSelectPull?.(p.n);
                }}
              >
                <circle
                  cx={p.centroid.left}
                  cy={p.centroid.top}
                  r={active ? 1.85 : 1.55}
                  fill="#111"
                  stroke="#fff"
                  strokeWidth={0.22}
                />
                <text x={p.centroid.left} y={p.centroid.top + 0.52} textAnchor="middle" fontSize={active ? 2 : 1.65}>
                  {p.n}
                </text>
                {p.note.trim() && (
                  <g transform={`translate(${p.centroid.left + 1.7}, ${p.centroid.top - 1.7})`}>
                    <circle r={0.95} fill="#f5d76e" stroke="#3a2a00" strokeWidth={0.12} />
                    <text y={0.42} textAnchor="middle" fontSize={1.35} fill="#3a2a00">
                      !
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {hover && (
        <div className="npc-tip" style={{ left: hover.x + 12, top: hover.y + 12 }}>
          <strong>{hover.name}</strong>
          <span>{hover.boss ? "Boss" : `Forces ${hover.count}`}</span>
        </div>
      )}
    </div>
  );
}

function diamond(x: number, y: number, r: number): string {
  return `${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`;
}

export function cloneOnFloor(dungeon: Dungeon, ref: CloneRef, floor: number): boolean {
  const c = findClone(dungeon, ref);
  return Boolean(c && c.sublevel === floor);
}
