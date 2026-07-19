import type { Furniture, Pricing } from "./types";
import { carcassPanels, type Panel } from "./furniture";

export { DEFAULT_PRICING } from "./types";
export type { Pricing } from "./types";

/** Una fila del despiece: piezas idénticas agrupadas. Medidas en metros. */
export type CutPiece = {
  role: string;
  largo: number; // lado mayor de la cara (m)
  ancho: number; // lado menor de la cara (m)
  thickness: number; // espesor (m)
  qty: number;
  materialId?: string;
  edgeMeters: number; // metros de canto por UNA pieza
};

export type Hardware = {
  hinges: number; // bisagras
  slides: number; // pares de correderas
  pulls: number; // tiradores / manijas
  rods: number; // barrales
  pistons: number; // pistones a gas / brazos hidráulicos (tapas verticales)
  pins: number; // soportes de estante regulable (sistema 32)
};

/** Peso estimado de las piezas (kg). Densidad MDF ≈ 730 kg/m³. */
export function weightOf(pieces: CutPiece[]): number {
  const kg = pieces.reduce((a, p) => a + p.largo * p.ancho * p.thickness * 730 * p.qty, 0);
  return Math.round(kg * 10) / 10;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000; // a milímetros
const isFlat = (p: Panel) => !p.cylinder && !p.shape;

/** Metros de canto de una pieza, estimados desde las caras marcadas en el panel. */
function edgeMetersOf(largo: number, ancho: number, edges?: Panel["edges"]): number {
  if (!edges) return 0;
  const flags = [edges.front, edges.back, edges.left, edges.right].filter(Boolean).length;
  if (flags >= 4) return r3(2 * (largo + ancho)); // perímetro completo (frentes/puertas)
  if (flags >= 1) return r3(largo); // un borde visible a la vista (el lado largo)
  return 0;
}

/** Genera el despiece de un mueble agrupando piezas idénticas. */
export function cutList(f: Furniture): CutPiece[] {
  const panels = carcassPanels(f).filter(isFlat);
  const map = new Map<string, CutPiece>();
  for (const p of panels) {
    const [a, b, c] = [...p.size].sort((x, y) => y - x); // c = espesor
    const largo = r3(a);
    const ancho = r3(b);
    const thickness = r3(c);
    const role = p.role ?? "Pieza";
    const key = `${role}|${largo}|${ancho}|${thickness}|${p.materialId ?? ""}`;
    const edgeMeters = edgeMetersOf(largo, ancho, p.edges);
    const existing = map.get(key);
    if (existing) existing.qty += 1;
    else map.set(key, { role, largo, ancho, thickness, qty: 1, materialId: p.materialId, edgeMeters });
  }
  return [...map.values()].sort(
    (x, y) => y.thickness - x.thickness || y.largo * y.ancho - x.largo * x.ancho,
  );
}

/** Cuenta los herrajes a partir de los componentes / puertas del mueble. */
export function hardwareOf(f: Furniture): Hardware {
  const hw: Hardware = { hinges: 0, slides: 0, pulls: 0, rods: 0, pistons: 0, pins: 0 };
  if (f.kind === "custom") {
    for (const c of f.components ?? []) {
      if (c.kind === "shelf" && c.adjustable) {
        hw.pins += 4; // 4 soportes por estante regulable
      } else if (c.kind === "doorHinged") {
        const leaves = 1;
        hw.hinges += leaves * (c.h > 1.4 ? 3 : 2);
        hw.pulls += 1;
      } else if (c.kind === "doorFlap") {
        // bisagras arriba/abajo + pistones a gas si la tapa abre hacia arriba
        hw.hinges += 2;
        hw.pulls += 1;
        if ((c.flapDir ?? "up") === "up" && c.pistons !== false) hw.pistons += 2;
      } else if (c.kind === "doorSliding") {
        hw.pulls += Math.max(2, c.count ?? 2);
      } else if (c.kind === "drawer") {
        const n = Math.max(1, c.count ?? 1);
        hw.slides += n;
        hw.pulls += n;
      } else if (c.kind === "rod") {
        hw.rods += 1;
      }
    }
  } else if (f.doors > 0) {
    hw.hinges += f.doors * (f.height > 1.4 ? 3 : 2);
    hw.pulls += f.doors;
  }
  return hw;
}

export type Budget = {
  pieces: number; // total de piezas (suma de qty)
  area: number; // m² de placa
  edgeMeters: number; // metros lineales de canto
  boards: number; // placas estimadas a comprar
  hardware: Hardware;
  cost: {
    material: number;
    edge: number;
    hardware: number;
    labor: number;
    total: number;
  };
};

/** Calcula el presupuesto a partir del despiece, herrajes y lista de precios. */
export function budgetOf(pieces: CutPiece[], hw: Hardware, pricing: Pricing): Budget {
  let area = 0;
  let edgeMeters = 0;
  let count = 0;
  for (const p of pieces) {
    area += p.largo * p.ancho * p.qty;
    edgeMeters += p.edgeMeters * p.qty;
    count += p.qty;
  }
  const boardArea = Math.max(0.01, pricing.boardW * pricing.boardH * Math.max(0.1, pricing.yield));
  const boards = Math.ceil(area / boardArea) || 0;
  const material = boards * pricing.boardPrice;
  const edge = edgeMeters * pricing.edgePrice;
  const hardware =
    hw.hinges * pricing.hingePrice +
    hw.slides * pricing.slidePrice +
    hw.pulls * pricing.pullPrice +
    hw.rods * pricing.rodPrice +
    hw.pistons * (pricing.pistonPrice ?? 6000) + // fallback para proyectos guardados sin este precio
    hw.pins * (pricing.shelfPinPrice ?? 150);
  const labor = area * pricing.laborPerM2;
  return {
    pieces: count,
    area: Math.round(area * 1000) / 1000,
    edgeMeters: Math.round(edgeMeters * 100) / 100,
    boards,
    hardware: hw,
    cost: {
      material: Math.round(material),
      edge: Math.round(edge),
      hardware: Math.round(hardware),
      labor: Math.round(labor),
      total: Math.round(material + edge + hardware + labor),
    },
  };
}
