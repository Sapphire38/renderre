import type { Furniture, Opening, Wall } from "./types";
import { uid } from "./geometry";
import { makeFurniture, presetFor } from "./furniture";
import { makeOpening } from "./openings";
import type { SceneSpec } from "./ai-parse";

const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function mkWall(
  a: [number, number],
  b: [number, number],
  thickness: number,
  height: number,
): Wall {
  return {
    id: uid(),
    a: { x: a[0], z: a[1] },
    b: { x: b[0], z: b[1] },
    thickness,
    height,
  };
}

/** Construye muros + muebles concretos (con ids) desde una SceneSpec. */
export function buildScene(
  spec: SceneSpec,
  defaults: { thickness: number; height: number },
): { walls: Wall[]; furniture: Furniture[]; openings: Opening[] } {
  const walls: Wall[] = [];
  const furniture: Furniture[] = [];
  const openings: Opening[] = [];
  const specWallIds: string[] = [];
  const th = defaults.thickness;
  const ht = defaults.height;

  // Si el modelo dio muros explícitos (plano), ignoramos "room" para no duplicar.
  const room = spec.walls && spec.walls.length ? undefined : spec.room;
  if (room) {
    const cx = room.x ?? 0;
    const cz = room.z ?? 0;
    const t = room.wallThickness ?? th;
    const h = room.wallHeight ?? ht;
    const x0 = cx - room.width / 2;
    const x1 = cx + room.width / 2;
    const z0 = cz - room.depth / 2;
    const z1 = cz + room.depth / 2;
    walls.push(mkWall([x0, z0], [x1, z0], t, h));
    walls.push(mkWall([x1, z0], [x1, z1], t, h));
    walls.push(mkWall([x1, z1], [x0, z1], t, h));
    walls.push(mkWall([x0, z1], [x0, z0], t, h));
  }

  for (const sw of spec.walls ?? []) {
    const w = mkWall(sw.a, sw.b, sw.thickness ?? th, sw.height ?? ht);
    walls.push(w);
    specWallIds.push(w.id);
  }

  for (const o of spec.openings ?? []) {
    const wid = specWallIds[o.wall];
    const wall = wid ? walls.find((w) => w.id === wid) : undefined;
    if (!wall) continue;
    const len = Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z);
    const op = makeOpening(wid!, o.kind === "window" ? "window" : "door", o.offset ?? len / 2);
    if (o.width != null) op.width = clampN(o.width, 0.2, 4);
    if (o.height != null) op.height = clampN(o.height, 0.2, 3);
    if (o.sill != null) op.sill = clampN(o.sill, 0, 2);
    openings.push(op);
  }

  const items = spec.furniture ?? [];
  if (items.length) {
    const resolved = items.map((it) => {
      const p = presetFor(it.kind);
      return { ...it, width: it.width ?? p.width, depth: it.depth ?? p.depth };
    });
    const gap = 0.1;
    const totalW =
      resolved.reduce((s, r) => s + r.width, 0) + gap * Math.max(0, resolved.length - 1);
    let cursor = -totalW / 2;
    const roomCx = room?.x ?? 0;
    const roomCz = room?.z ?? 0;
    const backZ = room ? -room.depth / 2 : 0;
    for (const r of resolved) {
      const cxItem = cursor + r.width / 2;
      cursor += r.width + gap;
      const z = room ? backZ + r.depth / 2 + 0.02 : 0;
      const rotDeg = r.rotDeg ?? (room ? 180 : 0);
      const f = makeFurniture(r.kind, { x: roomCx + cxItem, z: roomCz + z }, rotDeg);
      if (r.width != null) f.width = r.width;
      if (r.depth != null) f.depth = r.depth;
      if (r.height != null) f.height = r.height;
      if (r.doors != null) f.doors = r.doors;
      if (r.shelves != null) f.shelves = r.shelves;
      if (r.baseHeight != null) f.baseHeight = r.baseHeight;
      if (r.name) f.name = r.name;
      if (r.color) f.color = r.color;
      furniture.push(f);
    }
  }

  return { walls, furniture, openings };
}
