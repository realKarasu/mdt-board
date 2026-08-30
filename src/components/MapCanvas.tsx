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
import { cloneOwner, findClone, formatPct, pct, pullCentroid, pullForces } from "../lib/route";

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
 *
 * Overlay sizes are divided by the fit factor so they land at fixed CSS
 * pixels at zoom 1 (MDT scale: ~20px trash, ~30px boss) on any window,
 * then grow and shrink 1:1 with the user zoom.
 */
const UNIT = 2;
const TRASH_PX = 20;
const BOSS_PX = 30;
const ENTRANCE_PX = 24;
const ENTRANCE_ICON = "/icons/spell_arcane_portaldalaran.jpg";

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

  // World px per displayed CSS px at zoom 1.
  const k = 1 / Math.max(fit, 0.05);

  const clones = useMemo(() => {
    const list: {
      enemyId: number;
      clone: Clone;
      name: string;
      count: number;
      boss: boolean;
      displayId: number;
      skull: boolean;
      jx: number;
      jy: number;
    }[] = [];
    const buckets = new Map<string, number>();
    for (const enemy of dungeon.enemies) {
      for (const clone of enemy.clones) {
        if (clone.sublevel !== floor) continue;
        // Deterministic de-overlap: clones sharing a small cell spiral out
        // by a few map units so pack counts stay readable.
        const key = `${Math.round(clone.x / 5)}:${Math.round(clone.y / 5)}`;
        const ord = buckets.get(key) ?? 0;
        buckets.set(key, ord + 1);
        const ang = ord * 2.4;
        const dist = ord === 0 ? 0 : 2.4 + ord * 1.1;
        list.push({
          enemyId: enemy.id,
          clone,
          name: enemy.name,
          count: enemy.count,
          boss: enemy.isBoss,
          displayId: enemy.displayId,
          skull: isPriorityMob(enemy.count, enemy.isBoss, enemy.stealthDetect),
          jx: Math.cos(ang) * dist * UNIT,
          jy: Math.sin(ang) * dist * UNIT,
        });
      }
    }
    return list;
  }, [dungeon, floor]);

  const pullGeom = useMemo(() => {
    return route.pulls
      .map((pull, i) => {
        const onFloor = pull.clones
          .map((ref) => ({ ref, clone: findClone(dungeon, ref) }))
          .filter((row): row is { ref: CloneRef; clone: Clone } => row.clone != null && row.clone.sublevel === floor);
        const byPack = new Map<string, { x: number; y: number }[]>();
        for (const { ref, clone } of onFloor) {
          const key = clone.group != null ? `g:${clone.group}` : `solo:${ref.enemyId}:${ref.cloneIdx}`;
          const list = byPack.get(key) ?? [];
          list.push({ x: clone.x * UNIT, y: -clone.y * UNIT });
          byPack.set(key, list);
        }
        const clusters = [...byPack.values()];
        const pts = clusters.flat();
        const c = pullCentroid(dungeon, pull, floor);
        return {
          n: i + 1,
          color: pull.color,
          note: pull.note,
          forcePct: formatPct(pct(pullForces(dungeon, pull), dungeon.totalCount)),
          clusters,
          pts,
          centroid: c ? { x: c.x * UNIT, y: -c.y * UNIT } : null,
        };
      })
      .filter((p) => p.pts.length > 0);
  }, [route.pulls, dungeon, floor]);

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const next = Math.min(8, Math.max(0.85, zoom * (e.deltaY > 0 ? 0.9 : 1.12)));
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
  const hullPad = 8 * k;

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
          transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${scale})`,
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
              <feGaussianBlur stdDeviation={4 * k} />
            </filter>
          </defs>
          {pullGeom.map((p) => {
            const active = p.n === route.currentPull;
            return (
              <g key={`hull-${p.n}`} className={active ? "hull active" : "hull dim"}>
                {p.clusters.map((cluster, ci) => {
                  const d = hullPath(cluster, hullPad);
                  return (
                    <g key={`pack-${p.n}-${ci}`}>
                      <path
                        d={d}
                        fill={hexAlpha(p.color, active ? 0.1 : 0.04)}
                        stroke={hexAlpha(p.color, active ? 0.85 : 0.42)}
                        strokeWidth={7 * k}
                        strokeLinejoin="round"
                        filter="url(#pull-glow)"
                      />
                      <path
                        d={d}
                        fill="none"
                        stroke={hexAlpha(p.color, active ? 0.95 : 0.55)}
                        strokeWidth={1.25 * k}
                        strokeLinejoin="round"
                      />
                    </g>
                  );
                })}
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
              const trim = Math.min(hullPad + 10 * k, len * 0.32);
              const ax = from.centroid.x + ux * trim;
              const ay = from.centroid.y + uy * trim;
              const bx = to.centroid.x - ux * trim;
              const by = to.centroid.y - uy * trim;
              const ang = Math.atan2(uy, ux);
              const ah = 8 * k;
              const aw = 5 * k;
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
                    strokeWidth={3.4 * k}
                    strokeLinecap="round"
                    opacity={0.5}
                  />
                  <line
                    x1={ax}
                    y1={ay}
                    x2={bx}
                    y2={by}
                    stroke="#ffa94d"
                    strokeWidth={2 * k}
                    strokeLinecap="round"
                  />
                  <polygon
                    points={`${tip.x},${tip.y} ${p2} ${p3}`}
                    fill="#fff"
                    stroke="#0d0a06"
                    strokeWidth={0.8 * k}
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
            const size = (item.boss ? BOSS_PX : TRASH_PX) * k;
            const rim = (item.boss ? 1.6 : 1) * k;
            const rimColor = item.boss ? "#f0c14b" : color ?? "rgba(255, 255, 255, 0.92)";
            const shadows = [
              item.boss
                ? `0 0 ${6 * k}px ${hexAlpha("#f0c14b", 0.55)}`
                : `0 ${k}px ${3 * k}px rgba(0, 0, 0, 0.55)`,
            ];
            if (color && !item.boss) {
              shadows.unshift(`0 0 ${4 * k}px ${hexAlpha(color, active ? 0.7 : 0.4)}`);
            }
            return (
              <button
                key={`${item.enemyId}-${item.clone.idx}`}
                type="button"
                className={`portrait ${item.boss ? "boss" : ""} ${active ? "active" : ""}`}
                style={{
                  left: item.clone.x * UNIT + item.jx,
                  top: -item.clone.y * UNIT + item.jy,
                  width: size,
                  height: size,
                  borderWidth: rim,
                  borderColor: rimColor,
                  boxShadow: shadows.join(", "),
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
                <span className="portrait-fallback" style={{ fontSize: size * 0.5 }}>
                  {item.name.charAt(0)}
                </span>
                <img src={portraitSrc(item.displayId)} alt="" draggable={false} onError={hidePortrait} />
                {item.skull && <span className="elite-star" style={{ width: 8 * k, height: 8 * k }} aria-hidden />}
              </button>
            );
          })}
          {entrance && (
            <div
              className="entrance-pin"
              style={{
                left: entrance.x,
                top: entrance.y,
                width: ENTRANCE_PX * k,
                height: ENTRANCE_PX * k,
              }}
              title="Entrance"
            >
              <span
                className="entrance-stem"
                style={{
                  borderLeftWidth: 3.2 * k,
                  borderRightWidth: 3.2 * k,
                  borderTopWidth: 10 * k,
                }}
              />
              <img src={ENTRANCE_ICON} alt="Entrance" draggable={false} />
            </div>
          )}
        </div>

        <svg
          className="map-svg map-over"
          viewBox={`0 0 ${worldW} ${worldH}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {pullGeom.map((p) => {
            if (!p.centroid) return null;
            const active = p.n === route.currentPull;
            const label = `${p.n} · ${p.forcePct}`;
            const w = (active ? 52 : 48) * k;
            const h = (active ? 16 : 14) * k;
            return (
              <g
                key={`num-${p.n}`}
                className="pull-num"
                opacity={active ? 1 : 0.9}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSelectPull?.(p.n);
                }}
              >
                <rect
                  x={p.centroid.x - w / 2}
                  y={p.centroid.y - h / 2}
                  width={w}
                  height={h}
                  rx={h / 2}
                  fill="#0b0b0d"
                  stroke={p.color}
                  strokeWidth={1.2 * k}
                />
                <text
                  x={p.centroid.x}
                  y={p.centroid.y + (active ? 4.4 : 3.8) * k}
                  textAnchor="middle"
                  fontSize={(active ? 11 : 10) * k}
                >
                  {label}
                </text>
                {p.note.trim() && (
                  <g transform={`translate(${p.centroid.x + w / 2 + 6 * k}, ${p.centroid.y - h / 2})`}>
                    <circle r={4.6 * k} fill="#f5d76e" stroke="#3a2a00" strokeWidth={0.8 * k} />
                    <text y={2.4 * k} textAnchor="middle" fontSize={7 * k} fill="#3a2a00">
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

