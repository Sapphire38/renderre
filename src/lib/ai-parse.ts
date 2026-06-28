import type { FurnitureKind } from "./types";

/** Especificación de escena que devuelve la IA (o el parser local). Sin ids. */
export type SpecWall = {
  a: [number, number];
  b: [number, number];
  thickness?: number;
  height?: number;
};

export type SpecFurniture = {
  kind: FurnitureKind;
  x: number;
  z: number;
  rotDeg?: number;
  width?: number;
  depth?: number;
  height?: number;
  doors?: number;
  shelves?: number;
  baseHeight?: number;
  name?: string;
  color?: string;
};

export type SpecOpening = {
  wall: number; // índice (0-based) en el array "walls"
  kind: "door" | "window";
  offset?: number; // distancia desde el extremo A del muro (m); por defecto, centro
  width?: number;
  height?: number;
  sill?: number; // antepecho (ventana)
};

export type SceneSpec = {
  room?: {
    width: number;
    depth: number;
    x?: number;
    z?: number;
    wallThickness?: number;
    wallHeight?: number;
  };
  walls?: SpecWall[];
  openings?: SpecOpening[];
  furniture?: SpecFurniture[];
  note?: string;
};

const numOf = (s: string) => parseFloat(s.replace(",", "."));

/** Interpreta un valor con unidad. Sin unidad: <=10 → metros, >10 → centímetros. */
function withUnit(n: number, unit?: string): number {
  const u = (unit || "").toLowerCase();
  if (u.startsWith("mm")) return n / 1000;
  if (u.startsWith("c")) return n / 100;
  if (u.startsWith("m")) return n;
  return n <= 10 ? n : n / 100;
}

const KIND_KEYWORDS: { re: RegExp; kind: FurnitureKind; name: string }[] = [
  // equipamiento (más específicos primero)
  { re: /(mesa\s*de\s*luz|mesita\s*de\s*luz|velador)/, kind: "nightstand", name: "Mesa de luz" },
  { re: /(mueble\s*(de\s*)?tv|rack)/, kind: "tv-stand", name: "Mueble TV" },
  { re: /(televisor|tele\b|\btv\b|smart\s*tv|pantalla)/, kind: "tv", name: "TV" },
  { re: /(heladera|refrigerador|nevera)/, kind: "fridge", name: "Heladera" },
  { re: /(lavarropas|lavadora)/, kind: "washer", name: "Lavarropas" },
  { re: /(termotanque|calef[oó]n|term[oó]tanque|calentador\s*de\s*agua|water\s*heater)/, kind: "water-heater", name: "Termotanque" },
  { re: /(ba[ñn]era|tina|bathtub)/, kind: "bathtub", name: "Bañera" },
  { re: /(ducha|box\s*de\s*ducha|shower)/, kind: "shower", name: "Ducha" },
  { re: /(escalera|escalones|peldañ|stairs)/, kind: "stairs", name: "Escalera" },
  { re: /(planta\b|maceta|matera|helecho)/, kind: "plant", name: "Planta" },
  { re: /(silla\b|sillas)/, kind: "chair", name: "Silla" },
  { re: /(inodoro|v[aá]ter|\bwc\b)/, kind: "toilet", name: "Inodoro" },
  { re: /(vanitory|vanitorio|mueble\s*de\s*ba[ñn]o)/, kind: "vanity", name: "Vanitory" },
  { re: /(bacha|lavabo|pileta\s*de\s*cocina)/, kind: "sink", name: "Bacha" },
  { re: /(anafe|horno|cocina\s*(el[eé]ctrica|a\s*gas))/, kind: "stove", name: "Cocina" },
  { re: /(escritorio)/, kind: "desk", name: "Escritorio" },
  { re: /(\bcama\b|colch[oó]n)/, kind: "bed", name: "Cama" },
  { re: /(sof[aá]|sill[oó]n)/, kind: "sofa", name: "Sofá" },
  // muebles MDF
  { re: /(placard|ropero|armario)/, kind: "wardrobe", name: "Placard" },
  { re: /(bajo\s*mesada|bajomesada|mueble\s*bajo|mod[uú]lo\s*bajo)/, kind: "cabinet-base", name: "Bajo mesada" },
  { re: /(alacena|aéreo|aereo|mueble\s*alto)/, kind: "cabinet-wall", name: "Alacena" },
  { re: /(mesada|encimera)/, kind: "countertop", name: "Mesada" },
  { re: /(estanter[ií]a|biblioteca|repisa|estante|modular)/, kind: "shelf", name: "Estantería" },
  { re: /(mesa\s*(redonda|circular))/, kind: "round-table", name: "Mesa redonda" },
  { re: /(mesa\s*(ratona|de\s*centro|baja)|mesa\s*ratona)/, kind: "coffee-table", name: "Mesa ratona" },
  { re: /(mesa)/, kind: "table", name: "Mesa" },
  { re: /(m[oó]dulo|mueble|caj[oó]n|c[oó]moda|caja)/, kind: "module", name: "Módulo" },
];

