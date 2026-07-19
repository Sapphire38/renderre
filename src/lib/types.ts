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
  opacity?: number; // 0..1: transparencia (agua, vidrio). Default 1 (opaco)
};

/**
 * Tipo constructivo de un muro/cerco. "solid" y derivados (ladrillo/piedra/bloque/
 * vidrio/seto) se renderizan como cuerpo macizo; "fence/railing/picket" son cercos
 * calados (postes + barrotes/alambres) que se ven a través.
 */
export type WallKind =
  | "solid" // muro liso (default)
  | "brick" // ladrillo visto
  | "stone" // piedra
  | "block" // bloque de hormigón
  | "glass" // paño de vidrio
  | "hedge" // cerco vivo / seto
  | "fence" // alambrado (postes + alambres)
  | "railing" // reja / baranda (barrotes verticales)
  | "picket"; // cerco de madera (estacas)

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
  /** Tipo constructivo (default "solid"). Cambia geometría 3D y dibujo en planta. */
  kind?: WallKind;
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
  /** Armar la losa de piso automática de este nivel (default true). Apagala donde el
   *  suelo lo define el terreno/superficies, para que no se arme una losa que pisa
   *  el terreno con desnivel ni los objetos. */
  autoSlab?: boolean;
};

/** Forma de una superficie de suelo. */
export type SurfaceShape = "rect" | "circle" | "polygon";

/**
 * Una superficie de suelo: un parche con su propio material (grabilla, césped, deck,
 * agua, etc.) que se apoya sobre el suelo del nivel. Permite varios suelos sobre el
 * suelo, solapados o no. Se dibuja en planta y se renderiza como una losa fina en 3D.
 */
export type Surface = {
  id: string;
  pos: Vec2; // centro en planta
  width: number; // tamaño en X (m); diámetro si shape="circle"
  depth: number; // tamaño en Z (m)
  rotDeg: number; // rotación alrededor del eje vertical (grados)
  shape?: SurfaceShape; // default "rect"
  /** Sólo shape "polygon": vértices en coords LOCALES (relativas a pos, antes de rotar). */
  points?: Vec2[];
  /** Pendiente: dirección (azimut en grados, hacia dónde SUBE) e inclinación (grados, 0 = plano). */
  slopeDir?: number;
  slopeDeg?: number;
  materialId?: string;
  color?: string; // color de respaldo si no hay material
  level?: number; // piso/nivel (default 0)
  /** Altura sobre el suelo del nivel (m). Permite apilar superficies y evitar z-fighting. */
  lift?: number;
  /** Espesor de la losa (m). Default 0.04. */
  thickness?: number;
  name?: string;
};

/** Malla de terreno esculpible: grilla regular de alturas (heightfield). */
export type Terrain = {
  enabled: boolean;
  origin: Vec2; // esquina mínima (x,z) de la grilla, en metros
  cols: number; // celdas en X
  rows: number; // celdas en Z
  cell: number; // tamaño de celda (m)
  heights: number[]; // (cols+1)*(rows+1) alturas (m), fila por fila: heights[iz*(cols+1)+ix]
  materialId?: string;
  color?: string; // color de respaldo si no hay material
};

/** Ajustes de iluminación/render de la escena 3D. */
export type RenderSettings = {
  sunAzimuth: number; // grados, dirección del sol en planta (0..360)
  sunElevation: number; // grados sobre el horizonte (0..90)
  sunIntensity: number; // 0..3
  ambient: number; // luz ambiente 0..2
  background: string; // color de fondo / cielo (hex)
  shadows: boolean; // proyectar sombras
  lampLights?: boolean; // las luminarias (farola/velador/…) proyectan luz real (point lights)
  lampIntensity?: number; // intensidad de esas luces (0..40)
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
  /** $ por pistón a gas / brazo hidráulico (tapas de apertura vertical). Opcional para proyectos viejos. */
  pistonPrice?: number;
  laborPerM2: number; // $ de mano de obra por m² de placa
  yield: number; // 0..1 aprovechamiento estimado de la placa (sin nesting)
};

