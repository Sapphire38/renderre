import type { Opening, OpeningKind, Vec2, Wall } from "./types";
import { uid } from "./geometry";

export const OPENING_DEFAULTS: Record<OpeningKind, { width: number; height: number; sill: number }> = {
  door: { width: 0.9, height: 2.05, sill: 0 },
  window: { width: 1.2, height: 1.1, sill: 0.9 },
};

/** Estilos de abertura disponibles por tipo, con su etiqueta para la UI. */
export const OPENING_STYLES: Record<OpeningKind, { value: string; label: string }[]> = {
  door: [
    { value: "swing", label: "Batiente" },
    { value: "double", label: "Doble hoja" },
    { value: "sliding", label: "Corrediza" },
  ],
  window: [
    { value: "fixed", label: "Fija" },
    { value: "sliding", label: "Corrediza" },
    { value: "casement", label: "Batiente" },
  ],
};

export const defaultStyle = (k: OpeningKind): string => (k === "door" ? "swing" : "fixed");

export function makeOpening(wallId: string, kind: OpeningKind, offset: number): Opening {
  const d = OPENING_DEFAULTS[kind];
  return { id: uid(), wallId, kind, offset, width: d.width, height: d.height, sill: d.sill, style: defaultStyle(kind) };
}

export function wallLengthOf(wall: Wall): number {
  return Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z);
}

/** Proyecta un punto sobre el muro y devuelve el offset (distancia desde A), recortado a [0,len]. */
export function offsetOnWall(wall: Wall, p: Vec2): number {
  const dx = wall.b.x - wall.a.x;
  const dz = wall.b.z - wall.a.z;
  const len2 = dx * dx + dz * dz;
  if (len2 < 1e-9) return 0;
  let t = ((p.x - wall.a.x) * dx + (p.z - wall.a.z) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  return t * Math.sqrt(len2);
}

/** Centro de la abertura en mundo + ejes del muro. */
export function openingFrame(wall: Wall, op: Opening) {
  const len = wallLengthOf(wall);
  const dx = (wall.b.x - wall.a.x) / (len || 1);
  const dz = (wall.b.z - wall.a.z) / (len || 1);
  const c = Math.max(op.width / 2, Math.min(len - op.width / 2, op.offset));
  return {
    center: { x: wall.a.x + dx * c, z: wall.a.z + dz * c },
    dir: { x: dx, z: dz },
    perp: { x: -dz, z: dx },
    len,
    c,
  };
}

export type WallPiece = { x: number; w: number; yc: number; h: number };

/** Divide un muro en piezas sólidas alrededor de sus aberturas (marco local: x a lo largo). */
export function wallPieces(wall: Wall, openings: Opening[]): WallPiece[] {
  const len = wallLengthOf(wall);
  const H = wall.height;
  const seg = (x0: number, x1: number, y0: number, y1: number): WallPiece => ({
    x: -len / 2 + (x0 + x1) / 2,
    w: x1 - x0,
    yc: (y0 + y1) / 2,
    h: y1 - y0,
  });
  const valid = openings
    .filter((o) => o.wallId === wall.id && o.width > 0.01)
    .map((o) => ({ ...o, c: Math.max(o.width / 2, Math.min(len - o.width / 2, o.offset)) }))
    .sort((a, b) => a.c - b.c);
  if (!valid.length) return [seg(0, len, 0, H)];

  const pieces: WallPiece[] = [];
  let cursor = 0;
  for (const o of valid) {
    const s = o.c - o.width / 2;
    const e = o.c + o.width / 2;
    if (s - cursor > 1e-3) pieces.push(seg(cursor, s, 0, H));
    const sillTop = o.kind === "window" ? Math.min(o.sill, H) : 0;
    const headBottom = o.kind === "window" ? Math.min(o.sill + o.height, H) : Math.min(o.height, H);
    if (sillTop > 1e-3) pieces.push(seg(s, e, 0, sillTop)); // antepecho (ventana)
    if (H - headBottom > 1e-3) pieces.push(seg(s, e, headBottom, H)); // dintel
    cursor = Math.max(cursor, e);
  }
  if (len - cursor > 1e-3) pieces.push(seg(cursor, len, 0, H));
  return pieces;
}

/** Abertura cuyo centro está más cerca del punto, dentro de la tolerancia. */
export function pickOpening(
  openings: Opening[],
  wallById: (id: string) => Wall | undefined,
  p: Vec2,
  tol: number,
): Opening | null {
  let best: Opening | null = null;
  let bestD = tol;
  for (const o of openings) {
    const w = wallById(o.wallId);
    if (!w) continue;
    const f = openingFrame(w, o);
    const d = Math.hypot(p.x - f.center.x, p.z - f.center.z);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}
