import { useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import type { Clone, CloneRef, Dungeon, Route } from "../types";
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
    const list: { enemyId: number; clone: Clone; name: string; count: number; boss: boolean }[] = [];
    for (const enemy of dungeon.enemies) {
      for (const clone of enemy.clones) {
        if (clone.sublevel !== floor) continue;
        list.push({
          enemyId: enemy.id,
          clone,
          name: enemy.name,
          count: enemy.count,
          boss: enemy.isBoss,
        });
      }
    }
    return list;
  }, [dungeon, floor]);

  const centroids = useMemo(() => {
    return route.pulls
      .map((pull, i) => ({ n: i + 1, color: pull.color, c: pullCentroid(dungeon, pull, floor) }))
      .filter((p): p is { n: number; color: string; c: { x: number; y: number } } => p.c != null);
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
          <img src={mapSrc} alt={dungeon.nameFr} className="map-image" draggable={false} />
        ) : (
          <div className="map-fallback">{dungeon.nameFr}</div>
        )}
        <svg className="map-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          {showPath && centroids.length > 1 && (
            <polyline
              className="map-path"
              points={centroids.map((p) => {
                const pt = toPct(dungeon, p.c.x, p.c.y);
                return `${pt.left},${pt.top}`;
              }).join(" ")}
            />
          )}
          {clones.map((item) => {
            const owner = cloneOwner(route, { enemyId: item.enemyId, cloneIdx: item.clone.idx });
            const active = owner === route.currentPull;
            const pos = toPct(dungeon, item.clone.x, item.clone.y);
            const color = owner ? route.pulls[owner - 1].color : item.boss ? "#f5d76e" : "#d6d3d1";
            const r = item.boss ? (active ? 1.55 : 1.15) : active ? 1.25 : 0.72;
            return (
              <g
                key={`${item.enemyId}-${item.clone.idx}`}
                className={interactive ? "npc-hit" : undefined}
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
                {item.boss ? (
                  <polygon
                    points={diamond(pos.left, pos.top, r)}
                    fill={color}
                    stroke={active ? "#fff" : "#111"}
                    strokeWidth={active ? 0.28 : 0.16}
                  />
                ) : (
                  <circle
                    cx={pos.left}
                    cy={pos.top}
                    r={r}
                    fill={color}
                    stroke={active ? "#fff" : "#111"}
                    strokeWidth={active ? 0.28 : 0.12}
                    opacity={owner && !active ? 0.85 : 1}
                  />
                )}
              </g>
            );
          })}
          {centroids.map((p) => {
            const pos = toPct(dungeon, p.c.x, p.c.y);
            const active = p.n === route.currentPull;
            return (
              <g
                key={`pull-${p.n}`}
                className="pull-num"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSelectPull?.(p.n);
                }}
              >
                <circle
                  cx={pos.left}
                  cy={pos.top}
                  r={active ? 2.1 : 1.7}
                  fill="#0b0d10"
                  stroke={p.color}
                  strokeWidth={0.28}
                />
                <text x={pos.left} y={pos.top + 0.55} textAnchor="middle" fontSize={active ? 2.1 : 1.7}>
                  {p.n}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {hover && (
        <div className="npc-tip" style={{ left: hover.x + 12, top: hover.y + 12 }}>
          <strong>{hover.name}</strong>
          <span>
            {hover.boss ? "Boss" : `Forces ${hover.count}`}
          </span>
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
