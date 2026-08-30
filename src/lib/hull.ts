export type Pt = { x: number; y: number };

function cross(o: Pt, a: Pt, b: Pt): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

export function convexHull(points: Pt[]): Pt[] {
  const pts = points
    .map((p) => ({ x: p.x, y: p.y }))
    .sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  if (pts.length <= 2) return pts;
  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = pts.length - 1; i >= 0; i -= 1) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

export function padHull(hull: Pt[], pad: number): Pt[] {
  if (!hull.length) return hull;
  const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length;
  const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length;
  return hull.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / len) * pad, y: p.y + (dy / len) * pad };
  });
}

export function hullPath(points: Pt[], pad: number): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const p = points[0];
    const r = pad;
    return `M ${p.x - r} ${p.y} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`;
  }
  if (points.length === 2) {
    const [a, b] = points;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * pad;
    const ny = (dx / len) * pad;
    const p1 = { x: a.x + nx, y: a.y + ny };
    const p2 = { x: b.x + nx, y: b.y + ny };
    const p3 = { x: b.x - nx, y: b.y - ny };
    const p4 = { x: a.x - nx, y: a.y - ny };
    return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} A ${pad} ${pad} 0 0 1 ${p3.x} ${p3.y} L ${p4.x} ${p4.y} A ${pad} ${pad} 0 0 1 ${p1.x} ${p1.y} Z`;
  }
  const padded = padHull(convexHull(points), pad);
  return `M ${padded.map((p) => `${p.x} ${p.y}`).join(" L ")} Z`;
}

export function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
