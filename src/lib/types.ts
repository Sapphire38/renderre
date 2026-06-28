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
  height: number; // metros
  materialId?: string;
  level?: number; // piso/nivel (default 0)
  name?: string; // nombre opcional
};

/** Un piso/nivel del proyecto. */
export type Floor = {
  name: string;
  elevation: number; // altura de arranque del nivel, en metros
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
  | "vanity"; // mesada de baño con bacha

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
  grid: GridSettings;
  wallDefaults: WallDefaults;
};

export type SavedProject = {
  name: string;
  updatedAt: number;
  data: ProjectData;
};

export const SCHEMA_VERSION = 6;
