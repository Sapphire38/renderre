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

/** Esquinas del rectángulo de la superficie en mundo (orden horario). */
export function surfaceCorners(s: Surface): Vec2[] {
  const a = (s.rotDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const sn = Math.sin(a);
  const hw = s.width / 2;
  const hd = s.depth / 2;
  const pts: [number, number][] = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ];
  return pts.map(([u, v]) => ({ x: s.pos.x + u * c - v * sn, z: s.pos.z + u * sn + v * c }));
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

export const SURFACE_SHAPES: { value: SurfaceShape; label: string }[] = [
  { value: "rect", label: "Rectángulo" },
  { value: "circle", label: "Círculo" },
];