function detectKind(seg: string): { kind: FurnitureKind; name: string } | null {
  for (const k of KIND_KEYWORDS) if (k.re.test(seg)) return { kind: k.kind, name: k.name };
  return null;
}

const ROOM_RE = /(habitaci[oó]n|cuarto|sala|cocina|pieza|dormitorio|living|ba[ñn]o|oficina|ambiente|espacio|comedor)/;
const DIMS_RE = /(\d+(?:[.,]\d+)?)\s*(?:x|por|×)\s*(\d+(?:[.,]\d+)?)/;

/**
 * Parser heurístico en español: descripción → SceneSpec.
 * Maneja habitaciones ("habitación de 4x3"), muros ("pared de 3 m") y muebles
 * ("placard de 1.8m con 3 puertas", "mesa de 1.2x0.8", "alacena de 80cm").
 */
export function localParse(text: string): SceneSpec {
  const t = ` ${text.toLowerCase().trim()} `;
  const spec: SceneSpec = {};

  // --- Habitación ---
  const dims = t.match(DIMS_RE);
  const hasRoomWord = ROOM_RE.test(t);
  const furnitureFirst = detectKind(t);
  if (hasRoomWord && dims && !/(mesa|placard|alacena|mesada|estante)/.test(t.split(ROOM_RE)[0] || "")) {
    spec.room = { width: numOf(dims[1]), depth: numOf(dims[2]) };
  }

  // --- Muro suelto ---
  if (!spec.room) {
    const w = t.match(/(?:pared|muro|tabique)\s+(?:de\s+)?(\d+(?:[.,]\d+)?)\s*(mm|cm|m|metros|centimetros)?/);
    if (w) {
      const L = withUnit(numOf(w[1]), w[2]);
      spec.walls = [{ a: [-L / 2, 0], b: [L / 2, 0] }];
    }
  }

  // --- Muebles (por segmentos) ---
  const segs = t
    .split(/\s+y\s+|,|;|\+|\bcon\b/)
    .map((s) => s.trim())
    .filter(Boolean);
  const items: SpecFurniture[] = [];
  let lastKindSeg: { kind: FurnitureKind; name: string } | null = null;
  for (const seg of segs) {
    const det = detectKind(seg);
    // Si el segmento no nombra un mueble pero trae "N puertas/estantes", lo aplicamos al anterior.
    if (!det) {
      if (lastKindSeg && items.length) {
        const prev = items[items.length - 1];
        const doors = seg.match(/(\d+)\s*puertas?/);
        if (doors) prev.doors = parseInt(doors[1], 10);
        const shelves = seg.match(/(\d+)\s*(estantes?|repisas?|baldas?)/);
        if (shelves) prev.shelves = parseInt(shelves[1], 10);
      }
      continue;
    }
    lastKindSeg = det;
    const f: SpecFurniture = { kind: det.kind, name: det.name, x: 0, z: 0 };
    const wd = seg.match(DIMS_RE);
    if (wd) {
      f.width = withUnit(numOf(wd[1]), seg.includes("cm") ? "cm" : undefined);
      f.depth = withUnit(numOf(wd[2]), seg.includes("cm") ? "cm" : undefined);
    } else {
      const w = seg.match(/(?:de\s+)?(\d+(?:[.,]\d+)?)\s*(mm|cm|m|metros|centimetros)\b/);
      if (w) f.width = withUnit(numOf(w[1]), w[2]);
    }
    const doors = seg.match(/(\d+)\s*puertas?/);
    if (doors) f.doors = parseInt(doors[1], 10);
    const shelves = seg.match(/(\d+)\s*(estantes?|repisas?|baldas?)/);
    if (shelves) f.shelves = parseInt(shelves[1], 10);
    const high = seg.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m|metros)\s*(?:de\s*)?alt/);
    if (high) f.height = withUnit(numOf(high[1]), high[2]);
    items.push(f);
  }

  if (items.length) spec.furniture = items;
  if (!spec.room && !spec.walls && !spec.furniture) {
    spec.note = "No entendí la descripción. Probá: \"habitación de 4x3\" o \"placard de 1.8m con 3 puertas\".";
  }
  return spec;
}
