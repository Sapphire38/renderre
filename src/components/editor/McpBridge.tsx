"use client";

import { useEffect } from "react";
import { useEditor } from "@/lib/store";
import { buildScene } from "@/lib/ai-build";
import { cutList, hardwareOf, budgetOf } from "@/lib/cutlist";
import { saveProject, loadProject, listProjects, deleteProject } from "@/lib/storage";
import type { SceneSpec } from "@/lib/ai-parse";
import type {
  ComponentKind,
  Furniture,
  FurnitureComponent,
  FurnitureKind,
  Opening,
  OpeningKind,
  SelRef,
  Surface,
  SurfaceShape,
  ToolId,
  Vec2,
  Wall,
  WallKind,
} from "@/lib/types";

type Args = Record<string, unknown>;

/** Resultado de la última generación por IA (para que Claude lo lea por get_state). */
let lastGenerate: {
  source?: string;
  imageUsed?: boolean;
  analysis?: string;
  created: { walls: number; furniture: number; openings: number };
} | null = null;

const vec = (p: unknown): Vec2 | null => {
  if (Array.isArray(p) && p.length >= 2) return { x: Number(p[0]), z: Number(p[1]) };
  if (p && typeof p === "object") {
    const o = p as Record<string, unknown>;
    if ("x" in o && "z" in o) return { x: Number(o.x), z: Number(o.z) };
  }
  return null;
};
const num = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/** Construye un patch de componente del taller desde los args del comando. */
function componentPatch(args: Args): Partial<FurnitureComponent> {
  const p: Record<string, unknown> = {};
  for (const k of ["x", "y", "w", "h", "depth", "depthInset", "count", "open"] as const) {
    if (args[k] !== undefined) p[k] = num(args[k]);
  }
  if (typeof args.hinge === "string") p.hinge = args.hinge;
  if (typeof args.orient === "string") p.orient = args.orient;
  if (typeof args.shape === "string") p.shape = args.shape;
  if (typeof args.color === "string") p.color = args.color;
  if ("materialId" in args) p.materialId = args.materialId == null ? undefined : String(args.materialId);
  return p as Partial<FurnitureComponent>;
}

