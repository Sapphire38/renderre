import type { Material } from "./types";
import { uid } from "./geometry";

export type MaterialPreset = Omit<Material, "id">;

/** Presets de acabados típicos de mueblería en MDF/melamina + obra + jardín/exterior. */
export const MATERIAL_PRESETS: MaterialPreset[] = [
  { name: "MDF natural", color: "#c9b18b", tileM: 1, roughness: 0.85, metalness: 0 },
  { name: "Melamina blanca", color: "#ededeb", tileM: 1, roughness: 0.5, metalness: 0 },
  { name: "Melamina negra", color: "#1d1d1f", tileM: 1, roughness: 0.45, metalness: 0 },
  { name: "Nogal", color: "#5b3a23", tileM: 1, roughness: 0.7, metalness: 0 },
  { name: "Roble claro", color: "#c8a877", tileM: 1, roughness: 0.75, metalness: 0 },
  { name: "Gris cemento", color: "#8a8d91", tileM: 1, roughness: 0.9, metalness: 0 },
  { name: "Blanco pared", color: "#e8e8e6", tileM: 1, roughness: 0.95, metalness: 0 },
  // --- Jardín / exterior ---
  { name: "Césped", color: "#5a8f3c", tileM: 0.6, roughness: 1, metalness: 0 },
  { name: "Pasto sintético", color: "#4f9b46", tileM: 0.5, roughness: 0.95, metalness: 0 },
  { name: "Grabilla / grava", color: "#9b958a", tileM: 0.3, roughness: 1, metalness: 0 },
  { name: "Canto rodado", color: "#8a8378", tileM: 0.35, roughness: 0.95, metalness: 0 },
  { name: "Tierra", color: "#6b4e34", tileM: 0.8, roughness: 1, metalness: 0 },
  { name: "Arena", color: "#d8c89a", tileM: 0.5, roughness: 1, metalness: 0 },
  { name: "Deck de madera", color: "#9c6b40", tileM: 0.6, roughness: 0.65, metalness: 0 },
  { name: "Adoquín", color: "#8a8378", tileM: 0.25, roughness: 0.9, metalness: 0 },
  { name: "Laja / piedra plana", color: "#74726c", tileM: 0.6, roughness: 0.85, metalness: 0 },
  { name: "Hormigón exterior", color: "#9a9da1", tileM: 1, roughness: 0.9, metalness: 0 },
  { name: "Mulch / corteza", color: "#5a3d28", tileM: 0.4, roughness: 1, metalness: 0 },
  { name: "Agua", color: "#2f7fa8", tileM: 2, roughness: 0.12, metalness: 0.15, opacity: 0.6 },
  // --- Cercos / muros ---
  { name: "Ladrillo visto", color: "#a8553f", tileM: 0.5, roughness: 0.9, metalness: 0 },
  { name: "Piedra", color: "#8d8a82", tileM: 0.7, roughness: 0.95, metalness: 0 },
  { name: "Metal galvanizado", color: "#9aa0a6", tileM: 1, roughness: 0.5, metalness: 0.7 },
  { name: "Hierro negro", color: "#3a3d42", tileM: 1, roughness: 0.55, metalness: 0.6 },
  // --- Pisos / revestimientos ---
  { name: "Mármol blanco", color: "#eceae6", tileM: 0.6, roughness: 0.2, metalness: 0 },
  { name: "Granito negro", color: "#2c2e31", tileM: 0.6, roughness: 0.3, metalness: 0.1 },
  { name: "Porcelanato", color: "#d8d6d1", tileM: 0.6, roughness: 0.25, metalness: 0 },
  { name: "Terracota", color: "#b5673c", tileM: 0.4, roughness: 0.85, metalness: 0 },
  { name: "Acero inoxidable", color: "#c4c8cc", tileM: 1, roughness: 0.35, metalness: 0.85 },
  { name: "Vidrio", color: "#bcd6e6", tileM: 1, roughness: 0.1, metalness: 0.2, opacity: 0.4 },
];

export function makeMaterial(p: Omit<Material, "id">): Material {
  return { id: uid(), ...p };
}

/** Crea la librería inicial de materiales (presets con ids frescos). */
export function seedMaterials(): Material[] {
  return MATERIAL_PRESETS.map((p) => makeMaterial(p));
}
