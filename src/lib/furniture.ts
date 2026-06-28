import type { ComponentKind, Furniture, FurnitureComponent, FurnitureKind, Vec2 } from "./types";
import { uid } from "./geometry";

/** Un panel de MDF en el marco LOCAL del mueble (centro del footprint, y=0 en el piso). */
export type Panel = {
  pos: [number, number, number];
  size: [number, number, number];
  door?: boolean;
  pivot?: [number, number, number]; // eje de giro (puerta batiente)
  rotY?: number; // rotación alrededor del pivot
  cylinder?: boolean; // forma cilíndrica (barral, hornalla, etc.)
  cylAxis?: "x" | "y" | "z"; // eje del cilindro (default "x"); largo = size en ese eje, radio = otro
  shape?: "sphere" | "cone" | "pyramid" | "wedge"; // primitivas no-caja
  color?: string; // color propio del panel
  materialId?: string; // material propio del panel (tiene prioridad sobre color)
};

export type FurniturePreset = {
  kind: FurnitureKind;
  name: string;
  width: number;
  depth: number;
  height: number;
  panel: number;
  shelves: number;
  doors: number;
  baseHeight: number;
  color: string;
  category?: "mdf" | "equip" | "prim"; // equip = electrodomésticos/objetos · prim = primitivas
};

const MDF = 0.018; // 18 mm, placa estándar

