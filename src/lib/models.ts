import type { FurnitureKind } from "./types";

/**
 * Modelo 3D externo (.glb/glTF) para un tipo de mueble/objeto.
 * Si un `kind` tiene una entrada acá, el editor intenta cargar el .glb y, si falla
 * (archivo ausente o inválido), cae automáticamente al modelo de cajas procedural.
 */
export type ModelDef = {
  /** Ruta servida desde /public, ej. "/models/hilux.glb". */
  url: string;
  /** Auto-escalar el modelo para que entre en las dimensiones del preset (ancho×prof). Default true. */
  fit?: boolean;
  /** Escala manual (si no usás fit), 1 = tal cual viene el .glb. */
  scale?: number;
  /** Giro extra en Y (grados) si el modelo viene mirando para otro lado. */
  rotDeg?: number;
  /** Desplazamiento vertical (m) para apoyarlo bien en el piso. */
  yOffset?: number;
};

/**
 * Registro de modelos. Vacío por defecto: la app usa los modelos procedurales (cajas).
 * Para usar modelos reales: poné el .glb en `public/models/` y agregá/descomentá su entrada.
 * Fuentes CC0 recomendadas: Kenney (kenney.nl, "Car Kit"), Quaternius (quaternius.com,
 * "Ultimate Vehicles" / "Nature"). Ver public/models/README.md.
 */
export const FURNITURE_MODELS: Partial<Record<FurnitureKind, ModelDef>> = {
  // Vacío = todo procedural (cajas). Para usar modelos reales, poné el .glb en
  // public/models/ y descomentá/ajustá su entrada (verificado con example-box.glb):
  // pickup: { url: "/models/hilux.glb", fit: true, rotDeg: 0 },
  // car: { url: "/models/car.glb", fit: true },
  // kayak: { url: "/models/kayak.glb", fit: true },
  // tree: { url: "/models/tree.glb", fit: true },
  // prim-box: { url: "/models/example-box.glb", fit: true }, // demo de prueba
};

export const modelFor = (kind: FurnitureKind): ModelDef | undefined => FURNITURE_MODELS[kind];
