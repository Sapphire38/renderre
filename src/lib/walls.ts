import type { WallKind } from "./types";

/** Metadatos de cada tipo de muro/cerco para la UI y el render. */
export type WallKindMeta = {
  value: WallKind;
  label: string;
  /** true = cuerpo macizo (se extruye como pared). false = cerco calado (postes + barrotes). */
  solid: boolean;
  /** Color por defecto cuando el muro no tiene material asignado. */
  color: string;
  /** Color/estilo para el dibujo en planta (más claro, legible sobre el fondo oscuro). */
  plan: string;
};

export const WALL_KINDS: WallKindMeta[] = [
  { value: "solid", label: "Liso", solid: true, color: "#d6d3cd", plan: "rgba(206,213,224,0.92)" },
  { value: "brick", label: "Ladrillo", solid: true, color: "#a8553f", plan: "rgba(196,118,92,0.95)" },
  { value: "stone", label: "Piedra", solid: true, color: "#8d8a82", plan: "rgba(170,166,156,0.95)" },
  { value: "block", label: "Bloque", solid: true, color: "#b8b8b2", plan: "rgba(190,190,184,0.95)" },
  { value: "glass", label: "Vidrio", solid: true, color: "#bcd6e6", plan: "rgba(150,200,225,0.85)" },
  { value: "hedge", label: "Seto", solid: true, color: "#3f7d3a", plan: "rgba(95,170,90,0.92)" },
  { value: "fence", label: "Alambrado", solid: false, color: "#9aa0a6", plan: "rgba(180,186,192,0.95)" },
  { value: "railing", label: "Reja", solid: false, color: "#3a3d42", plan: "rgba(150,156,164,0.95)" },
  { value: "picket", label: "Cerco madera", solid: false, color: "#c8b48a", plan: "rgba(210,188,140,0.95)" },
];

const META = new Map<WallKind, WallKindMeta>(WALL_KINDS.map((m) => [m.value, m]));

export function wallKindMeta(kind?: WallKind): WallKindMeta {
  return META.get(kind ?? "solid") ?? WALL_KINDS[0];
}

/** ¿El muro se renderiza como cuerpo macizo (true) o como cerco calado (false)? */
export function isSolidWall(kind?: WallKind): boolean {
  return wallKindMeta(kind).solid;
}

export const defaultWallColor = (kind?: WallKind): string => wallKindMeta(kind).color;
export const wallPlanColor = (kind?: WallKind): string => wallKindMeta(kind).plan;

/** Una caja (poste/barrote/alambre) en el marco LOCAL del muro: x a lo largo (centrado), y desde la base, z a través del espesor. */
export type FenceBox = { pos: [number, number, number]; size: [number, number, number] };

/**
 * Geometría de un cerco calado (postes + barrotes/alambres) en el marco local del muro.
 * len = largo, h = alto, t = espesor. Devuelve cajas para mapear a meshes en 3D.
 */
export function fencePieces(len: number, h: number, t: number, kind: WallKind): FenceBox[] {
  if (len < 1e-3 || h < 1e-3) return [];
  const boxes: FenceBox[] = [];
  const td = Math.min(t, 0.08); // profundidad visual de las cajas (acotada)
  const half = len / 2;

  // Postes distribuidos a lo largo, incluyendo ambos extremos.
  const addPosts = (gap: number, postW: number, postD: number, postH: number) => {
    const n = Math.max(2, Math.round(len / gap) + 1);
    for (let i = 0; i < n; i++) {
      const x = -half + (len * i) / (n - 1);
      boxes.push({ pos: [x, postH / 2, 0], size: [postW, postH, postD] });
    }
  };
  // Riel/alambre horizontal a lo largo de todo el muro, a una altura y.
  const addRail = (y: number, railH: number, railD: number) => {
    boxes.push({ pos: [0, y, 0], size: [len, railH, railD] });
  };
  // Barrotes/estacas verticales distribuidos.
  const addBalusters = (gap: number, w: number, d: number, y0: number, y1: number) => {
    const n = Math.max(2, Math.round(len / gap));
    const bh = Math.max(y1 - y0, 0.02);
    for (let i = 0; i <= n; i++) {
      const x = -half + (len * i) / n;
      boxes.push({ pos: [x, (y0 + y1) / 2, 0], size: [w, bh, d] });
    }
  };

  if (kind === "fence") {
    // Alambrado: postes cada ~2.5 m + 4 alambres horizontales.
    addPosts(2.5, 0.06, td, h);
    const wires = 4;
    for (let i = 0; i < wires; i++) {
      const y = 0.12 + ((h - 0.2) * i) / (wires - 1);
      addRail(y, 0.012, 0.012);
    }
  } else if (kind === "railing") {
    // Reja/baranda: riel superior e inferior + barrotes verticales.
    addRail(h - 0.025, 0.05, Math.min(td, 0.05));
    addRail(0.06, 0.04, Math.min(td, 0.05));
    addBalusters(0.12, 0.02, 0.02, 0.06, h - 0.05);
    addPosts(2.5, 0.05, Math.min(td, 0.06), h); // postes de apoyo
  } else {
    // picket — cerco de madera: 2 rieles + estacas anchas.
    addRail(h * 0.3, 0.05, 0.025);
    addRail(h * 0.72, 0.05, 0.025);
    addBalusters(0.11, 0.07, 0.022, 0, h);
    addPosts(2.4, 0.08, 0.05, h * 1.02);
  }
  return boxes;
}
