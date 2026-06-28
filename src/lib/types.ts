/** Coordenadas en el plano, en METROS. x = derecha (este), z = abajo (sur). */
export type Vec2 = { x: number; z: number };

/** Un material/textura aplicable a muros, piso o muebles. */
export type Material = {
  id: string;
  name: string;
  color: string; // color base / tinte
  albedo?: string; // imagen (data URL) usada como mapa de color
  normal?: string; // normal map (data URL) generado desde la imagen
  tileM: number; // metros por repetición de la textura
  roughness: number; // 0..1
  metalness: number; // 0..1
};

/** Un muro es un segmento entre dos puntos, con espesor y altura en metros. */
export type Wall = {
  id: string;
  a: Vec2;
  b: Vec2;
  thickness: number; // metros
  height: number; // metros (tope uniforme; sirve de fallback de heightA/heightB)
  materialId?: string;
  level?: number; // piso/nivel (default 0)
  name?: string; // nombre opcional
  /** Altura de arranque desde el piso del nivel (default 0). Permite medios-muros/antepechos elevados. */
  base?: number;
  /** Altura del tope en el extremo A (default = height). Si difiere de heightB, el tope queda inclinado (muro a dos aguas). */
  heightA?: number;
  /** Altura del tope en el extremo B (default = height). */
  heightB?: number;
};

/** Un piso/nivel del proyecto. */
export type Floor = {
  name: string;
  elevation: number; // altura de arranque del nivel, en metros
  materialId?: string; // material propio del suelo de este nivel (si falta, usa el global)
};

/** Ajustes de iluminación/render de la escena 3D. */
export type RenderSettings = {
  sunAzimuth: number; // grados, dirección del sol en planta (0..360)
  sunElevation: number; // grados sobre el horizonte (0..90)
  sunIntensity: number; // 0..3
  ambient: number; // luz ambiente 0..2
  background: string; // color de fondo / cielo (hex)
  shadows: boolean; // proyectar sombras
};

/** Lista de precios para el despiece/presupuesto del Taller. Moneda libre. */
export type Pricing = {
  boardW: number; // ancho de la placa estándar (m)
  boardH: number; // alto de la placa estándar (m)
  boardPrice: number; // $ por placa
  edgePrice: number; // $ por metro lineal de canto
  hingePrice: number;
  slidePrice: number; // $ por par de correderas
  pullPrice: number;
  rodPrice: number;
  laborPerM2: number; // $ de mano de obra por m² de placa
  yield: number; // 0..1 aprovechamiento estimado de la placa (sin nesting)
};

/** Un techo sobre un nivel: cubre la huella de los muros de ese piso. */
export type RoofKind = "flat" | "gable";
export type Roof = {
  id: string;
  level: number; // nivel sobre el que apoya
  kind: RoofKind;
  height: number; // altura de los aleros (desde el piso del nivel) donde apoya el techo
  rise: number; // cuánto sube la cumbrera sobre los aleros (solo gable)
  overhang: number; // alero que sobresale del perímetro (m)
  ridgeAxis?: "x" | "z"; // dirección de la cumbrera (gable); default = lado más largo
  thickness?: number; // espesor de la losa/faldón (default 0.12)
  materialId?: string;
};

/** Tipos de mueble paramétrico de MDF. */
export type FurnitureKind =
  | "module" // módulo / caja genérica
  | "cabinet-base" // bajo mesada (cocina)
  | "cabinet-wall" // alacena
  | "shelf" // estantería
  | "countertop" // mesada (tabla)
  | "wardrobe" // placard
  | "table" // mesa
  | "custom" // mueble armado en el taller (usa components)
  // equipamiento (electrodomésticos / sanitarios)
  | "tv"
  | "fridge" // heladera
  | "stove" // cocina / anafe + horno
  | "sink" // bacha / pileta
  | "washer" // lavarropas
  | "toilet" // inodoro
  | "bed" // cama
  | "sofa" // sofá
  | "tv-stand" // mueble TV / rack
  | "nightstand" // mesa de luz
  | "desk" // escritorio
  | "vanity" // mesada de baño con bacha
  // equipamiento / objetos nuevos
  | "water-heater" // termotanque
  | "bathtub" // bañera
  | "shower" // ducha
  | "chair" // silla
  | "plant" // planta decorativa
  | "round-table" // mesa redonda
  | "coffee-table" // mesa ratona
  | "stairs" // escalera
  // primitivas (formas básicas para construir cualquier cosa)
  | "prim-box"
  | "prim-cylinder"
  | "prim-sphere"
  | "prim-cone"
  | "prim-pyramid"
  | "prim-wedge";

/** Componente de un mueble custom, ubicado por un rectángulo en la cara frontal. */
export type ComponentKind =
  | "shelf" // estante horizontal
  | "drawer" // cajón (frente + caja)
  | "doorHinged" // puerta batiente
  | "doorSliding" // puerta corrediza
  | "divider" // división vertical
  | "board" // placa libre
  | "rod"; // barral

