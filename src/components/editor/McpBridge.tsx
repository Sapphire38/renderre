"use client";

import { useEffect } from "react";
import { useEditor } from "@/lib/store";
import { buildScene } from "@/lib/ai-build";
import { saveProject, loadProject, listProjects } from "@/lib/storage";
import type { SceneSpec } from "@/lib/ai-parse";
import type { ComponentKind, Furniture, FurnitureComponent, FurnitureKind, OpeningKind, Vec2, Wall } from "@/lib/types";

type Args = Record<string, unknown>;

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
    counts: {
      walls: s.walls.length,
      furniture: s.furniture.length,
      openings: s.openings.length,
      floors: s.floors.length,
    },
    walls: s.walls.map((w) => ({ id: w.id, a: w.a, b: w.b, thickness: w.thickness, height: w.height, level: w.level ?? 0 })),
    furniture: s.furniture.map((f) => ({
      id: f.id, kind: f.kind, name: f.name, pos: f.pos, rotDeg: f.rotDeg,
      width: f.width, depth: f.depth, height: f.height, color: f.color, level: f.level ?? 0,
      custom: f.kind === "custom",
    })),
    openings: s.openings.map((o) => ({ id: o.id, wallId: o.wallId, kind: o.kind, offset: o.offset, width: o.width, height: o.height, sill: o.sill, level: o.level ?? 0 })),
    materials: s.materials.map((m) => ({ id: m.id, name: m.name })),
    floorMaterialId: s.floorMaterialId,
    customLibrary: s.customLibrary.map((f) => ({ id: f.id, name: f.name })),
    selection: s.selection,
    // --- Taller de muebles (si está abierto) ---
    workbenchOpen: s.workbenchOpen,
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
          components: (s.draft.components ?? []).map((c) => ({
            id: c.id, kind: c.kind, x: c.x, y: c.y, w: c.w, h: c.h,
            depth: c.depth, depthInset: c.depthInset, count: c.count,
            hinge: c.hinge, orient: c.orient, color: c.color, materialId: c.materialId, open: c.open,
          })),
        }
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
      if (id && (args.thickness !== undefined || args.height !== undefined)) {
        st.updateWall(id, {
          ...(args.thickness !== undefined ? { thickness: num(args.thickness)! } : {}),
          ...(args.height !== undefined ? { height: num(args.height)! } : {}),
        });
      }
      break;
    }
    case "add_furniture": {
      const kind = String(args.kind ?? "module") as FurnitureKind;
      const pos = vec(args.pos) ?? { x: num(args.x) ?? 0, z: num(args.z) ?? 0 };
      const id = st.addFurniture(kind, pos, num(args.rotDeg) ?? 0);
      const patch: Record<string, number | string> = {};
      for (const k of ["width", "depth", "height", "doors", "shelves", "baseHeight"] as const) {
        if (args[k] !== undefined) patch[k] = num(args[k])!;
      }
      if (typeof args.color === "string") patch.color = args.color;
      if (typeof args.name === "string") patch.name = args.name;
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
      const patch: Record<string, number> = {};
      for (const k of ["width", "height", "sill"] as const) if (args[k] !== undefined) patch[k] = num(args[k])!;
      if (id && Object.keys(patch).length) st.updateOpening(id, patch);
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
      break;
    }

    // --- editar / borrar elementos existentes por id ---
    case "update_furniture": {
      const id = String(args.id ?? "");
      const f = useEditor.getState().furniture.find((x) => x.id === id);
      if (!f) break;
      const patch: Record<string, unknown> = {};
      if (args.x !== undefined || args.z !== undefined) patch.pos = { x: num(args.x) ?? f.pos.x, z: num(args.z) ?? f.pos.z };
      for (const k of ["rotDeg", "width", "depth", "height", "doors", "shelves", "baseHeight"] as const) {
        if (args[k] !== undefined) patch[k] = num(args[k]);
      }
      if (typeof args.color === "string") patch.color = args.color;
      if (typeof args.name === "string") patch.name = args.name;
      if ("materialId" in args) patch.materialId = args.materialId == null ? undefined : String(args.materialId);
      st.updateFurniture(id, patch as Partial<Omit<Furniture, "id">>);
      break;
    }
    case "update_wall": {
      const id = String(args.id ?? "");
      const patch: Record<string, unknown> = {};
      for (const k of ["thickness", "height"] as const) if (args[k] !== undefined) patch[k] = num(args[k]);
      if ("materialId" in args) patch.materialId = args.materialId == null ? undefined : String(args.materialId);
      st.updateWall(id, patch as Partial<Omit<Wall, "id">>);
      break;
    }
    case "delete": {
      const id = String(args.id ?? "");
      const kind = String(args.kind ?? "furniture");
      if (kind === "wall") st.removeWall(id);
      else if (kind === "opening") st.removeOpening(id);
      else st.removeFurniture(id);
      break;
    }
    case "set_floor_material":
      st.setFloorMaterial(args.materialId == null ? null : String(args.materialId));
      break;
    case "place_custom": {
      const lib = useEditor.getState().customLibrary;
      let libId = typeof args.libId === "string" ? args.libId : undefined;
      if (!libId && typeof args.name === "string") libId = lib.find((f) => f.name === args.name)?.id;
      if (libId) st.placeCustom(libId);
      else st.pushToast("No encontré ese mueble guardado", "warn");
      break;
    }

    // --- Taller de muebles a medida ---
    case "open_workbench": {
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
