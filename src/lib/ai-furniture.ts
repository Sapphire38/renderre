import type { ComponentKind, Furniture, FurnitureComponent } from "./types";
import { uid } from "./geometry";
import { makeCustomFurniture } from "./furniture";

export type SpecRegion = "bottom" | "top" | "left" | "right" | "full";

export type SpecComponent = {
  kind: ComponentKind;
  count?: number;
  region?: SpecRegion;
  // geometría explícita opcional (la puede dar el LLM); si falta, se auto-ubica
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  hinge?: "left" | "right";
  orient?: "front" | "horizontal" | "vertical";
  color?: string; // color del componente (combinar acabados)
};

export type FurnitureSpec = {
  name?: string;
  width?: number;
  height?: number;
  depth?: number;
  panel?: number;
  color?: string;
  components?: SpecComponent[];
  note?: string;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const numOf = (s: string) => parseFloat(s.replace(",", "."));
function withUnit(n: number, unit?: string): number {
  const u = (unit || "").toLowerCase();
  if (u.startsWith("c")) return n / 100;
  if (u.startsWith("m")) return n;
  return n > 10 ? n / 100 : n;
}

function mkC(
  kind: ComponentKind,
  x: number,
  y: number,
  w: number,
  h: number,
  extra: Partial<FurnitureComponent> = {},
): FurnitureComponent {
  return { id: uid(), kind, x, y, w, h, ...extra };
}

/** Ubica una lista de componentes (sin geometría) dentro de una columna. */
function layoutColumn(
  items: SpecComponent[],
  x0: number,
  colW: number,
  y0: number,
  y1: number,
  t: number,
  out: FurnitureComponent[],
) {
  const colH = y1 - y0;
  const bands = items.filter((c) => c.kind !== "shelf" && c.kind !== "divider" && c.kind !== "rod");
  const rods = items.filter((c) => c.kind === "rod");
  const shelves = items.filter((c) => c.kind === "shelf");
  const dividers = items.filter((c) => c.kind === "divider");

  const order = (c: SpecComponent) => (c.kind === "drawer" || c.region === "bottom" ? 0 : 1);
  bands.sort((a, b) => order(a) - order(b));

  let fixedSum = 0;
  const flex: SpecComponent[] = [];
  const bh = bands.map((c) => {
    if (c.kind === "drawer") {
      const h = clamp((c.count ?? 1) * 0.2, 0.16, colH * 0.7);
      fixedSum += h;
      return h;
    }
    flex.push(c);
    return null;
  });
  const flexH = bands.length ? Math.max(0.1, (colH - fixedSum) / Math.max(1, flex.length)) : 0;

  let cy = y0;
  bands.forEach((c, i) => {
    const hh = bh[i] ?? flexH;
    if (c.kind === "drawer") {
      out.push(mkC("drawer", x0, cy, colW, hh, { count: c.count ?? 1, open: 0, color: c.color }));
    } else if (c.kind === "doorHinged") {
      const n = Math.max(1, c.count ?? 1);
      const dw = colW / n;
      for (let k = 0; k < n; k++) {
        out.push(mkC("doorHinged", x0 + k * dw, cy, dw, hh, { hinge: k % 2 === 0 ? "left" : "right", open: 0, color: c.color }));
      }
    } else if (c.kind === "doorSliding") {
      out.push(mkC("doorSliding", x0, cy, colW, hh, { count: c.count ?? 2, open: 0, color: c.color }));
    } else {
      out.push(mkC("board", x0, cy, colW, hh, { orient: c.orient ?? "front", color: c.color }));
    }
    cy += hh;
  });

  if (rods.length) out.push(mkC("rod", x0, y1 - 0.03, colW, 0.03));
  if (shelves.length) {
    const n = shelves.reduce((s, c) => s + (c.count ?? 1), 0);
    for (let k = 1; k <= n; k++) out.push(mkC("shelf", x0, y0 + (colH * k) / (n + 1), colW, t));
  }
  if (dividers.length) {
    const n = dividers.reduce((s, c) => s + (c.count ?? 1), 0);
    for (let k = 1; k <= n; k++) out.push(mkC("divider", x0 + (colW * k) / (n + 1), y0, t, colH));
  }
}

/** Convierte una FurnitureSpec en un mueble custom con componentes ubicados. */
export function layoutFurnitureSpec(spec: FurnitureSpec): Furniture {
  const f = makeCustomFurniture();
  if (spec.name) f.name = spec.name;
  if (spec.width) f.width = clamp(spec.width, 0.1, 4);
  if (spec.height) f.height = clamp(spec.height, 0.1, 3);
  if (spec.depth) f.depth = clamp(spec.depth, 0.05, 1.2);
  if (spec.panel) f.panel = clamp(spec.panel, 0.003, 0.05);
  if (spec.color) f.color = spec.color;

  const t = f.panel;
  const W = f.width;
  const H = f.height;
  const comps: FurnitureComponent[] = [];
  const sc = spec.components ?? [];

  for (const c of sc.filter((c) => c.x != null && c.w != null)) {
    comps.push(
      mkC(c.kind, clamp(c.x!, 0, W), clamp(c.y ?? t, 0, H), clamp(c.w!, 0.02, W), clamp(c.h ?? H - 2 * t, 0.02, H), {
        count: c.count,
        hinge: c.hinge,
        orient: c.orient,
        color: c.color,
      }),
    );
  }
  const auto = sc.filter((c) => !(c.x != null && c.w != null));
  const left = auto.filter((c) => c.region === "left");
  const right = auto.filter((c) => c.region === "right");
  const full = auto.filter((c) => c.region !== "left" && c.region !== "right");

  const x0 = t;
  const y0 = t;
  const y1 = H - t;
  const fullW = W - 2 * t;

  if (left.length || right.length) {
    const leftItems = [...left];
    const rightItems = [...right];
    // los componentes sin lado van a la columna vacía (o a la izquierda por defecto)
    if (full.length) {
      if (rightItems.length === 0 && leftItems.length > 0) rightItems.push(...full);
      else leftItems.push(...full);
    }
    const halfW = fullW / 2 - t / 2;
    layoutColumn(leftItems, x0, halfW, y0, y1, t, comps);
    layoutColumn(rightItems, x0 + fullW / 2 + t / 2, halfW, y0, y1, t, comps);
    comps.push(mkC("divider", x0 + fullW / 2, y0, t, y1 - y0));
  } else {
    layoutColumn(full, x0, fullW, y0, y1, t, comps);
  }

  f.components = comps;
  return f;
}

const TYPE_NAMES: [RegExp, string, number?][] = [
  [/placard|ropero|armario/, "Placard", 0.6],
  [/alacena/, "Alacena", 0.32],
  [/biblioteca|estanter[ií]a|modular/, "Biblioteca", 0.3],
  [/c[oó]moda|cajoner/, "Cómoda", 0.5],
  [/bajo\s*mesada|cocina/, "Bajo mesada", 0.6],
  [/mesa|escritorio/, "Mesa", 0.6],
  [/mueble|caja/, "Mueble", 0.5],
];

/** Parser heurístico en español: descripción → FurnitureSpec. */
export function localParseFurniture(text: string): FurnitureSpec {
  const t = ` ${text.toLowerCase().trim()} `;
  const spec: FurnitureSpec = { components: [] };

  let name = "Mueble";
  let defDepth: number | undefined;
  for (const [re, n, d] of TYPE_NAMES) {
    if (re.test(t)) {
      name = n;
      defDepth = d;
      break;
    }
  }
  spec.name = name;

  const dims = t.match(/(\d+(?:[.,]\d+)?)\s*(?:x|por|×)\s*(\d+(?:[.,]\d+)?)/);
  if (dims) {
    spec.width = withUnit(numOf(dims[1]));
    spec.height = withUnit(numOf(dims[2]));
  }
  const wM = t.match(/(\d+(?:[.,]\d+)?)\s*(m|cm|mm)?\s*(?:de\s*)?ancho/);
  if (wM) spec.width = withUnit(numOf(wM[1]), wM[2]);
  const hM = t.match(/(\d+(?:[.,]\d+)?)\s*(m|cm|mm)?\s*(?:de\s*)?alt/);
  if (hM) spec.height = withUnit(numOf(hM[1]), hM[2]);
  const dM = t.match(/(\d+(?:[.,]\d+)?)\s*(m|cm|mm)?\s*(?:de\s*)?(?:prof|profundidad|fondo)/);
  if (dM) spec.depth = withUnit(numOf(dM[1]), dM[2]);
  if (spec.depth == null && defDepth) spec.depth = defDepth;

  const sideOf = (seg: string): SpecRegion | undefined =>
    /izquierd/.test(seg)
      ? "left"
      : /derech/.test(seg)
        ? "right"
        : /abajo|inferior|base/.test(seg)
          ? "bottom"
          : /arriba|superior/.test(seg)
            ? "top"
            : undefined;

  const segs = t.split(/\s+y\s+|,|;|\bcon\b/).map((s) => s.trim()).filter(Boolean);
  for (const seg of segs) {
    const cnt = (seg.match(/(\d+)/) || [])[1];
    const n = cnt ? parseInt(cnt, 10) : undefined;
    const region = sideOf(seg);
    if (/corrediz/.test(seg)) spec.components!.push({ kind: "doorSliding", count: n ?? 2, region });
    else if (/puerta/.test(seg)) spec.components!.push({ kind: "doorHinged", count: n ?? 1, region });
    else if (/caj[oó]n|cajones|cajoner/.test(seg)) spec.components!.push({ kind: "drawer", count: n ?? 1, region: region ?? "bottom" });
    else if (/estante|repisa|balda/.test(seg)) spec.components!.push({ kind: "shelf", count: n ?? 3, region });
    else if (/divisi[oó]n|divisor/.test(seg)) spec.components!.push({ kind: "divider", count: n ?? 1, region });
    else if (/barral|barra|colgador/.test(seg)) spec.components!.push({ kind: "rod", region: region ?? "top" });
    else if (/\bplacas?\b|tablero/.test(seg)) spec.components!.push({ kind: "board", region });
  }

  if (!spec.components!.length) {
    spec.note = 'No reconocí componentes. Probá: "placard 1.8x2.4 con 3 puertas corredizas y 4 cajones".';
  }
  return spec;
}
