import type { Terrain } from "./types";

/**
 * Malla de terreno (heightfield): grilla regular de vértices con altura propia,
 * esculpible con un pincel. Coordenadas en metros, plano XZ.
 *
 * heights[iz * (cols+1) + ix] = altura (m) del vértice (ix, iz).
 * Vértice (ix,iz) en mundo: x = origin.x + ix*cell, z = origin.z + iz*cell.
 */

export const TERRAIN_MODES = ["raise", "lower", "flatten", "smooth"] as const;
export type TerrainMode = (typeof TERRAIN_MODES)[number];

/** Crea un terreno plano centrado en el origen. */
export function makeTerrain(cols = 24, rows = 24, cell = 1): Terrain {
  const nx = cols + 1;
  const nz = rows + 1;
  return {
    enabled: true,
    origin: { x: -(cols * cell) / 2, z: -(rows * cell) / 2 },
    cols,
    rows,
    cell,
    heights: new Array(nx * nz).fill(0),
  };
}

export const nxOf = (t: Terrain) => t.cols + 1;
export const nzOf = (t: Terrain) => t.rows + 1;
export const idx = (t: Terrain, ix: number, iz: number) => iz * (t.cols + 1) + ix;

/** Asegura que el array de alturas tenga el tamaño correcto (por si cambió la grilla). */
export function normalizeHeights(t: Terrain): number[] {
  const n = nxOf(t) * nzOf(t);
  if (t.heights.length === n) return t.heights;
  const h = new Array(n).fill(0);
  for (let i = 0; i < Math.min(n, t.heights.length); i++) h[i] = t.heights[i];
  return h;
}

/** Altura interpolada (bilineal) en un punto del mundo. Fuera de la grilla → 0. */
export function sampleHeight(t: Terrain, wx: number, wz: number): number {
  const gx = (wx - t.origin.x) / t.cell;
  const gz = (wz - t.origin.z) / t.cell;
  if (gx < 0 || gz < 0 || gx > t.cols || gz > t.rows) return 0;
  const ix = Math.floor(Math.min(gx, t.cols - 1e-6));
  const iz = Math.floor(Math.min(gz, t.rows - 1e-6));
  const fx = gx - ix;
  const fz = gz - iz;
  const h = t.heights;
  const h00 = h[idx(t, ix, iz)] ?? 0;
  const h10 = h[idx(t, ix + 1, iz)] ?? 0;
  const h01 = h[idx(t, ix, iz + 1)] ?? 0;
  const h11 = h[idx(t, ix + 1, iz + 1)] ?? 0;
  const a = h00 * (1 - fx) + h10 * fx;
  const b = h01 * (1 - fx) + h11 * fx;
  return a * (1 - fz) + b * fz;
}

/**
 * Esculpe el terreno con un pincel circular y devuelve un NUEVO array de alturas.
 * - raise/lower: suma/resta `strength` con caída suave hacia el borde del pincel.
 * - flatten: lleva las alturas hacia la altura del centro del pincel.
 * - smooth: promedia con los vecinos (suaviza).
 */
