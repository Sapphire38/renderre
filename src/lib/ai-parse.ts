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
  // jardín / exterior
  { re: /([áa]rbol\b|[áa]rboles)/, kind: "tree", name: "Árbol" },
  { re: /(pino|con[ií]fera|abeto|cipr[eé]s)/, kind: "pine", name: "Pino" },
  { re: /(palmera|palma\b)/, kind: "palm", name: "Palmera" },
  { re: /(arbusto|matorral)/, kind: "bush", name: "Arbusto" },
  { re: /(cantero|flores\b|florero|jardinera)/, kind: "flowers", name: "Cantero de flores" },
  { re: /(maceta|matera|planta\s*en\s*maceta)/, kind: "potted-plant", name: "Planta en maceta" },
  { re: /(banco\b|banca\b)/, kind: "bench", name: "Banco" },
  { re: /(fuente\b|pileta\s*decorativa)/, kind: "fountain", name: "Fuente" },
  { re: /(parrilla|asador|barbacoa|bbq)/, kind: "bbq", name: "Parrilla" },
  { re: /(sombrilla|quitasol|parasol)/, kind: "umbrella", name: "Sombrilla" },
  { re: /(roca\b|pe[ñn]asco|piedra\s*decorativa)/, kind: "rock", name: "Roca" },
  // recreación / exterior
  { re: /(pileta|piscina|alberca|pool)/, kind: "pool", name: "Pileta" },
  { re: /(p[eé]rgola)/, kind: "pergola", name: "Pérgola" },
  { re: /(glorieta|cenador|gazebo|qu?incho)/, kind: "gazebo", name: "Glorieta" },
  { re: /(hamaca\s*paraguaya)/, kind: "hammock", name: "Hamaca paraguaya" },
  { re: /(hamaca|columpio)/, kind: "swing", name: "Hamaca" },
  { re: /(tobog[aá]n|resbal[ií]n|sliding\s*board)/, kind: "slide", name: "Tobogán" },
  { re: /(cama\s*el[aá]stica|trampol[ií]n)/, kind: "trampoline", name: "Cama elástica" },
  { re: /(jardinera|cantero\s*largo|macetero\s*largo)/, kind: "planter-box", name: "Jardinera" },
  { re: /(tender|tendedero|colgar\s*ropa)/, kind: "clothesline", name: "Tender" },
  { re: /(buz[oó]n|mailbox)/, kind: "mailbox", name: "Buzón" },
  { re: /(bandera|m[aá]stil|asta\b)/, kind: "flag", name: "Bandera" },
  { re: /(\bauto\b|coche|veh[ií]culo|automóvil|automovil|car\b)/, kind: "car", name: "Auto" },
  // luminarias
  { re: /(farola|farol\b|poste\s*de\s*luz|alumbrado|luminaria)/, kind: "streetlamp", name: "Farola" },
  { re: /(baliza|bolardo)/, kind: "bollard-light", name: "Baliza" },
  { re: /(l[aá]mpara\s*de\s*pie)/, kind: "floor-lamp", name: "Lámpara de pie" },
  { re: /(l[aá]mpara\s*colgante|colgante|l[aá]mpara\s*de\s*techo|ara[ñn]a\b)/, kind: "pendant-lamp", name: "Lámpara colgante" },
  { re: /(aplique|l[aá]mpara\s*de\s*pared)/, kind: "wall-lamp", name: "Aplique" },
  { re: /(velador|veladora|l[aá]mpara\s*de\s*mesa|lamparita|l[aá]mpara\b)/, kind: "table-lamp", name: "Velador" },
  // electrodomésticos / interiores 2 + deco
  { re: /(microondas|microwave)/, kind: "microwave", name: "Microondas" },
  { re: /(campana|extractor)/, kind: "range-hood", name: "Campana" },
  { re: /(lavavajillas|lavavajilla|lavaplatos)/, kind: "dishwasher", name: "Lavavajillas" },
  { re: /(aire\s*acondicionado|\bsplit\b|\baire\b)/, kind: "air-conditioner", name: "Aire (split)" },
  { re: /(ventilador\s*de\s*techo|ventilador)/, kind: "ceiling-fan", name: "Ventilador de techo" },
  { re: /(tanque\s*de\s*agua|tanque)/, kind: "water-tank", name: "Tanque de agua" },
  { re: /(bid[eé])/, kind: "bidet", name: "Bidé" },
  { re: /(butaca|sill[oó]n\s*individual)/, kind: "armchair", name: "Sillón" },
  { re: /(c[oó]moda|chif+onier)/, kind: "dresser", name: "Cómoda" },
  { re: /(cuna)/, kind: "crib", name: "Cuna" },
  { re: /(alfombra|tapete)/, kind: "rug", name: "Alfombra" },
  { re: /(espejo)/, kind: "mirror", name: "Espejo" },
  { re: /(cuadro|pintura|l[aá]mina|p[oó]ster)/, kind: "painting", name: "Cuadro" },
  { re: /(cortina|cortinado)/, kind: "curtain", name: "Cortina" },
  { re: /(reloj)/, kind: "wall-clock", name: "Reloj" },
  { re: /(reposera|tumbona|camastro)/, kind: "lounger", name: "Reposera" },
  { re: /(bicicleta|bici\b)/, kind: "bicycle", name: "Bicicleta" },
  { re: /(cucha|casa\s*de\s*perro|caseta)/, kind: "dog-house", name: "Cucha" },
  // oficina / gym / mascotas / vehículos / juegos
  { re: /(monitor|pantalla\s*de\s*pc|\bpc\b|computadora|ordenador)/, kind: "monitor", name: "Monitor" },
  { re: /(silla\s*de\s*oficina|silla\s*ergon)/, kind: "office-chair", name: "Silla oficina" },
  { re: /(biblioteca|librero|estante\s*de\s*libros)/, kind: "bookcase", name: "Biblioteca" },
  { re: /(pizarra|pizarr[oó]n|whiteboard)/, kind: "whiteboard", name: "Pizarra" },
  { re: /(cinta\s*de\s*correr|trotadora|caminadora|treadmill)/, kind: "treadmill", name: "Cinta de correr" },
  { re: /(mancuernas|pesas|rack\s*de\s*pesas)/, kind: "dumbbell-rack", name: "Rack de pesas" },
  { re: /(bici\s*fija|bicicleta\s*fija|spinning)/, kind: "exercise-bike", name: "Bici fija" },
  { re: /(cama\s*de\s*mascota|cama\s*de\s*perro|cama\s*de\s*gato|cucha\s*blanda)/, kind: "pet-bed", name: "Cama de mascota" },
  { re: /(acuario|pecera)/, kind: "aquarium", name: "Acuario" },
  { re: /(jaula|p[aá]jaro|p[aá]jaros)/, kind: "bird-cage", name: "Jaula" },
  { re: /(perchero|perchas\b)/, kind: "coat-rack", name: "Perchero" },
  { re: /(moto\b|motocicleta|motoneta)/, kind: "motorcycle", name: "Moto" },
  { re: /(camioneta|pickup|pick\s*up|utilitario)/, kind: "pickup", name: "Camioneta" },
  { re: /(juego\s*de\s*plaza|playground|torre\s*con\s*tobog)/, kind: "playset", name: "Juego de plaza" },
  { re: /(subibaja|sube\s*y\s*baja|balanc[ií]n|sube-?baja)/, kind: "seesaw", name: "Subibaja" },
  { re: /(arenero|cajón\s*de\s*arena|sandbox)/, kind: "sandbox", name: "Arenero" },
  // cocina / baño 2 · náutico / vehículos 2
  { re: /(isla\s*de\s*cocina|isla\b)/, kind: "kitchen-island", name: "Isla de cocina" },
  { re: /(esquinero|mueble\s*esquin|alacena\s*esquin)/, kind: "corner-cabinet", name: "Esquinero" },
  { re: /(bacha\s*doble|doble\s*bacha|doble\s*pileta)/, kind: "double-sink", name: "Bacha doble" },
  { re: /(toallero)/, kind: "towel-rack", name: "Toallero" },
  { re: /(botiqu[ií]n)/, kind: "medicine-cabinet", name: "Botiquín" },
  { re: /(botellero|cava\b|vinoteca)/, kind: "wine-rack", name: "Botellero" },
  { re: /(barra\b)/, kind: "bar", name: "Barra" },
  { re: /(carpa|tienda\s*de\s*campa|toldo\s*de\s*campa)/, kind: "tent", name: "Carpa" },
  { re: /(kayak|canoa|piragua)/, kind: "kayak", name: "Kayak" },
  { re: /(fogata|fogón|hoguera|campfire)/, kind: "campfire", name: "Fogata" },
  { re: /(conservadora|heladerita|cooler|nevera\s*port)/, kind: "cooler", name: "Conservadora" },
  { re: /(bote|lancha|barca|yate|velero)/, kind: "boat", name: "Bote" },
  { re: /(furgoneta|\bvan\b|combi|trafic)/, kind: "van", name: "Van" },
  { re: /(cami[oó]n\b|camion\b)/, kind: "truck", name: "Camión" },
  { re: /(monopat[ií]n|patineta|scooter)/, kind: "scooter", name: "Monopatín" },
  // equipamiento general
  { re: /(mesa\s*de\s*luz|mesita\s*de\s*luz)/, kind: "nightstand", name: "Mesa de luz" },
  { re: /(mueble\s*(de\s*)?tv|rack)/, kind: "tv-stand", name: "Mueble TV" },
  { re: /(televisor|tele\b|\btv\b|smart\s*tv|pantalla)/, kind: "tv", name: "TV" },
  { re: /(heladera|refrigerador|nevera)/, kind: "fridge", name: "Heladera" },
  { re: /(lavarropas|lavadora)/, kind: "washer", name: "Lavarropas" },
  { re: /(termotanque|calef[oó]n|term[oó]tanque|calentador\s*de\s*agua|water\s*heater)/, kind: "water-heater", name: "Termotanque" },
  { re: /(ba[ñn]era|tina|bathtub)/, kind: "bathtub", name: "Bañera" },
  { re: /(ducha|box\s*de\s*ducha|shower)/, kind: "shower", name: "Ducha" },
  { re: /(escalera|escalones|peldañ|stairs)/, kind: "stairs", name: "Escalera" },
  { re: /(columna\s*cuadrada|pilar\s*cuadrad)/, kind: "column-sq", name: "Columna cuadrada" },
  { re: /(columna|pilar|pilote|column)/, kind: "column", name: "Columna" },
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