/** Snapshot compacto del estado para que Claude lo lea por get_state. */
function snapshot() {
  const s = useEditor.getState();
  return {
    projectName: s.projectName,
    dirty: s.dirty,
    savedProjects: listProjects().map((p) => ({ name: p.name, updatedAt: p.updatedAt })),
    activeLevel: s.activeLevel,
    floors: s.floors,
    roofs: s.roofs,
    counts: {
      walls: s.walls.length,
      furniture: s.furniture.length,
      openings: s.openings.length,
      surfaces: s.surfaces.length,
      floors: s.floors.length,
    },
    walls: s.walls.map((w) => ({ id: w.id, name: w.name, kind: w.kind ?? "solid", a: w.a, b: w.b, thickness: w.thickness, height: w.height, base: w.base, heightA: w.heightA, heightB: w.heightB, materialId: w.materialId, level: w.level ?? 0 })),
    surfaces: s.surfaces.map((x) => ({ id: x.id, name: x.name, shape: x.shape ?? "rect", pos: x.pos, width: x.width, depth: x.depth, rotDeg: x.rotDeg, thickness: x.thickness, lift: x.lift, materialId: x.materialId, color: x.color, level: x.level ?? 0 })),
    terrain: { enabled: s.terrain.enabled, cols: s.terrain.cols, rows: s.terrain.rows, cell: s.terrain.cell, origin: s.terrain.origin, materialId: s.terrain.materialId },
    furniture: s.furniture.map((f) => ({
      id: f.id, kind: f.kind, name: f.name, pos: f.pos, rotDeg: f.rotDeg,
      width: f.width, depth: f.depth, height: f.height, panel: f.panel, doors: f.doors, shelves: f.shelves,
      baseHeight: f.baseHeight, color: f.color, materialId: f.materialId, level: f.level ?? 0,
      custom: f.kind === "custom",
    })),
    openings: s.openings.map((o) => ({ id: o.id, wallId: o.wallId, kind: o.kind, style: o.style, hinge: o.hinge, swing: o.swing, name: o.name, offset: o.offset, width: o.width, height: o.height, sill: o.sill, level: o.level ?? 0 })),
    materials: s.materials.map((m) => ({ id: m.id, name: m.name, color: m.color, tileM: m.tileM, roughness: m.roughness, metalness: m.metalness, opacity: m.opacity ?? 1 })),
    floorMaterialId: s.floorMaterialId,
    render: s.render,
    models: s.models.map((m) => ({ id: m.id, name: m.name, width: m.width, depth: m.depth, height: m.height })),
    customLibrary: s.customLibrary.map((f) => ({ id: f.id, name: f.name })),
    selection: s.selection,
    multi: s.multi,
    tool: s.tool,
    furnitureKind: s.furnitureKind,
    openingKind: s.openingKind,
    openingStyle: s.openingStyle,
    wallKind: s.wallKind,
    surfaceShape: s.surfaceShape,
    surfaceMaterialId: s.surfaceMaterialId,
    grid: s.grid,
    wallDefaults: s.wallDefaults,
    // Resultado de la última generación por IA (qué entendió de la imagen + cuántos elementos creó)
    lastGenerate,
    // Proyecto completo (para exportar/llevar a otra PC vía renderre_export_project)
    project: s.exportData(),
    // --- Taller de muebles (si está abierto) ---
    workbenchOpen: s.workbenchOpen,
    workbenchDims: s.workbenchDims,
    draftCanUndo: s.draftPast.length > 0,
    draftCanRedo: s.draftFuture.length > 0,
    selectedComponentId: s.selectedComponentId,
    draft: s.draft
      ? {
          id: s.draft.id,
          name: s.draft.name,
          width: s.draft.width,
          height: s.draft.height,
          depth: s.draft.depth,
          panel: s.draft.panel,
          color: s.draft.color,
          back: s.draft.back !== false,
          carcass: s.draft.carcass !== false,
          components: (s.draft.components ?? []).map((c) => ({
            id: c.id, kind: c.kind, x: c.x, y: c.y, w: c.w, h: c.h,
            depth: c.depth, depthInset: c.depthInset, count: c.count,
            hinge: c.hinge, orient: c.orient, shape: c.shape, color: c.color, materialId: c.materialId, open: c.open,
          })),
        }
      : null,
    pricing: s.pricing,
    // Despiece + presupuesto del mueble en edición (si el Taller está abierto).
    cutlist: s.draft
      ? (() => {
          const pieces = cutList(s.draft);
          const hw = hardwareOf(s.draft);
          return { pieces, hardware: hw, budget: budgetOf(pieces, hw, s.pricing) };
        })()
      : null,
  };
}