export type FurnitureComponent = {
  id: string;
  kind: ComponentKind;
  /** Rectángulo en la cara frontal del mueble (metros). x desde la izquierda, y desde abajo. */
  x: number;
  y: number;
  w: number;
  h: number;
  count?: number; // cajones apilados / hojas corredizas
  hinge?: "left" | "right"; // puerta batiente
  orient?: "front" | "horizontal" | "vertical"; // placa libre
  /** Placa: forma 3D. "box" (default) o una primitiva (cilindro/esfera/cono/pirámide/cuña). */
  shape?: "box" | "cylinder" | "sphere" | "cone" | "pyramid" | "wedge";
  /** Profundidad propia del componente en el eje Z (m). Si falta, ocupa casi toda la del mueble. */
  depth?: number;
  /** Retiro en profundidad: distancia desde el frente del mueble (m). Si falta, va centrado. */
  depthInset?: number;
  open?: number; // 0..1 apertura para previsualizar
  color?: string; // color propio del componente (combinar acabados); si falta usa el del mueble
  materialId?: string; // material propio del componente (textura/melamina); tiene prioridad sobre color
};

/** Un mueble: caja paramétrica posicionada en planta. Dimensiones en metros. */
export type Furniture = {
  id: string;
  kind: FurnitureKind;
  name: string;
  pos: Vec2; // centro del footprint en planta
  rotDeg: number; // rotación alrededor del eje vertical (grados)
  width: number; // ancho (eje X local)
  depth: number; // profundidad (eje Z local)
  height: number; // alto (eje Y)
  panel: number; // espesor de placa MDF
  shelves: number; // estantes internos
  doors: number; // cantidad de puertas (0 = abierto)
  baseHeight: number; // altura del piso a la que arranca (alacena ~1.45)
  color: string; // color base si no hay material asignado
  materialId?: string;
  level?: number; // piso/nivel (default 0)
  /** Solo kind === "custom": componentes del mueble armado en el taller. */
  components?: FurnitureComponent[];
  back?: boolean; // tiene panel de fondo (custom). default true
  /** custom: dibujar la carcasa/caja (laterales+piso+techo+fondo). default true. false = solo componentes (formas libres, ej. una escalera). */
  carcass?: boolean;
};

/** Abertura (puerta o ventana) asociada a un muro. Medidas en metros. */
export type OpeningKind = "door" | "window";
export type Opening = {
  id: string;
  wallId: string;
  kind: OpeningKind;
  offset: number; // distancia desde el extremo A del muro al centro de la abertura
  width: number;
  height: number;
  sill: number; // altura de antepecho (ventana); puerta = 0
  level?: number; // piso/nivel (default 0); coincide con el muro
  name?: string; // nombre opcional
  /** Puerta: lado de la bisagra (respecto del sentido A→B del muro). Default "left". */
  hinge?: "left" | "right";
  /** Puerta: hacia qué lado del muro abre la hoja. Default "in". */
  swing?: "in" | "out";
  /** Estilo de la abertura. Puerta: swing|double|sliding. Ventana: fixed|sliding|casement. */
  style?: string;
};

export type ToolId = "select" | "wall" | "pan" | "furniture" | "opening";

/** Referencia a un elemento seleccionable: muro, mueble o abertura. */
export type SelRef =
  | { kind: "wall"; id: string }
  | { kind: "furniture"; id: string }
  | { kind: "opening"; id: string };

/** Selección unificada (elemento primario) o nada. */
export type Selection = SelRef | null;

export type GridSettings = {
  cellM: number; // tamaño de celda de la cuadrícula en metros
  snap: boolean; // imantar a la cuadrícula al dibujar
  showGrid: boolean;
};

export type WallDefaults = {
  thickness: number; // metros, para nuevos muros
  height: number; // metros, para nuevos muros
};

/** Datos serializables de un proyecto (lo que se guarda). */
export type ProjectData = {
  walls: Wall[];
  furniture: Furniture[];
  openings: Opening[];
  materials: Material[];
  customLibrary: Furniture[]; // muebles diseñados en el taller, reutilizables
  floors?: Floor[]; // pisos/niveles (default: 1 planta baja)
  activeLevel?: number;
  floorMaterialId?: string;
  roofs?: Roof[]; // techos por nivel
  render?: RenderSettings; // iluminación / fondo
  pricing?: Pricing; // lista de precios para el despiece/presupuesto
  grid: GridSettings;
  wallDefaults: WallDefaults;
};

export type SavedProject = {
  name: string;
  updatedAt: number;
  data: ProjectData;
};

export const SCHEMA_VERSION = 9;

/** Lista de precios por defecto (valores de referencia; el usuario los ajusta). */
export const DEFAULT_PRICING: Pricing = {
  boardW: 1.83,
  boardH: 2.6,
  boardPrice: 45000,
  edgePrice: 1200,
  hingePrice: 1500,
  slidePrice: 8000,
  pullPrice: 1200,
  rodPrice: 3000,
  laborPerM2: 30000,
  yield: 0.75,
};

/** Render por defecto. */
export const DEFAULT_RENDER: RenderSettings = {
  sunAzimuth: 135,
  sunElevation: 55,
  sunIntensity: 1.25,
  ambient: 0.25,
  background: "#0b0e14",
  shadows: true,
};
