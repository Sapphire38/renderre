import { create } from "zustand";
import type {
  ComponentKind,
  Floor,
  Furniture,
  FurnitureComponent,
  FurnitureKind,
  GridSettings,
  Material,
  ModelAsset,
  Opening,
  OpeningKind,
  Pricing,
  ProjectData,
  RenderSettings,
  Roof,
  RoofKind,
  Selection,
  SelRef,
  Surface,
  SurfaceShape,
  Terrain,
  ToolId,
  Wall,
  WallDefaults,
  WallKind,
  Vec2,
} from "./types";
import { uid } from "./geometry";
import { carcassPanels, customFromPreset, makeComponent, makeCustomFurniture, makeFurniture } from "./furniture";
import { makeOpening, OPENING_STYLES, defaultStyle } from "./openings";
import { makeSurface } from "./surfaces";
import { makeTerrain, sculpt as sculptHeights, type TerrainMode } from "./terrain";
import { seedMaterials } from "./materials";
import { DEFAULT_RENDER, DEFAULT_PRICING } from "./types";

const MIN_LEN = 0.02; // 2 cm: longitud mínima de un muro

const cloneWalls = (walls: Wall[]): Wall[] =>
  walls.map((w) => ({ ...w, a: { ...w.a }, b: { ...w.b } }));
const cloneOne = (f: Furniture): Furniture => ({
  ...f,
  pos: { ...f.pos },
  components: f.components?.map((c) => ({ ...c })),
});
const cloneFurniture = (list: Furniture[]): Furniture[] => list.map(cloneOne);
const cloneOpenings = (list: Opening[]): Opening[] => list.map((o) => ({ ...o }));
const cloneSurfaces = (list: Surface[]): Surface[] => list.map((s) => ({ ...s, pos: { ...s.pos } }));
const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Empuja un snapshot al historial del taller evitando duplicados adyacentes. */
const pushSnap = (past: Furniture[], snap: Furniture): Furniture[] => {
  const last = past[past.length - 1];
  if (last && JSON.stringify(last) === JSON.stringify(snap)) return past;
  return [...past, snap].slice(-50);
};
/** Mantiene un componente dentro del marco del mueble. */
const clampComponent = (c: FurnitureComponent, W: number, H: number): FurnitureComponent => {
  const w = clampN(c.w, 0.02, Math.max(0.02, W));
  const h = clampN(c.h, 0.02, Math.max(0.02, H));
  return { ...c, w, h, x: clampN(c.x, 0, Math.max(0, W - w)), y: clampN(c.y, 0, Math.max(0, H - h)) };
};

export type ToastKind = "info" | "ok" | "warn";
export type Toast = { id: string; text: string; kind: ToastKind };
type ClipItem =
  | { kind: "wall"; data: Wall }
  | { kind: "furniture"; data: Furniture }
  | { kind: "opening"; data: Opening }
  | { kind: "surface"; data: Surface };

const refEq = (a: SelRef, b: SelRef | null): boolean =>
  !!b && a.kind === b.kind && a.id === b.id;

/**
 * Conjunto efectivo de elementos seleccionados.
 * El multi-set sólo es válido si contiene la selección primaria; así cualquier
 * selección puntual (clic, addFurniture, etc.) invalida automáticamente un
 * marco de selección anterior que haya quedado obsoleto.
 */
export function selectedRefs(selection: Selection, multi: SelRef[]): SelRef[] {
  if (multi.length && multi.some((m) => refEq(m, selection))) return multi;
  return selection ? [selection] : [];
}

type Scene = { walls: Wall[]; furniture: Furniture[]; openings: Opening[]; surfaces: Surface[] };
const snapshot = (s: Scene): Scene => ({
  walls: cloneWalls(s.walls),
  furniture: cloneFurniture(s.furniture),
  openings: cloneOpenings(s.openings),
  surfaces: cloneSurfaces(s.surfaces),
});