async function applyCommand(type: string, args: Args = {}): Promise<void> {
  const st = useEditor.getState();
  switch (type) {
    case "ping":
      break;
    case "new_project":
      st.newProject();
      break;
    case "clear":
      st.clearAll();
      break;
    case "undo":
      st.undo();
      break;
    case "redo":
      st.redo();
      break;
    case "fit_view":
      window.dispatchEvent(new CustomEvent("renderre:fit"));
      break;
    case "fit_3d":
      window.dispatchEvent(new CustomEvent("renderre:fit3d"));
      break;
    case "add_floor":
      st.addFloor();
      break;
    case "set_active_level":
      st.setActiveLevel(num(args.level) ?? 0);
      break;
    case "save_project": {
      const name = String(args.name ?? st.projectName ?? "").trim();
      if (!name) break;
      st.setProjectName(name);
      saveProject(name, st.exportData(), Date.now());
      st.markSaved();
      st.pushToast(`Guardado: ${name}`, "ok");
      break;
    }
    case "open_project": {
      const name = String(args.name ?? "").trim();
      const p = name ? loadProject(name) : null;
      if (!p) {
        st.pushToast(`No encontré el proyecto "${name}"`, "warn");
        break;
      }
      st.loadData(p.data, p.name);
      window.dispatchEvent(new CustomEvent("renderre:fit"));
      st.pushToast(`Abierto: ${p.name}`, "ok");
      break;
    }
    case "add_wall": {
      const a = vec(args.a);
      const b = vec(args.b);
      if (!a || !b) break;
      const id = st.addWall(a, b);
      const patch: Record<string, number | string> = {};
      for (const k of ["thickness", "height", "base", "heightA", "heightB"] as const) {
        if (args[k] !== undefined) patch[k] = num(args[k])!;
      }
      if (typeof args.kind === "string") patch.kind = args.kind;
      if (typeof args.name === "string") patch.name = args.name;
      if (typeof args.materialId === "string") patch.materialId = args.materialId;
      if (id && Object.keys(patch).length) st.updateWall(id, patch as Partial<Omit<Wall, "id">>);
      break;
    }
    case "add_furniture": {
      const kind = String(args.kind ?? "module") as FurnitureKind;
      const pos = vec(args.pos) ?? { x: num(args.x) ?? 0, z: num(args.z) ?? 0 };
      const id = st.addFurniture(kind, pos, num(args.rotDeg) ?? 0);
      const patch: Record<string, number | string> = {};
      for (const k of ["width", "depth", "height", "panel", "doors", "shelves", "baseHeight"] as const) {
        if (args[k] !== undefined) patch[k] = num(args[k])!;
      }
      if (typeof args.color === "string") patch.color = args.color;
      if (typeof args.name === "string") patch.name = args.name;
      if (typeof args.materialId === "string") patch.materialId = args.materialId;
      if (Object.keys(patch).length) st.updateFurniture(id, patch);
      break;
    }
    case "add_opening": {
      const walls = useEditor.getState().walls;
      let wallId = typeof args.wallId === "string" ? args.wallId : undefined;
      if (!wallId && args.wallIndex !== undefined) wallId = walls[num(args.wallIndex)!]?.id;
      if (!wallId) break;
      const wall = walls.find((w) => w.id === wallId);
      if (!wall) break;
      const len = Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z);
      const offset = num(args.offset) ?? len / 2;
      const id = st.addOpening(wallId, (String(args.kind ?? "door") as OpeningKind), offset);
      const patch: Record<string, unknown> = {};
      for (const k of ["width", "height", "sill"] as const) if (args[k] !== undefined) patch[k] = num(args[k])!;
      for (const k of ["style", "hinge", "swing", "name"] as const) if (typeof args[k] === "string") patch[k] = args[k];
      if (id && Object.keys(patch).length) st.updateOpening(id, patch as Partial<Omit<Opening, "id">>);
      break;
    }
    case "apply_scene": {
      const spec = (args.spec ?? args) as SceneSpec;
      const built = buildScene(spec, useEditor.getState().wallDefaults);
      st.applyBatch(built.walls, built.furniture, built.openings);
      window.dispatchEvent(new CustomEvent("renderre:fit"));
      break;
    }
    case "generate": {
      const description = String(args.description ?? "");
      const images = Array.isArray(args.images) ? (args.images as string[]) : undefined;
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, images }),
      });
      const data = await res.json();
      const spec: SceneSpec = data.spec ?? {};
      const built = buildScene(spec, useEditor.getState().wallDefaults);
      st.applyBatch(built.walls, built.furniture, built.openings);
      window.dispatchEvent(new CustomEvent("renderre:fit"));
      lastGenerate = {
        source: data.source,
        imageUsed: !!data.imageUsed,
        analysis: typeof data.analysis === "string" ? data.analysis : undefined,
        created: { walls: built.walls.length, furniture: built.furniture.length, openings: built.openings.length },
      };
      st.pushToast(`IA: ${built.walls.length} muros · ${built.furniture.length} muebles · ${built.openings.length} aberturas`, "ok");
      break;
    }

    // --- editar / borrar elementos existentes por id ---
    case "update_furniture": {
      const id = String(args.id ?? "");
      const f = useEditor.getState().furniture.find((x) => x.id === id);
      if (!f) break;
      const patch: Record<string, unknown> = {};
      if (args.x !== undefined || args.z !== undefined) patch.pos = { x: num(args.x) ?? f.pos.x, z: num(args.z) ?? f.pos.z };
      for (const k of ["rotDeg", "width", "depth", "height", "panel", "doors", "shelves", "baseHeight"] as const) {
        if (args[k] !== undefined) patch[k] = num(args[k]);
      }
      if (typeof args.color === "string") patch.color = args.color;
      if (typeof args.name === "string") patch.name = args.name;
      if (typeof args.carcass === "boolean") patch.carcass = args.carcass;
      if (typeof args.back === "boolean") patch.back = args.back;
      if ("materialId" in args) patch.materialId = args.materialId == null ? undefined : String(args.materialId);
      st.updateFurniture(id, patch as Partial<Omit<Furniture, "id">>);
      break;
    }
    case "update_wall": {
      const id = String(args.id ?? "");
      const patch: Record<string, unknown> = {};
      for (const k of ["thickness", "height", "base", "heightA", "heightB"] as const) if (args[k] !== undefined) patch[k] = num(args[k]);
      const a = vec(args.a);
      const b = vec(args.b);
      if (a) patch.a = a;
      if (b) patch.b = b;
      if (typeof args.name === "string") patch.name = args.name;
      if (typeof args.kind === "string") patch.kind = args.kind;
      if ("materialId" in args) patch.materialId = args.materialId == null ? undefined : String(args.materialId);
      st.updateWall(id, patch as Partial<Omit<Wall, "id">>);
      break;
    }
    case "add_surface": {
      const pos = vec(args.pos) ?? { x: num(args.x) ?? 0, z: num(args.z) ?? 0 };
      const size =
        args.width !== undefined || args.depth !== undefined
          ? { width: num(args.width) ?? 2, depth: num(args.depth) ?? 2 }
          : undefined;
      if (typeof args.shape === "string") st.setSurfaceShape(args.shape as SurfaceShape);
      if ("materialId" in args) st.setSurfaceMaterial(args.materialId == null ? null : String(args.materialId));
      const id = st.addSurface(pos, size);
      const patch: Record<string, unknown> = {};
      for (const k of ["rotDeg", "thickness", "lift"] as const) if (args[k] !== undefined) patch[k] = num(args[k]);
      if (typeof args.name === "string") patch.name = args.name;
      if (typeof args.color === "string") patch.color = args.color;
      if (Object.keys(patch).length) st.updateSurface(id, patch as Partial<Omit<Surface, "id">>);
      break;
    }
    case "update_surface": {
      const id = String(args.id ?? "");
      if (!useEditor.getState().surfaces.some((x) => x.id === id)) break;
      const patch: Record<string, unknown> = {};
      if (args.x !== undefined || args.z !== undefined) {
        const cur = useEditor.getState().surfaces.find((x) => x.id === id)!;
        patch.pos = { x: num(args.x) ?? cur.pos.x, z: num(args.z) ?? cur.pos.z };
      }
      for (const k of ["width", "depth", "rotDeg", "thickness", "lift"] as const) if (args[k] !== undefined) patch[k] = num(args[k]);
      if (typeof args.shape === "string") patch.shape = args.shape;
      if (typeof args.name === "string") patch.name = args.name;
      if (typeof args.color === "string") patch.color = args.color;
      if ("materialId" in args) patch.materialId = args.materialId == null ? undefined : String(args.materialId);
      st.updateSurface(id, patch as Partial<Omit<Surface, "id">>);
      break;
    }
    case "update_opening": {
      const id = String(args.id ?? "");
      if (!useEditor.getState().openings.some((o) => o.id === id)) break;
      const patch: Record<string, unknown> = {};
      for (const k of ["offset", "width", "height", "sill"] as const) if (args[k] !== undefined) patch[k] = num(args[k]);
      for (const k of ["kind", "style", "hinge", "swing", "name"] as const) if (typeof args[k] === "string") patch[k] = args[k];
      st.updateOpening(id, patch as Partial<Omit<Opening, "id">>);
      break;
    }
    case "delete": {
      const id = String(args.id ?? "");
      const kind = String(args.kind ?? "furniture");
      if (kind === "wall") st.removeWall(id);
      else if (kind === "opening") st.removeOpening(id);
      else if (kind === "surface") st.removeSurface(id);
      else st.removeFurniture(id);
      break;
    }
    case "set_floor_material":
      st.setFloorMaterial(args.materialId == null ? null : String(args.materialId));
      break;
    case "set_floor_level_material":
      st.setFloorLevelMaterial(Number(args.level ?? st.activeLevel), args.materialId == null ? null : String(args.materialId));
      break;
    case "set_render": {
      const patch: Record<string, unknown> = {};
      for (const k of ["sunAzimuth", "sunElevation", "sunIntensity", "ambient", "lampIntensity"] as const)
        if (args[k] != null) patch[k] = Number(args[k]);
      if (args.background != null) patch.background = String(args.background);
      if (args.shadows != null) patch.shadows = Boolean(args.shadows);
      if (args.lampLights != null) patch.lampLights = Boolean(args.lampLights);
      st.setRender(patch);
      break;
    }
    case "set_terrain": {
      const patch: Record<string, unknown> = {};
      if (args.enabled != null) patch.enabled = Boolean(args.enabled);
      if (args.materialId !== undefined) patch.materialId = args.materialId == null ? undefined : String(args.materialId);
      if (Object.keys(patch).length) st.setTerrain(patch);
      if (args.cols != null || args.rows != null || args.cell != null) {
        const t = useEditor.getState().terrain;
        st.resizeTerrain(Number(args.cols ?? t.cols), Number(args.rows ?? t.rows), Number(args.cell ?? t.cell));
      }
      if (args.reset) st.resetTerrain();
      break;
    }
    case "sculpt_terrain": {
      const mode = ["raise", "lower", "flatten", "smooth"].includes(String(args.mode)) ? (String(args.mode) as "raise" | "lower" | "flatten" | "smooth") : "raise";
      st.sculptTerrain(Number(args.x ?? 0), Number(args.z ?? 0), Number(args.radius ?? 2), Number(args.strength ?? 0.3), mode);
      break;
    }
    case "set_pricing": {
      const patch: Record<string, number> = {};
      for (const k of ["boardW", "boardH", "boardPrice", "edgePrice", "hingePrice", "slidePrice", "pullPrice", "rodPrice", "laborPerM2", "yield"] as const)
        if (args[k] != null) patch[k] = Number(args[k]);
      st.setPricing(patch);
      break;
    }
    case "place_custom": {
      const lib = useEditor.getState().customLibrary;
      let libId = typeof args.libId === "string" ? args.libId : undefined;
      if (!libId && typeof args.name === "string") libId = lib.find((f) => f.name === args.name)?.id;
      if (libId) st.placeCustom(libId);
      else st.pushToast("No encontré ese mueble guardado", "warn");
      break;
    }
    case "place_model": {
      const lib = useEditor.getState().models;
      let id = typeof args.id === "string" ? args.id : undefined;
      if (!id && typeof args.name === "string") id = lib.find((m) => m.name === args.name)?.id;
      if (id) st.placeModel(id);
      else st.pushToast("No encontré ese modelo importado", "warn");
      break;
    }
    case "remove_model": {
      const lib = useEditor.getState().models;
      const id = typeof args.id === "string" ? args.id : lib.find((m) => m.name === args.name)?.id;
      if (id) st.removeModel(id);
      break;
    }

    // --- Taller de muebles a medida ---
    case "open_workbench": {
      if (typeof args.preset === "string") {
        st.openWorkbenchFromPreset(args.preset as FurnitureKind);
        break;
      }
      if (typeof args.libId === "string" || typeof args.libName === "string") {
        const lib = useEditor.getState().customLibrary;
        const f = typeof args.libId === "string" ? lib.find((x) => x.id === args.libId) : lib.find((x) => x.name === args.libName);
        if (f) st.loadDraft(f);
        else st.pushToast("No encontré ese mueble guardado", "warn");
        break;
      }
      const baseId = typeof args.baseId === "string" ? args.baseId : undefined;
      const base = baseId ? useEditor.getState().furniture.find((f) => f.id === baseId) : undefined;
      st.openWorkbench(base ?? undefined);
      break;
    }
    case "close_workbench":
      st.closeWorkbench();
      break;
    case "set_draft": {
      const patch: Record<string, unknown> = {};
      if (typeof args.name === "string") patch.name = args.name;
      for (const k of ["width", "height", "depth", "panel"] as const) if (args[k] !== undefined) patch[k] = num(args[k]);
      if (typeof args.color === "string") patch.color = args.color;
      if (typeof args.back === "boolean") patch.back = args.back;
      if (typeof args.carcass === "boolean") patch.carcass = args.carcass;
      st.updateDraft(patch as Partial<Furniture>);
      break;
    }
    case "add_component": {
      if (!useEditor.getState().draft) {
        st.pushToast("Abrí primero el taller (open_workbench)", "warn");
        break;
      }
      st.addComponent(String(args.kind ?? "shelf") as ComponentKind);
      const id = useEditor.getState().selectedComponentId;
      if (id) {
        const patch = componentPatch(args);
        if (Object.keys(patch).length) st.updateComponent(id, patch);
      }
      break;
    }
    case "update_component": {
      const id = String(args.id ?? "") || useEditor.getState().selectedComponentId || "";
      if (id) st.updateComponent(id, componentPatch(args));
      break;
    }
    case "remove_component": {
      const id = String(args.id ?? "") || useEditor.getState().selectedComponentId || "";
      if (id) st.removeComponent(id);
      break;
    }
    case "save_draft":
      st.saveDraftToPlan();
      break;
    case "undo_draft":
      st.undoDraft();
      break;
    case "redo_draft":
      st.redoDraft();
      break;
    case "duplicate_component":
      if (typeof args.id === "string") st.selectComponent(args.id);
      st.duplicateComponent();
      break;
    case "nudge_component":
      st.nudgeComponent(num(args.dx) ?? 0, num(args.dy) ?? 0);
      break;
    case "copy_component":
      if (typeof args.id === "string") st.selectComponent(args.id);
      st.copyComponent();
      break;
    case "paste_component":
      st.pasteComponent();
      break;
    case "toggle_dims":
      st.toggleWorkbenchDims();
      break;

    // --- pisos / niveles ---
    case "rename_floor":
      st.renameFloor(num(args.level) ?? st.activeLevel, String(args.name ?? ""));
      break;
    case "set_floor_elevation":
      st.setFloorElevation(num(args.level) ?? st.activeLevel, num(args.elevation) ?? 0);
      break;
    case "remove_floor":
      st.removeFloor(num(args.level) ?? st.activeLevel);
      break;

    // --- techos ---
    case "set_roof":
      st.setRoof(num(args.level) ?? st.activeLevel, String(args.kind ?? "flat") as "flat" | "gable" | "shed");
      break;
    case "update_roof": {
      const level = num(args.level) ?? st.activeLevel;
      const patch: Record<string, unknown> = {};
      for (const k of ["height", "rise", "overhang", "thickness"] as const) if (args[k] !== undefined) patch[k] = num(args[k]);
      if (args.ridgeAxis === "x" || args.ridgeAxis === "z") patch.ridgeAxis = args.ridgeAxis;
      if ("materialId" in args) patch.materialId = args.materialId == null ? undefined : String(args.materialId);
      st.updateRoof(level, patch);
      break;
    }
    case "remove_roof":
      st.removeRoof(num(args.level) ?? st.activeLevel);
      break;

    // --- materiales ---
    case "add_material": {
      const id = st.addMaterial({
        name: String(args.name ?? "Material"),
        color: typeof args.color === "string" ? args.color : "#c9b18b",
        tileM: num(args.tileM) ?? 1,
        roughness: num(args.roughness) ?? 0.85,
        metalness: num(args.metalness) ?? 0,
        ...(args.opacity !== undefined ? { opacity: num(args.opacity) } : {}),
      });
      st.pushToast(`Material creado: ${id}`, "ok");
      break;
    }
    case "update_material": {
      const id = String(args.id ?? "");
      if (!id) break;
      const patch: Record<string, unknown> = {};
      if (typeof args.name === "string") patch.name = args.name;
      if (typeof args.color === "string") patch.color = args.color;
      for (const k of ["tileM", "roughness", "metalness", "opacity"] as const) if (args[k] !== undefined) patch[k] = num(args[k]);
      st.updateMaterial(id, patch);
      break;
    }

    // --- biblioteca custom ---
    case "remove_from_library": {
      const lib = useEditor.getState().customLibrary;
      const libId = typeof args.libId === "string" ? args.libId : lib.find((f) => f.name === args.name)?.id;
      if (libId) st.removeFromLibrary(libId);
      break;
    }

    // --- selección y operaciones de grupo ---
    case "select": {
      const kind = String(args.kind ?? "");
      const id = String(args.id ?? "");
      if (kind === "wall") st.selectWall(id);
      else if (kind === "furniture") st.selectFurniture(id);
      else if (kind === "opening") st.selectOpening(id);
      else if (kind === "surface") st.selectSurface(id);
      break;
    }
    case "set_multi": {
      const refs = Array.isArray(args.refs)
        ? (args.refs as unknown[])
            .map((r) => (r && typeof r === "object" ? (r as Record<string, unknown>) : null))
            .filter((r): r is Record<string, unknown> => !!r && typeof r.kind === "string" && typeof r.id === "string")
            .map((r) => ({ kind: r.kind, id: r.id }) as SelRef)
        : [];
      st.setMulti(refs);
      break;
    }
    case "clear_selection":
      st.clearSelection();
      break;
    case "copy_selection":
      st.copySelection();
      break;
    case "paste":
      st.paste();
      window.dispatchEvent(new CustomEvent("renderre:fit"));
      break;
    case "nudge_selection":
      st.nudgeSelection(num(args.dx) ?? 0, num(args.dz) ?? 0);
      break;
    case "remove_selected":
      st.removeSelected();
      break;
    case "assign_material_to_selection":
      st.assignMaterialToSelection(args.materialId == null ? null : String(args.materialId));
      break;

    // --- proyectos / ajustes ---
    case "delete_project": {
      const name = String(args.name ?? "").trim();
      if (name) {
        deleteProject(name);
        st.pushToast(`Proyecto eliminado: ${name}`, "ok");
      }
      break;
    }
    case "set_project_name":
      st.setProjectName(String(args.name ?? ""));
      break;
    case "set_grid": {
      const patch: Record<string, unknown> = {};
      if (args.cellM !== undefined) patch.cellM = num(args.cellM);
      if (typeof args.snap === "boolean") patch.snap = args.snap;
      if (typeof args.showGrid === "boolean") patch.showGrid = args.showGrid;
      st.setGrid(patch);
      break;
    }
    case "set_wall_defaults": {
      const patch: Record<string, unknown> = {};
      if (args.thickness !== undefined) patch.thickness = num(args.thickness);
      if (args.height !== undefined) patch.height = num(args.height);
      st.setWallDefaults(patch);
      break;
    }
    case "set_tool":
      st.setTool(String(args.tool ?? "select") as ToolId);
      break;
    case "set_furniture_kind":
      st.setFurnitureKind(String(args.kind ?? "module") as FurnitureKind);
      break;
    case "set_opening_kind":
      st.setOpeningKind(String(args.kind ?? "door") as OpeningKind);
      break;
    case "set_opening_style":
      st.setOpeningStyle(String(args.style ?? "swing"));
      break;
    case "set_wall_kind":
      st.setWallKind(String(args.kind ?? "solid") as WallKind);
      break;
    case "set_surface_shape":
      st.setSurfaceShape(String(args.shape ?? "rect") as SurfaceShape);
      break;
    case "set_surface_material":
      st.setSurfaceMaterial(args.materialId == null ? null : String(args.materialId));
      break;
    case "export_png":
      window.dispatchEvent(new CustomEvent("renderre:exportpng"));
      break;

    default:
      st.pushToast(`MCP: comando desconocido "${type}"`, "warn");
      return;
  }
}

