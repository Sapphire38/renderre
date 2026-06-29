"use client";

import { useEditor } from "@/lib/store";
import { SURFACE_SHAPES } from "@/lib/surfaces";

export default function SurfaceBar() {
  const tool = useEditor((s) => s.tool);
  const shape = useEditor((s) => s.surfaceShape);
  const setShape = useEditor((s) => s.setSurfaceShape);
  const materials = useEditor((s) => s.materials);
  const surfaceMaterialId = useEditor((s) => s.surfaceMaterialId);
  const setSurfaceMaterial = useEditor((s) => s.setSurfaceMaterial);

  if (tool !== "surface") return null;

  const chip = (active: boolean) =>
    [
      "rounded-md px-3 py-1.5 text-sm transition-colors",
      active ? "bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/50" : "text-neutral-300 hover:bg-neutral-800",
    ].join(" ");
  const mchip = (active: boolean) =>
    [
      "grid h-7 w-7 place-items-center overflow-hidden rounded-md border",
      active ? "border-sky-400 ring-1 ring-sky-400" : "border-neutral-700 hover:border-neutral-500",
    ].join(" ");

  return (
    <div className="pointer-events-auto absolute left-1/2 top-3 z-20 flex max-w-[95%] -translate-x-1/2 flex-wrap items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900/95 p-1.5 shadow-xl backdrop-blur">
      {SURFACE_SHAPES.map((sh) => (
        <button key={sh.value} type="button" onClick={() => setShape(sh.value)} className={chip(shape === sh.value)}>
          {sh.label}
        </button>
      ))}
      <div className="mx-1 h-7 w-px self-center bg-neutral-700" />
      <span className="self-center px-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Material</span>
      <button type="button" onClick={() => setSurfaceMaterial(null)} title="Sin material (color por defecto)" className={mchip(!surfaceMaterialId)}>
        <span className="text-[10px] text-neutral-400">—</span>
      </button>
      {materials.map((m) => (
        <button key={m.id} type="button" onClick={() => setSurfaceMaterial(m.id)} title={m.name} className={mchip(surfaceMaterialId === m.id)}>
          {m.albedo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.albedo} alt={m.name} className="h-full w-full object-cover" />
          ) : (
            <span className="h-full w-full" style={{ background: m.color }} />
          )}
        </button>
      ))}
      <span className="self-center px-2 text-[11px] text-neutral-500">
        {shape === "polygon"
          ? "clic para agregar vértices · doble clic (o clic en el primero) para cerrar · doble clic en una arista/vértice para agregar/quitar"
          : "← arrastrá un rectángulo en el plano"}
      </span>
    </div>
  );
}