export type EditorState = {
  walls: Wall[];
  furniture: Furniture[];
  openings: Opening[];
  surfaces: Surface[];
  terrain: Terrain;
  materials: Material[];
  models: ModelAsset[]; // modelos 3D (.glb) importados
  customLibrary: Furniture[]; // muebles diseñados en el taller
  floors: Floor[];
  activeLevel: number;
  floorMaterialId?: string;
  roofs: Roof[];
  render: RenderSettings;
  pricing: Pricing;
  tool: ToolId;
  furnitureKind: FurnitureKind; // preset a colocar con la herramienta "furniture"
  openingKind: OpeningKind; // puerta/ventana a colocar
  openingStyle: string; // estilo de la abertura a colocar
  wallKind: WallKind; // tipo de muro/cerco a trazar
  surfaceShape: SurfaceShape; // forma de las nuevas superficies
  surfaceMaterialId?: string; // material de las nuevas superficies
  selection: Selection;
  multi: SelRef[]; // selección múltiple (marco de arrastre / shift-clic)
  // --- Taller de muebles (transitorio) ---
  workbenchOpen: boolean;
  draft: Furniture | null;
  selectedComponentId: string | null;
  draftPast: Furniture[]; // historial del taller (deshacer/rehacer del mueble en edición)
  draftFuture: Furniture[];
  componentClipboard: FurnitureComponent | null;
  workbenchDims: boolean; // mostrar cotas/medidas en el alzado
  grid: GridSettings;
  wallDefaults: WallDefaults;
  projectName: string;
  dirty: boolean;
  past: Scene[];
  future: Scene[];

  setTool: (t: ToolId) => void;
  setFurnitureKind: (k: FurnitureKind) => void;
  setOpeningKind: (k: OpeningKind) => void;
  setOpeningStyle: (style: string) => void;
  setWallKind: (k: WallKind) => void;
  setSurfaceShape: (s: SurfaceShape) => void;
  setSurfaceMaterial: (id: string | null) => void;
  selectWall: (id: string | null) => void;
  selectFurniture: (id: string) => void;
  selectOpening: (id: string) => void;
  selectSurface: (id: string) => void;
  clearSelection: () => void;
  setMulti: (refs: SelRef[]) => void;
  toggleMulti: (ref: SelRef) => void;

  /** Snapshot de la escena antes de un gesto (para deshacer). */
  pushHistory: () => void;
  setWalls: (walls: Wall[]) => void; // sin historial (arrastre)
  setFurniture: (list: Furniture[]) => void; // sin historial (arrastre)
  setOpenings: (list: Opening[]) => void; // sin historial (arrastre)
  setSurfaces: (list: Surface[]) => void; // sin historial (arrastre)

  addWall: (a: Vec2, b: Vec2) => string | null;
  removeWall: (id: string) => void;
  updateWall: (id: string, patch: Partial<Omit<Wall, "id">>) => void;

  addSurface: (pos: Vec2, size?: { width: number; depth: number }) => string;
  removeSurface: (id: string) => void;
  updateSurface: (id: string, patch: Partial<Omit<Surface, "id">>) => void;

  // Terreno esculpible (heightfield)
  setTerrain: (patch: Partial<Terrain>) => void;
  sculptTerrain: (wx: number, wz: number, radius: number, strength: number, mode: TerrainMode) => void;
  resizeTerrain: (cols: number, rows: number, cell: number) => void;
  resetTerrain: () => void;

  addFurniture: (kind: FurnitureKind, pos: Vec2, rotDeg?: number) => string;
  addFurnitureObject: (f: Furniture) => string;
  removeFurniture: (id: string) => void;
  updateFurniture: (id: string, patch: Partial<Omit<Furniture, "id">>) => void;

  addOpening: (wallId: string, kind: OpeningKind, offset: number) => string;
  removeOpening: (id: string) => void;
  updateOpening: (id: string, patch: Partial<Omit<Opening, "id">>) => void;

  removeSelected: () => void;
  clearAll: () => void;
  applyBatch: (walls: Wall[], furniture: Furniture[], openings?: Opening[]) => void;

  // Feedback, portapapeles y ajuste fino
  toasts: Toast[];
  pushToast: (text: string, kind?: ToastKind) => void;
  removeToast: (id: string) => void;
  clipboard: ClipItem[] | null;
  copySelection: () => void;
  paste: () => void;
  nudgeSelection: (dx: number, dz: number) => void;

  // Pisos / niveles
  setActiveLevel: (i: number) => void;
  addFloor: () => void;
  removeFloor: (i: number) => void;
  renameFloor: (i: number, name: string) => void;
  setFloorElevation: (i: number, elevation: number) => void;
  setFloorAutoSlab: (i: number, on: boolean) => void;

  // Techos (uno por nivel)
  setRoof: (level: number, kind: RoofKind) => void;
  updateRoof: (level: number, patch: Partial<Omit<Roof, "id" | "level">>) => void;
  removeRoof: (level: number) => void;

  // Taller de muebles
  openWorkbench: (base?: Furniture) => void;
  openWorkbenchFromPreset: (kind: FurnitureKind) => void;
  loadPresetBase: (kind: FurnitureKind) => void;
  removeFromLibrary: (libId: string) => void;
  closeWorkbench: () => void;
  loadDraft: (f: Furniture) => void;
  updateDraft: (patch: Partial<Furniture>) => void;
  addComponent: (kind: ComponentKind) => void;
  updateComponent: (id: string, patch: Partial<FurnitureComponent>) => void;
  removeComponent: (id: string) => void;
  selectComponent: (id: string | null) => void;
  saveDraftToPlan: () => void;
  placeCustom: (libId: string) => void;
  // Biblioteca de modelos 3D (.glb) importados
  addModel: (asset: Omit<ModelAsset, "id">) => string;
  removeModel: (id: string) => void;
  placeModel: (id: string) => void;
  // Taller: historial, portapapeles y ajustes finos de componentes
  pushDraftHistory: () => void;
  undoDraft: () => void;
  redoDraft: () => void;
  copyComponent: () => void;
  pasteComponent: () => void;
  duplicateComponent: () => void;
  nudgeComponent: (dx: number, dy: number) => void;
  toggleWorkbenchDims: () => void;

  addMaterial: (mat: Omit<Material, "id">) => string;
  updateMaterial: (id: string, patch: Partial<Omit<Material, "id">>) => void;
  assignMaterialToSelection: (id: string | null) => void;
  setFloorMaterial: (id: string | null) => void;
  setFloorLevelMaterial: (level: number, id: string | null) => void;
  setRender: (patch: Partial<RenderSettings>) => void;
  setPricing: (patch: Partial<Pricing>) => void;

  setGrid: (patch: Partial<GridSettings>) => void;
  setWallDefaults: (patch: Partial<WallDefaults>) => void;
  setProjectName: (name: string) => void;
  markSaved: () => void;

  undo: () => void;
  redo: () => void;

  loadData: (data: ProjectData, name: string) => void;
  exportData: () => ProjectData;
  newProject: () => void;
};