export function sculpt(
  t: Terrain,
  wx: number,
  wz: number,
  radius: number,
  strength: number,
  mode: TerrainMode,
): number[] {
  const src = normalizeHeights(t);
  const out = src.slice();
  const nx = nxOf(t);
  const nz = nzOf(t);
  const r2 = radius * radius;
  const target = mode === "flatten" ? sampleHeight(t, wx, wz) : 0;

  // rango de índices afectados
  const minIx = Math.max(0, Math.floor((wx - radius - t.origin.x) / t.cell));
  const maxIx = Math.min(nx - 1, Math.ceil((wx + radius - t.origin.x) / t.cell));
  const minIz = Math.max(0, Math.floor((wz - radius - t.origin.z) / t.cell));
  const maxIz = Math.min(nz - 1, Math.ceil((wz + radius - t.origin.z) / t.cell));

  for (let iz = minIz; iz <= maxIz; iz++) {
    for (let ix = minIx; ix <= maxIx; ix++) {
      const vx = t.origin.x + ix * t.cell;
      const vz = t.origin.z + iz * t.cell;
      const d2 = (vx - wx) * (vx - wx) + (vz - wz) * (vz - wz);
      if (d2 > r2) continue;
      const falloff = Math.pow(1 - Math.sqrt(d2) / radius, 2); // suave hacia el borde
      const i = iz * nx + ix;
      if (mode === "raise") out[i] = src[i] + strength * falloff;
      else if (mode === "lower") out[i] = src[i] - strength * falloff;
      else if (mode === "flatten") out[i] = src[i] + (target - src[i]) * falloff * 0.6;
      else if (mode === "smooth") {
        let sum = 0;
        let cnt = 0;
        for (let dz = -1; dz <= 1; dz++)
          for (let dx = -1; dx <= 1; dx++) {
            const jx = ix + dx;
            const jz = iz + dz;
            if (jx < 0 || jz < 0 || jx >= nx || jz >= nz) continue;
            sum += src[jz * nx + jx];
            cnt++;
          }
        const avg = cnt ? sum / cnt : src[i];
        out[i] = src[i] + (avg - src[i]) * falloff * 0.7;
      }
    }
  }
  return out;
}

export function heightRange(t: Terrain): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const h of t.heights) {
    if (h < min) min = h;
    if (h > max) max = h;
  }
  if (!Number.isFinite(min)) return { min: 0, max: 0 };
  return { min, max };
}

/** Geometría de la malla: posiciones, índices y uvs para three. */
export function buildTerrainGeometry(t: Terrain): {
  positions: Float32Array;
  indices: Uint32Array;
  uvs: Float32Array;
} {
  const nx = nxOf(t);
  const nz = nzOf(t);
  const h = normalizeHeights(t);
  const positions = new Float32Array(nx * nz * 3);
  const uvs = new Float32Array(nx * nz * 2);
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const i = iz * nx + ix;
      positions[i * 3] = t.origin.x + ix * t.cell;
      positions[i * 3 + 1] = h[i];
      positions[i * 3 + 2] = t.origin.z + iz * t.cell;
      uvs[i * 2] = ix / t.cols;
      uvs[i * 2 + 1] = iz / t.rows;
    }
  }
  const indices = new Uint32Array(t.cols * t.rows * 6);
  let p = 0;
  for (let iz = 0; iz < t.rows; iz++) {
    for (let ix = 0; ix < t.cols; ix++) {
      const a = iz * nx + ix;
      const b = a + 1;
      const c = a + nx;
      const dd = c + 1;
      // dos triángulos por celda (orientación arriba)
      indices[p++] = a; indices[p++] = c; indices[p++] = b;
      indices[p++] = b; indices[p++] = c; indices[p++] = dd;
    }
  }
  return { positions, indices, uvs };
}

/** Color por altura en componentes 0..1 (verde bajo → tierra → claro alto; azul si negativo). */
export function heightColor01(h: number, min: number, max: number): [number, number, number] {
  if (h < -0.02) return [0.184, 0.435, 0.561]; // depresión / agua (#2f6f8f)
  const span = Math.max(0.001, max - Math.max(0, min));
  const t = Math.max(0, Math.min(1, (h - Math.max(0, min)) / span));
  const stops: [number, [number, number, number]][] = [
    [0, [63, 125, 58]],
    [0.5, [150, 130, 80]],
    [1, [225, 220, 205]],
  ];
  let lo = stops[0];
  let hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  const f = (t - lo[0]) / Math.max(0.001, hi[0] - lo[0]);
  return [
    (lo[1][0] + (hi[1][0] - lo[1][0]) * f) / 255,
    (lo[1][1] + (hi[1][1] - lo[1][1]) * f) / 255,
    (lo[1][2] + (hi[1][2] - lo[1][2]) * f) / 255,
  ];
}

/** Color para el mapa de calor 2D del editor (verde bajo → tierra → claro alto; azul si negativo). */
export function heightColor(h: number, min: number, max: number): string {
  const [r, g, b] = heightColor01(h, min, max);
  return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
}
