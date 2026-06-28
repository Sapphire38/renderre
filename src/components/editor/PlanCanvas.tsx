"use client";

import { useCallback, useEffect, useRef } from "react";
import { useEditor, selectedRefs } from "@/lib/store";
import { isTypingTarget } from "@/lib/dom";
import {
  angleDeg,
  dist,
  formatLen,
  nearestEndpoint,
  orthoLock,
  pickWall,
  snapToGrid,
  totalLength,
  wallLength,
  wallsBounds,
} from "@/lib/geometry";
import {
  footprintCorners,
  localToWorld,
  pickFurniture,
  presetFor,
} from "@/lib/furniture";
import { offsetOnWall, openingFrame, pickOpening } from "@/lib/openings";
import type {
  Furniture,
  GridSettings,
  Opening,
  SelRef,
  Selection,
  ToolId,
  Vec2,
  Wall,
} from "@/lib/types";

const PX_PER_M = 40; // píxeles por metro a zoom 1

type View = { panX: number; panY: number; zoom: number };
type SnapKind = "endpoint" | "grid" | "free";
type Snap = { point: Vec2; kind: SnapKind };

type Gesture =
  | { type: "pan"; startSx: number; startSy: number; startPanX: number; startPanY: number }
  | { type: "move-endpoint"; wallId: string; which: "a" | "b"; committed: boolean }
  | { type: "move-wall"; wallId: string; committed: boolean; startWorld: Vec2; orig: { a: Vec2; b: Vec2 } }
  | { type: "move-furniture"; id: string; committed: boolean; startWorld: Vec2; orig: Vec2 }
  | { type: "resize-furniture"; id: string; committed: boolean; anchor: Vec2; ang: number }
  | { type: "rotate-furniture"; id: string; committed: boolean }
  | { type: "move-opening"; id: string; committed: boolean }
  | { type: "marquee"; startWorld: Vec2; startSx: number; startSy: number; additive: boolean }
  | {
      type: "move-group";
      committed: boolean;
      startWorld: Vec2;
      origW: Record<string, { a: Vec2; b: Vec2 }>;
      origF: Record<string, Vec2>;
    };

const selKey = (r: SelRef) => `${r.kind}:${r.id}`;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const norm360 = (d: number) => ((d % 360) + 360) % 360;

