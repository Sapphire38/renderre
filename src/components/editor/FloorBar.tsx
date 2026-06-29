"use client";

import { useEditor } from "@/lib/store";

export default function FloorBar() {
  const floors = useEditor((s) => s.floors);
  const activeLevel = useEditor((s) => s.activeLevel);
  const setActiveLevel = useEditor((s) => s.setActiveLevel);
  const addFloor = useEditor((s) => s.addFloor);
  const removeFloor = useEditor((s) => s.removeFloor);
  const setFloorElevation = useEditor((s) => s.setFloorElevation);
  const setFloorAutoSlab = useEditor((s) => s.setFloorAutoSlab);
  const renameFloor = useEditor((s) => s.renameFloor);

  const active = floors[activeLevel];
  // de arriba (piso más alto) hacia abajo
  const order = floors.map((_, i) => i).reverse();

  return (
    <div className="pointer-events-auto absolute left-2 top-1/2 z-20 flex w-32 -translate-y-1/2 flex-col gap-1 rounded-lg border border-neutral-800 bg-neutral-900/95 p-1.5 shadow-xl backdrop-blur">
      <div className="px-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Pisos</div>
      <button
        type="button"
        onClick={addFloor}
        title="Agregar un piso encima"
        className="rounded-md border border-dashed border-neutral-600 py-1 text-xs text-neutral-300 hover:border-sky-500 hover:text-sky-300"
      >
        + Piso
      </button>
      {order.map((i) => {
        const f = floors[i];
        const isActive = i === activeLevel;
        return (
          <button
            key={i}
            type="button"
            onClick={() => setActiveLevel(i)}
            className={[
              "rounded-md px-2 py-1 text-left transition-colors",
              isActive ? "bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/50" : "text-neutral-300 hover:bg-neutral-800",
            ].join(" ")}
          >
            <span className="block truncate text-sm leading-tight">{f.name}</span>
            <span className="block text-[10px] text-neutral-500">{f.elevation.toFixed(2)} m</span>
          </button>
        );
      })}
      {active && (
        <input
          type="text"
          value={active.name}
          onChange={(e) => renameFloor(activeLevel, e.target.value)}
          placeholder="Nombre del piso"
          title="Renombrar este piso"
          className="mt-1 w-full rounded border border-neutral-800 bg-neutral-950 px-1.5 py-0.5 text-[11px] text-neutral-100 outline-none focus:border-sky-600"
        />
      )}
      {active && (
        <label className="flex items-center justify-between gap-1 border-t border-neutral-800 pt-1 text-[11px] text-neutral-400">
          <span>Altura</span>
          <input
            type="number"
            step={0.1}
            value={active.elevation}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!Number.isNaN(v)) setFloorElevation(activeLevel, v);
            }}
            className="w-14 rounded border border-neutral-800 bg-neutral-950 px-1 py-0.5 text-right text-neutral-100 outline-none focus:border-sky-600"
          />
        </label>
      )}
      {active && (
        <label className="flex items-center justify-between gap-1 text-[11px] text-neutral-400" title="Si lo apagás, no se arma la losa de piso automática de este nivel (útil cuando el suelo lo define el terreno o las superficies).">
          <span>Losa auto.</span>
          <input
            type="checkbox"
            checked={active.autoSlab !== false}
            onChange={(e) => setFloorAutoSlab(activeLevel, e.target.checked)}
            className="h-3.5 w-3.5 accent-sky-500"
          />
        </label>
      )}
      {floors.length > 1 && (
        <button
          type="button"
          onClick={() => removeFloor(activeLevel)}
          className="rounded-md border border-red-900/60 bg-red-950/30 py-1 text-[11px] text-red-300 hover:bg-red-900/40"
        >
          Eliminar piso
        </button>
      )}
    </div>
  );
}
