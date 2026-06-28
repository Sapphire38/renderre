import type { Material } from "./types";
import { uid } from "./geometry";

export type MaterialPreset = Omit<Material, "id">;

/** Presets de acabados típicos de mueblería en MDF/melamina + algunos de obra. */
export const MATERIAL_PRESETS: MaterialPreset[] = [
  { name: "MDF natural", color: "#c9b18b", tileM: 1, roughness: 0.85, metalness: 0 },
  { name: "Melamina blanca", color: "#ededeb", tileM: 1, roughness: 0.5, metalness: 0 },
  { name: "Melamina negra", color: "#1d1d1f", tileM: 1, roughness: 0.45, metalness: 0 },
  { name: "Nogal", color: "#5b3a23", tileM: 1, roughness: 0.7, metalness: 0 },
  { name: "Roble claro", color: "#c8a877", tileM: 1, roughness: 0.75, metalness: 0 },
  { name: "Gris cemento", color: "#8a8d91", tileM: 1, roughness: 0.9, metalness: 0 },
  { name: "Blanco pared", color: "#e8e8e6", tileM: 1, roughness: 0.95, metalness: 0 },
];

export function makeMaterial(p: Omit<Material, "id">): Material {
  return { id: uid(), ...p };
}

/** Crea la librería inicial de materiales (presets con ids frescos). */
export function seedMaterials(): Material[] {
  return MATERIAL_PRESETS.map((p) => makeMaterial(p));
}
