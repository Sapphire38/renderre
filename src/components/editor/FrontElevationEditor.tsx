"use client";

import { useEffect, useRef } from "react";
import { useEditor } from "@/lib/store";
import type { ComponentKind, FurnitureComponent } from "@/lib/types";

const KIND_STYLE: Record<ComponentKind, { fill: string; stroke: string; label: string }> = {
  shelf: { fill: "rgba(217,180,120,0.30)", stroke: "#d9b478", label: "Estante" },
  drawer: { fill: "rgba(96,165,250,0.22)", stroke: "#60a5fa", label: "Cajón" },
  doorHinged: { fill: "rgba(52,211,153,0.18)", stroke: "#34d399", label: "Puerta" },
  doorSliding: { fill: "rgba(45,212,191,0.18)", stroke: "#2dd4bf", label: "Corrediza" },
  doorFlap: { fill: "rgba(251,146,60,0.20)", stroke: "#fb923c", label: "Tapa vertical" },
  cleat: { fill: "rgba(202,164,114,0.30)", stroke: "#caa472", label: "Listón francés" },
  divider: { fill: "rgba(148,163,184,0.35)", stroke: "#94a3b8", label: "División" },
  board: { fill: "rgba(167,139,250,0.20)", stroke: "#a78bfa", label: "Placa" },
  rod: { fill: "rgba(148,163,184,0.5)", stroke: "#cbd5e1", label: "Barral" },
};

type Corner = "bl" | "br" | "tl" | "tr";
type Gesture =
  | { mode: "move"; id: string; startFx: number; startFy: number; ox: number; oy: number; committed: boolean }
  | { mode: "resize"; id: string; corner: Corner; ax: number; ay: number; committed: boolean };

const snap = (v: number) => Math.round(v / 0.01) * 0.01;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const fmtCm = (m: number) => {
  const cm = m * 100;
  return `${Math.abs(cm) < 10 ? cm.toFixed(1) : Math.round(cm)} cm`;
};

// --- helpers de cotas (coordenadas de pantalla) ---
const DIM_LINE = "rgba(125,211,252,0.8)";
const DIM_LABEL = "#7dd3fc";
const GAP_LINE = "rgba(52,211,153,0.85)";
const GAP_LABEL = "#6ee7b7";

function tag(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string) {
  ctx.font = "10px ui-monospace, SFMono-Regular, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const w = ctx.measureText(text).width + 8;
  ctx.fillStyle = "rgba(8,11,18,0.85)";
  ctx.fillRect(x - w / 2, y - 8, w, 16);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}
function hDim(ctx: CanvasRenderingContext2D, xa: number, xb: number, y: number, text: string, line = DIM_LINE, lbl = DIM_LABEL) {
  if (Math.abs(xb - xa) < 1) return;
  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(xa, y);
  ctx.lineTo(xb, y);
  ctx.moveTo(xa, y - 4);
  ctx.lineTo(xa, y + 4);
  ctx.moveTo(xb, y - 4);
  ctx.lineTo(xb, y + 4);
  ctx.stroke();
  tag(ctx, text, (xa + xb) / 2, y, lbl);
}
function vDim(ctx: CanvasRenderingContext2D, x: number, ya: number, yb: number, text: string, line = DIM_LINE, lbl = DIM_LABEL) {
  if (Math.abs(yb - ya) < 1) return;
  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, ya);
  ctx.lineTo(x, yb);
  ctx.moveTo(x - 4, ya);
  ctx.lineTo(x + 4, ya);
  ctx.moveTo(x - 4, yb);
  ctx.lineTo(x + 4, yb);
  ctx.stroke();
  tag(ctx, text, x, (ya + yb) / 2, lbl);
}