export default function McpBridge() {
  useEffect(() => {
    let lastSeq = 0;
    let initialized = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/mcp/poll?after=${lastSeq}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!initialized) {
          // En el primer poll ignoramos el backlog previo a abrir el editor.
          lastSeq = data.seq ?? 0;
          initialized = true;
          return;
        }
        const cmds = (data.commands ?? []) as { seq: number; type: string; args?: Args }[];
        for (const c of cmds) {
          lastSeq = Math.max(lastSeq, c.seq);
          try {
            await applyCommand(c.type, c.args ?? {});
            if (c.type !== "ping") useEditor.getState().pushToast(`Claude → ${c.type}`, "info");
          } catch (err) {
            console.warn("MCP command failed", c, err);
          }
        }
      } catch {
        /* servidor no disponible: reintenta en el próximo tick */
      }
    };

    const pollTimer = setInterval(poll, 700);
    poll();

    // Publicar estado (al montar, en cada cambio con debounce, y por heartbeat).
    let pushTimer: ReturnType<typeof setTimeout> | null = null;
    const pushState = async () => {
      try {
        await fetch("/api/mcp/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(snapshot()),
          cache: "no-store",
        });
      } catch {
        /* ignore */
      }
    };
    const schedulePush = () => {
      if (pushTimer) clearTimeout(pushTimer);
      pushTimer = setTimeout(pushState, 350);
    };
    const unsub = useEditor.subscribe(schedulePush);
    pushState();
    const heartbeat = setInterval(pushState, 3000);

    return () => {
      clearInterval(pollTimer);
      clearInterval(heartbeat);
      if (pushTimer) clearTimeout(pushTimer);
      unsub();
    };
  }, []);

  return null;
}