export default function PlanCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const viewRef = useRef<View>({ panX: 0, panY: 0, zoom: 1 });
  const sizeRef = useRef({ w: 0, h: 0 });
  const initRef = useRef(false);
  const rafRef = useRef(0);
  const draftStartRef = useRef<Vec2 | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const snapRef = useRef<Snap | null>(null);
  const cursorScreenRef = useRef<{ x: number; y: number } | null>(null);
  const spaceRef = useRef(false);

  const propsRef = useRef<{
    walls: Wall[];
    furniture: Furniture[];
    openings: Opening[];
    grid: GridSettings;
    selection: Selection;
    multi: SelRef[];
    tool: ToolId;
    furnitureKind: string;
    activeLevel: number;
  }>({
    walls: [],
    furniture: [],
    openings: [],
    grid: { cellM: 0.5, snap: true, showGrid: true },
    selection: null,
    multi: [],
    tool: "wall",
    furnitureKind: "cabinet-base",
    activeLevel: 0,
  });

  const walls = useEditor((s) => s.walls);
  const furniture = useEditor((s) => s.furniture);
  const openings = useEditor((s) => s.openings);
  const grid = useEditor((s) => s.grid);
  const selection = useEditor((s) => s.selection);
  const multi = useEditor((s) => s.multi);
  const tool = useEditor((s) => s.tool);
  const furnitureKind = useEditor((s) => s.furnitureKind);
  const activeLevel = useEditor((s) => s.activeLevel);
  propsRef.current = { walls, furniture, openings, grid, selection, multi, tool, furnitureKind, activeLevel };

  const scale = () => PX_PER_M * viewRef.current.zoom;
  const worldToScreen = (p: Vec2) => {
    const v = viewRef.current;
    const s = PX_PER_M * v.zoom;
    return { x: v.panX + p.x * s, y: v.panY + p.z * s };
  };
  const screenToWorld = (sx: number, sy: number): Vec2 => {
    const v = viewRef.current;
    const s = PX_PER_M * v.zoom;
    return { x: (sx - v.panX) / s, z: (sy - v.panY) / s };
  };

  const computeSnap = (world: Vec2): Snap => {
    const st = useEditor.getState();
    const tol = 10 / scale();
    const g = gestureRef.current;
    const exclude = g && g.type === "move-endpoint" ? g.wallId : undefined;
    const lvlWalls = st.walls.filter((w) => (w.level ?? 0) === st.activeLevel);
    const ep = nearestEndpoint(lvlWalls, world, tol, exclude);
    if (ep) return { point: ep, kind: "endpoint" };
    if (st.grid.snap) return { point: snapToGrid(world, st.grid.cellM), kind: "grid" };
    return { point: world, kind: "free" };
  };

  // Punto-mundo del tirador de rotación de un mueble (al frente, hacia afuera).
  const rotateHandle = (f: Furniture): Vec2 => localToWorld(f, 0, -(f.depth / 2 + 0.3));

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    if (w === 0 || h === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const bw = Math.round(w * dpr);
    const bh = Math.round(h * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0b0e14";
    ctx.fillRect(0, 0, w, h);

    const v = viewRef.current;
    const s = PX_PER_M * v.zoom;
    const { walls: allW, furniture: allF, openings: allO, grid, selection, multi, tool, furnitureKind, activeLevel } =
      propsRef.current;
    const walls = allW.filter((wl) => (wl.level ?? 0) === activeLevel);
    const furniture = allF.filter((f) => (f.level ?? 0) === activeLevel);
    const openings = allO.filter((o) => (o.level ?? 0) === activeLevel);
    const sel = new Set(selectedRefs(selection, multi).map(selKey));

    if (grid.showGrid) drawGrid(ctx, w, h, v, s, grid.cellM);
    drawAxes(ctx, v, w, h);

    for (const wl of walls) {
      drawWall(ctx, wl, v, s, sel.has(`wall:${wl.id}`));
    }
    for (const o of openings) {
      const w = walls.find((x) => x.id === o.wallId);
      if (w) drawOpening(ctx, w, o, v, s, sel.has(`opening:${o.id}`));
    }
    for (const f of furniture) {
      drawFurniture(ctx, f, v, s, sel.has(`furniture:${f.id}`));
    }

    const start = draftStartRef.current;
    const snap = snapRef.current;
    if (tool === "wall" && start && snap) drawDraft(ctx, start, snap.point, v, s);
    if (snap && tool === "wall") drawSnapMark(ctx, snap, v, s);
    if (tool === "furniture" && snap) drawFurniturePreview(ctx, furnitureKind, snap.point, v, s);

    const g = gestureRef.current;
    const cur = cursorScreenRef.current;

    // guías de distancia/alineación al arrastrar
    if (g && (g.type === "move-furniture" || g.type === "move-wall" || g.type === "move-group")) {
      const dragged = new Set<string>();
      let dragB: B | null = null;
      if (g.type === "move-furniture") {
        const f = furniture.find((x) => x.id === g.id);
        if (f) { dragB = aabbOf(footprintCorners(f)); dragged.add(`f:${g.id}`); }
      } else if (g.type === "move-wall") {
        const wl = walls.find((x) => x.id === g.wallId);
        if (wl) { dragB = wallAabb(wl); dragged.add(`w:${g.wallId}`); }
      } else {
        const boxes: B[] = [];
        for (const id of Object.keys(g.origF)) {
          const f = furniture.find((x) => x.id === id);
          if (f) { boxes.push(aabbOf(footprintCorners(f))); dragged.add(`f:${id}`); }
        }
        for (const id of Object.keys(g.origW)) {
          const wl = walls.find((x) => x.id === id);
          if (wl) { boxes.push(wallAabb(wl)); dragged.add(`w:${id}`); }
        }
        dragB = boxes.length ? boxes.reduce((a, b) => mergeBounds(a, b)!) : null;
      }
      if (dragB) {
        const others: B[] = [];
        for (const f of furniture) if (!dragged.has(`f:${f.id}`)) others.push(aabbOf(footprintCorners(f)));
        for (const wl of walls) if (!dragged.has(`w:${wl.id}`)) others.push(wallAabb(wl));
        drawDragGuides(ctx, v, s, w, h, dragB, others);
      }
    }

    if (g && g.type === "marquee" && cur) {
      const a = worldToScreen(g.startWorld);
      drawMarquee(ctx, a.x, a.y, cur.x, cur.y);
    }

    drawHud(ctx, w, h, v, s, tool, walls, furniture, cursorScreenRef.current, sel.size);
  }, []);

  const schedule = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      draw();
    });
  }, [draw]);

  useEffect(() => {
    if (tool !== "wall") draftStartRef.current = null;
    schedule();
  }, [walls, furniture, openings, grid, selection, multi, tool, furnitureKind, activeLevel, schedule]);

  useEffect(() => {
    const el = containerRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;

    const rect0 = el.getBoundingClientRect();
    if (rect0.width > 0 && rect0.height > 0) {
      sizeRef.current = { w: rect0.width, h: rect0.height };
      if (!initRef.current) {
        viewRef.current = { panX: rect0.width / 2, panY: rect0.height / 2, zoom: 1 };
        initRef.current = true;
      }
    }

    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      const prev = sizeRef.current;
      sizeRef.current = { w: cr.width, h: cr.height };
      if (!initRef.current && cr.width > 0) {
        viewRef.current = { panX: cr.width / 2, panY: cr.height / 2, zoom: 1 };
        initRef.current = true;
      } else if (prev.w > 0 && cr.width > 0) {
        viewRef.current = {
          ...viewRef.current,
          panX: viewRef.current.panX + (cr.width - prev.w) / 2,
          panY: viewRef.current.panY + (cr.height - prev.h) / 2,
        };
      }
      schedule();
    });
    ro.observe(el);

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const v = viewRef.current;
      const factor = Math.exp(-e.deltaY * 0.0015);
      const newZoom = clamp(v.zoom * factor, 0.05, 40);
      const sBefore = PX_PER_M * v.zoom;
      const sAfter = PX_PER_M * newZoom;
      const wx = (mx - v.panX) / sBefore;
      const wz = (my - v.panY) / sBefore;
      viewRef.current = { panX: mx - wx * sAfter, panY: my - wz * sAfter, zoom: newZoom };
      schedule();
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });

    const onFit = () => {
      const st = useEditor.getState();
      const { w, h } = sizeRef.current;
      const lvlWalls = st.walls.filter((x) => (x.level ?? 0) === st.activeLevel);
      const lvlFurn = st.furniture.filter((x) => (x.level ?? 0) === st.activeLevel);
      const extra: Vec2[] = lvlFurn.flatMap((f) => footprintCorners(f));
      const b = wallsBounds(lvlWalls) ?? boundsOf(extra);
      const all = mergeBounds(b, boundsOf(extra));
      if (!all) {
        viewRef.current = { panX: w / 2, panY: h / 2, zoom: 1 };
        schedule();
        return;
      }
      const pad = 56;
      const bw = Math.max(all.maxX - all.minX, 1);
      const bh = Math.max(all.maxZ - all.minZ, 1);
      const zoom = clamp(
        Math.min((w - 2 * pad) / (bw * PX_PER_M), (h - 2 * pad) / (bh * PX_PER_M)),
        0.05,
        40,
      );
      const cx = (all.minX + all.maxX) / 2;
      const cz = (all.minZ + all.maxZ) / 2;
      const s = PX_PER_M * zoom;
      viewRef.current = { panX: w / 2 - cx * s, panY: h / 2 - cz * s, zoom };
      schedule();
    };
    window.addEventListener("renderre:fit", onFit);

    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const st = useEditor.getState();
      if (st.workbenchOpen) return; // el Taller maneja sus propios atajos
      const meta = e.ctrlKey || e.metaKey;
      if (meta && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
        return;
      }
      if (meta && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        st.redo();
        return;
      }
      if (meta && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        st.copySelection();
        return;
      }
      if (meta && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        st.paste();
        schedule();
        return;
      }
      if (e.key.startsWith("Arrow")) {
        if (st.selection) {
          e.preventDefault();
          const step = e.shiftKey ? 0.1 : 0.01;
          const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          const dz = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
          st.nudgeSelection(dx, dz);
          schedule();
        }
        return;
      }
      if (e.key === "Escape") {
        draftStartRef.current = null;
        st.clearSelection();
        schedule();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (st.selection) {
          e.preventDefault();
          st.removeSelected();
        }
        return;
      }
      if (e.key === "r" || e.key === "R") {
        if (st.selection?.kind === "furniture") {
          const id = st.selection.id;
          st.pushHistory();
          st.setFurniture(
            st.furniture.map((f) => (f.id === id ? { ...f, rotDeg: norm360(f.rotDeg + 90) } : f)),
          );
        }
        return;
      }
      if (e.key === " ") {
        spaceRef.current = true;
        e.preventDefault();
        return;
      }
      if (e.key === "v" || e.key === "V") st.setTool("select");
      else if (e.key === "w" || e.key === "W") st.setTool("wall");
      else if (e.key === "f" || e.key === "F") st.setTool("furniture");
      else if (e.key === "o" || e.key === "O") st.setTool("opening");
      else if (e.key === "h" || e.key === "H") st.setTool("pan");
      else if (e.key === "g" || e.key === "G") st.setGrid({ showGrid: !st.grid.showGrid });
      else if (e.key === "m" || e.key === "M") st.setGrid({ snap: !st.grid.snap });
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") spaceRef.current = false;
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);

    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __plan: unknown }).__plan = {
        view: () => ({ ...viewRef.current }),
        size: () => ({ ...sizeRef.current }),
        s2w: (sx: number, sy: number) => screenToWorld(sx, sy),
        w2s: (p: Vec2) => worldToScreen(p),
      };
    }

    schedule();

    return () => {
      ro.disconnect();
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("renderre:fit", onFit);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [schedule]);

  const getPointer = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* pointerId sintético */
    }
    const { sx, sy } = getPointer(e);
    cursorScreenRef.current = { x: sx, y: sy };
    const st = useEditor.getState();
    const world = screenToWorld(sx, sy);
    const onLvl = <T extends { level?: number }>(arr: T[]) => arr.filter((x) => (x.level ?? 0) === st.activeLevel);

    if (e.button === 1 || e.button === 2 || st.tool === "pan" || spaceRef.current) {
      const v = viewRef.current;
      gestureRef.current = { type: "pan", startSx: sx, startSy: sy, startPanX: v.panX, startPanY: v.panY };
      return;
    }
    if (e.button !== 0) return;

    if (st.tool === "wall") {
      const snap = computeSnap(world);
      let p = snap.point;
      if (e.shiftKey && draftStartRef.current) p = orthoLock(draftStartRef.current, p);
      if (!draftStartRef.current) draftStartRef.current = { ...p };
      else {
        st.addWall(draftStartRef.current, p);
        draftStartRef.current = { ...p };
      }
      snapRef.current = { point: p, kind: snap.kind };
      schedule();
      return;
    }

    if (st.tool === "furniture") {
      const snap = computeSnap(world);
      st.addFurniture(st.furnitureKind, snap.point);
      schedule();
      return;
    }

    if (st.tool === "opening") {
      const w = pickWall(onLvl(st.walls), world, Math.max(0.5, 16 / scale()));
      if (w) st.addOpening(w.id, st.openingKind, offsetOnWall(w, world));
      schedule();
      return;
    }

    if (st.tool === "select") {
      const tol = 9 / scale();
      const refs = selectedRefs(st.selection, st.multi);
      const single = refs.length <= 1;

      // tiradores: sólo con un único elemento seleccionado
      if (single && st.selection?.kind === "furniture") {
        const f = st.furniture.find((x) => x.id === st.selection!.id);
        if (f) {
          // esquinas → redimensionar (vértice opuesto = ancla)
          const cn = footprintCorners(f);
          for (let i = 0; i < 4; i++) {
            if (Math.hypot(world.x - cn[i].x, world.z - cn[i].z) < Math.max(10 / scale(), 0.08)) {
              gestureRef.current = {
                type: "resize-furniture",
                id: f.id,
                committed: false,
                anchor: { ...cn[(i + 2) % 4] },
                ang: (f.rotDeg * Math.PI) / 180,
              };
              return;
            }
          }
          const rh = rotateHandle(f);
          if (Math.hypot(world.x - rh.x, world.z - rh.z) < Math.max(12 / scale(), 0.15)) {
            gestureRef.current = { type: "rotate-furniture", id: f.id, committed: false };
            return;
          }
        }
      }
      if (single && st.selection?.kind === "wall") {
        const w = st.walls.find((x) => x.id === st.selection!.id);
        if (w) {
          for (const which of ["a", "b"] as const) {
            const ep = w[which];
            if (Math.hypot(world.x - ep.x, world.z - ep.z) < Math.max(tol, 0.05)) {
              gestureRef.current = { type: "move-endpoint", wallId: w.id, which, committed: false };
              return;
            }
          }
        }
      }

      // ¿qué hay bajo el cursor? muebles primero (encima), luego aberturas, luego muros
      const pf = pickFurniture(onLvl(st.furniture), world);
      const po = pf ? null : pickOpening(onLvl(st.openings), (id) => st.walls.find((x) => x.id === id), world, Math.max(tol, 12 / scale()));
      const pw = pf || po ? null : pickWall(onLvl(st.walls), world, tol);
      const hit: SelRef | null = pf
        ? { kind: "furniture", id: pf.id }
        : po
          ? { kind: "opening", id: po.id }
          : pw
            ? { kind: "wall", id: pw.id }
            : null;

      // Shift+clic: alternar pertenencia al conjunto (sin arrastrar)
      if (e.shiftKey) {
        if (hit) {
          st.toggleMulti(hit);
          schedule();
        }
        return;
      }

      const inSel = !!hit && refs.some((r) => r.kind === hit.kind && r.id === hit.id);

      // clic sobre un elemento que ya es parte de una selección múltiple -> mover el grupo
      if (hit && inSel && refs.length > 1) {
        const origW: Record<string, { a: Vec2; b: Vec2 }> = {};
        const origF: Record<string, Vec2> = {};
        for (const r of refs) {
          if (r.kind === "wall") {
            const w = st.walls.find((x) => x.id === r.id);
            if (w) origW[w.id] = { a: { ...w.a }, b: { ...w.b } };
          } else if (r.kind === "furniture") {
            const f = st.furniture.find((x) => x.id === r.id);
            if (f) origF[f.id] = { ...f.pos };
          }
        }
        gestureRef.current = { type: "move-group", committed: false, startWorld: world, origW, origF };
        return;
      }

      if (pf) {
        st.selectFurniture(pf.id);
        gestureRef.current = { type: "move-furniture", id: pf.id, committed: false, startWorld: world, orig: { ...pf.pos } };
        schedule();
        return;
      }
      if (po) {
        st.selectOpening(po.id);
        gestureRef.current = { type: "move-opening", id: po.id, committed: false };
        schedule();
        return;
      }
      if (pw) {
        st.selectWall(pw.id);
        gestureRef.current = {
          type: "move-wall",
          wallId: pw.id,
          committed: false,
          startWorld: world,
          orig: { a: { ...pw.a }, b: { ...pw.b } },
        };
        schedule();
        return;
      }

      // espacio vacío -> marco de selección (rubber-band)
      gestureRef.current = { type: "marquee", startWorld: world, startSx: sx, startSy: sy, additive: e.shiftKey };
      schedule();
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const { sx, sy } = getPointer(e);
    cursorScreenRef.current = { x: sx, y: sy };
    const st = useEditor.getState();
    const world = screenToWorld(sx, sy);
    const g = gestureRef.current;

    if (g && g.type === "pan") {
      const v = viewRef.current;
      viewRef.current = { ...v, panX: g.startPanX + (sx - g.startSx), panY: g.startPanY + (sy - g.startSy) };
      schedule();
      return;
    }

    if (g && g.type === "move-endpoint") {
      if (!g.committed) {
        st.pushHistory();
        g.committed = true;
      }
      const snap = computeSnap(world);
      st.setWalls(st.walls.map((w) => (w.id === g.wallId ? { ...w, [g.which]: { ...snap.point } } : w)));
      snapRef.current = snap;
      schedule();
      return;
    }

    if (g && g.type === "move-wall") {
      if (!g.committed) {
        st.pushHistory();
        g.committed = true;
      }
      let dx = world.x - g.startWorld.x;
      let dz = world.z - g.startWorld.z;
      if (st.grid.snap) {
        dx = Math.round(dx / st.grid.cellM) * st.grid.cellM;
        dz = Math.round(dz / st.grid.cellM) * st.grid.cellM;
      }
      st.setWalls(
        st.walls.map((w) =>
          w.id === g.wallId
            ? { ...w, a: { x: g.orig.a.x + dx, z: g.orig.a.z + dz }, b: { x: g.orig.b.x + dx, z: g.orig.b.z + dz } }
            : w,
        ),
      );
      schedule();
      return;
    }

    if (g && g.type === "move-furniture") {
      if (!g.committed) {
        st.pushHistory();
        g.committed = true;
      }
      let dx = world.x - g.startWorld.x;
      let dz = world.z - g.startWorld.z;
      if (st.grid.snap) {
        dx = Math.round(dx / st.grid.cellM) * st.grid.cellM;
        dz = Math.round(dz / st.grid.cellM) * st.grid.cellM;
      }
      st.setFurniture(
        st.furniture.map((f) => (f.id === g.id ? { ...f, pos: { x: g.orig.x + dx, z: g.orig.z + dz } } : f)),
      );
      schedule();
      return;
    }

    if (g && g.type === "resize-furniture") {
      if (!g.committed) {
        st.pushHistory();
        g.committed = true;
      }
      // vector ancla→cursor en el marco local del mueble (rotar por -ang)
      const c = Math.cos(-g.ang);
      const sn = Math.sin(-g.ang);
      const dxw = world.x - g.anchor.x;
      const dzw = world.z - g.anchor.z;
      let du = dxw * c - dzw * sn; // a lo ancho (X local)
      let dv = dxw * sn + dzw * c; // en profundidad (Z local)
      if (st.grid.snap) {
        du = Math.sign(du) * Math.max(st.grid.cellM, Math.round(Math.abs(du) / st.grid.cellM) * st.grid.cellM);
        dv = Math.sign(dv) * Math.max(st.grid.cellM, Math.round(Math.abs(dv) / st.grid.cellM) * st.grid.cellM);
      }
      const w = Math.max(0.05, Math.abs(du));
      const d = Math.max(0.05, Math.abs(dv));
      const su = du < 0 ? -1 : 1;
      const sv = dv < 0 ? -1 : 1;
      // centro = ancla + mitad del vector (en mundo)
      const ca = Math.cos(g.ang);
      const sa = Math.sin(g.ang);
      const halfU = (su * w) / 2;
      const halfV = (sv * d) / 2;
      const cx = g.anchor.x + halfU * ca - halfV * sa;
      const cz = g.anchor.z + halfU * sa + halfV * ca;
      st.setFurniture(
        st.furniture.map((x) => (x.id === g.id ? { ...x, width: w, depth: d, pos: { x: cx, z: cz } } : x)),
      );
      schedule();
      return;
    }

    if (g && g.type === "rotate-furniture") {
      if (!g.committed) {
        st.pushHistory();
        g.committed = true;
      }
      const f = st.furniture.find((x) => x.id === g.id);
      if (f) {
        const ang = (Math.atan2(world.z - f.pos.z, world.x - f.pos.x) * 180) / Math.PI + 90;
        let deg = norm360(ang);
        if (e.shiftKey) deg = norm360(Math.round(deg / 15) * 15);
        else deg = Math.round(deg);
        st.setFurniture(st.furniture.map((x) => (x.id === g.id ? { ...x, rotDeg: deg } : x)));
      }
      schedule();
      return;
    }

    if (g && g.type === "move-opening") {
      if (!g.committed) {
        st.pushHistory();
        g.committed = true;
      }
      const op = st.openings.find((o) => o.id === g.id);
      const w = op && st.walls.find((x) => x.id === op.wallId);
      if (op && w) {
        const off = offsetOnWall(w, world);
        st.setOpenings(st.openings.map((o) => (o.id === g.id ? { ...o, offset: off } : o)));
      }
      schedule();
      return;
    }

    if (g && g.type === "move-group") {
      if (!g.committed) {
        st.pushHistory();
        g.committed = true;
      }
      let dx = world.x - g.startWorld.x;
      let dz = world.z - g.startWorld.z;
      if (st.grid.snap) {
        dx = Math.round(dx / st.grid.cellM) * st.grid.cellM;
        dz = Math.round(dz / st.grid.cellM) * st.grid.cellM;
      }
      st.setWalls(
        st.walls.map((w) => {
          const o = g.origW[w.id];
          return o ? { ...w, a: { x: o.a.x + dx, z: o.a.z + dz }, b: { x: o.b.x + dx, z: o.b.z + dz } } : w;
        }),
      );
      st.setFurniture(
        st.furniture.map((f) => {
          const o = g.origF[f.id];
          return o ? { ...f, pos: { x: o.x + dx, z: o.z + dz } } : f;
        }),
      );
      schedule();
      return;
    }

    if (g && g.type === "marquee") {
      schedule(); // sólo redibuja el rectángulo
      return;
    }

    // hover sin gesto
    if (st.tool === "wall" || st.tool === "furniture") {
      const snap = computeSnap(world);
      let p = snap.point;
      if (st.tool === "wall" && e.shiftKey && draftStartRef.current) p = orthoLock(draftStartRef.current, p);
      snapRef.current = { point: p, kind: snap.kind };
    } else {
      snapRef.current = null;
    }
    schedule();
  };

  const endGesture = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    try {
      if (canvas && canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const g = gestureRef.current;
    if (g && g.type === "marquee") {
      const { sx, sy } = getPointer(e);
      const st = useEditor.getState();
      const movedPx = Math.hypot(sx - g.startSx, sy - g.startSy);
      if (movedPx < 4) {
        // fue un clic en vacío, no un arrastre -> limpiar selección
        if (!g.additive) st.clearSelection();
      } else {
        const end = screenToWorld(sx, sy);
        const r = {
          minX: Math.min(g.startWorld.x, end.x),
          maxX: Math.max(g.startWorld.x, end.x),
          minZ: Math.min(g.startWorld.z, end.z),
          maxZ: Math.max(g.startWorld.z, end.z),
        };
        const lvl = st.activeLevel;
        const found: SelRef[] = [];
        for (const f of st.furniture) {
          if ((f.level ?? 0) !== lvl) continue;
          if (rectIntersectsAabb(r, aabbOf(footprintCorners(f)))) found.push({ kind: "furniture", id: f.id });
        }
        for (const w of st.walls) {
          if ((w.level ?? 0) !== lvl) continue;
          if (segIntersectsRect(w.a, w.b, r)) found.push({ kind: "wall", id: w.id });
        }
        for (const o of st.openings) {
          if ((o.level ?? 0) !== lvl) continue;
          const wall = st.walls.find((x) => x.id === o.wallId);
          if (wall && pointInRect(openingFrame(wall, o).center, r)) found.push({ kind: "opening", id: o.id });
        }
        if (g.additive) {
          const prev = selectedRefs(st.selection, st.multi);
          const merged = [...prev];
          for (const r2 of found) if (!merged.some((m) => m.kind === r2.kind && m.id === r2.id)) merged.push(r2);
          st.setMulti(merged);
        } else {
          st.setMulti(found);
        }
      }
      gestureRef.current = null;
      schedule();
      return;
    }
    gestureRef.current = null;
  };

  const onPointerLeave = () => {
    if (!gestureRef.current) {
      cursorScreenRef.current = null;
      snapRef.current = null;
      schedule();
    }
  };

  const cursor =
    tool === "wall" || tool === "furniture" || tool === "opening"
      ? "crosshair"
      : tool === "pan"
        ? "grab"
        : "default";

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        style={{ touchAction: "none", cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        onPointerLeave={onPointerLeave}
        onDoubleClick={() => {
          draftStartRef.current = null;
          schedule();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          draftStartRef.current = null;
          schedule();
        }}
      />
    </div>
  );
}

// ============================ helpers de dibujo ============================

type B = { minX: number; minZ: number; maxX: number; maxZ: number };
function boundsOf(pts: Vec2[]): B | null {
  if (!pts.length) return null;
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minZ = Math.min(minZ, p.z);
    maxX = Math.max(maxX, p.x);
    maxZ = Math.max(maxZ, p.z);
  }
  return { minX, minZ, maxX, maxZ };
}
function mergeBounds(a: B | null, b: B | null): B | null {
  if (!a) return b;
  if (!b) return a;
  return {
    minX: Math.min(a.minX, b.minX),
    minZ: Math.min(a.minZ, b.minZ),
    maxX: Math.max(a.maxX, b.maxX),
    maxZ: Math.max(a.maxZ, b.maxZ),
  };
}

