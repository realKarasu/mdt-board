import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type SyntheticEvent,
  type WheelEvent,
} from "react";
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

/**
 * World pixels per MDT map unit. The world is a fixed-size canvas
 * (mapWidth * UNIT x mapHeight * UNIT) scaled uniformly to fit the stage,
 * so SVG overlays and HTML portraits share one aspect ratio and circles
 * can never become ellipses.
 */
const UNIT = 2;
const TRASH_SIZE = 52;
const BOSS_SIZE = 82;
const HULL_PAD = 40;

export function MapCanvas({
  dungeon,
  route,
  interactive,
  showPath,
  onToggleClone,
  onSelectPull,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(0.4);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const floor = route.currentSublevel;
  const mapSrc = dungeon.maps[floor] ?? dungeon.maps[dungeon.floors[0]];

  const worldW = dungeon.mapWidth * UNIT;
  const worldH = dungeon.mapHeight * UNIT;

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [dungeon.dungeonIndex, floor]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setFit(Math.min(r.width / worldW, r.height / worldH));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [worldW, worldH]);

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
          .map((c) => ({ x: c.x * UNIT, y: -c.y * UNIT }));
        const c = pullCentroid(dungeon, pull, floor);
        return {
          n: i + 1,
          color: pull.color,
          note: pull.note,
          pts,
          centroid: c ? { x: c.x * UNIT, y: -c.y * UNIT } : null,
        };
      })
      .filter((p) => p.pts.length > 0);
  }, [route.pulls, dungeon, floor]);

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const next = Math.min(6, Math.max(0.85, zoom * (e.deltaY > 0 ? 0.9 : 1.12)));
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

  function hidePortrait(e: SyntheticEvent<HTMLImageElement>) {
    e.currentTarget.style.display = "none";
  }

  const entrance =
    dungeon.entrance && dungeon.entrance.sublevel === floor
      ? { x: dungeon.entrance.x * UNIT, y: -dungeon.entrance.y * UNIT }
      : null;

  const scale = fit * zoom;

  return (
    <div
      ref={stageRef}
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
          width: worldW,
          height: worldH,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
        }}
      >
        {mapSrc ? (
          <img src={mapSrc} alt={dungeon.englishName} className="map-image" draggable={false} />
        ) : (
          <div className="map-fallback">{dungeon.englishName}</div>
        )}

        <svg
          className="map-svg map-under"
          viewBox={`0 0 ${worldW} ${worldH}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <filter id="pull-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="9" />
            </filter>
          </defs>
          {pullGeom.map((p) => {
            const active = p.n === route.currentPull;
            const d = hullPath(p.pts, HULL_PAD);
            return (
              <g key={`hull-${p.n}`} className={active ? "hull active" : "hull dim"}>
                <path
                  d={d}
                  fill={hexAlpha(p.color, active ? 0.13 : 0.06)}
                  stroke={hexAlpha(p.color, active ? 0.85 : 0.45)}
                  strokeWidth={18}
                  strokeLinejoin="round"
                  filter="url(#pull-glow)"
                />
                <path
                  d={d}
                  fill="none"
                  stroke={hexAlpha(p.color, active ? 0.95 : 0.6)}
                  strokeWidth={3}
                  strokeLinejoin="round"
                />
              </g>
            );
          })}
          {showPath &&
            pullGeom.slice(0, -1).map((from, i) => {
              const to = pullGeom[i + 1];
              if (!from.centroid || !to.centroid) return null;
              const dx = to.centroid.x - from.centroid.x;
              const dy = to.centroid.y - from.centroid.y;
              const len = Math.hypot(dx, dy) || 1;
              const ux = dx / len;
              const uy = dy / len;
              const trim = Math.min(HULL_PAD + 18, len * 0.32);
              const ax = from.centroid.x + ux * trim;
              const ay = from.centroid.y + uy * trim;
              const bx = to.centroid.x - ux * trim;
              const by = to.centroid.y - uy * trim;
              const ang = Math.atan2(uy, ux);
              const ah = 16;
              const aw = 10;
              const tip = { x: bx + ux * ah * 0.6, y: by + uy * ah * 0.6 };
              const p2 = `${tip.x - Math.cos(ang) * ah + Math.cos(ang + Math.PI / 2) * aw},${
                tip.y - Math.sin(ang) * ah + Math.sin(ang + Math.PI / 2) * aw
              }`;
              const p3 = `${tip.x - Math.cos(ang) * ah - Math.cos(ang + Math.PI / 2) * aw},${
                tip.y - Math.sin(ang) * ah - Math.sin(ang + Math.PI / 2) * aw
              }`;
              const active = from.n === route.currentPull || to.n === route.currentPull;
              return (
                <g key={`seg-${from.n}`} opacity={active ? 0.95 : 0.5}>
                  <line
                    x1={ax}
                    y1={ay}
                    x2={bx}
                    y2={by}
                    stroke="#0d0a06"
                    strokeWidth={7}
                    strokeLinecap="round"
                    opacity={0.5}
                  />
                  <line
                    x1={ax}
                    y1={ay}
                    x2={bx}
                    y2={by}
                    stroke="#ffa94d"
                    strokeWidth={4}
                    strokeLinecap="round"
                  />
                  <polygon
                    points={`${tip.x},${tip.y} ${p2} ${p3}`}
                    fill="#fff"
                    stroke="#0d0a06"
                    strokeWidth={1.5}
                    strokeLinejoin="round"
                  />
                </g>
              );
            })}
        </svg>

        <div className="portrait-layer">
          {clones.map((item) => {
            const owner = cloneOwner(route, { enemyId: item.enemyId, cloneIdx: item.clone.idx });
            const active = owner === route.currentPull;
            const color = owner ? route.pulls[owner - 1].color : null;
            const size = item.boss ? BOSS_SIZE : TRASH_SIZE;
            return (
              <button
                key={`${item.enemyId}-${item.clone.idx}`}
                type="button"
                className={`portrait ${item.boss ? "boss" : ""} ${active ? "active" : ""}`}
                style={{
                  left: item.clone.x * UNIT,
                  top: -item.clone.y * UNIT,
                  width: size,
                  height: size,
                  boxShadow: color
                    ? `0 0 0 3px ${hexAlpha(color, active ? 0.95 : 0.6)}, 0 2px 6px rgba(0,0,0,0.55)`
                    : undefined,
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
                <span className="portrait-fallback">{item.name.charAt(0)}</span>
                <img src={portraitSrc(item.displayId)} alt="" draggable={false} onError={hidePortrait} />
                {item.skull && <span className="skull" aria-hidden />}
              </button>
            );
          })}
        </div>

        <svg
          className="map-svg map-over"
          viewBox={`0 0 ${worldW} ${worldH}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {entrance && (
            <polygon
              className="entrance"
              points={diamond(entrance.x, entrance.y, 16)}
              fill="#3b82f6"
              stroke="#eaf2ff"
              strokeWidth={3}
            />
          )}
          {pullGeom.map((p) => {
            if (!p.centroid) return null;
            const active = p.n === route.currentPull;
            const r = active ? 20 : 17;
            return (
              <g
                key={`num-${p.n}`}
                className="pull-num"
                opacity={active ? 1 : 0.88}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSelectPull?.(p.n);
                }}
              >
                <circle
                  cx={p.centroid.x}
                  cy={p.centroid.y}
                  r={r}
                  fill="#0b0b0d"
                  stroke={active ? "#fff" : "rgba(255,255,255,0.75)"}
                  strokeWidth={2}
                />
                <text
                  x={p.centroid.x}
                  y={p.centroid.y + (active ? 9 : 8)}
                  textAnchor="middle"
                  fontSize={active ? 27 : 23}
                >
                  {p.n}
                </text>
                {p.note.trim() && (
                  <g transform={`translate(${p.centroid.x + r + 9}, ${p.centroid.y - r - 2})`}>
                    <circle r={9} fill="#f5d76e" stroke="#3a2a00" strokeWidth={1.5} />
                    <text y={4.5} textAnchor="middle" fontSize={14} fill="#3a2a00">
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
