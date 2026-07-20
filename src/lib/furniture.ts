import type { ComponentKind, Furniture, FurnitureComponent, FurnitureKind, Vec2 } from "./types";
import { uid } from "./geometry";

/** Un panel de MDF en el marco LOCAL del mueble (centro del footprint, y=0 en el piso). */
export type Panel = {
  pos: [number, number, number];
  size: [number, number, number];
  door?: boolean;
  pivot?: [number, number, number]; // eje de giro (puerta batiente / tapa)
  rotY?: number; // rotación alrededor del pivot (eje vertical, puerta batiente)
  rotX?: number; // rotación alrededor del pivot (eje horizontal, tapa de apertura vertical)
  cylinder?: boolean; // forma cilíndrica (barral, hornalla, etc.)
  cylAxis?: "x" | "y" | "z"; // eje del cilindro (default "x"); largo = size en ese eje, radio = otro
  shape?: "sphere" | "cone" | "pyramid" | "wedge"; // primitivas no-caja
  color?: string; // color propio del panel
  materialId?: string; // material propio del panel (tiene prioridad sobre color)
  emissive?: string; // color de emisión (la pieza "brilla", para focos/pantallas de luz)
  opacity?: number; // 0..1: transparencia (agua, vidrio). Default 1 (opaco)
  rot?: [number, number, number]; // inclinación propia de la pieza (radianes), para capós/parabrisas/proas en diagonal
  /** Rol de la pieza para el despiece (Lateral, Piso, Estante, Frente, Puerta, …). */
  role?: string;
  /** Cantos a la vista (bordes con tapacanto) para el despiece. Si falta, se estima. */
  edges?: { front?: boolean; back?: boolean; left?: boolean; right?: boolean; top?: boolean; bottom?: boolean };
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
  category?: "mdf" | "equip" | "prim" | "struct" | "garden" | "decor"; // equip = electrodomésticos/objetos · prim = primitivas · struct = estructura (columnas) · garden = jardín/luces/exterior · decor = decoración
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
  // --- estructura ---
  { kind: "column", name: "Columna redonda", width: 0.25, depth: 0.25, height: 2.6, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#cfd2d6", category: "struct" },
  { kind: "column-sq", name: "Columna cuadrada", width: 0.25, depth: 0.25, height: 2.6, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#cfd2d6", category: "struct" },
  // --- jardín / exterior ---
  { kind: "tree", name: "Árbol", width: 2.4, depth: 2.4, height: 4.2, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#3f7d3a", category: "garden" },
  { kind: "pine", name: "Pino", width: 1.7, depth: 1.7, height: 4.6, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#2f6d44", category: "garden" },
  { kind: "palm", name: "Palmera", width: 2.6, depth: 2.6, height: 4.6, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#4f9b46", category: "garden" },
  { kind: "bush", name: "Arbusto", width: 0.9, depth: 0.9, height: 0.7, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#4a8f3e", category: "garden" },
  { kind: "potted-plant", name: "Planta en maceta", width: 0.45, depth: 0.45, height: 0.9, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#b5673c", category: "garden" },
  { kind: "flowers", name: "Cantero de flores", width: 1.0, depth: 0.5, height: 0.35, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#6b4a2c", category: "garden" },
  { kind: "bench", name: "Banco", width: 1.6, depth: 0.5, height: 0.85, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#8a6b4f", category: "garden" },
  { kind: "fountain", name: "Fuente", width: 1.4, depth: 1.4, height: 0.9, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#b8bcc2", category: "garden" },
  { kind: "bbq", name: "Parrilla", width: 1.2, depth: 0.7, height: 1.7, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#a8553f", category: "garden" },
  { kind: "umbrella", name: "Sombrilla", width: 2.4, depth: 2.4, height: 2.5, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#cf5b4e", category: "garden" },
  { kind: "rock", name: "Roca", width: 0.8, depth: 0.7, height: 0.5, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#8d8a82", category: "garden" },
  // --- luminarias ---
  { kind: "streetlamp", name: "Farola", width: 0.5, depth: 0.5, height: 3.4, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#3a3f45", category: "garden" },
  { kind: "bollard-light", name: "Baliza", width: 0.2, depth: 0.2, height: 0.8, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#4a4f57", category: "garden" },
  { kind: "table-lamp", name: "Velador", width: 0.3, depth: 0.3, height: 0.5, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#e7ddc8", category: "garden" },
  { kind: "floor-lamp", name: "Lámpara de pie", width: 0.4, depth: 0.4, height: 1.6, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#e7ddc8", category: "garden" },
  { kind: "pendant-lamp", name: "Colgante", width: 0.4, depth: 0.4, height: 0.5, panel: MDF, shelves: 0, doors: 0, baseHeight: 1.95, color: "#3a3f45", category: "garden" },
  { kind: "wall-lamp", name: "Aplique", width: 0.22, depth: 0.18, height: 0.3, panel: MDF, shelves: 0, doors: 0, baseHeight: 1.8, color: "#3a3f45", category: "garden" },
  // --- recreación / exterior 2 ---
  { kind: "pool", name: "Pileta", width: 4.0, depth: 2.5, height: 0.5, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#2f7fa8", category: "garden" },
  { kind: "pergola", name: "Pérgola", width: 3.0, depth: 3.0, height: 2.4, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#9c6b40", category: "garden" },
  { kind: "gazebo", name: "Glorieta", width: 3.0, depth: 3.0, height: 3.0, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#cdb89a", category: "garden" },
  { kind: "swing", name: "Hamaca", width: 1.8, depth: 1.2, height: 2.0, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#5a8fb0", category: "garden" },
  { kind: "slide", name: "Tobogán", width: 2.6, depth: 0.9, height: 2.0, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#e0683a", category: "garden" },
  { kind: "hammock", name: "Hamaca paraguaya", width: 2.2, depth: 0.9, height: 1.0, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#d8c46a", category: "garden" },
  { kind: "trampoline", name: "Cama elástica", width: 2.4, depth: 2.4, height: 0.9, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#2b2f36", category: "garden" },
  { kind: "planter-box", name: "Jardinera", width: 1.4, depth: 0.4, height: 0.5, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#8a6b4f", category: "garden" },
  { kind: "clothesline", name: "Tender", width: 1.8, depth: 1.0, height: 1.6, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#b9bec4", category: "garden" },
  { kind: "mailbox", name: "Buzón", width: 0.3, depth: 0.4, height: 1.1, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#3a6ea5", category: "garden" },
  { kind: "flag", name: "Bandera", width: 0.4, depth: 0.4, height: 4.0, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#dfe2e5", category: "garden" },
  { kind: "car", name: "Auto", width: 1.8, depth: 4.4, height: 1.5, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#b23b3b", category: "garden" },
  // --- electrodomésticos / interiores 2 ---
  { kind: "microwave", name: "Microondas", width: 0.5, depth: 0.38, height: 0.3, panel: MDF, shelves: 0, doors: 0, baseHeight: 0.9, color: "#cfd3d8", category: "equip" },
  { kind: "range-hood", name: "Campana", width: 0.6, depth: 0.5, height: 0.6, panel: MDF, shelves: 0, doors: 0, baseHeight: 1.5, color: "#d7dade", category: "equip" },
  { kind: "dishwasher", name: "Lavavajillas", width: 0.6, depth: 0.6, height: 0.85, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#edeff1", category: "equip" },
  { kind: "air-conditioner", name: "Aire (split)", width: 0.9, depth: 0.22, height: 0.3, panel: MDF, shelves: 0, doors: 0, baseHeight: 2.1, color: "#f1f3f5", category: "equip" },
  { kind: "ceiling-fan", name: "Ventilador techo", width: 1.1, depth: 1.1, height: 0.4, panel: MDF, shelves: 0, doors: 0, baseHeight: 2.35, color: "#caa472", category: "equip" },
  { kind: "water-tank", name: "Tanque de agua", width: 1.0, depth: 1.0, height: 1.1, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#2b2f36", category: "equip" },
  { kind: "bidet", name: "Bidé", width: 0.4, depth: 0.6, height: 0.4, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#eef0f2", category: "equip" },
  { kind: "armchair", name: "Sillón", width: 0.9, depth: 0.9, height: 0.9, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#6f7681", category: "equip" },
  { kind: "dresser", name: "Cómoda", width: 1.0, depth: 0.5, height: 0.9, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#caa472", category: "equip" },
  { kind: "crib", name: "Cuna", width: 0.7, depth: 1.3, height: 0.9, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#d8c4a3", category: "equip" },
  // --- decoración ---
  { kind: "rug", name: "Alfombra", width: 2.0, depth: 1.4, height: 0.02, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#9c5b4a", category: "decor" },
  { kind: "mirror", name: "Espejo", width: 0.6, depth: 0.05, height: 1.2, panel: MDF, shelves: 0, doors: 0, baseHeight: 1.0, color: "#8a6b4f", category: "decor" },
  { kind: "painting", name: "Cuadro", width: 0.8, depth: 0.04, height: 0.6, panel: MDF, shelves: 0, doors: 0, baseHeight: 1.4, color: "#5b3a23", category: "decor" },
  { kind: "curtain", name: "Cortina", width: 1.6, depth: 0.12, height: 2.2, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#b7a98f", category: "decor" },
  { kind: "wall-clock", name: "Reloj", width: 0.4, depth: 0.06, height: 0.4, panel: MDF, shelves: 0, doors: 0, baseHeight: 1.8, color: "#3a3f45", category: "decor" },
  { kind: "lounger", name: "Reposera", width: 0.65, depth: 1.9, height: 0.6, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#5a8fb0", category: "decor" },
  { kind: "bicycle", name: "Bicicleta", width: 0.12, depth: 1.7, height: 1.1, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#3a6ea5", category: "decor" },
  { kind: "dog-house", name: "Cucha", width: 0.8, depth: 0.9, height: 0.8, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#9c6b40", category: "decor" },
  // --- oficina / gym / mascotas / vehículos / juegos ---
  { kind: "monitor", name: "Monitor", width: 0.6, depth: 0.18, height: 0.45, panel: MDF, shelves: 0, doors: 0, baseHeight: 0.75, color: "#1b1d22", category: "equip" },
  { kind: "office-chair", name: "Silla oficina", width: 0.6, depth: 0.6, height: 1.1, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#2b2f36", category: "equip" },
  { kind: "bookcase", name: "Biblioteca", width: 0.9, depth: 0.3, height: 1.9, panel: MDF, shelves: 4, doors: 0, baseHeight: 0, color: "#caa472", category: "mdf" },
  { kind: "whiteboard", name: "Pizarra", width: 1.5, depth: 0.05, height: 0.9, panel: MDF, shelves: 0, doors: 0, baseHeight: 1.0, color: "#9aa0a6", category: "equip" },
  { kind: "treadmill", name: "Cinta correr", width: 0.8, depth: 1.8, height: 1.3, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#3a3f45", category: "equip" },
  { kind: "dumbbell-rack", name: "Rack pesas", width: 1.0, depth: 0.4, height: 0.8, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#23262b", category: "equip" },
  { kind: "exercise-bike", name: "Bici fija", width: 0.5, depth: 1.0, height: 1.2, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#3a3f45", category: "equip" },
  { kind: "pet-bed", name: "Cama mascota", width: 0.7, depth: 0.55, height: 0.2, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#8a6b4f", category: "equip" },
  { kind: "aquarium", name: "Acuario", width: 0.8, depth: 0.35, height: 0.5, panel: MDF, shelves: 0, doors: 0, baseHeight: 0.6, color: "#bcd6e6", category: "equip" },
  { kind: "bird-cage", name: "Jaula", width: 0.5, depth: 0.5, height: 1.2, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#c7cbd0", category: "equip" },
  { kind: "coat-rack", name: "Perchero", width: 0.4, depth: 0.4, height: 1.8, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#6b4a2c", category: "equip" },
  { kind: "motorcycle", name: "Moto", width: 0.5, depth: 2.0, height: 1.1, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#1b1d22", category: "garden" },
  { kind: "pickup", name: "Camioneta", width: 1.9, depth: 5.0, height: 1.7, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#2b2f36", category: "garden" },
  { kind: "playset", name: "Juego de plaza", width: 3.0, depth: 3.5, height: 2.4, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#5a8f3c", category: "garden" },
  { kind: "seesaw", name: "Subibaja", width: 0.4, depth: 2.6, height: 0.6, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#e0683a", category: "garden" },
  { kind: "sandbox", name: "Arenero", width: 1.6, depth: 1.6, height: 0.25, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#9c6b40", category: "garden" },
  // --- cocina / baño 2 ---
  { kind: "kitchen-island", name: "Isla de cocina", width: 1.6, depth: 0.9, height: 0.9, panel: MDF, shelves: 0, doors: 2, baseHeight: 0, color: "#cdb595", category: "mdf" },
  { kind: "corner-cabinet", name: "Esquinero", width: 0.9, depth: 0.9, height: 0.85, panel: MDF, shelves: 1, doors: 1, baseHeight: 0, color: "#cdb595", category: "mdf" },
  { kind: "double-sink", name: "Bacha doble", width: 1.2, depth: 0.55, height: 0.2, panel: MDF, shelves: 0, doors: 0, baseHeight: 0.85, color: "#ced3d8", category: "equip" },
  { kind: "towel-rack", name: "Toallero", width: 0.6, depth: 0.12, height: 0.5, panel: MDF, shelves: 0, doors: 0, baseHeight: 1.0, color: "#c7cbd0", category: "equip" },
  { kind: "medicine-cabinet", name: "Botiquín", width: 0.5, depth: 0.15, height: 0.6, panel: MDF, shelves: 0, doors: 0, baseHeight: 1.3, color: "#d7d2c8", category: "equip" },
  { kind: "wine-rack", name: "Botellero", width: 0.6, depth: 0.35, height: 1.0, panel: MDF, shelves: 4, doors: 0, baseHeight: 0, color: "#8a6b4f", category: "mdf" },
  { kind: "bar", name: "Barra", width: 1.6, depth: 0.6, height: 1.1, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#8a6b4f", category: "mdf" },
  // --- náutico / camping ---
  { kind: "tent", name: "Carpa", width: 2.0, depth: 2.2, height: 1.5, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#3a7d4a", category: "garden" },
  { kind: "kayak", name: "Kayak", width: 0.6, depth: 3.0, height: 0.4, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#e0a13a", category: "garden" },
  { kind: "campfire", name: "Fogata", width: 0.7, depth: 0.7, height: 0.5, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#8d8a82", category: "garden" },
  { kind: "cooler", name: "Conservadora", width: 0.6, depth: 0.4, height: 0.45, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#cf5b4e", category: "garden" },
  { kind: "boat", name: "Bote", width: 1.6, depth: 4.0, height: 1.2, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#dfe3e6", category: "garden" },
  // --- vehículos 2 ---
  { kind: "van", name: "Van", width: 1.9, depth: 4.8, height: 2.0, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#e0e2e5", category: "garden" },
  { kind: "truck", name: "Camión", width: 2.2, depth: 6.5, height: 2.6, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#3a6ea5", category: "garden" },
  { kind: "scooter", name: "Monopatín", width: 0.2, depth: 1.0, height: 1.1, panel: MDF, shelves: 0, doors: 0, baseHeight: 0, color: "#2b2f36", category: "garden" },
];

const APPLIANCE_KINDS = new Set<FurnitureKind>([
  "tv", "fridge", "stove", "sink", "washer", "toilet", "bed", "sofa",
  "tv-stand", "nightstand", "desk", "vanity",
  "water-heater", "bathtub", "shower", "chair", "plant", "round-table", "coffee-table", "stairs",
  "prim-box", "prim-cylinder", "prim-sphere", "prim-cone", "prim-pyramid", "prim-wedge",
  "column", "column-sq",
  "tree", "pine", "palm", "bush", "potted-plant", "flowers", "bench", "fountain", "bbq", "umbrella", "rock",
  "streetlamp", "bollard-light", "table-lamp", "floor-lamp", "pendant-lamp", "wall-lamp",
  "pool", "pergola", "gazebo", "swing", "slide", "hammock", "trampoline", "planter-box", "clothesline", "mailbox", "flag", "car",
  "microwave", "range-hood", "dishwasher", "air-conditioner", "ceiling-fan", "water-tank", "bidet", "armchair", "dresser", "crib",
  "rug", "mirror", "painting", "curtain", "wall-clock", "lounger", "bicycle", "dog-house",
  "monitor", "office-chair", "bookcase", "whiteboard", "treadmill", "dumbbell-rack", "exercise-bike",
  "pet-bed", "aquarium", "bird-cage", "coat-rack", "motorcycle", "pickup", "playset", "seesaw", "sandbox",
  "kitchen-island", "corner-cabinet", "double-sink", "towel-rack", "medicine-cabinet", "wine-rack", "bar",
  "tent", "kayak", "campfire", "cooler", "boat", "van", "truck", "scooter",
  "model",
]);

/** Objetos que se montan/apoyan contra un muro: al colocarlos cerca de uno se pegan y orientan. */
export const WALL_MOUNTED = new Set<FurnitureKind>([
  "tv", "painting", "mirror", "wall-clock", "wall-lamp", "air-conditioner", "whiteboard", "curtain",
  "towel-rack", "medicine-cabinet",
]);
export const isWallMounted = (k: FurnitureKind) => WALL_MOUNTED.has(k);
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
    panels.push({ pos: [0, base + H / 2, 0], size: [W, H, D], role: "Mesada", edges: { front: true, left: true, right: true } });
    return panels;
  }

  if (f.kind === "table") {
    const topT = Math.max(t, 0.025);
    const legD = 0.06;
    const legH = Math.max(H - topT, 0.05);
    panels.push({ pos: [0, base + H - topT / 2, 0], size: [W, topT, D], role: "Tapa", edges: { front: true, back: true, left: true, right: true } });
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
  panels.push({ pos: [-(W / 2 - t / 2), base + H / 2, 0], size: [t, H, D], role: "Lateral", edges: { front: true } }); // lateral izq
  panels.push({ pos: [W / 2 - t / 2, base + H / 2, 0], size: [t, H, D], role: "Lateral", edges: { front: true } }); // lateral der
  panels.push({ pos: [0, base + t / 2, 0], size: [innerW, t, D], role: "Piso", edges: { front: true } }); // piso
  panels.push({ pos: [0, base + H - t / 2, 0], size: [innerW, t, D], role: "Techo", edges: { front: true } }); // techo
  panels.push({ pos: [0, base + H / 2, D / 2 - t / 2], size: [innerW, H - 2 * t, t], role: "Fondo" }); // fondo

  for (let i = 1; i <= f.shelves; i++) {
    const sy = base + t + ((H - 2 * t) * i) / (f.shelves + 1);
    panels.push({ pos: [0, sy, 0], size: [innerW, t, D - t], role: "Estante", edges: { front: true } });
  }

  if (f.doors > 0) {
    const gap = 0.003;
    const doorW = (W - gap * (f.doors + 1)) / f.doors;
    const doorH = H - 2 * t - gap * 2;
    for (let i = 0; i < f.doors; i++) {
      const dx = -W / 2 + gap + doorW / 2 + i * (doorW + gap);
      // Frente sobrepuesto: la puerta va POR DELANTE de la carcasa (no incrustada en ella).
      panels.push({
        pos: [dx, base + H / 2, -(D / 2 + t / 2)],
        size: [doorW, doorH, t],
        door: true,
        role: "Puerta",
        edges: { front: true, back: true, left: true, right: true },
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
    case "doorFlap": {
      // Tapa vertical: por defecto ocupa la franja superior y abre hacia arriba con pistones.
      const fh = Math.min(0.45, inH);
      return { id, kind, x: t, y: Math.max(t, t + inH - fh), w: inW, h: fh, flapDir: "up", pistons: true, open: 0 };
    }
    case "divider":
      return { id, kind, x: W / 2 - t / 2, y: t, w: t, h: inH };
    case "cleat":
      // Listón francés: tira horizontal (ripada a 45°) en la franja superior trasera.
      return { id, kind, x: t, y: Math.max(t, H - t - 0.12), w: inW, h: 0.08 };
    case "rod":
      return { id, kind, x: t, y: H * 0.85, w: inW, h: 0.03 };
    case "board":
    default:
      return { id, kind, x: W * 0.25, y: H * 0.25, w: W * 0.5, h: H * 0.4, orient: "front" };
  }
}

/** Espesor y retiro EFECTIVOS del fondo de un mueble custom (y si existe). */
export function backInfo(f: Furniture): { bt: number; bi: number; has: boolean } {
  const t = Math.min(f.panel, Math.min(f.width, f.depth, f.height) / 3);
  const has = f.carcass !== false && f.back !== false;
  const bt = Math.min(f.backThickness ?? t, f.depth / 2);
  const groove = f.backGroove === true;
  const bi = Math.min(Math.max(f.backInset ?? (groove ? 0.01 : 0), 0), Math.max(0, f.depth - bt - 0.01));
  return { bt, bi, has };
}

/**
 * Profundidad interior ÚTIL: de la cara frontal a la cara del fondo, descontando
 * espesor y retiro del fondo (sin fondo → toda la profundidad). Es la medida de
 * corte correcta para estantes y divisiones.
 */
export function innerDepth(f: Furniture): number {
  const { bt, bi, has } = backInfo(f);
  return Math.max(0.02, has ? f.depth - bi - bt : f.depth);
}

/**
 * Luz efectiva de UNA abertura (puerta/tapa/frente): la propia (`gap`) manda;
 * si no, se calcula por herraje con la fórmula del arco √(a²+c²)−c + 1 mm de
 * tolerancia; si no hay herraje definido, usa la luz global del mueble.
 */
export function frontGapFor(f: Furniture, c: FurnitureComponent): number {
  const cl = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  if (c.gap != null) return cl(c.gap, 0, 0.02);
  let g: number;
  switch (c.hingeType) {
    case "cup": // cazoleta 35: el movimiento compuesto saca la tapa antes de girar
      g = 0.003;
      break;
    case "pianoFront": // piano con nudo al frente: gira hacia afuera, luz solo estética
      g = 0.002;
      break;
    case "custom": {
      const a = c.hingeA ?? 0;
      const cc = c.hingeC ?? 0;
      g = cl(Math.hypot(a, cc) - cc + 0.001, 0.002, 0.02);
      break;
    }
    case "straightBack": // eje atrás: luz normal PERO exige chanfle 45° en el canto del eje
    default:
      g = cl(f.frontGap ?? GAP, 0, 0.02);
  }
  // Tapas verticales anchas flexionan con el peso: 1 mm extra de seguridad.
  if (c.kind === "doorFlap" && c.w > 0.9) g += 0.001;
  return g;
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
  const plinth = Math.min(Math.max(f.plinth ?? 0, 0), H / 2);
  if (f.carcass !== false) {
    panels.push({ pos: [-(W / 2 - t / 2), base + H / 2, 0], size: [t, H, D], role: "Lateral", edges: { front: true } });
    panels.push({ pos: [W / 2 - t / 2, base + H / 2, 0], size: [t, H, D], role: "Lateral", edges: { front: true } });
    // Con zócalo el piso del mueble sube y se agrega la tira de zócalo retirada del frente.
    panels.push({ pos: [0, base + plinth + t / 2, 0], size: [inW, t, D], role: "Piso", edges: { front: true } });
    panels.push({ pos: [0, base + H - t / 2, 0], size: [inW, t, D], role: "Techo", edges: { front: true } });
    if (plinth > 0.005) {
      const pin = Math.min(Math.max(f.plinthInset ?? 0.05, 0), D / 2);
      panels.push({ pos: [0, base + plinth / 2, -D / 2 + pin + t / 2], size: [inW, plinth, t], role: "Zócalo", edges: { front: true } });
    }
    if (f.back !== false) {
      // Fondo con espesor propio (típico 3 mm) y retiro desde atrás: con 18–20 mm de
      // retiro queda el hueco para embutir un listón francés oculto contra la pared.
      // Ranurado: entra 6 mm por lado en laterales/piso/techo → la pieza sale más grande
      // (queda oculta dentro de la ranura; en 3D el solape no se ve).
      const { bt, bi } = backInfo(f);
      const groove = f.backGroove === true;
      const g2 = groove ? 0.012 : 0; // 6 mm por lado
      panels.push({ pos: [0, base + plinth / 2 + H / 2, D / 2 - bi - bt / 2], size: [inW + g2, H - plinth - 2 * t + g2, bt], role: groove ? "Fondo (ranurado)" : "Fondo" });
    }
  }

  const cx = (x: number, w: number) => -W / 2 + x + w / 2;
  const cyTop = (y: number, h: number) => base + y + h / 2;
  // Cara frontal de la carcasa. Los FRENTES (puertas, tapas, frentes de cajón) van
  // sobrepuestos POR DELANTE de este plano — si quedaran dentro (z = -D/2 + t/2) se
  // incrustan en laterales/piso/techo y la tapa cerrada se ve metida en el mueble.
  const frontFace = -D / 2;
  const cl = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  // Profundidad interior útil: de la cara frontal a la cara del fondo (descuenta
  // espesor Y retiro del fondo). Es el default de estantes/divisiones/cajones.
  const fullD = innerDepth(f);
  // Profundidad (eje Z) y retiro desde el frente de un componente. Default:
  // arranca en la cara frontal (retiro 0) y muere contra el fondo — la medida
  // que se ve en "Profundidad" es directamente la de corte.
  const depthZ = (c: FurnitureComponent): { zc: number; zs: number } => {
    const zs = c.depth == null ? fullD : cl(c.depth, 0.02, D);
    const inset = cl(c.depthInset ?? 0, 0, Math.max(0, D - zs));
    return { zc: -D / 2 + inset + zs / 2, zs };
  };

  for (const c of f.components ?? []) {
    const open = c.open ?? 0;
    const col = c.color; // color propio del componente (si falta, usa el del mueble)
    const mat = c.materialId; // material propio del componente (textura/melamina)
    // Espesor propio de la pieza (m). Si no se definió, usa el del mueble.
    const ct = c.thickness != null ? cl(c.thickness, 0.003, Math.min(W, D, H) / 2) : t;
    if (c.kind === "shelf") {
      const d = depthZ(c);
      panels.push({ pos: [cx(c.x, c.w), base + c.y, d.zc], size: [c.w, ct, d.zs], color: col, materialId: mat, role: "Estante", edges: { front: true } });
    } else if (c.kind === "divider") {
      // El espesor FÍSICO de la división es su campo "Espesor" (ct), no el ancho
      // dibujado en el alzado (que tiene mínimo 2 cm y es solo el manejador visual):
      // si no, el despiece listaba divisiones de 20 mm con placa de 18.
      const d = depthZ(c);
      panels.push({ pos: [cx(c.x, c.w), cyTop(c.y, c.h), d.zc], size: [ct, c.h, d.zs], color: col, materialId: mat, role: "División", edges: { front: true } });
    } else if (c.kind === "cleat") {
      // Listón francés: tira pegada a la cara trasera del mueble (dentro del retiro del
      // fondo si lo hay). Se corta ripado a 45° — el ángulo va como nota en el despiece.
      const clT = cl(c.depth ?? Math.max(ct, 0.018), 0.009, D / 2);
      panels.push({
        pos: [cx(c.x, c.w), cyTop(c.y, c.h), D / 2 - clT / 2],
        size: [c.w, c.h, clT],
        color: col ?? "#a89170",
        materialId: mat,
        role: "Listón francés (45°)",
        edges: { front: true },
      });
    } else if (c.kind === "rod") {
      panels.push({ pos: [cx(c.x, c.w), base + c.y, 0], size: [c.w, 0.03, 0.03], cylinder: true, color: col ?? "#9aa3ad" });
    } else if (c.kind === "board") {
      const o = c.orient ?? "front";
      const shp = c.shape && c.shape !== "box" ? c.shape : null;
      if (shp) {
        // Placa con forma de primitiva: ocupa el rectángulo (w×h) con profundidad propia.
        const dep = cl(c.depth ?? Math.min(c.w, c.h, fullD), 0.02, D);
        const inset = cl(c.depthInset ?? 0, 0, Math.max(0, D - dep));
        const pos: [number, number, number] = [cx(c.x, c.w), cyTop(c.y, c.h), -D / 2 + inset + dep / 2];
        const size: [number, number, number] = [c.w, c.h, dep];
        if (shp === "cylinder") panels.push({ pos, size, cylinder: true, cylAxis: "y", color: col, materialId: mat });
        else panels.push({ pos, size, shape: shp, color: col, materialId: mat });
      } else if (o === "front") {
        const inset = cl(c.depthInset ?? 0, 0, Math.max(0, D - ct));
        panels.push({ pos: [cx(c.x, c.w), cyTop(c.y, c.h), frontFace + ct / 2 + inset], size: [c.w, c.h, ct], color: col, materialId: mat, role: "Placa", edges: { front: true, back: true, left: true, right: true } });
      } else if (o === "horizontal") {
        const d = depthZ(c);
        panels.push({ pos: [cx(c.x, c.w), base + c.y + c.h / 2, d.zc], size: [c.w, ct, d.zs], color: col, materialId: mat, role: "Placa", edges: { front: true } });
      } else {
        const d = depthZ(c);
        panels.push({ pos: [cx(c.x, c.w), cyTop(c.y, c.h), d.zc], size: [ct, c.h, d.zs], color: col, materialId: mat, role: "Placa", edges: { front: true } });
      }
    } else if (c.kind === "drawer") {
      const g = frontGapFor(f, c);
      const n = Math.max(1, c.count ?? 1);
      const each = c.h / n;
      const pull = open * Math.min(D * 0.7, 0.4);
      // Caja del cajón: entra desde el frente y deja 2 cm de luz contra el fondo
      // (respetando espesor + retiro del fondo para no invadir el hueco del francés).
      const boxD = cl(c.depth ?? fullD - 0.02, 0.05, D - ct);
      for (let i = 0; i < n; i++) {
        const dy = c.y + i * each;
        const fY = cyTop(dy, each);
        // frente sobrepuesto: cerrado queda apoyado contra la cara frontal del mueble
        const fz = frontFace - ct / 2 - pull;
        const bxc = cx(c.x, c.w);
        const boxZc = fz + ct / 2 + boxD / 2;
        const sideH = Math.max(each * 0.55, 0.05);
        const boxYc = fY - each / 2 + sideH / 2 + ct;
        panels.push({ pos: [bxc, fY, fz], size: [c.w - g, each - g, ct], door: true, color: col, materialId: mat, role: "Frente cajón", edges: { front: true, back: true, left: true, right: true } }); // frente
        panels.push({ pos: [bxc, fY - each / 2 + ct, boxZc], size: [c.w - 2 * ct, ct, boxD], role: "Piso cajón" }); // piso
        panels.push({ pos: [bxc, boxYc, boxZc + boxD / 2 - ct / 2], size: [c.w - 2 * ct, sideH, ct], role: "Contrafrente cajón" }); // fondo cajón
        panels.push({ pos: [bxc - c.w / 2 + ct / 2, boxYc, boxZc], size: [ct, sideH, boxD], role: "Lateral cajón" }); // lado izq
        panels.push({ pos: [bxc + c.w / 2 - ct / 2, boxYc, boxZc], size: [ct, sideH, boxD], role: "Lateral cajón" }); // lado der
      }
    } else if (c.kind === "doorHinged") {
      const g = frontGapFor(f, c);
      const hingeLeft = (c.hinge ?? "left") === "left";
      const pivotX = hingeLeft ? cx(c.x, c.w) - c.w / 2 : cx(c.x, c.w) + c.w / 2;
      const rot = (hingeLeft ? 1 : -1) * open * Math.PI * 0.62;
      const fz = frontFace - ct / 2; // hoja sobrepuesta al frente
      panels.push({
        pos: [cx(c.x, c.w), cyTop(c.y, c.h), fz],
        size: [c.w - g, c.h - g, ct],
        door: true,
        color: col,
        materialId: mat,
        pivot: [pivotX, cyTop(c.y, c.h), fz],
        rotY: rot,
        role: c.hingeType === "straightBack" ? "Puerta (chanfle 45° lado eje)" : "Puerta",
        edges: { front: true, back: true, left: true, right: true },
      });
    } else if (c.kind === "doorFlap") {
      // Tapa de apertura vertical: rebate alrededor del borde superior ("up", con
      // brazos hidráulicos) o del borde inferior ("down", tipo bar/escritorio).
      const g = frontGapFor(f, c);
      const dir = c.flapDir ?? "up";
      const fz = frontFace - ct / 2; // tapa sobrepuesta al frente
      const bx = cx(c.x, c.w);
      const up = dir === "up";
      const pivotY = up ? base + c.y + c.h : base + c.y;
      // "up": rota hacia afuera/arriba (~100° con pistones); "down": hasta horizontal (90°).
      const ang = up ? open * Math.PI * 0.55 : -open * Math.PI * 0.5;
      panels.push({
        pos: [bx, cyTop(c.y, c.h), fz],
        size: [c.w - g, c.h - g, ct],
        door: true,
        color: col,
        materialId: mat,
        pivot: [bx, pivotY, fz],
        rotX: ang,
        role: c.hingeType === "straightBack" ? "Tapa (chanfle 45° lado eje)" : "Tapa",
        edges: { front: true, back: true, left: true, right: true },
      });
      // Brazos hidráulicos (pistones a gas): unen el lateral interno con la tapa.
      if (up && c.pistons !== false && open > 0.02) {
        const dDoor = Math.min(0.35, c.h * 0.6); // anclaje en la tapa, medido desde el pivote
        const bY = pivotY - dDoor * Math.cos(ang);
        const bZ = fz - dDoor * Math.sin(ang);
        const aY = pivotY - Math.min(0.28, c.h * 0.85);
        const aZ = frontFace + Math.min(0.12, D * 0.4);
        const dy = bY - aY;
        const dz = bZ - aZ;
        const len = Math.hypot(dy, dz) || 0.01;
        const tilt = Math.atan2(-dy, dz); // orienta un cilindro (eje z) sobre el plano Y-Z
        for (const side of [-1, 1]) {
          const px = bx + side * (c.w / 2 - 0.03);
          // cuerpo (cilindro grueso, arranca en el anclaje fijo) + vástago (fino, llega a la tapa)
          panels.push({ pos: [px, aY + dy * 0.275, aZ + dz * 0.275], size: [0.024, 0.024, len * 0.58], cylinder: true, cylAxis: "z", rot: [tilt, 0, 0], color: "#7d848c" });
          panels.push({ pos: [px, bY - dy * 0.225, bZ - dz * 0.225], size: [0.013, 0.013, len * 0.5], cylinder: true, cylAxis: "z", rot: [tilt, 0, 0], color: "#c9ced4" });
        }
      }
    } else if (c.kind === "doorSliding") {
      // Hojas en 2 carriles bien separados, POR DELANTE de la carcasa. Cerradas:
      // tilean el hueco con leve solape. Al abrir se corren y apilan sobre la hoja 0.
      const g = frontGapFor(f, c);
      const n = Math.max(2, c.count ?? 2);
      const seg = c.w / n;
      const overlap = c.overlap != null ? cl(c.overlap, 0, seg) : Math.min(0.04, seg * 0.12);
      const leafW = seg + overlap;
      const trackGap = ct + 0.012;
      for (let i = 0; i < n; i++) {
        const track = i % 2;
        const z = frontFace - ct / 2 - track * trackGap;
        const closedX = -W / 2 + c.x + i * seg + seg / 2;
        const x = closedX - open * i * seg;
        panels.push({ pos: [x, cyTop(c.y, c.h), z], size: [leafW - g, c.h - g, ct], door: true, color: col, materialId: mat, role: "Puerta corrediza", edges: { front: true, back: true, left: true, right: true } });
      }
    }
  }
  return panels;
}

// ===================== Plantillas del taller (variantes de mueble) =====================

export type WorkshopTemplate = { id: string; name: string; hint: string; build: () => Furniture };

/** Base común para las plantillas: mueble custom con medidas y componentes dados. */
function tpl(
  name: string,
  dims: Partial<Furniture>,
  comps: (f: Furniture) => Omit<FurnitureComponent, "id">[],
): Furniture {
  const f: Furniture = { ...makeCustomFurniture(), ...dims, id: uid(), name };
  f.components = comps(f).map((c) => ({ ...c, id: uid() }));
  return f;
}

/**
 * Variantes típicas de carpintería, listas para ajustar medidas. Cada una arma un
 * mueble completo (carcasa + componentes) que después se edita libremente.
 */
export const WORKSHOP_TEMPLATES: WorkshopTemplate[] = [
  {
    id: "cajonera",
    name: "Cajonera (4 cajones)",
    hint: "Módulo de cajones parejos con correderas",
    build: () =>
      tpl("Cajonera", { width: 0.6, depth: 0.5, height: 0.9 }, (f) => [
        { kind: "drawer", x: f.panel, y: f.panel, w: f.width - 2 * f.panel, h: f.height - 2 * f.panel, count: 4, open: 0 },
      ]),
  },
  {
    id: "alacena-rebatible",
    name: "Alacena rebatible (tapa arriba)",
    hint: "Tapa vertical con brazos hidráulicos, colgada",
    build: () =>
      tpl("Alacena rebatible", { width: 0.9, depth: 0.35, height: 0.42, baseHeight: 1.45, backThickness: 0.003, backInset: 0.02 }, (f) => [
        { kind: "cleat", x: f.panel, y: f.height - f.panel - 0.1, w: f.width - 2 * f.panel, h: 0.08 },
        { kind: "doorFlap", x: f.panel, y: f.panel, w: f.width - 2 * f.panel, h: f.height - 2 * f.panel, flapDir: "up", pistons: true, open: 0 },
      ]),
  },
  {
    id: "mueble-bar",
    name: "Mueble bar (tapa abajo)",
    hint: "Tapa rebatible hacia abajo que hace de mesada",
    build: () =>
      tpl("Mueble bar", { width: 0.8, depth: 0.4, height: 1.1 }, (f) => {
        const t = f.panel;
        const inW = f.width - 2 * t;
        return [
          { kind: "shelf", x: t, y: f.height * 0.55, w: inW, h: t },
          { kind: "doorFlap", x: t, y: f.height * 0.55 + t, w: inW, h: f.height - t - (f.height * 0.55 + t), flapDir: "down", open: 0 },
          { kind: "doorHinged", x: t, y: t, w: inW / 2, h: f.height * 0.55 - t, hinge: "left", open: 0 },
          { kind: "doorHinged", x: t + inW / 2, y: t, w: inW / 2, h: f.height * 0.55 - t, hinge: "right", open: 0 },
        ];
      }),
  },
  {
    id: "placard",
    name: "Placard 2 puertas + barral",
    hint: "Interior con barral, estante superior y cajonera",
    build: () =>
      tpl("Placard", { width: 1.2, depth: 0.6, height: 2.2 }, (f) => {
        const t = f.panel;
        const inW = f.width - 2 * t;
        return [
          { kind: "shelf", x: t, y: f.height - t - 0.35, w: inW, h: t },
          { kind: "rod", x: t, y: f.height - t - 0.45, w: inW, h: 0.03 },
          { kind: "drawer", x: t, y: t, w: inW, h: 0.6, count: 3, open: 0 },
          { kind: "doorHinged", x: t, y: t, w: inW / 2, h: f.height - 2 * t, hinge: "left", open: 0 },
          { kind: "doorHinged", x: t + inW / 2, y: t, w: inW / 2, h: f.height - 2 * t, hinge: "right", open: 0 },
        ];
      }),
  },
  {
    id: "rack-flotante",
    name: "Rack TV flotante (francés)",
    hint: "Colgado con listón francés embutido, fondo retirado",
    build: () =>
      tpl("Rack TV flotante", { width: 1.6, depth: 0.35, height: 0.4, baseHeight: 0.45, backThickness: 0.003, backInset: 0.02 }, (f) => {
        const t = f.panel;
        const inW = f.width - 2 * t;
        return [
          { kind: "cleat", x: t, y: f.height - t - 0.1, w: inW, h: 0.08 },
          { kind: "drawer", x: t, y: t, w: inW / 2 - 0.0015, h: f.height - 2 * t, count: 1, open: 0 },
          { kind: "drawer", x: t + inW / 2 + 0.0015, y: t, w: inW / 2 - 0.0015, h: f.height - 2 * t, count: 1, open: 0 },
        ];
      }),
  },
  {
    id: "biblioteca",
    name: "Biblioteca abierta",
    hint: "Estantes parejos, fondo de 3 mm",
    build: () =>
      tpl("Biblioteca", { width: 0.9, depth: 0.3, height: 1.8, backThickness: 0.003 }, (f) => {
        const t = f.panel;
        const inW = f.width - 2 * t;
        const inH = f.height - 2 * t;
        const n = 4;
        return Array.from({ length: n }, (_, i) => ({
          kind: "shelf" as const,
          x: t,
          y: t + (inH * (i + 1)) / (n + 1),
          w: inW,
          h: t,
        }));
      }),
  },
  {
    id: "bajo-mesada",
    name: "Bajo mesada cajón + puerta",
    hint: "Con zócalo, cajón superior y puerta batiente",
    build: () =>
      tpl("Bajo mesada", { width: 0.6, depth: 0.58, height: 0.85, plinth: 0.1, plinthInset: 0.05 }, (f) => {
        const t = f.panel;
        const inW = f.width - 2 * t;
        const y0 = 0.1 + t; // el interior arranca sobre el zócalo
        return [
          { kind: "drawer", x: t, y: f.height - t - 0.18, w: inW, h: 0.18, count: 1, open: 0 },
          { kind: "doorHinged", x: t, y: y0, w: inW, h: f.height - t - 0.18 - 0.003 - y0, hinge: "left", open: 0 },
        ];
      }),
  },
];

/** Genera la forma 3D (cajas + cilindros con color) de un equipamiento. Frente hacia -z. */
export function appliancePanels(f: Furniture): Panel[] {
  const W = f.width;
  const D = f.depth;
  const H = f.height;
  const base = f.baseHeight;
  const P: Panel[] = [];
  const box = (cx: number, cy: number, cz: number, w: number, h: number, d: number, color: string, emissive?: string) =>
    P.push({ pos: [cx, base + cy, cz], size: [Math.max(w, 0.005), Math.max(h, 0.005), Math.max(d, 0.005)], color, ...(emissive ? { emissive } : {}) });
  const cyl = (
    cx: number,
    cy: number,
    cz: number,
    dia: number,
    len: number,
    axis: "x" | "y" | "z",
    color: string,
    emissive?: string,
  ) => {
    const size: [number, number, number] =
      axis === "y" ? [dia, len, dia] : axis === "z" ? [dia, dia, len] : [len, dia, dia];
    P.push({ pos: [cx, base + cy, cz], size, cylinder: true, cylAxis: axis, color, ...(emissive ? { emissive } : {}) });
  };
  const prim = (shape: "sphere" | "cone" | "pyramid" | "wedge", cx: number, cy: number, cz: number, w: number, h: number, d: number, color: string, emissive?: string) =>
    P.push({ pos: [cx, base + cy, cz], size: [Math.max(w, 0.005), Math.max(h, 0.005), Math.max(d, 0.005)], shape, color, ...(emissive ? { emissive } : {}) });
  // Caja/cilindro translúcidos (agua, vidrio).
  const tbox = (cx: number, cy: number, cz: number, w: number, h: number, d: number, color: string, opacity: number) =>
    P.push({ pos: [cx, base + cy, cz], size: [Math.max(w, 0.005), Math.max(h, 0.005), Math.max(d, 0.005)], color, opacity });
  const tcyl = (cx: number, cy: number, cz: number, dia: number, len: number, axis: "x" | "y" | "z", color: string, opacity: number) => {
    const size: [number, number, number] = axis === "y" ? [dia, len, dia] : axis === "z" ? [dia, dia, len] : [len, dia, dia];
    P.push({ pos: [cx, base + cy, cz], size, cylinder: true, cylAxis: axis, color, opacity });
  };
  // Caja / primitiva inclinadas (capó, parabrisas, proa de kayak/bote).
  const rbox = (cx: number, cy: number, cz: number, w: number, h: number, d: number, color: string, rot: [number, number, number], emissive?: string) =>
    P.push({ pos: [cx, base + cy, cz], size: [Math.max(w, 0.005), Math.max(h, 0.005), Math.max(d, 0.005)], color, rot, ...(emissive ? { emissive } : {}) });
  const rprim = (shape: "sphere" | "cone" | "pyramid" | "wedge", cx: number, cy: number, cz: number, w: number, h: number, d: number, color: string, rot: [number, number, number]) =>
    P.push({ pos: [cx, base + cy, cz], size: [Math.max(w, 0.005), Math.max(h, 0.005), Math.max(d, 0.005)], shape, color, rot });
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
      tbox(0, H / 2 + 0.04, -D / 2 + 0.01, W, H, 0.02, "#bcd5de", 0.4); // mampara
      tbox(-W / 2 + 0.01, H / 2 + 0.04, 0, 0.02, H, D, "#bcd5de", 0.4);
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
    case "column":
      // fuste redondo + base y capitel apenas más anchos
      cyl(0, H / 2, 0, Math.min(W, D), H, "y", body);
      box(0, 0.04, 0, W * 1.25, 0.08, D * 1.25, shade(body, -0.08));
      box(0, H - 0.04, 0, W * 1.25, 0.08, D * 1.25, shade(body, -0.08));
      break;
    case "column-sq":
      box(0, H / 2, 0, W, H, D, body);
      box(0, 0.04, 0, W * 1.25, 0.08, D * 1.25, shade(body, -0.08));
      box(0, H - 0.04, 0, W * 1.25, 0.08, D * 1.25, shade(body, -0.08));
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

    // ---- Jardín / plantas ----
    case "tree": {
      const dia = Math.min(W, D);
      const trunkH = H * 0.4;
      cyl(0, trunkH / 2, 0, dia * 0.16, trunkH, "y", "#6b4a2c");
      const cy0 = trunkH + dia * 0.28;
      prim("sphere", 0, cy0, 0, dia * 1.05, dia * 1.05, dia * 1.05, body); // copa central
      prim("sphere", dia * 0.3, cy0 + dia * 0.22, dia * 0.14, dia * 0.7, dia * 0.7, dia * 0.7, shade(body, 0.08));
      prim("sphere", -dia * 0.28, cy0 + dia * 0.2, -dia * 0.14, dia * 0.66, dia * 0.66, dia * 0.66, shade(body, -0.06));
      prim("sphere", dia * 0.06, cy0 + dia * 0.5, -dia * 0.05, dia * 0.62, dia * 0.62, dia * 0.62, shade(body, 0.04)); // copa alta
      prim("sphere", -dia * 0.05, cy0 - dia * 0.08, dia * 0.3, dia * 0.52, dia * 0.52, dia * 0.52, shade(body, -0.03));
      break;
    }
    case "pine": {
      const dia = Math.min(W, D);
      const trunkH = H * 0.16;
      cyl(0, trunkH / 2, 0, dia * 0.14, trunkH, "y", "#6b4a2c");
      const tiers = 3;
      for (let i = 0; i < tiers; i++) {
        const cy = trunkH + ((H - trunkH) * i) / tiers;
        const ch = (H - trunkH) * 0.5;
        const cd = dia * (1 - i * 0.26);
        prim("cone", 0, cy + ch / 2, 0, cd, ch, cd, i % 2 === 0 ? body : shade(body, 0.05));
      }
      break;
    }
    case "palm": {
      const dia = Math.min(W, D);
      const trunkH = H * 0.78;
      cyl(0, trunkH / 2, 0, dia * 0.12, trunkH, "y", "#7a5a38");
      prim("sphere", 0, trunkH + dia * 0.1, 0, dia * 0.45, dia * 0.3, dia * 0.45, shade(body, -0.06));
      const fl = dia * 0.55;
      for (const [ux, uz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]] as const) {
        box(ux * fl * 0.55, trunkH + dia * 0.06, uz * fl * 0.55, ux !== 0 ? fl : dia * 0.16, 0.04, uz !== 0 ? fl : dia * 0.16, ux * uz !== 0 ? shade(body, -0.04) : body);
      }
      break;
    }
    case "bush": {
      const dia = Math.min(W, D);
      prim("sphere", 0, H * 0.5, 0, dia, H, dia, body);
      prim("sphere", dia * 0.24, H * 0.42, dia * 0.1, dia * 0.6, H * 0.7, dia * 0.6, shade(body, 0.06));
      prim("sphere", -dia * 0.22, H * 0.4, -dia * 0.12, dia * 0.55, H * 0.62, dia * 0.55, shade(body, -0.05));
      break;
    }
    case "potted-plant": {
      const dia = Math.min(W, D);
      const potH = H * 0.34;
      cyl(0, potH / 2, 0, dia * 0.8, potH, "y", body);
      cyl(0, potH, 0, dia * 0.82, 0.03, "y", shade(body, -0.1));
      prim("sphere", 0, potH + (H - potH) * 0.5, 0, dia * 0.95, (H - potH) * 0.98, dia * 0.95, "#3f7d3a");
      break;
    }
    case "flowers": {
      box(0, H * 0.4, 0, W, H * 0.8, D, "#6b4a2c");
      box(0, H * 0.82, 0, W * 0.98, H * 0.12, D * 0.98, "#3f7d3a");
      const cols = ["#e8556d", "#f2c14e", "#e87fb0", "#7c6bf2", "#f08a3c"];
      const n = Math.max(3, Math.round(W / 0.2));
      for (let i = 0; i < n; i++) {
        const fx = -W / 2 + (W * (i + 0.5)) / n;
        prim("sphere", fx, H + 0.05, (i % 2 ? 1 : -1) * D * 0.18, 0.08, 0.08, 0.08, cols[i % cols.length]);
      }
      break;
    }
    case "rock": {
      prim("sphere", 0, H * 0.42, 0, W, H * 0.9, D, body);
      prim("sphere", W * 0.22, H * 0.3, D * 0.12, W * 0.5, H * 0.5, D * 0.5, shade(body, -0.06));
      break;
    }

    // ---- Muebles de exterior ----
    case "bench": {
      const seatH = H * 0.5;
      box(0, seatH, 0.02, W, 0.06, D * 0.8, body);
      box(0, seatH + (H - seatH) / 2, -D / 2 + 0.05, W, H - seatH, 0.06, body);
      const blx = W / 2 - 0.08, blz = D / 2 - 0.08;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(sx * blx, seatH / 2, sz * blz, 0.05, seatH, "y", "#4a4f57");
      break;
    }
    case "fountain": {
      const dia = Math.min(W, D);
      cyl(0, H * 0.18, 0, dia, H * 0.36, "y", body);
      tcyl(0, H * 0.2, 0, dia * 0.9, 0.06, "y", "#2f7fa8", 0.7);
      cyl(0, H * 0.55, 0, dia * 0.18, H * 0.5, "y", shade(body, 0.04));
      cyl(0, H * 0.78, 0, dia * 0.45, 0.1, "y", shade(body, 0.04));
      tcyl(0, H * 0.82, 0, dia * 0.4, 0.04, "y", "#3a93bd", 0.7);
      break;
    }
    case "bbq": {
      box(0, H * 0.28, 0, W, H * 0.56, D, body);
      box(0, H * 0.58, 0, W * 0.92, 0.04, D * 0.9, "#9a9da1");
      box(W * 0.28, H * 0.8, -D * 0.1, W * 0.4, H * 0.46, D * 0.7, body);
      box(W * 0.28, H + 0.12, -D * 0.1, W * 0.16, 0.32, D * 0.18, shade(body, -0.12));
      break;
    }
    case "umbrella": {
      const dia = Math.min(W, D);
      cyl(0, H * 0.5, 0, 0.05, H, "y", "#6b6f76");
      prim("cone", 0, H * 0.9, 0, dia, H * 0.24, dia, body);
      cyl(0, 0.04, 0, dia * 0.3, 0.08, "y", "#3a3f45");
      break;
    }

    // ---- Luminarias (la pieza luminosa emite con `emissive`) ----
    case "streetlamp": {
      const glow = "#ffe6a3";
      cyl(0, H * 0.5, 0, 0.08, H, "y", body);
      cyl(0, H - 0.02, 0, 0.16, 0.04, "y", shade(body, -0.05));
      box(0, H + 0.13, 0, 0.28, 0.28, 0.28, shade(body, -0.08));
      box(0, H + 0.13, 0, 0.2, 0.2, 0.2, "#fff3cf", glow);
      prim("pyramid", 0, H + 0.33, 0, 0.32, 0.13, 0.32, shade(body, -0.08));
      break;
    }
    case "bollard-light": {
      const dia = Math.min(W, D);
      cyl(0, H * 0.45, 0, dia * 0.7, H * 0.9, "y", body);
      cyl(0, H * 0.96, 0, dia * 0.82, H * 0.14, "y", "#fff3cf", "#ffe6a3");
      break;
    }
    case "table-lamp": {
      const dia = Math.min(W, D);
      cyl(0, 0.03, 0, dia * 0.55, 0.06, "y", "#3a3f45");
      cyl(0, H * 0.42, 0, 0.02, H * 0.66, "y", metal);
      cyl(0, H * 0.82, 0, dia * 0.9, H * 0.34, "y", body, "#ffeec6");
      break;
    }
    case "floor-lamp": {
      const dia = Math.min(W, D);
      cyl(0, 0.03, 0, dia * 0.5, 0.06, "y", "#3a3f45");
      cyl(0, H * 0.5, 0, 0.025, H * 0.92, "y", metal);
      cyl(0, H * 0.9, 0, dia * 0.85, H * 0.16, "y", body, "#ffeec6");
      break;
    }
    case "pendant-lamp": {
      const dia = Math.min(W, D);
      cyl(0, H * 0.78, 0, 0.012, H * 0.44, "y", shade(body, -0.05));
      prim("cone", 0, H * 0.36, 0, dia, H * 0.5, dia, body);
      prim("sphere", 0, H * 0.16, 0, 0.12, 0.12, 0.12, "#fff3cf", "#ffe6a3");
      break;
    }
    case "wall-lamp": {
      box(0, H * 0.5, D / 2 - 0.02, W * 0.7, H * 0.7, 0.04, body);
      cyl(0, H * 0.5, 0, 0.02, D * 0.7, "z", metal);
      box(0, H * 0.5, -D / 2 + 0.06, W * 0.8, H * 0.55, W * 0.5, "#fff3cf", "#ffeec6");
      break;
    }

    // ---- Recreación / exterior 2 ----
    case "pool": {
      box(0, H * 0.5, 0, W, H, D, "#cdd3d8"); // estructura
      tbox(0, H * 0.55, 0, W * 0.9, H * 0.9, D * 0.9, body, 0.6); // agua (translúcida)
      box(0, H, 0, W * 1.05, 0.07, D * 1.05, "#dfe3e6"); // borde
      break;
    }
    case "pergola": {
      const post = 0.12;
      const lx = W / 2 - post / 2, lz = D / 2 - post / 2;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(sx * lx, H / 2, sz * lz, post, H, post, body);
      box(0, H - 0.06, -lz, W, 0.1, 0.08, shade(body, 0.04));
      box(0, H - 0.06, lz, W, 0.1, 0.08, shade(body, 0.04));
      box(-lx, H - 0.06, 0, 0.08, 0.1, D, shade(body, 0.04));
      box(lx, H - 0.06, 0, 0.08, 0.1, D, shade(body, 0.04));
      const ns = Math.max(3, Math.round(D / 0.35));
      for (let i = 0; i <= ns; i++) { const z = -D / 2 + (D * i) / ns; box(0, H + 0.02, z, W, 0.05, 0.04, body); }
      break;
    }
    case "gazebo": {
      const post = 0.12;
      const lx = W / 2 - post, lz = D / 2 - post;
      const colH = H * 0.7;
      box(0, 0.06, 0, W, 0.12, D, shade(body, -0.06)); // piso
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(sx * lx, 0.12 + colH / 2, sz * lz, post, colH, post, body);
      box(0, 0.12 + colH, 0, W, 0.1, D, shade(body, 0.04)); // anillo
      prim("pyramid", 0, 0.12 + colH + (H - colH - 0.12) / 2, 0, W * 1.15, H - colH - 0.12, D * 1.15, shade(body, -0.1)); // techo
      break;
    }
    case "swing": {
      const topY = H * 0.94;
      for (const sx of [-1, 1]) {
        box(sx * (W / 2 - 0.05), H / 2, -D / 2 + 0.06, 0.06, H, 0.06, body);
        box(sx * (W / 2 - 0.05), H / 2, D / 2 - 0.06, 0.06, H, 0.06, body);
      }
      cyl(0, topY, 0, 0.06, W, "x", shade(body, -0.05)); // barra superior
      for (const sx of [-1, 1]) {
        const ax = sx * W * 0.22;
        cyl(ax - 0.16, topY - 0.32, 0, 0.012, 0.62, "y", "#4a4f57");
        cyl(ax + 0.16, topY - 0.32, 0, 0.012, 0.62, "y", "#4a4f57");
        box(ax, topY - 0.64, 0, 0.36, 0.04, 0.18, "#caa472");
      }
      break;
    }
    case "slide": {
      const platH = H * 0.92;
      box(W * 0.34, platH, 0, W * 0.3, 0.06, D, body); // plataforma (lado +X)
      for (const sz of [-1, 1]) box(W * 0.46, platH / 2, sz * (D / 2 - 0.05), 0.06, platH, 0.06, shade(body, -0.06));
      box(W * 0.46, platH + 0.3, 0, 0.04, 0.6, D, shade(body, 0.04)); // baranda
      prim("wedge", -W * 0.05, platH / 2, 0, W * 0.72, platH, D * 0.7, shade(body, 0.05)); // rampa (sube hacia +X)
      break;
    }
    case "hammock": {
      for (const sx of [-1, 1]) box(sx * (W / 2 - 0.05), H / 2, 0, 0.06, H, 0.06, "#6b4a2c"); // soportes
      box(0, H * 0.45, 0, W * 0.8, 0.05, D * 0.7, body); // tela
      break;
    }
    case "trampoline": {
      const dia = Math.min(W, D);
      cyl(0, H, 0, dia, 0.05, "y", "#1b1d22"); // lona
      cyl(0, H + 0.02, 0, dia * 1.06, 0.06, "y", body); // borde acolchado
      const lx = dia * 0.38;
      for (const [ux, uz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) cyl(ux * lx, H / 2, uz * lx, 0.04, H, "y", "#6b6f76");
      break;
    }
    case "planter-box": {
      box(0, H * 0.45, 0, W, H * 0.9, D, body);
      box(0, H * 0.85, 0, W * 0.92, H * 0.1, D * 0.85, "#5a3d28"); // tierra
      const np = Math.max(2, Math.round(W / 0.4));
      for (let i = 0; i < np; i++) { const fx = -W / 2 + (W * (i + 0.5)) / np; prim("sphere", fx, H + 0.12, 0, 0.24, 0.32, 0.24, "#3f7d3a"); }
      break;
    }
    case "clothesline": {
      cyl(0, H / 2, 0, 0.05, H, "y", body); // mástil
      cyl(0, H - 0.1, 0, 0.03, W, "x", body);
      cyl(0, H - 0.1, 0, 0.03, D, "z", body);
      for (const r of [0.3, 0.46]) {
        box(0, H - 0.12, 0, W * r * 2, 0.006, 0.006, "#dfe2e5");
        box(0, H - 0.16, 0, 0.006, 0.006, D * r * 2, "#dfe2e5");
      }
      break;
    }
    case "mailbox": {
      cyl(0, H * 0.4, 0, 0.06, H * 0.8, "y", "#6b6f76"); // poste
      box(0, H * 0.86, 0, W, H * 0.28, D, body); // caja
      box(0, H * 0.86, -D / 2 - 0.005, W * 0.9, H * 0.2, 0.01, shade(body, -0.1)); // tapa
      box(W / 2 + 0.03, H * 0.92, D * 0.2, 0.02, 0.12, 0.08, "#cc3b3b"); // banderita
      break;
    }
    case "flag": {
      cyl(0, H / 2, 0, 0.05, H, "y", "#c7cbd0"); // mástil
      prim("sphere", 0, H + 0.04, 0, 0.09, 0.09, 0.09, "#f2c14e"); // remate
      box(0.5, H * 0.8, 0, 0.92, H * 0.26, 0.02, body); // paño
      break;
    }
    case "car": {
      // Sedán: cuerpo bajo + capó/baúl apenas inclinados + cabina con parabrisas y luneta raked.
      const wheelR = 0.34, ride = 0.26;
      box(0, ride + 0.2, 0, W, 0.4, D * 0.96, body); // cuerpo
      rbox(0, ride + 0.42, -D * 0.3, W * 0.9, 0.1, D * 0.3, body, [-0.05, 0, 0]); // capó
      rbox(0, ride + 0.42, D * 0.32, W * 0.9, 0.1, D * 0.26, body, [0.05, 0, 0]); // baúl
      const cabH = 0.42, cabY = ride + 0.4 + cabH / 2;
      box(0, cabY, D * 0.02, W * 0.84, cabH, D * 0.4, shade(body, -0.04)); // techo/pilares
      box(0, ride + 0.4 + cabH, D * 0.02, W * 0.8, 0.05, D * 0.34, shade(body, -0.06)); // techo
      rbox(0, cabY, -D * 0.18, W * 0.78, cabH * 1.05, 0.03, "#1b2026", [0.6, 0, 0]); // parabrisas
      rbox(0, cabY, D * 0.22, W * 0.78, cabH * 1.05, 0.03, "#1b2026", [-0.55, 0, 0]); // luneta
      for (const sx of [-1, 1]) box(sx * W * 0.44, cabY, D * 0.02, 0.02, cabH * 0.6, D * 0.34, "#1b2026"); // ventanas lat
      for (const sx of [-1, 1]) box(sx * W * 0.34, ride + 0.34, -D / 2 + 0.02, W * 0.16, 0.08, 0.04, "#fff6da", "#ffe9a0"); // faros
      for (const sx of [-1, 1]) box(sx * W * 0.34, ride + 0.34, D / 2 - 0.02, W * 0.16, 0.07, 0.03, "#b23b3b"); // luces traseras
      box(0, ride + 0.1, -D / 2 + 0.01, W, 0.14, 0.05, "#23262b"); // paragolpes del
      box(0, ride + 0.1, D / 2 - 0.01, W, 0.14, 0.05, "#23262b"); // paragolpes tras
      const cwx = W / 2 - 0.02, cwz = D * 0.3;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        cyl(sx * cwx, wheelR, sz * cwz, wheelR * 2, 0.2, "x", "#15171b"); // neumático
        cyl(sx * cwx, wheelR, sz * cwz, wheelR * 0.85, 0.22, "x", "#9aa0a6"); // llanta
      }
      break;
    }

    // ---- Electrodomésticos / interiores 2 ----
    case "microwave": {
      box(0, H / 2, 0, W, H, D, body);
      box(-W * 0.12, H / 2, -D / 2 + 0.006, W * 0.58, H * 0.78, 0.012, "#23262b"); // puerta/visor
      box(W * 0.32, H / 2, -D / 2 + 0.006, W * 0.28, H * 0.82, 0.012, "#3a3f45"); // panel
      break;
    }
    case "range-hood": {
      box(0, H * 0.2, 0, W, H * 0.4, D, body); // campana
      box(0, H * 0.72, D * 0.18, W * 0.4, H * 0.56, D * 0.4, body); // conducto
      box(0, 0.02, 0, W * 0.9, 0.04, D * 0.9, "#23262b"); // filtro
      break;
    }
    case "dishwasher": {
      box(0, H / 2, 0, W, H, D, body);
      box(0, H * 0.55, -D / 2 + 0.006, W * 0.9, H * 0.82, 0.012, "#cfd3d8"); // frente
      cyl(0, H * 0.92, -D / 2 - 0.01, 0.02, W * 0.7, "x", metal); // manija
      break;
    }
    case "air-conditioner": {
      box(0, H / 2, 0, W, H, D, body); // split
      box(0, H * 0.32, -D / 2 + 0.008, W * 0.95, H * 0.2, 0.01, "#3a3f45"); // rejilla de salida
      break;
    }
    case "ceiling-fan": {
      const bl = Math.min(W, D);
      cyl(0, H * 0.82, 0, 0.05, H * 0.36, "y", "#6b6f76"); // varilla
      cyl(0, H * 0.62, 0, 0.18, 0.1, "y", body); // motor
      for (const [ux, uz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
        box(ux * bl * 0.3, H * 0.6, uz * bl * 0.3, ux !== 0 ? bl * 0.58 : 0.16, 0.02, uz !== 0 ? bl * 0.58 : 0.16, shade(body, -0.06)); // aspas
      prim("sphere", 0, H * 0.55, 0, 0.14, 0.12, 0.14, "#fff3cf", "#ffeec6"); // plafón con luz
      break;
    }
    case "water-tank": {
      const dia = Math.min(W, D);
      cyl(0, H * 0.5, 0, dia, H, "y", body); // tanque
      cyl(0, H + 0.04, 0, dia * 0.6, 0.08, "y", shade(body, 0.1)); // tapa
      break;
    }
    case "bidet": {
      box(0, H * 0.4, -D * 0.02, W * 0.85, H * 0.7, D * 0.7, "#eef0f2"); // cuerpo
      cyl(0, H * 0.62, D * 0.05, W * 0.8, H * 0.36, "y", "#f4f6f7"); // taza
      cyl(0, H + 0.04, -D * 0.28, 0.02, 0.08, "y", metal); // grifería
      break;
    }
    case "armchair": {
      const sh = 0.42;
      box(0, sh / 2 + 0.05, 0.05, W, sh, D * 0.85, body); // base
      box(0, sh + 0.25, -D / 2 + 0.12, W, 0.42, 0.2, body); // respaldo
      box(-W / 2 + 0.1, sh + 0.12, 0.05, 0.18, 0.4, D * 0.85, body); // apoyabrazos
      box(W / 2 - 0.1, sh + 0.12, 0.05, 0.18, 0.4, D * 0.85, body);
      box(0, sh + 0.11, 0.08, W * 0.62, 0.12, D * 0.55, shade(body, 0.05)); // almohadón
      const flx = W / 2 - 0.12, flz = D / 2 - 0.1;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(sx * flx, 0.025, sz * flz, 0.05, 0.05, "y", dark);
      break;
    }
    case "dresser": {
      box(0, H / 2, 0, W, H, D, body);
      const rows = 3;
      for (let i = 0; i < rows; i++) {
        const dy = H * 0.14 + H * 0.72 * (i / (rows - 1));
        box(0, dy, -D / 2 + 0.006, W * 0.9, H * 0.2, 0.012, shade(body, -0.05)); // frente cajón
        cyl(0, dy, -D / 2 - 0.012, 0.02, W * 0.22, "x", metal); // tirador
      }
      for (const sx of [-1, 1]) cyl(sx * (W / 2 - 0.05), 0.05, D / 2 - 0.05, 0.04, 0.1, "y", legC);
      break;
    }
    case "crib": {
      box(0, H * 0.42, 0, W * 0.92, 0.1, D * 0.92, "#dfe2e5"); // colchón
      const lx = W / 2 - 0.03, lz = D / 2 - 0.03;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(sx * lx, H / 2, sz * lz, 0.05, H, 0.05, body); // postes
      const nb = Math.max(4, Math.round(D / 0.12));
      for (let i = 0; i <= nb; i++) {
        const z = -D / 2 + (D * i) / nb;
        box(-lx, H * 0.66, z, 0.03, H * 0.48, 0.02, body);
        box(lx, H * 0.66, z, 0.03, H * 0.48, 0.02, body);
      }
      break;
    }

    // ---- Decoración ----
    case "rug": {
      box(0, H / 2, 0, W, H, D, body);
      box(0, H + 0.002, 0, W * 0.84, 0.003, D * 0.84, shade(body, 0.1)); // cenefa
      break;
    }
    case "mirror": {
      box(0, H / 2, D / 2 - 0.01, W, H, 0.03, body); // marco
      box(0, H / 2, D / 2 - 0.03, W * 0.86, H * 0.92, 0.012, "#cfe2ea"); // vidrio
      break;
    }
    case "painting": {
      box(0, H / 2, 0, W, H, D, body); // marco
      box(0, H / 2, -D / 2 - 0.003, W * 0.84, H * 0.84, 0.006, shade(body, 0.28)); // lienzo (frente -z)
      break;
    }
    case "curtain": {
      box(0, H, 0, W, 0.05, D * 0.5, "#6b6f76"); // riel
      const nc = Math.max(4, Math.round(W / 0.2));
      for (let i = 0; i < nc; i++) {
        const fx = -W / 2 + (W * (i + 0.5)) / nc;
        box(fx, H / 2, (i % 2 ? 1 : -1) * 0.025, (W / nc) * 0.92, H, 0.04, i % 2 ? body : shade(body, -0.05)); // pliegues
      }
      break;
    }
    case "wall-clock": {
      const dia = Math.min(W, H);
      cyl(0, H / 2, 0, dia, D, "z", body); // caja
      cyl(0, H / 2, -D / 2 - 0.004, dia * 0.85, 0.01, "z", "#f1f3f5"); // esfera
      box(0, H / 2, -D / 2 - 0.01, 0.02, dia * 0.34, 0.008, "#23262b"); // aguja
      box(0.0, H / 2 + 0.03, -D / 2 - 0.01, dia * 0.2, 0.02, 0.008, "#23262b"); // aguja 2
      break;
    }
    case "lounger": {
      box(0, H * 0.45, D * 0.08, W, 0.08, D * 0.78, body); // colchoneta
      box(0, H * 0.6, -D / 2 + 0.12, W, H * 0.45, 0.1, body); // respaldo
      const llx = W / 2 - 0.04;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(sx * llx, H * 0.22, sz * (D * 0.32), 0.03, H * 0.44, "y", "#6b6f76");
      break;
    }
    case "bicycle": {
      const r = Math.min(H * 0.34, D * 0.2);
      cyl(0, r, -D * 0.32, r * 2, 0.05, "x", "#1b1d22"); // rueda delantera
      cyl(0, r, D * 0.32, r * 2, 0.05, "x", "#1b1d22"); // rueda trasera
      box(0, r + 0.18, 0, 0.04, 0.04, D * 0.5, body); // tubo horizontal
      box(0, r + 0.1, D * 0.18, 0.04, 0.3, 0.04, body); // tubo asiento
      box(0, r + 0.1, -D * 0.2, 0.04, 0.32, 0.04, body); // horquilla
      box(0, r + 0.36, -D * 0.22, 0.18, 0.04, 0.04, "#23262b"); // manubrio
      box(0, r + 0.34, D * 0.16, 0.16, 0.04, 0.1, "#23262b"); // asiento
      break;
    }
    case "dog-house": {
      box(0, H * 0.35, 0, W, H * 0.7, D, body); // cuerpo
      prim("pyramid", 0, H * 0.82, 0, W * 1.12, H * 0.4, D * 1.12, shade(body, -0.1)); // techo
      box(0, H * 0.28, -D / 2 + 0.01, W * 0.45, H * 0.5, 0.02, "#1b1d22"); // entrada
      break;
    }

    // ---- Oficina ----
    case "monitor": {
      box(0, 0.02, 0, W * 0.4, 0.04, D, "#23262b"); // base
      cyl(0, H * 0.25, D * 0.12, 0.03, H * 0.5, "y", "#3a3f45"); // cuello
      box(0, H * 0.6, 0, W, H * 0.55, 0.03, "#1b1d22"); // marco pantalla
      box(0, H * 0.6, -0.02, W * 0.94, H * 0.48, 0.005, "#2b6cb0", "#1f4f7a"); // display (leve glow)
      break;
    }
    case "office-chair": {
      const seatH = H * 0.45;
      cyl(0, 0.04, 0, 0.62, 0.06, "y", "#23262b"); // base
      cyl(0, seatH * 0.55, 0, 0.05, seatH * 0.6, "y", "#3a3f45"); // pistón
      box(0, seatH, 0, W * 0.82, 0.1, D * 0.82, body); // asiento
      box(0, seatH + 0.32, -D * 0.32, W * 0.78, 0.52, 0.08, body); // respaldo
      for (const sx of [-1, 1]) box(sx * W * 0.42, seatH + 0.06, 0, 0.06, 0.1, D * 0.4, shade(body, 0.1)); // apoyabrazos
      break;
    }
    case "bookcase": {
      const t = 0.02;
      box(-(W / 2 - t / 2), H / 2, 0, t, H, D, body);
      box(W / 2 - t / 2, H / 2, 0, t, H, D, body);
      box(0, t / 2, 0, W - 2 * t, t, D, body);
      box(0, H - t / 2, 0, W - 2 * t, t, D, body);
      box(0, H / 2, D / 2 - t / 2, W - 2 * t, H, t, shade(body, -0.06)); // fondo
      const shelves = 4;
      const cols = ["#b23b3b", "#3a6ea5", "#5a8f3c", "#e0a13a", "#7c5ba6", "#2f8f8f"];
      for (let i = 1; i <= shelves; i++) box(0, t + ((H - 2 * t) * i) / (shelves + 1), 0, W - 2 * t, t, D - t, body); // estantes
      for (let i = 0; i <= shelves; i++) {
        const y0 = t + ((H - 2 * t) * i) / (shelves + 1);
        const y1 = t + ((H - 2 * t) * (i + 1)) / (shelves + 1);
        const gap = y1 - y0 - t - 0.02;
        const segs = 5;
        for (let j = 0; j < segs; j++) {
          const bw = (W - 2 * t - 0.04) / segs;
          const bx = -W / 2 + t + 0.02 + j * bw + bw / 2;
          const hh = gap * (0.78 + ((i + j) % 3) * 0.07);
          box(bx, y0 + t + hh / 2, -D * 0.08, bw * 0.9, hh, D * 0.5, cols[(i + j) % cols.length]); // libros
        }
      }
      break;
    }
    case "whiteboard": {
      box(0, H / 2, D / 2 - 0.01, W, H, 0.03, body); // marco
      box(0, H / 2, D / 2 - 0.03, W * 0.95, H * 0.9, 0.01, "#f3f5f6"); // superficie
      break;
    }

    // ---- Gym ----
    case "treadmill": {
      box(0, 0.1, D * 0.1, W, 0.2, D * 0.8, "#23262b"); // base
      box(0, 0.21, D * 0.1, W * 0.72, 0.03, D * 0.72, "#3a3f45"); // banda
      for (const sx of [-1, 1]) cyl(sx * (W / 2 - 0.06), H * 0.45, -D / 2 + 0.22, 0.04, H * 0.7, "y", body); // brazos
      box(0, H * 0.78, -D / 2 + 0.22, W * 0.9, H * 0.28, 0.08, body); // consola
      box(0, H * 0.8, -D / 2 + 0.18, W * 0.5, H * 0.18, 0.01, "#1b1d22"); // pantalla
      break;
    }
    case "dumbbell-rack": {
      box(0, H * 0.2, 0, W, 0.05, D, body);
      for (const sx of [-1, 1]) box(sx * (W / 2 - 0.04), H / 2, D / 2 - 0.04, 0.05, H, 0.05, body);
      box(0, H * 0.55, D / 2 - 0.04, W, 0.05, 0.05, body);
      for (const lvl of [0.28, 0.5]) for (let i = 0; i < 4; i++) cyl(-W / 2 + 0.15 + (i * (W - 0.3)) / 3, lvl, 0, 0.09, 0.22, "x", "#2b2f36"); // mancuernas
      break;
    }
    case "exercise-bike": {
      box(0, 0.08, 0, W, 0.12, D, "#23262b"); // base
      cyl(0, H * 0.35, D * 0.2, 0.36, 0.06, "x", "#3a3f45"); // volante
      cyl(0, H * 0.5, -D * 0.1, 0.05, H * 0.6, "y", body); // columna
      box(0, H * 0.8, -D * 0.15, W * 0.7, 0.1, 0.2, body); // manubrio
      box(0, H * 0.6, D * 0.2, W * 0.4, 0.08, 0.25, body); // asiento
      break;
    }

    // ---- Mascotas ----
    case "pet-bed": {
      const dia = Math.min(W, D);
      cyl(0, H * 0.5, 0, dia, H, "y", body); // borde
      cyl(0, H * 0.62, 0, dia * 0.72, H * 0.5, "y", shade(body, 0.1)); // cojín
      break;
    }
    case "aquarium": {
      tbox(0, H / 2, 0, W, H, D, "#bcd6e6", 0.3); // vidrio
      tbox(0, H * 0.45, 0, W * 0.94, H * 0.78, D * 0.94, "#2f7fa8", 0.7); // agua
      box(0, 0.03, 0, W * 0.96, 0.06, D * 0.96, "#caa05a"); // grava
      box(0, H + 0.02, 0, W, 0.04, D, "#23262b"); // tapa
      break;
    }
    case "bird-cage": {
      const dia = Math.min(W, D);
      cyl(0, 0.05, 0, dia, 0.1, "y", body); // base
      const nb2 = 10;
      for (let i = 0; i < nb2; i++) {
        const a = (i * Math.PI * 2) / nb2;
        cyl(Math.cos(a) * dia * 0.45, H * 0.55, Math.sin(a) * dia * 0.45, 0.012, H * 0.9, "y", "#c7cbd0"); // barrotes
      }
      cyl(0, H * 0.98, 0, dia * 0.6, 0.06, "y", body);
      prim("cone", 0, H * 1.06, 0, dia * 0.5, 0.2, dia * 0.5, body); // capucha
      break;
    }
    case "coat-rack": {
      cyl(0, H * 0.5, 0, 0.05, H, "y", body); // mástil
      for (const [ux, uz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) box(ux * 0.18, 0.04, uz * 0.18, ux !== 0 ? 0.36 : 0.05, 0.06, uz !== 0 ? 0.36 : 0.05, "#3a3f45"); // patas
      for (const [ux, uz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) cyl(ux * 0.1, H - 0.1, uz * 0.1, 0.02, 0.2, ux !== 0 ? "x" : "z", shade(body, -0.1)); // ganchos
      break;
    }

    // ---- Vehículos / juegos ----
    case "motorcycle": {
      const r = Math.min(H * 0.32, D * 0.18);
      cyl(0, r, -D * 0.34, r * 2, 0.12, "x", "#15171b"); // rueda del
      cyl(0, r, D * 0.34, r * 2, 0.14, "x", "#15171b"); // rueda tras
      box(0, r + 0.25, 0, W * 0.5, 0.3, D * 0.4, body); // cuerpo/tanque
      box(0, r + 0.2, D * 0.18, W * 0.5, 0.12, D * 0.3, "#23262b"); // asiento
      cyl(0, r + 0.35, -D * 0.28, 0.04, 0.4, "y", "#3a3f45"); // horquilla
      box(0, r + 0.5, -D * 0.3, W * 0.7, 0.05, 0.05, "#23262b"); // manubrio
      break;
    }
    case "pickup": {
      // Pickup estilo Hilux: chasis + capó inclinado + cabina con parabrisas raked + caja con paredes + arcos + faros.
      const wheelR = 0.42, ride = 0.3;
      box(0, ride + 0.18, 0, W, 0.36, D * 0.98, body); // chasis
      rbox(0, ride + 0.42, -D * 0.34, W * 0.92, 0.14, D * 0.28, shade(body, -0.03), [-0.06, 0, 0]); // capó
      box(0, ride + 0.26, -D / 2 + 0.04, W * 0.85, 0.26, 0.06, "#23262b"); // parrilla
      box(0, ride + 0.12, -D / 2 + 0.01, W, 0.16, 0.06, "#3a3f45"); // paragolpes
      for (const sx of [-1, 1]) box(sx * W * 0.36, ride + 0.36, -D / 2 + 0.03, W * 0.18, 0.1, 0.04, "#fff6da", "#ffe9a0"); // faros
      const cabZ = -D * 0.06, cabH = 0.5, cabY = ride + 0.42 + cabH / 2;
      box(0, cabY, cabZ, W * 0.94, cabH, D * 0.34, shade(body, -0.04)); // cabina
      rbox(0, cabY + 0.02, cabZ - D * 0.17, W * 0.8, 0.5, 0.03, "#1b2026", [0.5, 0, 0]); // parabrisas inclinado
      rbox(0, cabY + 0.02, cabZ + D * 0.17, W * 0.8, 0.46, 0.03, "#1b2026", [-0.4, 0, 0]); // luneta
      for (const sx of [-1, 1]) box(sx * W * 0.47, cabY, cabZ, 0.02, cabH * 0.66, D * 0.3, "#1b2026"); // ventanas lat
      box(0, ride + 0.42 + cabH, cabZ, W * 0.9, 0.05, D * 0.32, shade(body, -0.05)); // techo
      const bedZ = D * 0.28, bedY = ride + 0.42;
      box(0, ride + 0.4, bedZ, W * 0.94, 0.04, D * 0.5, shade(body, -0.06)); // piso caja
      for (const sx of [-1, 1]) box(sx * W * 0.45, bedY, bedZ, 0.06, 0.3, D * 0.5, body); // laterales caja
      box(0, bedY, bedZ + D * 0.25, W * 0.94, 0.3, 0.06, body); // tapa trasera
      box(0, bedY, bedZ - D * 0.25, W * 0.94, 0.34, 0.06, shade(body, -0.03)); // pared contra cabina
      const pwx = W / 2 - 0.02, pwz = D * 0.3;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        cyl(sx * pwx, wheelR, sz * pwz, wheelR * 2, 0.24, "x", "#15171b"); // neumático
        cyl(sx * pwx, wheelR, sz * pwz, wheelR * 0.9, 0.26, "x", "#6b6f76"); // llanta
      }
      break;
    }
    case "playset": {
      const towerW = W * 0.42;
      const tx = W * 0.24;
      const platH = H * 0.5;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(tx + sx * (towerW / 2 - 0.05), H * 0.45, sz * (D * 0.3 - 0.05), 0.08, H * 0.9, 0.08, body); // postes
      box(tx, platH, 0, towerW, 0.08, D * 0.6, shade(body, -0.04)); // plataforma
      prim("pyramid", tx, H * 0.78, 0, towerW * 1.2, H * 0.32, D * 0.7, "#b23b3b"); // techito
      prim("wedge", -W * 0.18, platH / 2, 0, W * 0.5, platH, D * 0.4, "#e0a13a"); // tobogán (sube hacia +X, hacia la torre)
      break;
    }
    case "seesaw": {
      cyl(0, H * 0.25, 0, 0.16, H * 0.5, "y", body); // pivote
      box(0, H * 0.5, 0, W * 0.6, 0.06, D, "#e0683a"); // tabla
      for (const sz of [-1, 1]) cyl(0, H * 0.58, sz * (D / 2 - 0.15), 0.03, 0.16, "y", "#23262b"); // manijas
      break;
    }
    case "sandbox": {
      box(0, H * 0.5, 0, W, H, D, "#d8c89a"); // arena
      for (const sz of [-1, 1]) box(0, H * 0.6, sz * (D / 2 - 0.05), W, H * 0.5, 0.1, body); // bordes
      for (const sx of [-1, 1]) box(sx * (W / 2 - 0.05), H * 0.6, 0, 0.1, H * 0.5, D, body);
      break;
    }

    // ---- Cocina / baño 2 ----
    case "kitchen-island": {
      const cabH = H - 0.04;
      box(0, cabH / 2, 0, W, cabH, D, body);
      box(0, H - 0.02, 0, W * 1.06, 0.04, D * 1.12, "#3a3f45"); // mesada con voladizo
      box(-W * 0.25, cabH / 2, -D / 2 + 0.006, W * 0.42, cabH * 0.8, 0.012, shade(body, -0.05));
      box(W * 0.25, cabH / 2, -D / 2 + 0.006, W * 0.42, cabH * 0.8, 0.012, shade(body, -0.05));
      break;
    }
    case "corner-cabinet": {
      box(-W * 0.25, H / 2, 0, W * 0.5, H, D, body); // brazo 1
      box(W * 0.05, H / 2, D * 0.25, W * 0.6, H, D * 0.5, body); // brazo 2 (L)
      box(0, H - 0.02, 0, W, 0.04, D, "#3a3f45"); // tapa
      break;
    }
    case "double-sink": {
      box(0, H - 0.02, 0, W, 0.04, D, body); // mesada
      for (const sx of [-1, 1]) box(sx * W * 0.24, H - 0.1, 0, W * 0.32, 0.12, D * 0.7, basin); // bachas
      cyl(0, H + 0.13, D / 2 - 0.1, 0.035, 0.26, "y", metal); // grifo
      break;
    }
    case "towel-rack": {
      cyl(0, H * 0.85, -D / 2 + 0.04, 0.02, W * 0.9, "x", metal); // barra
      box(0, H * 0.4, -D / 2 + 0.07, W * 0.5, H * 0.7, 0.03, "#eef0f2"); // toalla
      break;
    }
    case "medicine-cabinet": {
      box(0, H / 2, 0, W, H, D, body);
      box(0, H / 2, -D / 2 + 0.006, W * 0.92, H * 0.92, 0.012, "#cfe2ea"); // puerta espejo
      break;
    }
    case "wine-rack": {
      for (const sx of [-1, 1]) box(sx * (W / 2 - 0.02), H / 2, 0, 0.04, H, D, body); // laterales
      const rows = 4;
      for (let i = 0; i <= rows; i++) box(0, (H * i) / rows, 0, W, 0.03, D, body); // estantes
      const wc = ["#3a5f3a", "#5b2a2a", "#2a3a5b"];
      for (let i = 0; i < rows; i++) for (let j = 0; j < 3; j++) {
        const bx = -W / 2 + 0.12 + (j * (W - 0.24)) / 2;
        cyl(bx, (H * (i + 0.5)) / rows, 0, 0.08, D * 0.8, "z", wc[(i + j) % wc.length]); // botellas
      }
      break;
    }
    case "bar": {
      box(0, H * 0.5, 0, W, H, D, body); // cuerpo
      box(0, H - 0.03, 0, W * 1.06, 0.06, D * 1.1, "#3a3f45"); // tapa
      box(0, H * 0.18, -D / 2 - 0.02, W, 0.04, 0.04, metal); // reposapiés
      break;
    }

    // ---- Náutico / camping ----
    case "tent": {
      prim("pyramid", 0, H / 2, 0, W * 1.1, H, D * 1.1, body);
      box(0, H * 0.25, -D / 2 + 0.12, W * 0.18, H * 0.5, 0.02, "#1b1d22"); // entrada
      break;
    }
    case "kayak": {
      // Casco central + proa/popa cónicas apuntando a lo largo (Z) → forma de kayak de verdad.
      box(0, H * 0.5, 0, W * 0.78, H * 0.72, D * 0.62, body); // casco
      rprim("cone", 0, H * 0.5, -D * 0.42, W * 0.78, D * 0.24, W * 0.78, body, [-Math.PI / 2, 0, 0]); // proa
      rprim("cone", 0, H * 0.5, D * 0.42, W * 0.78, D * 0.24, W * 0.78, body, [Math.PI / 2, 0, 0]); // popa
      box(0, H * 0.86, D * 0.04, W * 0.46, 0.04, D * 0.32, "#1b1d22"); // cockpit
      box(0, H * 0.74, D * 0.12, W * 0.42, 0.06, D * 0.18, shade(body, -0.08)); // asiento
      break;
    }
    case "campfire": {
      const dia = Math.min(W, D);
      const ns = 7;
      for (let i = 0; i < ns; i++) { const a = (i * Math.PI * 2) / ns; prim("sphere", Math.cos(a) * dia * 0.42, 0.07, Math.sin(a) * dia * 0.42, 0.14, 0.14, 0.14, "#8d8a82"); } // piedras
      cyl(0, 0.1, 0, 0.06, dia * 0.7, "x", "#5a3d28"); // leños
      cyl(0, 0.14, 0, 0.06, dia * 0.7, "z", "#5a3d28");
      prim("cone", 0, 0.3, 0, dia * 0.4, 0.4, dia * 0.4, "#ff7a1a", "#ff6a00"); // llama
      prim("cone", 0.06, 0.42, 0.04, dia * 0.22, 0.32, dia * 0.22, "#ffd24a", "#ffb000"); // llama interior
      break;
    }
    case "cooler": {
      box(0, H * 0.42, 0, W, H * 0.84, D, body); // cuerpo
      box(0, H * 0.9, 0, W * 1.02, H * 0.16, D * 1.02, shade(body, 0.08)); // tapa
      box(0, H * 0.5, -D / 2 - 0.01, W * 0.3, 0.06, 0.02, "#23262b"); // manija
      break;
    }
    case "boat": {
      box(0, H * 0.3, D * 0.05, W, H * 0.5, D * 0.78, body); // casco
      rprim("cone", 0, H * 0.3, -D * 0.46, W, H * 0.5, D * 0.32, body, [-Math.PI / 2, 0, 0]); // proa puntiaguda
      box(0, H * 0.7, D * 0.12, W * 0.6, H * 0.5, D * 0.4, "#dfe3e6"); // cabina
      box(0, H * 0.74, D * 0.12, W * 0.55, H * 0.3, D * 0.42, "#1b2026"); // ventanas
      break;
    }

    // ---- Vehículos 2 ----
    case "van": {
      box(0, 0.25 + (H - 0.25) / 2, 0, W, H - 0.25, D * 0.96, body); // caja
      box(0, 0.25 + (H - 0.25) * 0.62, -D * 0.32, W * 0.92, (H - 0.25) * 0.5, D * 0.32, "#23262b"); // ventanas
      const vwx = W / 2 - 0.04, vwz = D * 0.3;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(sx * vwx, 0.28, sz * vwz, 0.56, 0.2, "x", "#15171b");
      break;
    }
    case "truck": {
      box(0, 0.4 + (H * 0.55) / 2, -D * 0.32, W, H * 0.55, D * 0.3, shade(body, -0.05)); // cabina
      box(0, 0.4 + H * 0.45, -D * 0.32, W * 0.9, H * 0.25, D * 0.32, "#23262b"); // ventanas
      box(0, 0.4 + (H * 0.75) / 2, D * 0.12, W, H * 0.75, D * 0.62, shade(body, 0.04)); // caja de carga
      const twx = W / 2 - 0.05;
      for (const tz of [-D * 0.32, D * 0.05, D * 0.28]) for (const sx of [-1, 1]) cyl(sx * twx, 0.4, tz, 0.8, 0.24, "x", "#15171b"); // 6 ruedas
      break;
    }
    case "scooter": {
      const r = 0.1;
      cyl(0, r, -D * 0.4, r * 2, 0.05, "x", "#1b1d22");
      cyl(0, r, D * 0.4, r * 2, 0.05, "x", "#1b1d22");
      box(0, r + 0.04, 0, W * 0.5, 0.04, D * 0.8, body); // plataforma
      cyl(0, H * 0.55, -D * 0.4, 0.03, H * 0.9, "y", body); // columna
      box(0, H * 0.95, -D * 0.4, W * 1.5, 0.04, 0.04, "#23262b"); // manubrio
      break;
    }
    case "model": // modelo .glb importado: si falla la carga, caja simple
      box(0, H / 2, 0, W, H, D, body);
      break;

    default:
      box(0, H / 2, 0, W, H, D, body);
  }
  return P;
}