// --- hit-tests para el marco de selección ---
function aabbOf(pts: Vec2[]): B {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minZ = Math.min(minZ, p.z);
    maxX = Math.max(maxX, p.x);
    maxZ = Math.max(maxZ, p.z);
  }
  return { minX, minZ, maxX, maxZ };
}
function rectIntersectsAabb(r: B, a: B): boolean {
  return !(a.maxX < r.minX || a.minX > r.maxX || a.maxZ < r.minZ || a.minZ > r.maxZ);
}
function pointInRect(p: Vec2, r: B): boolean {
  return p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ;
}
function segSeg(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): boolean {
  const d = (o: Vec2, a: Vec2, b: Vec2) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const d1 = d(p3, p4, p1);
  const d2 = d(p3, p4, p2);
  const d3 = d(p1, p2, p3);
  const d4 = d(p1, p2, p4);
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
}
function segIntersectsRect(a: Vec2, b: Vec2, r: B): boolean {
  if (pointInRect(a, r) || pointInRect(b, r)) return true;
  const c1 = { x: r.minX, z: r.minZ };
  const c2 = { x: r.maxX, z: r.minZ };
  const c3 = { x: r.maxX, z: r.maxZ };
  const c4 = { x: r.minX, z: r.maxZ };
  return segSeg(a, b, c1, c2) || segSeg(a, b, c2, c3) || segSeg(a, b, c3, c4) || segSeg(a, b, c4, c1);
}

