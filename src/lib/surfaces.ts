import type { Surface, SurfaceShape, Vec2 } from "./types";
import { uid } from "./geometry";

export const SURFACE_DEFAULTS = {
  width: 2,
  depth: 2,
  thickness: 0.04,
  lift: 0.01,
  color: "#7d7468",
};

/** Crea una superficie centrada en pos, con tamaño opcional. */
export function makeSurface(pos: Vec2, size?: { width: number; depth: number }): Surface {
  return {
    id: uid(),
    pos: { ...pos },
    width: size?.width ?? SURFACE_DEFAULTS.width,
    depth: size?.depth ?? SURFACE_DEFAULTS.depth,
    rotDeg: 0,
    shape: "rect",
    thickness: SURFACE_DEFAULTS.thickness,
    lift: SURFACE_DEFAULTS.lift,
    color: SURFACE_DEFAULTS.color,
  };
}

/** Vértices de la superficie en mundo. Polígono → sus puntos; si no, el rectángulo. */
export function surfaceCorners(s: Surface): Vec2[] {
  const a = (s.rotDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const sn = Math.sin(a);
  const toWorld = (u: number, v: number): Vec2 => ({ x: s.pos.x + u * c - v * sn, z: s.pos.z + u * sn + v * c });
  if (s.shape === "polygon" && s.points && s.points.length >= 3) {
    return s.points.map((p) => toWorld(p.x, p.z));
  }
  const hw = s.width / 2;
  const hd = s.depth / 2;
  return ([[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]] as [number, number][]).map(([u, v]) => toWorld(u, v));
}

/** ¿El punto (en mundo) está dentro del polígono? (ray casting) */
function pointInPoly(pts: Vec2[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, zi = pts[i].z, xj = pts[j].x, zj = pts[j].z;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** ¿El punto (mundo) está dentro de la superficie? */
export function pointInSurface(s: Surface, p: Vec2): boolean {
  // pasar a marco local (deshacer rotación)
  const a = (-s.rotDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const sn = Math.sin(a);
  const dx = p.x - s.pos.x;
  const dz = p.z - s.pos.z;
  const u = dx * c - dz * sn;
  const v = dx * sn + dz * c;
  if (s.shape === "polygon" && s.points && s.points.length >= 3) {
    return pointInPoly(surfaceCorners(s), p.x, p.z);
  }
  if (s.shape === "circle") {
    const rx = s.width / 2;
    const rz = s.depth / 2;
    if (rx < 1e-6 || rz < 1e-6) return false;
    return (u * u) / (rx * rx) + (v * v) / (rz * rz) <= 1;
  }
  return Math.abs(u) <= s.width / 2 && Math.abs(v) <= s.depth / 2;
}

/** Superficie superior (la "de más arriba" por lift) bajo el punto. */
export function pickSurface(surfaces: Surface[], p: Vec2): Surface | null {
  let best: Surface | null = null;
  for (const s of surfaces) {
    if (pointInSurface(s, p)) {
      if (!best || (s.lift ?? 0) >= (best.lift ?? 0)) best = s;
    }
  }
  return best;
}

/** Crea una superficie poligonal a partir de vértices en mundo. pos = centroide; points en local. */
export function makePolygonSurface(rawPts: Vec2[]): Surface {
  // sacar vértices repetidos consecutivos (el doble-clic agrega duplicados) y el cierre redundante
  const worldPts: Vec2[] = [];
  for (const p of rawPts) {
    const last = worldPts[worldPts.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.z - last.z) > 0.02) worldPts.push(p);
  }
  if (worldPts.length > 3) {
    const first = worldPts[0], last = worldPts[worldPts.length - 1];
    if (Math.hypot(first.x - last.x, first.z - last.z) <= 0.02) worldPts.pop();
  }
  const n = Math.max(1, worldPts.length);
  const cx = worldPts.reduce((a, p) => a + p.x, 0) / n;
  const cz = worldPts.reduce((a, p) => a + p.z, 0) / n;
  const xs = worldPts.map((p) => p.x), zs = worldPts.map((p) => p.z);
  return {
    id: uid(),
    pos: { x: cx, z: cz },
    width: Math.max(0.1, Math.max(...xs) - Math.min(...xs)),
    depth: Math.max(0.1, Math.max(...zs) - Math.min(...zs)),
    rotDeg: 0,
    shape: "polygon",
    points: worldPts.map((p) => ({ x: p.x - cx, z: p.z - cz })),
    thickness: SURFACE_DEFAULTS.thickness,
    lift: SURFACE_DEFAULTS.lift,
    color: SURFACE_DEFAULTS.color,
  };
}

export const SURFACE_SHAPES: { value: SurfaceShape; label: string }[] = [
  { value: "rect", label: "Rectángulo" },
  { value: "circle", label: "Círculo" },
  { value: "polygon", label: "Polígono" },
];
