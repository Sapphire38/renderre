import type { Vec2, Wall } from "./types";

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

export function wallLength(w: Wall): number {
  return dist(w.a, w.b);
}

export function midpoint(a: Vec2, b: Vec2): Vec2 {
  return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
}

/** Ángulo del segmento a→b en grados (0° = +x, sentido horario en pantalla). */
export function angleDeg(a: Vec2, b: Vec2): number {
  return (Math.atan2(b.z - a.z, b.x - a.x) * 180) / Math.PI;
}

export function snapToGrid(p: Vec2, cellM: number): Vec2 {
  return {
    x: Math.round(p.x / cellM) * cellM,
    z: Math.round(p.z / cellM) * cellM,
  };
}

/** Restringe el punto b a múltiplos de 45° respecto de a (lock ortogonal con Shift). */
export function orthoLock(a: Vec2, b: Vec2): Vec2 {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) return { ...b };
  const ang = Math.atan2(dz, dx);
  const step = Math.PI / 4; // 45°
  const snapped = Math.round(ang / step) * step;
  return { x: a.x + Math.cos(snapped) * len, z: a.z + Math.sin(snapped) * len };
}

/** Distancia de un punto p al segmento a–b. */
export function distPointToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const vx = b.x - a.x;
  const vz = b.z - a.z;
  const wx = p.x - a.x;
  const wz = p.z - a.z;
  const c1 = vx * wx + vz * wz;
  if (c1 <= 0) return Math.hypot(p.x - a.x, p.z - a.z);
  const c2 = vx * vx + vz * vz;
  if (c2 <= c1) return Math.hypot(p.x - b.x, p.z - b.z);
  const t = c1 / c2;
  const projx = a.x + t * vx;
  const projz = a.z + t * vz;
  return Math.hypot(p.x - projx, p.z - projz);
}

/** Endpoint más cercano dentro de la tolerancia (en metros). */
export function nearestEndpoint(
  walls: Wall[],
  p: Vec2,
  tol: number,
  excludeId?: string,
): Vec2 | null {
  let best: Vec2 | null = null;
  let bestD = tol;
  for (const w of walls) {
    if (w.id === excludeId) continue;
    for (const e of [w.a, w.b]) {
      const d = Math.hypot(p.x - e.x, p.z - e.z);
      if (d < bestD) {
        bestD = d;
        best = { x: e.x, z: e.z };
      }
    }
  }
  return best;
}

/** Muro cuyo cuerpo está más cerca del punto, dentro de la tolerancia. */
export function pickWall(walls: Wall[], p: Vec2, tol: number): Wall | null {
  let best: Wall | null = null;
  let bestD = tol;
  for (const w of walls) {
    const d = distPointToSegment(p, w.a, w.b);
    if (d < bestD) {
      bestD = d;
      best = w;
    }
  }
  return best;
}

export function formatLen(m: number): string {
  const abs = Math.abs(m);
  if (abs < 1) return `${Math.round(m * 100)} cm`;
  return `${m.toFixed(2)} m`;
}

export function totalLength(walls: Wall[]): number {
  return walls.reduce((s, w) => s + wallLength(w), 0);
}

export type Bounds = { minX: number; minZ: number; maxX: number; maxZ: number };

export function wallsBounds(walls: Wall[]): Bounds | null {
  if (!walls.length) return null;
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (const w of walls) {
    for (const e of [w.a, w.b]) {
      minX = Math.min(minX, e.x);
      minZ = Math.min(minZ, e.z);
      maxX = Math.max(maxX, e.x);
      maxZ = Math.max(maxZ, e.z);
    }
  }
  return { minX, minZ, maxX, maxZ };
}