function drawMarquee(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  const x = Math.min(x0, x1);
  const y = Math.min(y0, y1);
  const w = Math.abs(x1 - x0);
  const h = Math.abs(y1 - y0);
  ctx.save();
  ctx.fillStyle = "rgba(56,189,248,0.12)";
  ctx.fillRect(x, y, w, h);
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = "rgba(56,189,248,0.9)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

function wallAabb(w: Wall): B {
  const t = (w.thickness ?? 0.1) / 2;
  return {
    minX: Math.min(w.a.x, w.b.x) - t,
    maxX: Math.max(w.a.x, w.b.x) + t,
    minZ: Math.min(w.a.z, w.b.z) - t,
    maxZ: Math.max(w.a.z, w.b.z) + t,
  };
}

// Guías al arrastrar: líneas de alineación + distancia al objeto más cercano por lado.
function drawDragGuides(
  ctx: CanvasRenderingContext2D,
  v: View,
  s: number,
  w: number,
  h: number,
  drag: B,
  others: B[],
) {
  const X = (x: number) => v.panX + x * s;
  const Y = (z: number) => v.panY + z * s;
  const tol = 6 / s;

  // --- líneas de alineación (bordes y centros) ---
  const dragXs = [drag.minX, (drag.minX + drag.maxX) / 2, drag.maxX];
  const dragZs = [drag.minZ, (drag.minZ + drag.maxZ) / 2, drag.maxZ];
  const vlines: number[] = [];
  const hlines: number[] = [];
  for (const o of others) {
    const oXs = [o.minX, (o.minX + o.maxX) / 2, o.maxX];
    const oZs = [o.minZ, (o.minZ + o.maxZ) / 2, o.maxZ];
    for (const dx of dragXs) for (const ox of oXs) if (Math.abs(dx - ox) < tol) vlines.push(ox);
    for (const dz of dragZs) for (const oz of oZs) if (Math.abs(dz - oz) < tol) hlines.push(oz);
  }
  const uniq = (arr: number[]) => {
    const out: number[] = [];
    for (const a of arr) if (!out.some((b) => Math.abs(b - a) < tol)) out.push(a);
    return out;
  };
  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = "rgba(244,114,182,0.85)";
  ctx.lineWidth = 1;
  for (const x of uniq(vlines)) {
    const px = X(x);
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, h);
    ctx.stroke();
  }
  for (const z of uniq(hlines)) {
    const py = Y(z);
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(w, py);
    ctx.stroke();
  }
  ctx.restore();

  // --- distancia al vecino más cercano por lado ---
  const ovZ = (o: B) => drag.minZ < o.maxZ && drag.maxZ > o.minZ;
  const ovX = (o: B) => drag.minX < o.maxX && drag.maxX > o.minX;
  const gaps: { x1: number; z1: number; x2: number; z2: number; val: number }[] = [];
  const rights = others.filter((o) => ovZ(o) && o.minX >= drag.maxX - 1e-6);
  if (rights.length) {
    const n = rights.reduce((a, b) => (b.minX < a.minX ? b : a));
    const mz = (Math.max(drag.minZ, n.minZ) + Math.min(drag.maxZ, n.maxZ)) / 2;
    gaps.push({ x1: drag.maxX, z1: mz, x2: n.minX, z2: mz, val: n.minX - drag.maxX });
  }
  const lefts = others.filter((o) => ovZ(o) && o.maxX <= drag.minX + 1e-6);
  if (lefts.length) {
    const n = lefts.reduce((a, b) => (b.maxX > a.maxX ? b : a));
    const mz = (Math.max(drag.minZ, n.minZ) + Math.min(drag.maxZ, n.maxZ)) / 2;
    gaps.push({ x1: n.maxX, z1: mz, x2: drag.minX, z2: mz, val: drag.minX - n.maxX });
  }
  const ups = others.filter((o) => ovX(o) && o.maxZ <= drag.minZ + 1e-6);
  if (ups.length) {
    const n = ups.reduce((a, b) => (b.maxZ > a.maxZ ? b : a));
    const mx = (Math.max(drag.minX, n.minX) + Math.min(drag.maxX, n.maxX)) / 2;
    gaps.push({ x1: mx, z1: n.maxZ, x2: mx, z2: drag.minZ, val: drag.minZ - n.maxZ });
  }
  const downs = others.filter((o) => ovX(o) && o.minZ >= drag.maxZ - 1e-6);
  if (downs.length) {
    const n = downs.reduce((a, b) => (b.minZ < a.minZ ? b : a));
    const mx = (Math.max(drag.minX, n.minX) + Math.min(drag.maxX, n.maxX)) / 2;
    gaps.push({ x1: mx, z1: drag.maxZ, x2: mx, z2: n.minZ, val: n.minZ - drag.maxZ });
  }

  ctx.save();
  for (const g of gaps) {
    if (g.val < 0.005) continue;
    const ax = X(g.x1);
    const ay = Y(g.z1);
    const bx = X(g.x2);
    const by = Y(g.z2);
    ctx.strokeStyle = "rgba(110,231,183,0.95)";
    ctx.lineWidth = 1.2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    // ticks perpendiculares en los extremos
    const horiz = Math.abs(ay - by) < 0.5;
    ctx.beginPath();
    if (horiz) {
      ctx.moveTo(ax, ay - 4); ctx.lineTo(ax, ay + 4);
      ctx.moveTo(bx, by - 4); ctx.lineTo(bx, by + 4);
    } else {
      ctx.moveTo(ax - 4, ay); ctx.lineTo(ax + 4, ay);
      ctx.moveTo(bx - 4, by); ctx.lineTo(bx + 4, by);
    }
    ctx.stroke();
    label(ctx, formatLen(g.val), (ax + bx) / 2, (ay + by) / 2, true);
  }
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, accent: boolean) {
  ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const tw = ctx.measureText(text).width;
  const bw = tw + 10;
  ctx.fillStyle = "rgba(8,11,18,0.82)";
  roundRect(ctx, x - bw / 2, y - 8, bw, 16, 4);
  ctx.fill();
  ctx.fillStyle = accent ? "#7dd3fc" : "#cbd5e1";
  ctx.fillText(text, x, y);
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, v: View, s: number, cellM: number) {
  let step = cellM;
  while (step * s < 8) step *= 2;
  const minX = (0 - v.panX) / s;
  const maxX = (w - v.panX) / s;
  const minZ = (0 - v.panY) / s;
  const maxZ = (h - v.panY) / s;
  const i0 = Math.floor(minX / step);
  const i1 = Math.ceil(maxX / step);
  for (let i = i0; i <= i1; i++) {
    const x = i * step;
    const sx = v.panX + x * s;
    ctx.strokeStyle = Math.abs(x - Math.round(x)) < 1e-6 ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.045)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, h);
    ctx.stroke();
  }
  const j0 = Math.floor(minZ / step);
  const j1 = Math.ceil(maxZ / step);
  for (let j = j0; j <= j1; j++) {
    const z = j * step;
    const sy = v.panY + z * s;
    ctx.strokeStyle = Math.abs(z - Math.round(z)) < 1e-6 ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.045)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(w, sy);
    ctx.stroke();
  }
}