export default function FrontElevationEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const gestureRef = useRef<Gesture | null>(null);
  // Líneas-guía activas durante un arrastre (coordenadas en metros).
  const guidesRef = useRef<{ x: number[]; y: number[] }>({ x: [], y: [] });

  const draft = useEditor((s) => s.draft);
  const selectedId = useEditor((s) => s.selectedComponentId);
  const showDims = useEditor((s) => s.workbenchDims);

  // transform helpers basados en el draft actual
  const tf = () => {
    const { w: cw, h: ch } = sizeRef.current;
    const W = draft?.width ?? 1;
    const H = draft?.height ?? 1;
    const pad = 56;
    const scale = Math.max(1, Math.min((cw - 2 * pad) / W, (ch - 2 * pad) / H));
    const ox = (cw - W * scale) / 2;
    const oy = (ch - H * scale) / 2;
    return { cw, ch, W, H, scale, ox, oy };
  };
  const sx = (x: number, t = tf()) => t.ox + x * t.scale;
  const sy = (y: number, t = tf()) => t.oy + (t.H - y) * t.scale;
  const fx = (px: number, t = tf()) => (px - t.ox) / t.scale;
  const fy = (py: number, t = tf()) => t.H - (py - t.oy) / t.scale;

  const corners = (c: FurnitureComponent) => ({
    bl: { x: c.x, y: c.y },
    br: { x: c.x + c.w, y: c.y },
    tl: { x: c.x, y: c.y + c.h },
    tr: { x: c.x + c.w, y: c.y + c.h },
  });

  // Imanta un conjunto de "anclas" móviles (bordes/centro) a las líneas objetivo
  // (marco del mueble + bordes/centros de los demás componentes). Devuelve el
  // desplazamiento a aplicar y la línea sobre la que imantó (para dibujar la guía).
  const snapAxis = (movers: number[], targets: number[], thr: number): { delta: number; at: number } | null => {
    let best: { delta: number; at: number } | null = null;
    for (const m of movers) {
      for (const tv of targets) {
        const d = tv - m;
        if (Math.abs(d) <= thr && (!best || Math.abs(d) < Math.abs(best.delta))) best = { delta: d, at: tv };
      }
    }
    return best;
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas || !draft) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    if (w === 0) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0b0e14";
    ctx.fillRect(0, 0, w, h);
    const t = tf();

    // cuerpo del mueble (cara frontal)
    const x0 = sx(0, t);
    const y0 = sy(0, t);
    const x1 = sx(t.W, t);
    const y1 = sy(t.H, t);
    ctx.fillStyle = "rgba(201,177,139,0.10)";
    ctx.fillRect(x0, y1, x1 - x0, y0 - y1);
    if (draft.carcass === false) {
      // sin carcasa: el marco es solo una guía (no hay caja real)
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = "rgba(148,163,184,0.5)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x0, y1, x1 - x0, y0 - y1);
      ctx.restore();
    } else {
      // marco (espesor de placa)
      const pPx = (draft.panel || 0.018) * t.scale;
      ctx.strokeStyle = "rgba(206,213,224,0.55)";
      ctx.lineWidth = Math.max(pPx, 3);
      ctx.strokeRect(x0 + pPx / 2, y1 + pPx / 2, x1 - x0 - pPx, y0 - y1 - pPx);
    }

    // zócalo: banda inferior con su línea (el interior del mueble arranca encima)
    const plinthM = draft.carcass === false ? 0 : draft.plinth ?? 0;
    if (plinthM > 0.005) {
      const py = sy(plinthM, t);
      ctx.fillStyle = "rgba(206,213,224,0.07)";
      ctx.fillRect(x0, py, x1 - x0, y0 - py);
      ctx.strokeStyle = "rgba(206,213,224,0.45)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, py);
      ctx.lineTo(x1, py);
      ctx.stroke();
      tag(ctx, "zócalo", (x0 + x1) / 2, (py + y0) / 2, "rgba(206,213,224,0.6)");
    }

    const comps = draft.components ?? [];

    // Sistema 32: si hay algún estante regulable, columnas de perforado en los laterales
    // (agujeros cada 32 mm, a 37 mm de los cantos, como se marcan en el taller).
    if (draft.carcass !== false && comps.some((c) => c.kind === "shelf" && c.adjustable)) {
      const tt = draft.panel || 0.018;
      const yLo = Math.max(tt, plinthM + tt) + 0.037;
      const yHi = t.H - tt - 0.037;
      ctx.fillStyle = "rgba(148,163,184,0.55)";
      for (const xm of [tt + 0.037, t.W - tt - 0.037]) {
        for (let ym = yLo; ym <= yHi + 1e-9; ym += 0.032) {
          ctx.beginPath();
          ctx.arc(sx(xm, t), sy(ym, t), 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // componentes
    for (const c of comps) {
      const st = KIND_STYLE[c.kind];
      const cx0 = sx(c.x, t);
      const cy1 = sy(c.y + c.h, t);
      const cw = c.w * t.scale;
      const chh = c.h * t.scale;
      ctx.fillStyle = st.fill;
      ctx.fillRect(cx0, cy1, cw, chh);
      const sel = c.id === selectedId;
      ctx.strokeStyle = sel ? "#38bdf8" : st.stroke;
      ctx.lineWidth = sel ? 2.5 : 1.5;
      ctx.strokeRect(cx0, cy1, cw, chh);
      // etiqueta
      ctx.fillStyle = sel ? "#7dd3fc" : "rgba(226,232,240,0.85)";
      ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const lbl = c.kind === "drawer" && (c.count ?? 1) > 1 ? `${st.label} ×${c.count}` : st.label;
      if (chh > 16 && cw > 30) ctx.fillText(lbl, cx0 + cw / 2, cy1 + chh / 2);
      // medida W×H pequeña en componentes NO seleccionados
      if (showDims && !sel && chh > 30 && cw > 44) {
        ctx.fillStyle = "rgba(148,163,184,0.8)";
        ctx.font = "9px ui-monospace, monospace";
        ctx.fillText(`${Math.round(c.w * 100)}×${Math.round(c.h * 100)}`, cx0 + cw / 2, cy1 + chh / 2 + 13);
      }
      // handles si seleccionado
      if (sel) {
        const cc = corners(c);
        for (const k of ["bl", "br", "tl", "tr"] as Corner[]) {
          const p = cc[k];
          const hx = sx(p.x, t);
          const hy = sy(p.y, t);
          ctx.fillStyle = "#0b0e14";
          ctx.fillRect(hx - 4, hy - 4, 8, 8);
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(hx - 4, hy - 4, 8, 8);
        }
      }
    }

    // líneas-guía de alineación (mientras se arrastra)
    const guides = guidesRef.current;
    if (guides.x.length || guides.y.length) {
      ctx.save();
      ctx.strokeStyle = "rgba(244,114,182,0.9)"; // rosa
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      for (const gx of guides.x) {
        const px = sx(gx, t);
        ctx.moveTo(px, 0);
        ctx.lineTo(px, h);
      }
      for (const gy of guides.y) {
        const py = sy(gy, t);
        ctx.moveTo(0, py);
        ctx.lineTo(w, py);
      }
      ctx.stroke();
      ctx.restore();
    }

    if (!showDims) return;

    // --- cotas generales (ancho abajo, alto a la izquierda) ---
    hDim(ctx, x0, x1, y0 + 22, fmtCm(t.W));
    vDim(ctx, x0 - 22, y0, y1, fmtCm(t.H));

    // --- cotas del componente seleccionado: tamaño, distancia a bordes y a vecinos ---
    const sel = comps.find((c) => c.id === selectedId);
    if (sel) {
      const cL = sx(sel.x, t);
      const cR = sx(sel.x + sel.w, t);
      const cTop = sy(sel.y + sel.h, t);
      const cBot = sy(sel.y, t);
      // tamaño
      hDim(ctx, cL, cR, cTop - 14, fmtCm(sel.w));
      vDim(ctx, cR + 14, cBot, cTop, fmtCm(sel.h));
      // Caras interiores de la carcasa: si hay caja, descuenta el espesor de placa
      // (si carcass === false el marco es solo guía → referencia = borde exterior).
      const tt = draft.carcass === false ? 0 : draft.panel || 0.018;
      const inL = tt;
      const inR = t.W - tt;
      const inB = tt;
      const inT = t.H - tt;

      // Cotas de luz libre: en cada dirección, al vecino más cercano (verde) o,
      // si no hay ninguno, a la cara interior de la carcasa (azul).
      const others = comps.filter((c) => c.id !== sel.id);
      const ovY = (c: FurnitureComponent) => c.y < sel.y + sel.h && c.y + c.h > sel.y;
      const ovX = (c: FurnitureComponent) => c.x < sel.x + sel.w && c.x + c.w > sel.x;
      // derecha
      const rights = others.filter((c) => ovY(c) && c.x >= sel.x + sel.w - 1e-4);
      if (rights.length) {
        const n = rights.reduce((a, b) => (b.x < a.x ? b : a));
        const my = (Math.max(sel.y, n.y) + Math.min(sel.y + sel.h, n.y + n.h)) / 2;
        hDim(ctx, cR, sx(n.x, t), sy(my, t), fmtCm(n.x - (sel.x + sel.w)), GAP_LINE, GAP_LABEL);
      } else if (sel.x + sel.w < inR - 1e-3) {
        hDim(ctx, cR, sx(inR, t), sy(sel.y + sel.h / 2, t), fmtCm(inR - (sel.x + sel.w)));
      }
      // izquierda
      const lefts = others.filter((c) => ovY(c) && c.x + c.w <= sel.x + 1e-4);
      if (lefts.length) {
        const n = lefts.reduce((a, b) => (b.x + b.w > a.x + a.w ? b : a));
        const my = (Math.max(sel.y, n.y) + Math.min(sel.y + sel.h, n.y + n.h)) / 2;
        hDim(ctx, sx(n.x + n.w, t), cL, sy(my, t), fmtCm(sel.x - (n.x + n.w)), GAP_LINE, GAP_LABEL);
      } else if (sel.x > inL + 1e-3) {
        hDim(ctx, sx(inL, t), cL, sy(sel.y + sel.h / 2, t), fmtCm(sel.x - inL));
      }
      // arriba
      const tops = others.filter((c) => ovX(c) && c.y >= sel.y + sel.h - 1e-4);
      if (tops.length) {
        const n = tops.reduce((a, b) => (b.y < a.y ? b : a));
        const mx = (Math.max(sel.x, n.x) + Math.min(sel.x + sel.w, n.x + n.w)) / 2;
        vDim(ctx, sx(mx, t), sy(n.y, t), cTop, fmtCm(n.y - (sel.y + sel.h)), GAP_LINE, GAP_LABEL);
      } else if (sel.y + sel.h < inT - 1e-3) {
        vDim(ctx, sx(sel.x + sel.w / 2, t), sy(inT, t), cTop, fmtCm(inT - (sel.y + sel.h)));
      }
      // abajo
      const bottoms = others.filter((c) => ovX(c) && c.y + c.h <= sel.y + 1e-4);
      if (bottoms.length) {
        const n = bottoms.reduce((a, b) => (b.y + b.h > a.y + a.h ? b : a));
        const mx = (Math.max(sel.x, n.x) + Math.min(sel.x + sel.w, n.x + n.w)) / 2;
        vDim(ctx, sx(mx, t), cBot, sy(n.y + n.h, t), fmtCm(sel.y - (n.y + n.h)), GAP_LINE, GAP_LABEL);
      } else if (sel.y > inB + 1e-3) {
        vDim(ctx, sx(sel.x + sel.w / 2, t), cBot, sy(inB, t), fmtCm(sel.y - inB));
      }
    }
  };

  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, selectedId, showDims]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      sizeRef.current = { w: cr.width, h: cr.height };
      draw();
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getFace = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const t = tf();
    return { fx: fx(e.clientX - rect.left, t), fy: fy(e.clientY - rect.top, t), px: e.clientX - rect.left, py: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!draft) return;
    try {
      canvasRef.current!.setPointerCapture(e.pointerId);
    } catch {}
    const t = tf();
    const { fx: mx, fy: my, px, py } = getFace(e);
    const st = useEditor.getState();
    const comps = draft.components ?? [];

    // handles del seleccionado
    const sel = comps.find((c) => c.id === selectedId);
    if (sel) {
      const cc = corners(sel);
      for (const k of ["bl", "br", "tl", "tr"] as Corner[]) {
        const p = cc[k];
        if (Math.hypot(px - sx(p.x, t), py - sy(p.y, t)) < 9) {
          // ancla = esquina opuesta
          const opp = { bl: cc.tr, br: cc.tl, tl: cc.br, tr: cc.bl }[k];
          gestureRef.current = { mode: "resize", id: sel.id, corner: k, ax: opp.x, ay: opp.y, committed: false };
          return;
        }
      }
    }
    // cuerpo (de arriba hacia abajo)
    for (let i = comps.length - 1; i >= 0; i--) {
      const c = comps[i];
      if (mx >= c.x && mx <= c.x + c.w && my >= c.y && my <= c.y + c.h) {
        st.selectComponent(c.id);
        gestureRef.current = { mode: "move", id: c.id, startFx: mx, startFy: my, ox: c.x, oy: c.y, committed: false };
        return;
      }
    }
    st.selectComponent(null);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    if (!g || !draft) return;
    const { fx: mx, fy: my } = getFace(e);
    const st = useEditor.getState();
    const W = draft.width;
    const H = draft.height;
    const c = (draft.components ?? []).find((x) => x.id === g.id);
    if (!c) return;
    // snapshot para deshacer en el primer movimiento real del gesto
    if (!g.committed) {
      st.pushDraftHistory();
      g.committed = true;
    }

    const t = tf();
    const thr = 7 / t.scale; // 7px en metros
    const others = (draft.components ?? []).filter((x) => x.id !== g.id);
    const targX = [0, W / 2, W, ...others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w])];
    const targY = [0, H / 2, H, ...others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h])];
    const guides: { x: number[]; y: number[] } = { x: [], y: [] };

    if (g.mode === "move") {
      let nx = g.ox + (mx - g.startFx);
      let ny = g.oy + (my - g.startFy);
      const snX = snapAxis([nx, nx + c.w / 2, nx + c.w], targX, thr);
      const snY = snapAxis([ny, ny + c.h / 2, ny + c.h], targY, thr);
      if (snX) { nx += snX.delta; guides.x.push(snX.at); } else nx = snap(nx);
      if (snY) { ny += snY.delta; guides.y.push(snY.at); } else ny = snap(ny);
      nx = clamp(nx, 0, W - c.w);
      ny = clamp(ny, 0, H - c.h);
      guidesRef.current = guides;
      st.updateComponent(g.id, { x: nx, y: ny });
    } else {
      let px2 = clamp(mx, 0, W);
      let py2 = clamp(my, 0, H);
      const snX = snapAxis([px2], targX, thr);
      const snY = snapAxis([py2], targY, thr);
      if (snX) { px2 += snX.delta; guides.x.push(snX.at); } else px2 = snap(px2);
      if (snY) { py2 += snY.delta; guides.y.push(snY.at); } else py2 = snap(py2);
      const x = Math.min(g.ax, px2);
      const w = Math.max(0.02, Math.abs(g.ax - px2));
      const y = Math.min(g.ay, py2);
      const h = Math.max(0.02, Math.abs(g.ay - py2));
      guidesRef.current = guides;
      st.updateComponent(g.id, { x, y, w, h });
    }
  };

  const endGesture = (e: React.PointerEvent) => {
    try {
      const cv = canvasRef.current;
      if (cv && cv.hasPointerCapture(e.pointerId)) cv.releasePointerCapture(e.pointerId);
    } catch {}
    gestureRef.current = null;
    guidesRef.current = { x: [], y: [] };
    draw();
  };

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        style={{ touchAction: "none", cursor: "default" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
      />
      <div className="pointer-events-none absolute left-3 top-2 text-[11px] text-neutral-500">
        Alzado frontal · clic para seleccionar · arrastrá para mover · esquinas para redimensionar · flechas para ajuste fino · Ctrl+C/V copia
      </div>
    </div>
  );
}