export const FURNITURE_PRESETS: FurniturePreset[] = [
  { kind: "module", name: "Módulo", width: 0.6, depth: 0.4, height: 0.8, panel: MDF, shelves: 1, doors: 0, baseHeight: 0, color: "#c9b18b" },
  { kind: "cabinet-base", name: "Bajo mesada", width: 0.6, depth: 0.6, height: 0.85, panel: MDF, shelves: 1, doors: 2, baseHeight: 0, color: "#cdb595" },
  { kind: "cabinet-wall", name: "Alacena", width: 0.6, depth: 0.32, height: 0.7, panel: MDF, shelves: 1, doors: 2, baseHeight: 1.45, color: "#cdb595" },
  { kind: "shelf", name: "Estantería", width: 0.8, depth: 0.3, height: 1.8, panel: MDF, shelves: 4, doors: 0, baseHeight: 0, color: "#c9b18b" },
  { kind: "countertop", name: "Mesada", width: 1.2, depth: 0.6, height: 0.04, panel: 0.04, shelves: 0, doors: 0, baseHeight: 0.85, color: "#3a3f45" },
  { kind: "wardrobe", name: "Placard", width: 1.8, depth: 0.6, height: 2.4, panel: MDF, shelves: 3, doors: 3, baseHeight: 0, color: "#d8c4a3" },
  { kind: "table", name: "Mesa", width: 1.2, depth: 0.8, height: 0.75, panel: 0.025, shelves: 0, doors: 0, baseHeight: 0, color: "#b98b5e" },
  // --- Equipamiento ---
  { kind: "tv", name: "TV", width: 1.1, depth: 0.08, height: 0.62, panel: MDF, shelves: 0, doors: 0, baseHeight: 0.5, color: "#1b1d22", category: "equip" },
  { kind: "fridge", name: "Heladera", width: 0.7, depth: 0.7, height: 1.8, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#c9ced3", category: "equip" },
  { kind: "stove", name: "Cocina", width: 0.6, depth: 0.6, height: 0.9, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#e6e8eb", category: "equip" },
  { kind: "sink", name: "Bacha", width: 0.8, depth: 0.55, height: 0.2, panel: MDF, shelves: 0, doors: 0, baseHeight: 0.85, color: "#ced3d8", category: "equip" },
  { kind: "washer", name: "Lavarropas", width: 0.6, depth: 0.6, height: 0.85, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#edeff1", category: "equip" },
  { kind: "toilet", name: "Inodoro", width: 0.4, depth: 0.68, height: 0.78, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#f1f3f5", category: "equip" },
  { kind: "bed", name: "Cama", width: 1.5, depth: 2.0, height: 0.5, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#9aa3ad", category: "equip" },
  { kind: "sofa", name: "Sofá", width: 1.9, depth: 0.9, height: 0.82, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#6f7681", category: "equip" },
  { kind: "tv-stand", name: "Mueble TV", width: 1.4, depth: 0.4, height: 0.45, panel: MDF, shelves: 0, doors: 2, baseHeight: 0, color: "#caa472", category: "mdf" },
  { kind: "nightstand", name: "Mesa de luz", width: 0.45, depth: 0.4, height: 0.5, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#caa472", category: "mdf" },
  { kind: "desk", name: "Escritorio", width: 1.2, depth: 0.6, height: 0.75, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#caa472", category: "mdf" },
  { kind: "vanity", name: "Vanitory (baño)", width: 0.8, depth: 0.5, height: 0.85, panel: MDF, shelves: 0, doors: 2, baseHeight: 0, color: "#d7d2c8", category: "equip" },
  // --- equipamiento / objetos nuevos ---
  { kind: "water-heater", name: "Termotanque", width: 0.5, depth: 0.5, height: 1.4, panel: MDF, shelves: 0, doors: 0, baseHeight: 0.4, color: "#dfe2e5", category: "equip" },
  { kind: "bathtub", name: "Bañera", width: 1.7, depth: 0.75, height: 0.58, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#eef1f3", category: "equip" },
  { kind: "shower", name: "Ducha", width: 0.9, depth: 0.9, height: 2.0, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#cfe3ea", category: "equip" },
  { kind: "chair", name: "Silla", width: 0.45, depth: 0.48, height: 0.9, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#8a6b4f", category: "equip" },
  { kind: "plant", name: "Planta", width: 0.45, depth: 0.45, height: 1.0, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#3f7d3a", category: "equip" },
  { kind: "round-table", name: "Mesa redonda", width: 1.1, depth: 1.1, height: 0.75, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#b98b5e", category: "equip" },
  { kind: "coffee-table", name: "Mesa ratona", width: 1.0, depth: 0.55, height: 0.4, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#b98b5e", category: "equip" },
  { kind: "stairs", name: "Escalera", width: 1.0, depth: 3.0, height: 2.7, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#c2c5c9", category: "equip" },
  // --- primitivas ---
  { kind: "prim-box", name: "Caja", width: 0.5, depth: 0.5, height: 0.5, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#9aa3ad", category: "prim" },
  { kind: "prim-cylinder", name: "Cilindro", width: 0.5, depth: 0.5, height: 0.8, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#9aa3ad", category: "prim" },
  { kind: "prim-sphere", name: "Esfera", width: 0.6, depth: 0.6, height: 0.6, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#9aa3ad", category: "prim" },
  { kind: "prim-cone", name: "Cono", width: 0.6, depth: 0.6, height: 0.9, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#9aa3ad", category: "prim" },
  { kind: "prim-pyramid", name: "Pirámide", width: 0.6, depth: 0.6, height: 0.7, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#9aa3ad", category: "prim" },
  { kind: "prim-wedge", name: "Rampa/cuña", width: 1.0, depth: 0.6, height: 0.5, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#9aa3ad", category: "prim" },
];

const APPLIANCE_KINDS = new Set<FurnitureKind>([
  "tv", "fridge", "stove", "sink", "washer", "toilet", "bed", "sofa",
  "tv-stand", "nightstand", "desk", "vanity",
  "water-heater", "bathtub", "shower", "chair", "plant", "round-table", "coffee-table", "stairs",
  "prim-box", "prim-cylinder", "prim-sphere", "prim-cone", "prim-pyramid", "prim-wedge",
]);
export const isAppliance = (k: FurnitureKind) => APPLIANCE_KINDS.has(k);

export function presetFor(kind: FurnitureKind): FurniturePreset {
  return FURNITURE_PRESETS.find((p) => p.kind === kind) ?? FURNITURE_PRESETS[0];
}

export function makeFurniture(kind: FurnitureKind, pos: Vec2, rotDeg = 0): Furniture {
  const p = presetFor(kind);
  return {
    id: uid(),
    kind,
    name: p.name,
    pos: { ...pos },
    rotDeg,
    width: p.width,
    depth: p.depth,
    height: p.height,
    panel: p.panel,
    shelves: p.shelves,
    doors: p.doors,
    baseHeight: p.baseHeight,
    color: p.color,
  };
}

/**
 * Crea un mueble CUSTOM (para el taller) a partir de un preset del programa,
 * generando componentes (estantes + puertas) que aproximan al preset. Sirve para
 * "usar de base" un preset y seguir editándolo en el taller.
 */
export function customFromPreset(kind: FurnitureKind): Furniture {
  const f = makeFurniture(kind, { x: 0, z: 0 });
  const W = f.width;
  const H = f.height;
  const t = f.panel;
  const inW = Math.max(W - 2 * t, 0.1);
  const inH = Math.max(H - 2 * t, 0.1);
  const comps: FurnitureComponent[] = [];
  for (let i = 1; i <= f.shelves; i++) {
    const y = t + (inH * i) / (f.shelves + 1);
    comps.push({ id: uid(), kind: "shelf", x: t, y, w: inW, h: t });
  }
  if (f.doors > 0) {
    const gap = 0.003;
    const dw = (inW - gap * (f.doors - 1)) / f.doors;
    for (let i = 0; i < f.doors; i++) {
      comps.push({
        id: uid(),
        kind: "doorHinged",
        x: t + i * (dw + gap),
        y: t,
        w: dw,
        h: inH,
        hinge: i % 2 === 0 ? "left" : "right",
        open: 0,
      });
    }
  }
  return { ...f, id: uid(), kind: "custom", name: f.name, components: comps, back: true };
}

/** Genera los paneles MDF en coordenadas locales (centradas en el footprint, y desde el piso). */
export function carcassPanels(f: Furniture): Panel[] {
  if (f.kind === "custom") return buildCustomPanels(f);
  if (APPLIANCE_KINDS.has(f.kind)) return appliancePanels(f);
  const W = f.width;
  const D = f.depth;
  const H = f.height;
  const t = Math.min(f.panel, Math.min(W, D, H) / 2);
  const base = f.baseHeight;
  const panels: Panel[] = [];

  if (f.kind === "countertop") {
    panels.push({ pos: [0, base + H / 2, 0], size: [W, H, D] });
    return panels;
  }

  if (f.kind === "table") {
    const topT = Math.max(t, 0.025);
    const legD = 0.06;
    const legH = Math.max(H - topT, 0.05);
    panels.push({ pos: [0, base + H - topT / 2, 0], size: [W, topT, D] });
    const lx = W / 2 - legD;
    const lz = D / 2 - legD;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        // patas redondas (cilindro vertical)
        panels.push({ pos: [sx * lx, base + legH / 2, sz * lz], size: [legD, legH, legD], cylinder: true, cylAxis: "y" });
      }
    }
    return panels;
  }

  // Carcasa genérica: laterales, piso, techo, fondo, estantes y puertas.
  const innerW = Math.max(W - 2 * t, 0.02);
  panels.push({ pos: [-(W / 2 - t / 2), base + H / 2, 0], size: [t, H, D] }); // lateral izq
  panels.push({ pos: [W / 2 - t / 2, base + H / 2, 0], size: [t, H, D] }); // lateral der
  panels.push({ pos: [0, base + t / 2, 0], size: [innerW, t, D] }); // piso
  panels.push({ pos: [0, base + H - t / 2, 0], size: [innerW, t, D] }); // techo
  panels.push({ pos: [0, base + H / 2, D / 2 - t / 2], size: [innerW, H - 2 * t, t] }); // fondo

  for (let i = 1; i <= f.shelves; i++) {
    const sy = base + t + ((H - 2 * t) * i) / (f.shelves + 1);
    panels.push({ pos: [0, sy, 0], size: [innerW, t, D - t] });
  }

  if (f.doors > 0) {
    const gap = 0.003;
    const doorW = (W - gap * (f.doors + 1)) / f.doors;
    const doorH = H - 2 * t - gap * 2;
    for (let i = 0; i < f.doors; i++) {
      const dx = -W / 2 + gap + doorW / 2 + i * (doorW + gap);
      panels.push({
        pos: [dx, base + H / 2, -(D / 2 - t / 2)],
        size: [doorW, doorH, t],
        door: true,
      });
    }
  }

  return panels;
}

/** Rota un offset local (lx,lz) por rotDeg y lo suma a la posición → punto mundo. */
export function localToWorld(f: Furniture, lx: number, lz: number): Vec2 {
  const a = (f.rotDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: f.pos.x + lx * c - lz * s, z: f.pos.z + lx * s + lz * c };
}

/** Lleva un punto mundo al marco local del mueble (x a lo ancho, z en profundidad). */
export function worldToLocal(f: Furniture, p: Vec2): Vec2 {
  const a = (-f.rotDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const dx = p.x - f.pos.x;
  const dz = p.z - f.pos.z;
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}

/** Las 4 esquinas del footprint en coordenadas mundo. */
export function footprintCorners(f: Furniture): Vec2[] {
  const hw = f.width / 2;
  const hd = f.depth / 2;
  return [
    localToWorld(f, -hw, -hd),
    localToWorld(f, hw, -hd),
    localToWorld(f, hw, hd),
    localToWorld(f, -hw, hd),
  ];
}

/** ¿El punto está dentro del footprint del mueble? */
export function pointInFurniture(f: Furniture, p: Vec2): boolean {
  const l = worldToLocal(f, p);
  return Math.abs(l.x) <= f.width / 2 && Math.abs(l.z) <= f.depth / 2;
}

/** Mueble (el último dibujado = arriba) que contiene el punto. */
export function pickFurniture(list: Furniture[], p: Vec2): Furniture | null {
  for (let i = list.length - 1; i >= 0; i--) {
    if (pointInFurniture(list[i], p)) return list[i];
  }
  return null;
}

// ===================== Muebles custom (taller) =====================

const GAP = 0.003;

export function makeCustomFurniture(): Furniture {
  return {
    id: uid(),
    kind: "custom",
    name: "Mueble nuevo",
    pos: { x: 0, z: 0 },
    rotDeg: 0,
    width: 0.8,
    depth: 0.5,
    height: 1.2,
    panel: 0.018,
    shelves: 0,
    doors: 0,
    baseHeight: 0,
    color: "#c9b18b",
    components: [],
    back: true,
    carcass: true,
  };
}

/** Crea un componente con valores razonables dentro de la cara del mueble. */
export function makeComponent(kind: ComponentKind, f: Furniture): FurnitureComponent {
  const W = f.width;
  const H = f.height;
  const t = f.panel;
  const id = uid();
  const inW = Math.max(W - 2 * t, 0.1);
  const inH = Math.max(H - 2 * t, 0.1);
  switch (kind) {
    case "shelf":
      return { id, kind, x: t, y: H / 2, w: inW, h: t };
    case "drawer":
      return { id, kind, x: t, y: t, w: inW, h: Math.min(0.28, inH), count: 1, open: 0 };
    case "doorHinged":
      return { id, kind, x: t, y: t, w: inW, h: inH, hinge: "left", open: 0 };
    case "doorSliding":
      return { id, kind, x: t, y: t, w: inW, h: inH, count: 2, open: 0 };
    case "divider":
      return { id, kind, x: W / 2 - t / 2, y: t, w: t, h: inH };
    case "rod":
      return { id, kind, x: t, y: H * 0.85, w: inW, h: 0.03 };
    case "board":
    default:
      return { id, kind, x: W * 0.25, y: H * 0.25, w: W * 0.5, h: H * 0.4, orient: "front" };
  }
}

/** Genera los paneles 3D de un mueble custom: carcasa + componentes. */
export function buildCustomPanels(f: Furniture): Panel[] {
  const W = f.width;
  const D = f.depth;
  const H = f.height;
  const t = Math.min(f.panel, Math.min(W, D, H) / 3);
  const base = f.baseHeight;
  const inW = Math.max(W - 2 * t, 0.02);
  const panels: Panel[] = [];

  // carcasa (caja). Se puede desactivar para hacer formas libres (ej. una escalera).
  if (f.carcass !== false) {
    panels.push({ pos: [-(W / 2 - t / 2), base + H / 2, 0], size: [t, H, D] });
    panels.push({ pos: [W / 2 - t / 2, base + H / 2, 0], size: [t, H, D] });
    panels.push({ pos: [0, base + t / 2, 0], size: [inW, t, D] });
    panels.push({ pos: [0, base + H - t / 2, 0], size: [inW, t, D] });
    if (f.back !== false) panels.push({ pos: [0, base + H / 2, D / 2 - t / 2], size: [inW, H - 2 * t, t] });
  }

  const cx = (x: number, w: number) => -W / 2 + x + w / 2;
  const cyTop = (y: number, h: number) => base + y + h / 2;
  const frontZ = -(D / 2 - t / 2);
  const cl = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const fullD = D - t;
  // Profundidad (eje Z) y retiro desde el frente de un componente.
  // Sin depth ni depthInset → comportamiento previo (centrado, casi toda la profundidad).
  const depthZ = (c: FurnitureComponent): { zc: number; zs: number } => {
    if (c.depth == null) {
      const zs = fullD;
      if (c.depthInset == null) return { zc: 0, zs };
      const inset = cl(c.depthInset, 0, Math.max(0, D - zs));
      return { zc: -D / 2 + inset + zs / 2, zs };
    }
    const zs = cl(c.depth, 0.02, D);
    const inset = c.depthInset != null ? cl(c.depthInset, 0, Math.max(0, D - zs)) : (D - zs) / 2;
    return { zc: -D / 2 + inset + zs / 2, zs };
  };

  for (const c of f.components ?? []) {
    const open = c.open ?? 0;
    const col = c.color; // color propio del componente (si falta, usa el del mueble)
    const mat = c.materialId; // material propio del componente (textura/melamina)
    if (c.kind === "shelf") {
      const d = depthZ(c);
      panels.push({ pos: [cx(c.x, c.w), base + c.y, d.zc], size: [c.w, t, d.zs], color: col, materialId: mat });
    } else if (c.kind === "divider") {
      const d = depthZ(c);
      panels.push({ pos: [cx(c.x, c.w), cyTop(c.y, c.h), d.zc], size: [Math.max(c.w, t), c.h, d.zs], color: col, materialId: mat });
    } else if (c.kind === "rod") {
      panels.push({ pos: [cx(c.x, c.w), base + c.y, 0], size: [c.w, 0.03, 0.03], cylinder: true, color: col ?? "#9aa3ad" });
    } else if (c.kind === "board") {
      const o = c.orient ?? "front";
      if (o === "front") {
        const inset = cl(c.depthInset ?? 0, 0, Math.max(0, D - t));
        panels.push({ pos: [cx(c.x, c.w), cyTop(c.y, c.h), frontZ + inset], size: [c.w, c.h, t], color: col, materialId: mat });
      } else if (o === "horizontal") {
        const d = depthZ(c);
        panels.push({ pos: [cx(c.x, c.w), base + c.y + c.h / 2, d.zc], size: [c.w, t, d.zs], color: col, materialId: mat });
      } else {
        const d = depthZ(c);
        panels.push({ pos: [cx(c.x, c.w), cyTop(c.y, c.h), d.zc], size: [t, c.h, d.zs], color: col, materialId: mat });
      }
    } else if (c.kind === "drawer") {
      const n = Math.max(1, c.count ?? 1);
      const each = c.h / n;
      const pull = open * Math.min(D * 0.7, 0.4);
      const boxD = cl(c.depth ?? D - 2 * t - 0.02, 0.05, D - t);
      for (let i = 0; i < n; i++) {
        const dy = c.y + i * each;
        const fY = cyTop(dy, each);
        const fz = frontZ - pull;
        const bxc = cx(c.x, c.w);
        const boxZc = fz + t / 2 + boxD / 2;
        const sideH = Math.max(each * 0.55, 0.05);
        const boxYc = fY - each / 2 + sideH / 2 + t;
        panels.push({ pos: [bxc, fY, fz], size: [c.w - GAP, each - GAP, t], door: true, color: col, materialId: mat }); // frente
        panels.push({ pos: [bxc, fY - each / 2 + t, boxZc], size: [c.w - 2 * t, t, boxD] }); // piso
        panels.push({ pos: [bxc, boxYc, boxZc + boxD / 2 - t / 2], size: [c.w - 2 * t, sideH, t] }); // fondo cajón
        panels.push({ pos: [bxc - c.w / 2 + t / 2, boxYc, boxZc], size: [t, sideH, boxD] }); // lado izq
        panels.push({ pos: [bxc + c.w / 2 - t / 2, boxYc, boxZc], size: [t, sideH, boxD] }); // lado der
      }
    } else if (c.kind === "doorHinged") {
      const hingeLeft = (c.hinge ?? "left") === "left";
      const pivotX = hingeLeft ? cx(c.x, c.w) - c.w / 2 : cx(c.x, c.w) + c.w / 2;
      const rot = (hingeLeft ? 1 : -1) * open * Math.PI * 0.62;
      panels.push({
        pos: [cx(c.x, c.w), cyTop(c.y, c.h), frontZ],
        size: [c.w - GAP, c.h - GAP, t],
        door: true,
        color: col,
        materialId: mat,
        pivot: [pivotX, cyTop(c.y, c.h), frontZ],
        rotY: rot,
      });
    } else if (c.kind === "doorSliding") {
      // Hojas en 2 carriles bien separados. Cerradas: tilean el hueco con leve solape.
      // Al abrir, cada hoja se corre hacia la izquierda y se apilan sobre la hoja 0.
      const n = Math.max(2, c.count ?? 2);
      const seg = c.w / n;
      const overlap = Math.min(0.04, seg * 0.12);
      const leafW = seg + overlap;
      const trackGap = t + 0.012;
      for (let i = 0; i < n; i++) {
        const track = i % 2;
        const z = frontZ - track * trackGap;
        const closedX = -W / 2 + c.x + i * seg + seg / 2;
        const x = closedX - open * i * seg;
        panels.push({ pos: [x, cyTop(c.y, c.h), z], size: [leafW - GAP, c.h - GAP, t], door: true, color: col, materialId: mat });
      }
    }
  }
  return panels;
}

/** Genera la forma 3D (cajas + cilindros con color) de un equipamiento. Frente hacia -z. */
export function appliancePanels(f: Furniture): Panel[] {
  const W = f.width;
  const D = f.depth;
  const H = f.height;
  const base = f.baseHeight;
  const P: Panel[] = [];
  const box = (cx: number, cy: number, cz: number, w: number, h: number, d: number, color: string) =>
    P.push({ pos: [cx, base + cy, cz], size: [Math.max(w, 0.005), Math.max(h, 0.005), Math.max(d, 0.005)], color });
  const cyl = (
    cx: number,
    cy: number,
    cz: number,
    dia: number,
    len: number,
    axis: "x" | "y" | "z",
    color: string,
  ) => {
    const size: [number, number, number] =
      axis === "y" ? [dia, len, dia] : axis === "z" ? [dia, dia, len] : [len, dia, dia];
    P.push({ pos: [cx, base + cy, cz], size, cylinder: true, cylAxis: axis, color });
  };
  const prim = (shape: "sphere" | "cone" | "pyramid" | "wedge", cx: number, cy: number, cz: number, w: number, h: number, d: number, color: string) =>
    P.push({ pos: [cx, base + cy, cz], size: [Math.max(w, 0.005), Math.max(h, 0.005), Math.max(d, 0.005)], shape, color });
  const body = f.color;
  const dark = "#23262b";
  const black = "#101216";
  const metal = "#aeb4ba";
  const basin = "#dfe3e6";
  const legC = "#3a3f45";
  const shade = (hex: string, amt: number) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
    const r = clamp(((n >> 16) & 255) + amt * 255);
    const g = clamp(((n >> 8) & 255) + amt * 255);
    const b = clamp((n & 255) + amt * 255);
    return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  };

  switch (f.kind) {
    case "tv":
      box(0, H / 2, 0.005, W, H, Math.max(D * 0.6, 0.03), dark);
      box(0, H / 2, -D / 2, W * 0.94, H * 0.9, 0.008, black);
      break;
    case "fridge":
      box(0, H / 2, 0, W, H, D, body);
      box(0, H * 0.62, -D / 2 + 0.006, W, 0.02, 0.012, dark);
      cyl(W / 2 - 0.07, H * 0.82, -D / 2 - 0.012, 0.03, H * 0.24, "y", metal);
      cyl(W / 2 - 0.07, H * 0.3, -D / 2 - 0.012, 0.03, H * 0.4, "y", metal);
      break;
    case "stove": {
      box(0, H / 2, 0, W, H, D, body);
      box(0, H + 0.004, 0, W, 0.02, D, dark);
      const bx = W * 0.22;
      const bz = D * 0.22;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(sx * bx, H + 0.02, sz * bz, 0.13, 0.012, "y", "#3b3f45");
      box(0, H * 0.34, -D / 2 + 0.006, W * 0.82, H * 0.45, 0.012, "#cfd3d8");
      cyl(0, H * 0.6, -D / 2 - 0.012, 0.03, W * 0.7, "x", metal);
      break;
    }
    case "sink":
      box(0, H - 0.02, 0, W, 0.04, D, body);
      box(0, H - 0.1, 0, W * 0.6, 0.12, D * 0.7, basin);
      cyl(0, H + 0.13, D / 2 - 0.1, 0.035, 0.26, "y", metal);
      cyl(0, H + 0.24, D / 2 - 0.16, 0.03, 0.12, "z", metal);
      break;
    case "washer":
      box(0, H / 2, 0, W, H, D, body);
      cyl(0, H * 0.45, -D / 2 - 0.006, W * 0.55, 0.02, "z", "#2b2f36");
      cyl(0, H * 0.45, -D / 2 - 0.014, W * 0.38, 0.01, "z", black);
      box(0, H - 0.08, -D / 2 + 0.006, W * 0.9, 0.1, 0.012, "#d7dade");
      break;
    case "toilet":
      box(0, H * 0.55, D / 2 - 0.09, W, H * 0.5, 0.18, "#eef0f2");
      cyl(0, 0.22, -D * 0.02, W * 0.8, 0.42, "y", "#eef0f2");
      box(0, 0.44, -D * 0.02, W * 0.85, 0.05, D * 0.5, "#e3e6e9");
      break;
    case "bed": {
      box(0, 0.18, D * 0.05, W, 0.28, D * 0.9, body);
      box(0, 0.06, D * 0.05, W * 1.02, 0.1, D * 0.92, "#5b6068");
      box(0, 0.5, -D / 2 + 0.04, W * 1.02, 0.7, 0.08, "#4a4f57");
      const blx = W / 2 - 0.06;
      const blz = D / 2 - 0.06;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(sx * blx, 0.05, sz * blz, 0.05, 0.1, "y", legC);
      break;
    }
    case "sofa": {
      const sh = 0.42;
      box(0, sh / 2 + 0.05, 0.05, W, sh, D * 0.85, body);
      box(0, sh + 0.25, -D / 2 + 0.12, W, 0.42, 0.22, body);
      box(-W / 2 + 0.1, sh + 0.12, 0.05, 0.2, 0.45, D * 0.85, body);
      box(W / 2 - 0.1, sh + 0.12, 0.05, 0.2, 0.45, D * 0.85, body);
      box(-W * 0.24, sh + 0.13, 0.08, W * 0.4, 0.12, D * 0.6, body);
      box(W * 0.24, sh + 0.13, 0.08, W * 0.4, 0.12, D * 0.6, body);
      const flx = W / 2 - 0.14;
      const flz = D / 2 - 0.12;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(sx * flx, 0.025, sz * flz, 0.05, 0.05, "y", dark);
      break;
    }
    case "tv-stand": {
      box(0, H / 2, 0, W, H, D, body);
      box(0, H - 0.012, 0, W, 0.024, D, body);
      const dw = W / 2 - 0.02;
      box(-W * 0.25, H / 2, -D / 2 + 0.006, dw, H * 0.78, 0.012, dark);
      box(W * 0.25, H / 2, -D / 2 + 0.006, dw, H * 0.78, 0.012, dark);
      const slx = W / 2 - 0.06;
      const slz = D / 2 - 0.06;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(sx * slx, 0.025, sz * slz, 0.04, 0.05, "y", legC);
      break;
    }
    case "nightstand": {
      box(0, H / 2, 0, W, H, D, body);
      box(0, H * 0.7, -D / 2 + 0.006, W * 0.85, H * 0.42, 0.012, dark);
      cyl(0, H * 0.7, -D / 2 - 0.008, 0.025, 0.1, "x", metal);
      const nlx = W / 2 - 0.05;
      const nlz = D / 2 - 0.05;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(sx * nlx, 0.06, sz * nlz, 0.04, 0.12, "y", legC);
      break;
    }
    case "desk": {
      const topT = 0.03;
      box(0, H - topT / 2, 0, W, topT, D, body);
      const cabW = W * 0.3;
      box(W / 2 - cabW / 2, (H - topT) / 2, 0, cabW, H - topT, D * 0.9, body);
      box(W / 2 - cabW / 2, H * 0.66, -D / 2 + 0.006, cabW * 0.85, 0.16, 0.012, dark);
      box(W / 2 - cabW / 2, H * 0.4, -D / 2 + 0.006, cabW * 0.85, 0.16, 0.012, dark);
      const legH = H - topT;
      for (const sz of [-1, 1]) cyl(-W / 2 + 0.06, legH / 2, sz * (D / 2 - 0.06), 0.05, legH, "y", legC);
      break;
    }
    case "vanity": {
      const cabH = H - 0.04;
      box(0, cabH / 2, 0, W, cabH, D, body);
      box(0, H - 0.02, 0, W, 0.04, D, "#cdd1d5");
      box(0, H - 0.08, 0, W * 0.5, 0.1, D * 0.6, basin);
      box(-W * 0.24, cabH / 2, -D / 2 + 0.006, W * 0.42, cabH * 0.8, 0.012, dark);
      box(W * 0.24, cabH / 2, -D / 2 + 0.006, W * 0.42, cabH * 0.8, 0.012, dark);
      cyl(0, H + 0.12, D / 2 - 0.1, 0.03, 0.24, "y", metal);
      cyl(0, H + 0.22, D / 2 - 0.15, 0.025, 0.1, "z", metal);
      break;
    }
    case "water-heater": {
      const dia = Math.min(W, D);
      cyl(0, H / 2, 0, dia, H, "y", body);
      cyl(0, H + 0.02, 0, dia * 0.9, 0.04, "y", "#b9bec4");
      box(0, H * 0.3, -dia / 2 - 0.004, dia * 0.5, 0.18, 0.02, "#c2c7cc");
      break;
    }
    case "bathtub":
      box(0, H / 2, 0, W, H, D, body);
      box(0, H * 0.62, 0, W * 0.86, H * 0.66, D * 0.7, "#cfd6da");
      cyl(-W / 2 + 0.12, H + 0.06, 0, 0.03, 0.18, "y", metal);
      break;
    case "shower":
      box(0, 0.04, 0, W, 0.08, D, "#cdd3d8");
      box(0, H / 2 + 0.04, -D / 2 + 0.01, W, H, 0.02, "#bcd5de");
      box(-W / 2 + 0.01, H / 2 + 0.04, 0, 0.02, H, D, "#bcd5de");
      cyl(W * 0.28, H, -D * 0.28, 0.07, 0.04, "y", metal);
      cyl(W * 0.28, H - 0.18, -D * 0.28, 0.018, 0.36, "y", metal);
      break;
    case "chair": {
      const seatH = H * 0.5;
      box(0, seatH, 0, W, 0.05, D, body);
      box(0, seatH + (H - seatH) / 2, -D / 2 + 0.03, W, H - seatH, 0.05, body);
      const clx = W / 2 - 0.04, clz = D / 2 - 0.04;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(sx * clx, seatH / 2, sz * clz, 0.04, seatH, "y", shade(body, -0.1));
      break;
    }
    case "plant": {
      const dia = Math.min(W, D);
      cyl(0, 0.16, 0, dia * 0.7, 0.32, "y", "#8a5a3c");
      prim("sphere", 0, H - dia * 0.55, 0, dia * 1.15, dia * 1.15, dia * 1.15, body);
      prim("sphere", dia * 0.2, H - dia * 0.2, dia * 0.1, dia * 0.7, dia * 0.7, dia * 0.7, shade(body, 0.06));
      break;
    }
    case "round-table":
      cyl(0, H - 0.02, 0, W, 0.04, "y", body);
      cyl(0, (H - 0.04) / 2, 0, 0.1, H - 0.04, "y", "#6b6f76");
      cyl(0, 0.02, 0, W * 0.4, 0.04, "y", "#6b6f76");
      break;
    case "coffee-table": {
      box(0, H - 0.02, 0, W, 0.04, D, body);
      const tlx = W / 2 - 0.06, tlz = D / 2 - 0.06;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(sx * tlx, (H - 0.04) / 2, sz * tlz, 0.05, H - 0.04, "y", shade(body, -0.1));
      break;
    }
    case "stairs": {
      const n = Math.max(2, Math.round(H / 0.18));
      const rise = H / n;
      const run = D / n;
      for (let i = 0; i < n; i++) {
        const stepH = (i + 1) * rise;
        const z = -D / 2 + (i + 0.5) * run;
        box(0, stepH / 2, z, W, stepH, run, i % 2 === 0 ? body : shade(body, -0.04));
      }
      break;
    }
    case "prim-box":
      box(0, H / 2, 0, W, H, D, body);
      break;
    case "prim-cylinder":
      cyl(0, H / 2, 0, Math.min(W, D), H, "y", body);
      break;
    case "prim-sphere": {
      const dia = Math.min(W, Math.min(D, H));
      prim("sphere", 0, dia / 2, 0, dia, dia, dia, body);
      break;
    }
    case "prim-cone":
      prim("cone", 0, H / 2, 0, Math.min(W, D), H, Math.min(W, D), body);
      break;
    case "prim-pyramid":
      prim("pyramid", 0, H / 2, 0, W, H, D, body);
      break;
    case "prim-wedge":
      prim("wedge", 0, H / 2, 0, W, H, D, body);
      break;
    default:
      box(0, H / 2, 0, W, H, D, body);
  }
  return P;
}