export const useEditor = create<EditorState>((set, get) => ({
  walls: [],
  furniture: [],
  openings: [],
  surfaces: [],
  terrain: { ...makeTerrain(), enabled: false },
  materials: seedMaterials(),
  models: [],
  customLibrary: [],
  floors: [{ name: "Planta baja", elevation: 0 }],
  activeLevel: 0,
  floorMaterialId: undefined,
  roofs: [],
  render: { ...DEFAULT_RENDER },
  pricing: { ...DEFAULT_PRICING },
  tool: "wall",
  furnitureKind: "cabinet-base",
  openingKind: "door",
  openingStyle: "swing",
  wallKind: "solid",
  surfaceShape: "rect",
  surfaceMaterialId: undefined,
  selection: null,
  multi: [],
  workbenchOpen: false,
  draft: null,
  selectedComponentId: null,
  draftPast: [],
  draftFuture: [],
  componentClipboard: null,
  workbenchDims: true,
  toasts: [],
  clipboard: null,
  grid: { cellM: 0.5, snap: true, showGrid: true },
  wallDefaults: { thickness: 0.12, height: 2.5 },
  projectName: "Proyecto sin título",
  dirty: false,
  past: [],
  future: [],

  setTool: (t) =>
    set((s) => ({
      tool: t,
      selection: t === "select" ? s.selection : null,
      multi: t === "select" ? s.multi : [],
    })),
  setFurnitureKind: (k) => set({ furnitureKind: k }),
  setOpeningKind: (k) => set({ openingKind: k, openingStyle: defaultStyle(k) }),
  setOpeningStyle: (style) => set({ openingStyle: style }),
  setWallKind: (k) => set({ wallKind: k }),
  setSurfaceShape: (s) => set({ surfaceShape: s }),
  setSurfaceMaterial: (id) => set({ surfaceMaterialId: id ?? undefined }),
  selectWall: (id) => set({ selection: id ? { kind: "wall", id } : null, multi: [] }),
  selectFurniture: (id) => set({ selection: { kind: "furniture", id }, multi: [] }),
  selectOpening: (id) => set({ selection: { kind: "opening", id }, multi: [] }),
  selectSurface: (id) => set({ selection: { kind: "surface", id }, multi: [] }),
  clearSelection: () => set({ selection: null, multi: [] }),
  setMulti: (refs) => set({ multi: refs, selection: refs[0] ?? null }),
  toggleMulti: (ref) =>
    set((s) => {
      const cur = selectedRefs(s.selection, s.multi);
      const exists = cur.some((m) => refEq(m, ref));
      const next = exists ? cur.filter((m) => !refEq(m, ref)) : [...cur, ref];
      return { multi: next, selection: next[0] ?? null };
    }),

  pushHistory: () =>
    set((s) => ({ past: [...s.past, snapshot(s)].slice(-100), future: [] })),
  setWalls: (walls) => set({ walls, dirty: true }),
  setFurniture: (list) => set({ furniture: list, dirty: true }),
  setOpenings: (list) => set({ openings: list, dirty: true }),
  setSurfaces: (list) => set({ surfaces: list, dirty: true }),

  addWall: (a, b) => {
    if (Math.hypot(b.x - a.x, b.z - a.z) < MIN_LEN) return null;
    const { wallDefaults, wallKind } = get();
    const w: Wall = {
      id: uid(),
      a: { ...a },
      b: { ...b },
      thickness: wallDefaults.thickness,
      height: wallDefaults.height,
      level: get().activeLevel,
      ...(wallKind !== "solid" ? { kind: wallKind } : {}),
    };
    get().pushHistory();
    set((s) => ({ walls: [...s.walls, w], dirty: true }));
    return w.id;
  },
  removeWall: (id) => {
    get().pushHistory();
    set((s) => {
      const removedOpenings = new Set(
        s.openings.filter((o) => o.wallId === id).map((o) => o.id),
      );
      const selCleared =
        (s.selection?.kind === "wall" && s.selection.id === id) ||
        (s.selection?.kind === "opening" && removedOpenings.has(s.selection.id));
      return {
        walls: s.walls.filter((w) => w.id !== id),
        openings: s.openings.filter((o) => o.wallId !== id),
        selection: selCleared ? null : s.selection,
        dirty: true,
      };
    });
  },
  updateWall: (id, patch) => {
    get().pushHistory();
    set((s) => ({
      walls: s.walls.map((w) => (w.id === id ? { ...w, ...patch } : w)),
      dirty: true,
    }));
  },

  addSurface: (pos, size) => {
    const s = makeSurface(pos, size);
    s.level = get().activeLevel;
    const mid = get().surfaceMaterialId;
    if (mid) s.materialId = mid;
    s.shape = get().surfaceShape;
    get().pushHistory();
    set((st) => ({
      surfaces: [...st.surfaces, s],
      selection: { kind: "surface", id: s.id },
      multi: [],
      dirty: true,
    }));
    get().pushToast("Superficie agregada");
    return s.id;
  },
  removeSurface: (id) => {
    get().pushHistory();
    set((s) => ({
      surfaces: s.surfaces.filter((x) => x.id !== id),
      selection: s.selection?.kind === "surface" && s.selection.id === id ? null : s.selection,
      dirty: true,
    }));
  },
  updateSurface: (id, patch) => {
    get().pushHistory();
    set((s) => ({
      surfaces: s.surfaces.map((x) => (x.id === id ? { ...x, ...patch } : x)),
      dirty: true,
    }));
  },

  // --- Terreno esculpible ---
  setTerrain: (patch) => set((s) => ({ terrain: { ...s.terrain, ...patch }, dirty: true })),
  sculptTerrain: (wx, wz, radius, strength, mode) =>
    set((s) => ({
      terrain: { ...s.terrain, enabled: true, heights: sculptHeights(s.terrain, wx, wz, radius, strength, mode) },
      dirty: true,
    })),
  resizeTerrain: (cols, rows, cell) =>
    set((s) => {
      const next = makeTerrain(Math.max(2, Math.round(cols)), Math.max(2, Math.round(rows)), Math.max(0.1, cell));
      return { terrain: { ...next, enabled: s.terrain.enabled, materialId: s.terrain.materialId, color: s.terrain.color }, dirty: true };
    }),
  resetTerrain: () =>
    set((s) => ({ terrain: { ...s.terrain, heights: new Array((s.terrain.cols + 1) * (s.terrain.rows + 1)).fill(0) }, dirty: true })),

  addFurniture: (kind, pos, rotDeg = 0) => {
    const f = makeFurniture(kind, pos, rotDeg);
    f.level = get().activeLevel;
    get().pushHistory();
    set((s) => ({
      furniture: [...s.furniture, f],
      selection: { kind: "furniture", id: f.id },
      dirty: true,
    }));
    get().pushToast("Agregado: " + f.name);
    return f.id;
  },
  addFurnitureObject: (f) => {
    get().pushHistory();
    set((s) => ({ furniture: [...s.furniture, f], dirty: true }));
    return f.id;
  },
  removeFurniture: (id) => {
    get().pushHistory();
    set((s) => ({
      furniture: s.furniture.filter((f) => f.id !== id),
      selection:
        s.selection?.kind === "furniture" && s.selection.id === id
          ? null
          : s.selection,
      dirty: true,
    }));
  },
  updateFurniture: (id, patch) => {
    get().pushHistory();
    set((s) => ({
      furniture: s.furniture.map((f) => (f.id === id ? { ...f, ...patch } : f)),
      dirty: true,
    }));
  },

  addOpening: (wallId, kind, offset) => {
    const o = makeOpening(wallId, kind, offset);
    o.level = get().activeLevel;
    const st = get().openingStyle;
    o.style = OPENING_STYLES[kind].some((x) => x.value === st) ? st : defaultStyle(kind);
    get().pushHistory();
    set((s) => ({
      openings: [...s.openings, o],
      selection: { kind: "opening", id: o.id },
      dirty: true,
    }));
    return o.id;
  },
  removeOpening: (id) => {
    get().pushHistory();
    set((s) => ({
      openings: s.openings.filter((o) => o.id !== id),
      selection:
        s.selection?.kind === "opening" && s.selection.id === id ? null : s.selection,
      dirty: true,
    }));
  },
  updateOpening: (id, patch) => {
    get().pushHistory();
    set((s) => ({
      openings: s.openings.map((o) => (o.id === id ? { ...o, ...patch } : o)),
      dirty: true,
    }));
  },

  removeSelected: () => {
    const s = get();
    const refs = selectedRefs(s.selection, s.multi);
    if (!refs.length) return;
    get().pushHistory();
    const wallIds = new Set(refs.filter((r) => r.kind === "wall").map((r) => r.id));
    const furnIds = new Set(refs.filter((r) => r.kind === "furniture").map((r) => r.id));
    const openIds = new Set(refs.filter((r) => r.kind === "opening").map((r) => r.id));
    const surfIds = new Set(refs.filter((r) => r.kind === "surface").map((r) => r.id));
    set((st) => ({
      walls: st.walls.filter((w) => !wallIds.has(w.id)),
      // las aberturas de un muro borrado se van con él
      openings: st.openings.filter((o) => !openIds.has(o.id) && !wallIds.has(o.wallId)),
      furniture: st.furniture.filter((f) => !furnIds.has(f.id)),
      surfaces: st.surfaces.filter((x) => !surfIds.has(x.id)),
      selection: null,
      multi: [],
      dirty: true,
    }));
    get().pushToast(refs.length > 1 ? `${refs.length} eliminados` : "Eliminado");
  },
  clearAll: () => {
    if (!get().walls.length && !get().furniture.length && !get().openings.length && !get().surfaces.length) return;
    get().pushHistory();
    set({ walls: [], furniture: [], openings: [], surfaces: [], selection: null, multi: [], dirty: true });
  },
  applyBatch: (walls, furniture, openings = []) => {
    if (!walls.length && !furniture.length && !openings.length) return;
    get().pushHistory();
    const lvl = get().activeLevel;
    set((s) => ({
      walls: [...s.walls, ...walls.map((w) => ({ ...w, level: lvl }))],
      furniture: [...s.furniture, ...furniture.map((f) => ({ ...f, level: lvl }))],
      openings: [...s.openings, ...openings.map((o) => ({ ...o, level: lvl }))],
      selection: furniture.length
        ? { kind: "furniture", id: furniture[furniture.length - 1].id }
        : walls.length
          ? { kind: "wall", id: walls[walls.length - 1].id }
          : s.selection,
      dirty: true,
    }));
  },

  pushToast: (text, kind = "info") =>
    set((s) => ({ toasts: [...s.toasts, { id: uid(), text, kind }].slice(-4) })),
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  copySelection: () => {
    const s = get();
    const refs = selectedRefs(s.selection, s.multi);
    if (!refs.length) return;
    const clips: ClipItem[] = [];
    for (const r of refs) {
      if (r.kind === "wall") {
        const w = s.walls.find((x) => x.id === r.id);
        if (w) clips.push({ kind: "wall", data: { ...w, a: { ...w.a }, b: { ...w.b } } });
      } else if (r.kind === "furniture") {
        const f = s.furniture.find((x) => x.id === r.id);
        if (f) clips.push({ kind: "furniture", data: cloneOne(f) });
      } else if (r.kind === "surface") {
        const sf = s.surfaces.find((x) => x.id === r.id);
        if (sf) clips.push({ kind: "surface", data: { ...sf, pos: { ...sf.pos } } });
      } else {
        const o = s.openings.find((x) => x.id === r.id);
        if (o) clips.push({ kind: "opening", data: { ...o } });
      }
    }
    if (clips.length) {
      set({ clipboard: clips });
      get().pushToast(clips.length > 1 ? `${clips.length} copiados` : "Copiado");
    }
  },

  paste: () => {
    const clips = get().clipboard;
    if (!clips || !clips.length) return;
    get().pushHistory();
    const lvl = get().activeLevel;
    const OFF = 0.3;
    const newWalls: Wall[] = [];
    const newFurn: Furniture[] = [];
    const newOpen: Opening[] = [];
    const newSurf: Surface[] = [];
    const refs: SelRef[] = [];
    let skipped = 0;
    for (const c of clips) {
      if (c.kind === "wall") {
        const w = c.data;
        const nw: Wall = {
          ...w, id: uid(), level: lvl,
          a: { x: w.a.x + OFF, z: w.a.z + OFF }, b: { x: w.b.x + OFF, z: w.b.z + OFF },
        };
        newWalls.push(nw);
        refs.push({ kind: "wall", id: nw.id });
      } else if (c.kind === "furniture") {
        const f = c.data;
        const nf: Furniture = { ...cloneOne(f), id: uid(), level: lvl, pos: { x: f.pos.x + OFF, z: f.pos.z + OFF } };
        newFurn.push(nf);
        refs.push({ kind: "furniture", id: nf.id });
      } else if (c.kind === "surface") {
        const sf = c.data;
        const ns: Surface = { ...sf, id: uid(), level: lvl, pos: { x: sf.pos.x + OFF, z: sf.pos.z + OFF } };
        newSurf.push(ns);
        refs.push({ kind: "surface", id: ns.id });
      } else {
        const o = c.data;
        const wall = get().walls.find((w) => w.id === o.wallId);
        if (!wall) { skipped++; continue; }
        const no: Opening = { ...o, id: uid(), level: wall.level ?? 0, offset: o.offset + OFF };
        newOpen.push(no);
        refs.push({ kind: "opening", id: no.id });
      }
    }
    if (!refs.length) {
      get().pushToast("No se pudo pegar (el muro de la abertura ya no existe)", "warn");
      return;
    }
    set((s) => ({
      walls: [...s.walls, ...newWalls],
      furniture: [...s.furniture, ...newFurn],
      openings: [...s.openings, ...newOpen],
      surfaces: [...s.surfaces, ...newSurf],
      selection: refs[0],
      multi: refs.length > 1 ? refs : [],
      dirty: true,
    }));
    get().pushToast(
      refs.length > 1 ? `${refs.length} pegados` : "Pegado",
      skipped ? "warn" : "info",
    );
  },

  nudgeSelection: (dx, dz) => {
    const s0 = get();
    const refs = selectedRefs(s0.selection, s0.multi);
    if (!refs.length) return;
    get().pushHistory();
    const wallIds = new Set(refs.filter((r) => r.kind === "wall").map((r) => r.id));
    const furnIds = new Set(refs.filter((r) => r.kind === "furniture").map((r) => r.id));
    const openIds = new Set(refs.filter((r) => r.kind === "opening").map((r) => r.id));
    const surfIds = new Set(refs.filter((r) => r.kind === "surface").map((r) => r.id));
    if (wallIds.size || furnIds.size || surfIds.size) {
      set((s) => ({
        walls: s.walls.map((w) =>
          wallIds.has(w.id) ? { ...w, a: { x: w.a.x + dx, z: w.a.z + dz }, b: { x: w.b.x + dx, z: w.b.z + dz } } : w,
        ),
        furniture: s.furniture.map((f) => (furnIds.has(f.id) ? { ...f, pos: { x: f.pos.x + dx, z: f.pos.z + dz } } : f)),
        surfaces: s.surfaces.map((x) => (surfIds.has(x.id) ? { ...x, pos: { x: x.pos.x + dx, z: x.pos.z + dz } } : x)),
        dirty: true,
      }));
    }
    if (openIds.size) {
      set((s) => ({
        openings: s.openings.map((o) => (openIds.has(o.id) ? { ...o, offset: Math.max(0, o.offset + dx + dz) } : o)),
        dirty: true,
      }));
    }
  },

  setActiveLevel: (i) =>
    set((s) => ({ activeLevel: Math.max(0, Math.min(s.floors.length - 1, i)), selection: null, multi: [] })),
  addFloor: () => {
    const s = get();
    const top = s.floors[s.floors.length - 1];
    const elevation = Math.round((top.elevation + s.wallDefaults.height + 0.2) * 100) / 100;
    const name = `Piso ${s.floors.length}`;
    set({ floors: [...s.floors, { name, elevation }], activeLevel: s.floors.length, selection: null, multi: [], dirty: true });
    get().pushToast("Piso agregado: " + name);
  },
  removeFloor: (i) => {
    const s = get();
    if (s.floors.length <= 1) {
      get().pushToast("Tiene que haber al menos un piso", "warn");
      return;
    }
    get().pushHistory();
    const reidx = (lvl?: number) => {
      const l = lvl ?? 0;
      return l > i ? l - 1 : l;
    };
    const keep = (lvl?: number) => (lvl ?? 0) !== i;
    const newActive = Math.max(0, Math.min(s.floors.length - 2, s.activeLevel >= i ? s.activeLevel - 1 : s.activeLevel));
    set((st) => ({
      floors: st.floors.filter((_, k) => k !== i),
      walls: st.walls.filter((w) => keep(w.level)).map((w) => ({ ...w, level: reidx(w.level) })),
      furniture: st.furniture.filter((f) => keep(f.level)).map((f) => ({ ...f, level: reidx(f.level) })),
      openings: st.openings.filter((o) => keep(o.level)).map((o) => ({ ...o, level: reidx(o.level) })),
      surfaces: st.surfaces.filter((x) => keep(x.level)).map((x) => ({ ...x, level: reidx(x.level) })),
      roofs: st.roofs.filter((r) => r.level !== i).map((r) => ({ ...r, level: reidx(r.level) })),
      activeLevel: newActive,
      selection: null,
      multi: [],
      dirty: true,
    }));
    get().pushToast("Piso eliminado");
  },
  renameFloor: (i, name) => set((s) => ({ floors: s.floors.map((f, k) => (k === i ? { ...f, name } : f)), dirty: true })),
  setFloorElevation: (i, elevation) =>
    set((s) => ({ floors: s.floors.map((f, k) => (k === i ? { ...f, elevation } : f)), dirty: true })),
  setFloorAutoSlab: (i, on) =>
    set((s) => ({ floors: s.floors.map((f, k) => (k === i ? { ...f, autoSlab: on } : f)), dirty: true })),

  setRoof: (level, kind) => {
    const s = get();
    get().pushHistory();
    // altura de aleros por defecto = tope máximo de los muros del nivel (o 2.5)
    const lvlWalls = s.walls.filter((w) => (w.level ?? 0) === level);
    let h = 2.5;
    for (const w of lvlWalls) h = Math.max(h, w.heightB ?? w.heightA ?? w.height);
    const existing = s.roofs.find((r) => r.level === level);
    const roof: Roof = existing
      ? { ...existing, kind }
      : { id: uid(), level, kind, height: h, rise: 1.2, overhang: 0.3, thickness: 0.12 };
    set((st) => ({
      roofs: [...st.roofs.filter((r) => r.level !== level), roof],
      dirty: true,
    }));
    get().pushToast(`Techo ${kind === "gable" ? "a dos aguas" : kind === "shed" ? "de una caída" : "plano"} en ${s.floors[level]?.name ?? "el piso"}`);
  },
  updateRoof: (level, patch) =>
    set((s) => ({ roofs: s.roofs.map((r) => (r.level === level ? { ...r, ...patch } : r)), dirty: true })),
  removeRoof: (level) =>
    set((s) => ({ roofs: s.roofs.filter((r) => r.level !== level), dirty: true })),

  openWorkbench: (base) =>
    set({
      workbenchOpen: true,
      draft: base ? { ...cloneOne(base), kind: "custom" } : makeCustomFurniture(),
      selectedComponentId: null,
      draftPast: [],
      draftFuture: [],
    }),
  openWorkbenchFromPreset: (kind) =>
    set({
      workbenchOpen: true,
      draft: customFromPreset(kind),
      selectedComponentId: null,
      draftPast: [],
      draftFuture: [],
    }),
  loadPresetBase: (kind) => {
    if (!get().draft) return;
    get().pushDraftHistory();
    set({ draft: customFromPreset(kind), selectedComponentId: null });
  },
  removeFromLibrary: (libId) =>
    set((s) => ({ customLibrary: s.customLibrary.filter((f) => f.id !== libId), dirty: true })),
  closeWorkbench: () =>
    set({ workbenchOpen: false, draft: null, selectedComponentId: null, draftPast: [], draftFuture: [] }),
  loadDraft: (f) => set({ workbenchOpen: true, draft: cloneOne(f), selectedComponentId: null, draftPast: [], draftFuture: [] }),
  updateDraft: (patch) => set((s) => (s.draft ? { draft: { ...s.draft, ...patch } } : {})),
  addComponent: (kind) =>
    set((s) => {
      if (!s.draft) return {};
      const c = makeComponent(kind, s.draft);
      return {
        draft: { ...s.draft, components: [...(s.draft.components ?? []), c] },
        selectedComponentId: c.id,
        draftPast: pushSnap(s.draftPast, cloneOne(s.draft)),
        draftFuture: [],
      };
    }),
  updateComponent: (id, patch) =>
    set((s) =>
      s.draft
        ? {
            draft: {
              ...s.draft,
              components: (s.draft.components ?? []).map((c) =>
                c.id === id ? clampComponent({ ...c, ...patch }, s.draft!.width, s.draft!.height) : c,
              ),
            },
          }
        : {},
    ),
  removeComponent: (id) =>
    set((s) =>
      s.draft
        ? {
            draft: {
              ...s.draft,
              components: (s.draft.components ?? []).filter((c) => c.id !== id),
            },
            selectedComponentId: s.selectedComponentId === id ? null : s.selectedComponentId,
            draftPast: pushSnap(s.draftPast, cloneOne(s.draft)),
            draftFuture: [],
          }
        : {},
    ),
  selectComponent: (id) => set({ selectedComponentId: id }),

  pushDraftHistory: () =>
    set((s) => {
      if (!s.draft) return {};
      const next = pushSnap(s.draftPast, cloneOne(s.draft));
      return next === s.draftPast ? {} : { draftPast: next, draftFuture: [] };
    }),
  undoDraft: () =>
    set((s) => {
      if (!s.draft || !s.draftPast.length) return {};
      const prev = s.draftPast[s.draftPast.length - 1];
      return {
        draft: cloneOne(prev),
        draftPast: s.draftPast.slice(0, -1),
        draftFuture: [cloneOne(s.draft), ...s.draftFuture].slice(0, 50),
      };
    }),
  redoDraft: () =>
    set((s) => {
      if (!s.draft || !s.draftFuture.length) return {};
      const next = s.draftFuture[0];
      return {
        draft: cloneOne(next),
        draftFuture: s.draftFuture.slice(1),
        draftPast: [...s.draftPast, cloneOne(s.draft)].slice(-50),
      };
    }),
  copyComponent: () => {
    const s = get();
    const c = s.draft?.components?.find((x) => x.id === s.selectedComponentId);
    if (c) {
      set({ componentClipboard: { ...c } });
      get().pushToast("Componente copiado");
    }
  },
  pasteComponent: () => {
    const s = get();
    const c = s.componentClipboard;
    if (!s.draft || !c) return;
    get().pushDraftHistory();
    const OFF = 0.05;
    const nx = clampN(c.x + OFF, 0, Math.max(0, s.draft.width - c.w));
    const ny = clampN(c.y + OFF, 0, Math.max(0, s.draft.height - c.h));
    const nc: FurnitureComponent = { ...c, id: uid(), x: nx, y: ny };
    set((st) =>
      st.draft ? { draft: { ...st.draft, components: [...(st.draft.components ?? []), nc] }, selectedComponentId: nc.id } : {},
    );
    get().pushToast("Componente pegado");
  },
  duplicateComponent: () => {
    const s = get();
    const c = s.draft?.components?.find((x) => x.id === s.selectedComponentId);
    if (!s.draft || !c) return;
    get().pushDraftHistory();
    const OFF = 0.05;
    const nx = clampN(c.x + OFF, 0, Math.max(0, s.draft.width - c.w));
    const ny = clampN(c.y + OFF, 0, Math.max(0, s.draft.height - c.h));
    const nc: FurnitureComponent = { ...c, id: uid(), x: nx, y: ny };
    set((st) =>
      st.draft ? { draft: { ...st.draft, components: [...(st.draft.components ?? []), nc] }, selectedComponentId: nc.id } : {},
    );
    get().pushToast("Componente duplicado");
  },
  nudgeComponent: (dx, dy) => {
    const s = get();
    const c = s.draft?.components?.find((x) => x.id === s.selectedComponentId);
    if (!s.draft || !c) return;
    get().pushDraftHistory();
    const nx = clampN(c.x + dx, 0, Math.max(0, s.draft.width - c.w));
    const ny = clampN(c.y + dy, 0, Math.max(0, s.draft.height - c.h));
    set((st) =>
      st.draft
        ? { draft: { ...st.draft, components: (st.draft.components ?? []).map((x) => (x.id === c.id ? { ...x, x: nx, y: ny } : x)) } }
        : {},
    );
  },
  toggleWorkbenchDims: () => set((s) => ({ workbenchDims: !s.workbenchDims })),
  saveDraftToPlan: () => {
    const d = get().draft;
    if (!d) return;
    const template = { ...cloneOne(d), id: uid(), level: undefined };
    const instance = { ...cloneOne(d), id: uid(), pos: { x: 0, z: 0 }, level: get().activeLevel };
    get().pushHistory();
    set((s) => ({
      customLibrary: [...s.customLibrary, template],
      furniture: [...s.furniture, instance],
      selection: { kind: "furniture", id: instance.id },
      multi: [],
      workbenchOpen: false,
      draft: null,
      selectedComponentId: null,
      draftPast: [],
      draftFuture: [],
      dirty: true,
    }));
    get().pushToast("Mueble guardado y colocado");
  },
  placeCustom: (libId) => {
    const lib = get().customLibrary.find((f) => f.id === libId);
    if (!lib) return;
    const instance = { ...cloneOne(lib), id: uid(), pos: { x: 0, z: 0 }, level: get().activeLevel };
    get().pushHistory();
    set((s) => ({
      furniture: [...s.furniture, instance],
      selection: { kind: "furniture", id: instance.id },
      dirty: true,
    }));
    get().pushToast("Colocado: " + instance.name);
  },

  addModel: (asset) => {
    const m: ModelAsset = { id: uid(), ...asset };
    set((s) => ({ models: [...s.models, m], dirty: true }));
    return m.id;
  },
  removeModel: (id) =>
    set((s) => ({ models: s.models.filter((m) => m.id !== id), dirty: true })),
  placeModel: (id) => {
    const m = get().models.find((x) => x.id === id);
    if (!m) return;
    const f: Furniture = {
      id: uid(),
      kind: "model",
      name: m.name,
      pos: { x: 0, z: 0 },
      rotDeg: 0,
      width: m.width,
      depth: m.depth,
      height: m.height,
      panel: 0.018,
      shelves: 0,
      doors: 0,
      baseHeight: 0,
      color: "#9aa3ad",
      modelUrl: m.dataUrl,
      level: get().activeLevel,
    };
    get().pushHistory();
    set((s) => ({
      furniture: [...s.furniture, f],
      selection: { kind: "furniture", id: f.id },
      multi: [],
      dirty: true,
    }));
    get().pushToast("Colocado: " + m.name);
  },

  addMaterial: (mat) => {
    const m: Material = { id: uid(), ...mat };
    set((s) => ({ materials: [...s.materials, m], dirty: true }));
    return m.id;
  },
  updateMaterial: (id, patch) =>
    set((s) => ({
      materials: s.materials.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      dirty: true,
    })),
  assignMaterialToSelection: (id) => {
    const s0 = get();
    const refs = selectedRefs(s0.selection, s0.multi);
    if (!refs.length) return;
    const wallIds = new Set(refs.filter((r) => r.kind === "wall").map((r) => r.id));
    const furnIds = new Set(refs.filter((r) => r.kind === "furniture").map((r) => r.id));
    const surfIds = new Set(refs.filter((r) => r.kind === "surface").map((r) => r.id));
    if (!wallIds.size && !furnIds.size && !surfIds.size) return;
    get().pushHistory();
    set((s) => ({
      walls: s.walls.map((w) => (wallIds.has(w.id) ? { ...w, materialId: id ?? undefined } : w)),
      furniture: s.furniture.map((f) => (furnIds.has(f.id) ? { ...f, materialId: id ?? undefined } : f)),
      surfaces: s.surfaces.map((x) => (surfIds.has(x.id) ? { ...x, materialId: id ?? undefined } : x)),
      dirty: true,
    }));
  },
  setFloorMaterial: (id) => set({ floorMaterialId: id ?? undefined, dirty: true }),
  setFloorLevelMaterial: (level, id) =>
    set((s) => ({
      floors: s.floors.map((f, k) => (k === level ? { ...f, materialId: id ?? undefined } : f)),
      dirty: true,
    })),
  setRender: (patch) => set((s) => ({ render: { ...s.render, ...patch }, dirty: true })),
  setPricing: (patch) => set((s) => ({ pricing: { ...s.pricing, ...patch }, dirty: true })),

  setGrid: (patch) => set((s) => ({ grid: { ...s.grid, ...patch }, dirty: true })),
  setWallDefaults: (patch) =>
    set((s) => ({ wallDefaults: { ...s.wallDefaults, ...patch }, dirty: true })),
  setProjectName: (name) => set({ projectName: name, dirty: true }),
  markSaved: () => set({ dirty: false }),

  undo: () =>
    set((s) => {
      if (!s.past.length) return {};
      const prev = s.past[s.past.length - 1];
      return {
        walls: cloneWalls(prev.walls),
        furniture: cloneFurniture(prev.furniture),
        openings: cloneOpenings(prev.openings),
        surfaces: cloneSurfaces(prev.surfaces),
        past: s.past.slice(0, -1),
        future: [...s.future, snapshot(s)],
        dirty: true,
      };
    }),
  redo: () =>
    set((s) => {
      if (!s.future.length) return {};
      const next = s.future[s.future.length - 1];
      return {
        walls: cloneWalls(next.walls),
        furniture: cloneFurniture(next.furniture),
        openings: cloneOpenings(next.openings),
        surfaces: cloneSurfaces(next.surfaces),
        future: s.future.slice(0, -1),
        past: [...s.past, snapshot(s)],
        dirty: true,
      };
    }),

  loadData: (data, name) =>
    set({
      walls: cloneWalls(data.walls),
      furniture: cloneFurniture(data.furniture ?? []),
      openings: cloneOpenings(data.openings ?? []),
      surfaces: cloneSurfaces(data.surfaces ?? []),
      terrain: data.terrain ? { ...data.terrain, origin: { ...data.terrain.origin }, heights: [...data.terrain.heights] } : { ...makeTerrain(), enabled: false },
      materials: data.materials?.length ? data.materials.map((m) => ({ ...m })) : seedMaterials(),
      models: (data.models ?? []).map((m) => ({ ...m })),
      customLibrary: cloneFurniture(data.customLibrary ?? []),
      floors: data.floors?.length ? data.floors.map((f) => ({ ...f })) : [{ name: "Planta baja", elevation: 0 }],
      activeLevel: data.activeLevel ?? 0,
      floorMaterialId: data.floorMaterialId,
      roofs: (data.roofs ?? []).map((r) => ({ ...r })),
      render: { ...DEFAULT_RENDER, ...(data.render ?? {}) },
      pricing: { ...DEFAULT_PRICING, ...(data.pricing ?? {}) },
      grid: { ...data.grid },
      wallDefaults: { ...data.wallDefaults },
      projectName: name,
      selection: null,
      multi: [],
      workbenchOpen: false,
      draft: null,
      selectedComponentId: null,
      past: [],
      future: [],
      dirty: false,
    }),
  exportData: () => {
    const s = get();
    return {
      walls: cloneWalls(s.walls),
      furniture: cloneFurniture(s.furniture),
      openings: cloneOpenings(s.openings),
      surfaces: cloneSurfaces(s.surfaces),
      terrain: { ...s.terrain, origin: { ...s.terrain.origin }, heights: [...s.terrain.heights] },
      materials: s.materials.map((m) => ({ ...m })),
      models: s.models.map((m) => ({ ...m })),
      customLibrary: cloneFurniture(s.customLibrary),
      floors: s.floors.map((f) => ({ ...f })),
      activeLevel: s.activeLevel,
      floorMaterialId: s.floorMaterialId,
      roofs: s.roofs.map((r) => ({ ...r })),
      render: { ...s.render },
      pricing: { ...s.pricing },
      grid: { ...s.grid },
      wallDefaults: { ...s.wallDefaults },
    };
  },
  newProject: () =>
    set({
      walls: [],
      furniture: [],
      openings: [],
      surfaces: [],
      terrain: { ...makeTerrain(), enabled: false },
      materials: seedMaterials(),
      models: [],
      customLibrary: [],
      floors: [{ name: "Planta baja", elevation: 0 }],
      activeLevel: 0,
      floorMaterialId: undefined,
      roofs: [],
      render: { ...DEFAULT_RENDER },
      pricing: { ...DEFAULT_PRICING },
      selection: null,
      multi: [],
      workbenchOpen: false,
      draft: null,
      selectedComponentId: null,
      projectName: "Proyecto sin título",
      past: [],
      future: [],
      dirty: false,
    }),
}));

// Hook de depuración (solo dev): permite inspeccionar el estado desde la consola.
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __editor: typeof useEditor }).__editor = useEditor;
  (window as unknown as { __carcass: typeof carcassPanels }).__carcass = carcassPanels;
}
