"use client";

import { useRef, useState } from "react";
import { useEditor } from "@/lib/store";
import { imageToPbr } from "@/lib/texture";

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className={disabled ? "opacity-40" : ""}>
      <div className="flex items-center justify-between text-xs text-neutral-400">
        <span>{label}</span>
        <span className="text-neutral-300">
          {value.toFixed(2)}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-sky-500"
      />
    </div>
  );
}

export default function MaterialControls({ target }: { target: "selection" | "floor" }) {
  const materials = useEditor((s) => s.materials);
  const selection = useEditor((s) => s.selection);
  const walls = useEditor((s) => s.walls);
  const furniture = useEditor((s) => s.furniture);
  const floorMaterialId = useEditor((s) => s.floorMaterialId);
  const addMaterial = useEditor((s) => s.addMaterial);
  const updateMaterial = useEditor((s) => s.updateMaterial);
  const assignSel = useEditor((s) => s.assignMaterialToSelection);
  const setFloor = useEditor((s) => s.setFloorMaterial);

  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const currentId =
    target === "floor"
      ? floorMaterialId
      : selection?.kind === "wall"
        ? walls.find((w) => w.id === selection.id)?.materialId
        : selection?.kind === "furniture"
          ? furniture.find((f) => f.id === selection.id)?.materialId
          : undefined;
  const current = materials.find((m) => m.id === currentId);

  const assign = (id: string | null) => (target === "floor" ? setFloor(id) : assignSel(id));

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const { albedo, normal, name } = await imageToPbr(file);
      const id = addMaterial({ name, color: "#ffffff", albedo, normal, tileM: 1, roughness: 0.85, metalness: 0 });
      assign(id);
    } catch {
      window.alert("No se pudo procesar la imagen.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const chip = (active: boolean) =>
    [
      "grid h-8 w-8 place-items-center overflow-hidden rounded-md border",
      active ? "border-sky-400 ring-1 ring-sky-400" : "border-neutral-700 hover:border-neutral-500",
    ].join(" ");

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => assign(null)} title="Por defecto" className={chip(!current)}>
          <span className="text-[10px] text-neutral-400">—</span>
        </button>
        {materials.map((m) => (
          <button key={m.id} type="button" onClick={() => assign(m.id)} title={m.name} className={chip(current?.id === m.id)}>
            {m.albedo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.albedo} alt={m.name} className="h-full w-full object-cover" />
            ) : (
              <span className="h-full w-full" style={{ background: m.color }} />
            )}
          </button>
        ))}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          title="Subir imagen como textura"
          className="grid h-8 min-w-8 place-items-center rounded-md border border-dashed border-neutral-600 px-2 text-xs text-neutral-300 hover:border-sky-500 hover:text-sky-300 disabled:opacity-50"
        >
          {busy ? "…" : "＋ img"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
      </div>

      {current && (
        <div className="mt-3 space-y-2">
          <div className="text-[11px] text-neutral-500">{current.name}</div>
          <Slider
            label="Tamaño textura"
            value={current.tileM}
            min={0.1}
            max={4}
            step={0.1}
            unit="m"
            disabled={!current.albedo}
            onChange={(v) => updateMaterial(current.id, { tileM: v })}
          />
          <Slider
            label="Rugosidad"
            value={current.roughness}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => updateMaterial(current.id, { roughness: v })}
          />
        </div>
      )}
    </div>
  );
}
