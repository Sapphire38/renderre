"use client";

import { useEditor } from "@/lib/store";
import { FURNITURE_PRESETS, type FurniturePreset } from "@/lib/furniture";

export default function FurnitureCatalog() {
  const tool = useEditor((s) => s.tool);
  const kind = useEditor((s) => s.furnitureKind);
  const setKind = useEditor((s) => s.setFurnitureKind);
  const customLibrary = useEditor((s) => s.customLibrary);
  const placeCustom = useEditor((s) => s.placeCustom);
  const openWorkbenchFromPreset = useEditor((s) => s.openWorkbenchFromPreset);
  const loadDraft = useEditor((s) => s.loadDraft);
  const removeFromLibrary = useEditor((s) => s.removeFromLibrary);

  if (tool !== "furniture") return null;

  const mdf = FURNITURE_PRESETS.filter((p) => p.category !== "equip");
  const equip = FURNITURE_PRESETS.filter((p) => p.category === "equip");

  const cornerBtn =
    "absolute grid h-4 w-4 place-items-center rounded-full bg-neutral-700 text-[9px] leading-none text-neutral-100 shadow hover:bg-sky-600";

  const presetBtn = (p: FurniturePreset) => (
    <div key={p.kind} className="relative">
      <button
        type="button"
        onClick={() => setKind(p.kind)}
        className={[
          "rounded-md px-2.5 py-1.5 text-left transition-colors",
          kind === p.kind ? "bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/50" : "text-neutral-300 hover:bg-neutral-800",
        ].join(" ")}
      >
        <span className="block text-sm leading-tight">{p.name}</span>
        <span className="block text-[10px] text-neutral-500">
          {Math.round(p.width * 100)}×{Math.round(p.depth * 100)} cm
        </span>
      </button>
      {p.category !== "equip" && (
        <button
          type="button"
          onClick={() => openWorkbenchFromPreset(p.kind)}
          title="Abrir en el Taller para editar/crear a partir de este"
          className={`${cornerBtn} -right-1 -top-1`}
        >
          ✎
        </button>
      )}
    </div>
  );

  const divider = <div className="mx-1 h-9 w-px self-center bg-neutral-700" />;

  return (
    <div className="pointer-events-auto absolute left-1/2 top-3 z-20 flex max-w-[95%] -translate-x-1/2 flex-wrap items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/95 p-1.5 shadow-xl backdrop-blur">
      <span className="self-center pl-1 pr-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        MDF
      </span>
      {mdf.map(presetBtn)}
      {divider}
      <span className="self-center px-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        Equip.
      </span>
      {equip.map(presetBtn)}
      {customLibrary.length > 0 && (
        <>
          {divider}
          <span className="self-center px-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-500/80">
            Míos
          </span>
          {customLibrary.map((f) => (
            <div key={f.id} className="relative">
              <button
                type="button"
                onClick={() => placeCustom(f.id)}
                title="Colocar este mueble en el plano"
                className="rounded-md px-2.5 py-1.5 text-left text-neutral-300 hover:bg-neutral-800"
              >
                <span className="block text-sm leading-tight">{f.name}</span>
                <span className="block text-[10px] text-sky-400/80">
                  {Math.round(f.width * 100)}×{Math.round(f.depth * 100)} cm
                </span>
              </button>
              <button
                type="button"
                onClick={() => loadDraft(f)}
                title="Editar en el Taller"
                className={`${cornerBtn} -left-1 -top-1`}
              >
                ✎
              </button>
              <button
                type="button"
                onClick={() => removeFromLibrary(f.id)}
                title="Quitar de mis muebles"
                className={`${cornerBtn} -right-1 -top-1 hover:bg-red-600`}
              >
                ×
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