function drawAxes(ctx: CanvasRenderingContext2D, v: View, w: number, h: number) {
  ctx.strokeStyle = "rgba(96,165,250,0.30)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(v.panX, 0);
  ctx.lineTo(v.panX, h);
  ctx.moveTo(0, v.panY);
  ctx.lineTo(w, v.panY);
  ctx.stroke();
}

function drawWall(ctx: CanvasRenderingContext2D, wl: Wall, v: View, s: number, selected: boolean) {
  const A = { x: v.panX + wl.a.x * s, y: v.panY + wl.a.z * s };
  const B = { x: v.panX + wl.b.x * s, y: v.panY + wl.b.z * s };
  const tpx = Math.max(wl.thickness * s, 2);
  ctx.lineCap = "round";
  ctx.strokeStyle = selected ? "rgba(56,189,248,0.95)" : "rgba(206,213,224,0.92)";
  ctx.lineWidth = tpx;
  ctx.beginPath();
  ctx.moveTo(A.x, A.y);
  ctx.lineTo(B.x, B.y);
  ctx.stroke();
  ctx.strokeStyle = selected ? "rgba(8,47,73,0.55)" : "rgba(15,23,42,0.45)";
  ctx.lineWidth = Math.max(tpx * 0.16, 0.6);
  ctx.beginPath();
  ctx.moveTo(A.x, A.y);
  ctx.lineTo(B.x, B.y);
  ctx.stroke();
  for (const e of [A, B]) {
    if (selected) {
      ctx.fillStyle = "#0b0e14";
      ctx.fillRect(e.x - 3.5, e.y - 3.5, 7, 7);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(e.x - 3.5, e.y - 3.5, 7, 7);
    } else {
      ctx.fillStyle = "#8b94a3";
      ctx.beginPath();
      ctx.arc(e.x, e.y, 2.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  label(ctx, formatLen(wallLength(wl)), (A.x + B.x) / 2, (A.y + B.y) / 2, selected);
}

function drawOpening(
  ctx: CanvasRenderingContext2D,
  wall: Wall,
  op: Opening,
  v: View,
  s: number,
  selected: boolean,
) {
  const f = openingFrame(wall, op);
  const W2S = (p: Vec2) => ({ x: v.panX + p.x * s, y: v.panY + p.z * s });
  const hw = op.width / 2;
  const halfT = wall.thickness / 2 + 0.02;
  const p0 = { x: f.center.x - f.dir.x * hw, z: f.center.z - f.dir.z * hw };
  const p1 = { x: f.center.x + f.dir.x * hw, z: f.center.z + f.dir.z * hw };

  // "cortar" el hueco pintando el fondo sobre el muro
  const corners = [
    { x: p0.x + f.perp.x * halfT, z: p0.z + f.perp.z * halfT },
    { x: p1.x + f.perp.x * halfT, z: p1.z + f.perp.z * halfT },
    { x: p1.x - f.perp.x * halfT, z: p1.z - f.perp.z * halfT },
    { x: p0.x - f.perp.x * halfT, z: p0.z - f.perp.z * halfT },
  ].map(W2S);
  ctx.fillStyle = "#0b0e14";
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath();
  ctx.fill();

  const col = selected ? "#38bdf8" : op.kind === "window" ? "#67b8e0" : "#d2b48c";
  const A = W2S(p0);
  const B = W2S(p1);

  // jambas (ticks perpendiculares en los extremos del hueco)
  ctx.strokeStyle = col;
  ctx.lineWidth = selected ? 2 : 1.5;
  for (const p of [p0, p1]) {
    const a = W2S({ x: p.x + f.perp.x * halfT, z: p.z + f.perp.z * halfT });
    const b = W2S({ x: p.x - f.perp.x * halfT, z: p.z - f.perp.z * halfT });
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // hoja batiente: línea de hoja + arco de barrido (desde "hingePt" hacia la posición cerrada "closedPt")
  const drawLeaf = (hingePt: Vec2, closedPt: Vec2, leafW: number, sgn: number) => {
    const leafEnd = { x: hingePt.x + f.perp.x * leafW * sgn, z: hingePt.z + f.perp.z * leafW * sgn };
    const H = W2S(hingePt);
    const L = W2S(leafEnd);
    const C = W2S(closedPt);
    ctx.beginPath();
    ctx.moveTo(H.x, H.y);
    ctx.lineTo(L.x, L.y);
    ctx.stroke();
    const rPx = leafW * s;
    const a0 = Math.atan2(L.y - H.y, L.x - H.x);
    const a1 = Math.atan2(C.y - H.y, C.x - H.x);
    let d = a1 - a0;
    while (d <= -Math.PI) d += 2 * Math.PI;
    while (d > Math.PI) d -= 2 * Math.PI;
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(H.x, H.y, rPx, a0, a1, d < 0);
    ctx.stroke();
    ctx.restore();
  };
  // panel corredizo: segmento a lo largo del hueco (t en 0..1) desplazado en perp
  const along = (t: number): Vec2 => ({ x: p0.x + (p1.x - p0.x) * t, z: p0.z + (p1.z - p0.z) * t });
  const drawPanel = (t0: number, t1: number, perpOff: number) => {
    const a = along(t0);
    const b = along(t1);
    const A2 = W2S({ x: a.x + f.perp.x * perpOff, z: a.z + f.perp.z * perpOff });
    const B2 = W2S({ x: b.x + f.perp.x * perpOff, z: b.z + f.perp.z * perpOff });
    ctx.beginPath();
    ctx.moveTo(A2.x, A2.y);
    ctx.lineTo(B2.x, B2.y);
    ctx.stroke();
  };
  const line = () => {
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(B.x, B.y);
    ctx.stroke();
  };

  const style = op.style ?? (op.kind === "door" ? "swing" : "fixed");
  const sgn = (op.swing ?? "in") === "in" ? 1 : -1;
  const hingeAtP0 = (op.hinge ?? "left") === "left";
  const slideOff = Math.min(wall.thickness * 0.28, 0.05);

  if (op.kind === "door") {
    if (style === "double") {
      const mid = { x: (p0.x + p1.x) / 2, z: (p0.z + p1.z) / 2 };
      drawLeaf(p0, mid, op.width / 2, sgn);
      drawLeaf(p1, mid, op.width / 2, sgn);
    } else if (style === "sliding") {
      drawPanel(0, 0.55, slideOff);
      drawPanel(0.45, 1, -slideOff);
    } else {
      drawLeaf(hingeAtP0 ? p0 : p1, hingeAtP0 ? p1 : p0, op.width, sgn);
    }
  } else {
    if (style === "sliding") {
      drawPanel(0, 0.55, slideOff);
      drawPanel(0.45, 1, -slideOff);
    } else if (style === "casement") {
      line();
      drawLeaf(hingeAtP0 ? p0 : p1, hingeAtP0 ? p1 : p0, op.width, sgn);
    } else {
      line();
    }
  }

  if (selected) {
    label(ctx, formatLen(op.width), (A.x + B.x) / 2, (A.y + B.y) / 2 - 12, true);
  }
}

function drawFurniture(ctx: CanvasRenderingContext2D, f: Furniture, v: View, s: number, selected: boolean) {
  const corners = footprintCorners(f).map((p) => ({ x: v.panX + p.x * s, y: v.panY + p.z * s }));
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath();
  ctx.fillStyle = selected ? "rgba(56,189,248,0.20)" : "rgba(201,177,139,0.16)";
  ctx.fill();
  ctx.strokeStyle = selected ? "#38bdf8" : "rgba(201,177,139,0.85)";
  ctx.lineWidth = selected ? 2 : 1.4;
  ctx.stroke();

  // frente (lado de las puertas)
  ctx.strokeStyle = selected ? "#7dd3fc" : "#e2c79a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  ctx.lineTo(corners[1].x, corners[1].y);
  ctx.stroke();

  const c = { x: v.panX + f.pos.x * s, y: v.panY + f.pos.z * s };
  label(ctx, f.name, c.x, c.y, selected);

  if (selected) {
    const rh = localToWorld(f, 0, -(f.depth / 2 + 0.3));
    const fc = localToWorld(f, 0, -f.depth / 2);
    const rhs = { x: v.panX + rh.x * s, y: v.panY + rh.z * s };
    const fcs = { x: v.panX + fc.x * s, y: v.panY + fc.z * s };
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(fcs.x, fcs.y);
    ctx.lineTo(rhs.x, rhs.y);
    ctx.stroke();
    ctx.fillStyle = "#0b0e14";
    ctx.beginPath();
    ctx.arc(rhs.x, rhs.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(rhs.x, rhs.y, 6, 0, Math.PI * 2);
    ctx.stroke();

    // tiradores de esquina para redimensionar
    for (const p of corners) {
      ctx.fillStyle = "#0b0e14";
      ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(p.x - 4, p.y - 4, 8, 8);
    }
  }
}

function drawFurniturePreview(ctx: CanvasRenderingContext2D, kind: string, point: Vec2, v: View, s: number) {
  const p = presetFor(kind as Furniture["kind"]);
  const hw = p.width / 2;
  const hd = p.depth / 2;
  const corners = [
    { x: point.x - hw, z: point.z - hd },
    { x: point.x + hw, z: point.z - hd },
    { x: point.x + hw, z: point.z + hd },
    { x: point.x - hw, z: point.z + hd },
  ].map((q) => ({ x: v.panX + q.x * s, y: v.panY + q.z * s }));
  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath();
  ctx.fillStyle = "rgba(56,189,248,0.12)";
  ctx.fill();
  ctx.strokeStyle = "rgba(56,189,248,0.8)";
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();
}

function drawDraft(ctx: CanvasRenderingContext2D, start: Vec2, end: Vec2, v: View, s: number) {
  const A = { x: v.panX + start.x * s, y: v.panY + start.z * s };
  const B = { x: v.panX + end.x * s, y: v.panY + end.z * s };
  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = "rgba(56,189,248,0.9)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(A.x, A.y);
  ctx.lineTo(B.x, B.y);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "#38bdf8";
  for (const p of [A, B]) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const len = dist(start, end);
  if (len > 0.001) {
    label(ctx, `${formatLen(len)}   ${angleDeg(start, end).toFixed(0)}°`, (A.x + B.x) / 2, (A.y + B.y) / 2 - 14, true);
  }
}

function drawSnapMark(ctx: CanvasRenderingContext2D, snap: Snap, v: View, s: number) {
  const p = { x: v.panX + snap.point.x * s, y: v.panY + snap.point.z * s };
  if (snap.kind === "endpoint") {
    ctx.strokeStyle = "#34d399";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.stroke();
  } else if (snap.kind === "grid") {
    ctx.strokeStyle = "rgba(125,211,252,0.7)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(p.x - 5, p.y);
    ctx.lineTo(p.x + 5, p.y);
    ctx.moveTo(p.x, p.y - 5);
    ctx.lineTo(p.x, p.y + 5);
    ctx.stroke();
  }
}

function drawHud(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  v: View,
  s: number,
  tool: ToolId,
  walls: Wall[],
  furniture: Furniture[],
  cursor: { x: number; y: number } | null,
  selCount: number,
) {
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = "rgba(148,163,184,0.85)";
  const hint =
    tool === "wall"
      ? "Muro: clic para empezar y encadenar · doble clic / Esc para terminar · Shift = ortogonal"
      : tool === "furniture"
        ? "Mueble: elegí del catálogo y hacé clic para colocar · luego seleccioná (V) para mover/rotar"
        : tool === "opening"
          ? "Abertura: elegí puerta/ventana y hacé clic sobre un muro · arrastrala para reubicarla"
          : tool === "select"
            ? "Seleccionar: clic o arrastrá un marco para varios · Shift+clic suma · arrastrá para mover · R rota · Supr borra"
            : "Mano: arrastrá para mover la vista · rueda para zoom";
  ctx.fillText(hint, 12, 10);
  if (selCount > 1) {
    ctx.fillStyle = "#7dd3fc";
    ctx.fillText(`${selCount} seleccionados`, 12, 26);
  }

  ctx.textBaseline = "bottom";
  ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
  let coord = "";
  if (cursor) {
    const wx = (cursor.x - v.panX) / s;
    const wz = (cursor.y - v.panY) / s;
    coord = `x ${wx.toFixed(2)}  z ${wz.toFixed(2)} m   ·   `;
  }
  ctx.fillStyle = "rgba(148,163,184,0.9)";
  ctx.fillText(
    `${coord}zoom ${Math.round(v.zoom * 100)}%   ·   ${walls.length} muros · ${furniture.length} muebles · ${formatLen(totalLength(walls))}`,
    12,
    h - 10,
  );
}
