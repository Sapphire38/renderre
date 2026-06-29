"use client";

import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";

// El 3D se carga solo en cliente (three.js usa APIs del navegador).
const Scene3D = dynamic(() => import("./Scene3D"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center text-xs text-neutral-500">Iniciando 3D…</div>
  ),
});

type Mode = "dock" | "big" | "float";
type Rect = { x: number; y: number; w: number; h: number };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Contenedor de la vista 3D con 3 modos: anclado (en el panel), pantalla completa,
 * y ventana flotante (arrastrable + redimensionable). Scene3D queda SIEMPRE montado
 * (no se recrea el contexto WebGL al cambiar de modo).
 */
export default function Viewport3D() {
  const [mode, setMode] = useState<Mode>("dock");
  const [rect, setRect] = useState<Rect>({ x: 120, y: 96, w: 560, h: 400 });
  const start = useRef<{ px: number; py: number; rect: Rect; kind: "drag" | "resize" } | null>(null);

  const floating = mode === "float";
  const big = mode === "big";

  const onMove = useCallback((e: PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.px;
    const dy = e.clientY - s.py;
    if (s.kind === "drag") {
      setRect({
        ...s.rect,
        x: clamp(s.rect.x + dx, 8 - s.rect.w + 80, window.innerWidth - 80),
        y: clamp(s.rect.y + dy, 0, window.innerHeight - 44),
      });
    } else {
      setRect({
        ...s.rect,
        w: clamp(s.rect.w + dx, 320, window.innerWidth - s.rect.x - 8),
        h: clamp(s.rect.h + dy, 240, window.innerHeight - s.rect.y - 8),
      });
    }
  }, []);
  const onUp = useCallback(() => {
    start.current = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  }, [onMove]);
  const begin = (kind: "drag" | "resize") => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    start.current = { px: e.clientX, py: e.clientY, rect, kind };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const wrapperCls = big
    ? "fixed inset-0 z-40 bg-neutral-950"
    : floating
      ? "fixed z-40 flex flex-col overflow-hidden rounded-lg border border-neutral-600 bg-[#0b0e14] shadow-2xl"
      : "h-[44%] min-h-0 border-b border-neutral-800";
  const style = floating ? { left: rect.x, top: rect.y, width: rect.w, height: rect.h } : undefined;

  return (
    <div className={wrapperCls} style={style}>
      <div
        className={
          floating
            ? "flex h-8 shrink-0 cursor-move items-center justify-between border-b border-neutral-700 bg-neutral-900/95 px-2 text-[11px] text-neutral-300 select-none"
            : "hidden"
        }
        onPointerDown={begin("drag")}
      >
        <span>Vista 3D · arrastrá para mover</span>
        <button
          type="button"
          onClick={() => setMode("dock")}
          title="Anclar de nuevo en el panel"
          className="rounded px-1.5 py-0.5 text-neutral-300 hover:bg-neutral-700"
        >
          ⤓ Anclar
        </button>
      </div>

      <div className={floating ? "relative min-h-0 flex-1" : "h-full w-full"}>
        <Scene3D
          big={big}
          onToggleBig={() => setMode((m) => (m === "big" ? "dock" : "big"))}
          floating={floating}
          onToggleFloat={() => setMode((m) => (m === "float" ? "dock" : "float"))}
          onOpenTab={() => window.open("/view3d", "renderre-3d")}
        />
      </div>

      <div
        className={floating ? "absolute bottom-0 right-0 z-10 h-4 w-4 cursor-nwse-resize" : "hidden"}
        onPointerDown={begin("resize")}
        title="Redimensionar"
        style={{ background: "linear-gradient(135deg, transparent 50%, rgba(148,163,184,0.7) 50%)" }}
      />
    </div>
  );
}