/** Un techo sobre un nivel: cubre la huella de los muros de ese piso. */
export type RoofKind = "flat" | "gable" | "shed";
export type Roof = {
  id: string;
  level: number; // nivel sobre el que apoya
  kind: RoofKind;
  height: number; // altura de los aleros (desde el piso del nivel) donde apoya el techo
  rise: number; // cuánto sube la cumbrera (gable) o el lado alto (shed) sobre los aleros
  overhang: number; // alero que sobresale del perímetro (m)
  ridgeAxis?: "x" | "z"; // gable: dirección de la cumbrera · shed: eje del borde alto; default = lado más largo
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
  | "prim-wedge"
  // estructura
  | "column" // columna redonda
  | "column-sq" // columna cuadrada
  // jardín / exterior
  | "tree" // árbol
  | "pine" // pino / conífera
  | "palm" // palmera
  | "bush" // arbusto
  | "potted-plant" // planta en maceta
  | "flowers" // cantero de flores
  | "bench" // banco
  | "fountain" // fuente
  | "bbq" // parrilla / asador
  | "umbrella" // sombrilla
  | "rock" // roca decorativa
  // luminarias
  | "streetlamp" // farola / poste de luz
  | "bollard-light" // baliza de jardín
  | "table-lamp" // velador / lámpara de mesa
  | "floor-lamp" // lámpara de pie
  | "pendant-lamp" // lámpara colgante (techo)
  | "wall-lamp" // aplique de pared
  // recreación / exterior 2
  | "pool" // pileta / piscina
  | "pergola" // pérgola
  | "gazebo" // glorieta
  | "swing" // hamaca / columpio (juego de plaza)
  | "slide" // tobogán
  | "hammock" // hamaca paraguaya
  | "trampoline" // cama elástica
  | "planter-box" // jardinera larga
  | "clothesline" // tender de ropa
  | "mailbox" // buzón
  | "flag" // mástil con bandera
  | "car" // auto
  // electrodomésticos / interiores 2
  | "microwave" // microondas
  | "range-hood" // campana de cocina
  | "dishwasher" // lavavajillas
  | "air-conditioner" // aire acondicionado split
  | "ceiling-fan" // ventilador de techo
  | "water-tank" // tanque de agua
  | "bidet" // bidé
  | "armchair" // sillón individual
  | "dresser" // cómoda
  | "crib" // cuna
  // decoración
  | "rug" // alfombra
  | "mirror" // espejo
  | "painting" // cuadro
  | "curtain" // cortina
  | "wall-clock" // reloj de pared
  | "lounger" // reposera
  | "bicycle" // bicicleta
  | "dog-house" // cucha
  // oficina / gym / mascotas / vehículos / juegos
  | "monitor" // monitor / PC
  | "office-chair" // silla de oficina
  | "bookcase" // biblioteca con libros
  | "whiteboard" // pizarra
  | "treadmill" // cinta de correr
  | "dumbbell-rack" // rack de mancuernas
  | "exercise-bike" // bicicleta fija
  | "pet-bed" // cama de mascota
  | "aquarium" // acuario / pecera
  | "bird-cage" // jaula de pájaros
  | "motorcycle" // moto
  | "pickup" // camioneta
  | "playset" // juego de plaza combinado
  | "seesaw" // subibaja / balancín
  | "sandbox" // arenero
  | "coat-rack" // perchero
  // cocina / baño 2
  | "kitchen-island" // isla de cocina
  | "corner-cabinet" // mueble esquinero
  | "double-sink" // bacha doble
  | "towel-rack" // toallero
  | "medicine-cabinet" // botiquín
  | "wine-rack" // botellero / cava
  | "bar" // barra
  // náutico / camping
  | "tent" // carpa
  | "kayak" // kayak / canoa
  | "campfire" // fogata
  | "cooler" // conservadora
  | "boat" // bote / lancha
  // vehículos 2
  | "van" // furgoneta / van
  | "truck" // camión
  | "scooter" // monopatín
  // modelo 3D importado (.glb) — la geometría viene de modelUrl
  | "model";

/** Componente de un mueble custom, ubicado por un rectángulo en la cara frontal. */
export type ComponentKind =
  | "shelf" // estante horizontal
  | "drawer" // cajón (frente + caja)
  | "doorHinged" // puerta batiente
  | "doorSliding" // puerta corrediza
  | "doorFlap" // tapa de apertura vertical (rebatible hacia arriba o abajo)
  | "cleat" // listón francés (fijación a muro, tira ripada a 45°)
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
  /** Corrediza: solape entre hojas (m). Si falta, se calcula automático (12% del segmento, tope 4 cm). */
  overlap?: number;
  hinge?: "left" | "right"; // puerta batiente
  /** Tapa vertical (doorFlap): hacia dónde abre. "up" = alacena con brazos hidráulicos; "down" = rebatible tipo bar/escritorio. Default "up". */
  flapDir?: "up" | "down";
  /** Tapa vertical hacia arriba: dibujar los brazos hidráulicos (pistones a gas). Default true. */
  pistons?: boolean;
  orient?: "front" | "horizontal" | "vertical"; // placa libre
  /** Placa: forma 3D. "box" (default) o una primitiva (cilindro/esfera/cono/pirámide/cuña). */
  shape?: "box" | "cylinder" | "sphere" | "cone" | "pyramid" | "wedge";
  /** Espesor propio de la placa de este componente (m). Si falta, usa el del mueble (draft.panel). */
  thickness?: number;
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
  /** Espesor propio del fondo (m). Si falta usa `panel`. Típico 3 mm (fibrofácil) en muebles livianos. */
  backThickness?: number;
  /** Retiro del fondo desde la cara trasera (m). Default 0 (a tope). Con 18–20 mm queda el hueco
   *  para embutir un sistema de fijación francés (listón a 45°) oculto contra la pared. */
  backInset?: number;
  /** custom: dibujar la carcasa/caja (laterales+piso+techo+fondo). default true. false = solo componentes (formas libres, ej. una escalera). */
  carcass?: boolean;
  /** Modelo 3D externo (.glb/glTF): data URL o ruta. Si está, se renderiza el modelo (fit a width×depth) con fallback a caja. */
  modelUrl?: string;
};

/** Un modelo 3D importado (.glb) guardado en la biblioteca del proyecto. */
export type ModelAsset = {
  id: string;
  name: string;
  dataUrl: string; // data:...;base64, del .glb (persistido en el proyecto)
  width: number; // dimensiones nativas medidas al importar (m)
  depth: number;
  height: number;
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

export type ToolId = "select" | "wall" | "pan" | "furniture" | "opening" | "surface";

/** Referencia a un elemento seleccionable: muro, mueble, abertura o superficie. */
export type SelRef =
  | { kind: "wall"; id: string }
  | { kind: "furniture"; id: string }
  | { kind: "opening"; id: string }
  | { kind: "surface"; id: string };

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
  surfaces?: Surface[]; // superficies de suelo (grabilla, césped, deck, agua, …)
  terrain?: Terrain; // malla de terreno esculpible (heightfield)
  materials: Material[];
  models?: ModelAsset[]; // modelos 3D (.glb) importados por el usuario
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

export const SCHEMA_VERSION = 10;

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
  pistonPrice: 6000,
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
  lampLights: true,
  lampIntensity: 8,
};
