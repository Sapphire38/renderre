"use client";

import { useRef, useState } from "react";
import { Box3, Vector3 } from "three";
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
  const models = useEditor((s) => s.models);
  const addModel = useEditor((s) => s.addModel);
  const removeModel = useEditor((s) => s.removeModel);
  const placeModel = useEditor((s) => s.placeModel);
  const pushToast = useEditor((s) => s.pushToast);
  const modelFileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const onImportModel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const loader = new GLTFLoader();
      const gltf = await new Promise<{ scene: import("three").Object3D }>((res, rej) =>
        loader.parse(buf.slice(0), "", (g) => res(g as { scene: import("three").Object3D }), rej),
      );
      const size = new Box3().setFromObject(gltf.scene).getSize(new Vector3());
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = () => rej(r.error);
        r.readAsDataURL(file);
      });
      const name = file.name.replace(/\.(glb|gltf)$/i, "");
      const id = addModel({
        name,
        dataUrl,
        width: Math.max(0.05, size.x || 1),
        depth: Math.max(0.05, size.z || 1),
        height: Math.max(0.05, size.y || 1),
      });
      placeModel(id);
      if (dataUrl.length > 3_800_000) {
        pushToast("Modelo grande: puede no guardarse en el navegador. Exportá el proyecto a archivo.", "warn");
      }
    } catch {
      pushToast("No pude leer ese archivo (usá .glb sin compresión)", "warn");
    } finally {
      setImporting(false);
      if (modelFileRef.current) modelFileRef.current.value = "";
    }
  };

  if (tool !== "furniture") return null;

  const mdf = FURNITURE_PRESETS.filter((p) => !p.category || p.category === "mdf");
  const equip = FURNITURE_PRESETS.filter((p) => p.category === "equip");
  const prim = FURNITURE_PRESETS.filter((p) => p.category === "prim");
  const struct = FURNITURE_PRESETS.filter((p) => p.category === "struct");
  const garden = FURNITURE_PRESETS.filter((p) => p.category === "garden");
  const decor = FURNITURE_PRESETS.filter((p) => p.category === "decor");

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
      {(!p.category || p.category === "mdf") && (
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
    <div className="no-scrollbar pointer-events-auto absolute left-1/2 top-3 z-20 flex max-w-[calc(100%-1rem)] -translate-x-1/2 flex-nowrap items-center gap-1.5 overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-900/95 p-1.5 shadow-xl backdrop-blur [&>*]:shrink-0 lg:max-w-[95%] lg:flex-wrap lg:overflow-visible">
      <span className="self-center pl-1 pr-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        MDF
      </span>
      {mdf.map(presetBtn)}
      {divider}
      <span className="self-center px-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        Equip.
      </span>
      {equip.map(presetBtn)}
      {prim.length > 0 && (
        <>
          {divider}
          <span className="self-center px-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            Prim.
          </span>
          {prim.map(presetBtn)}
        </>
      )}
      {struct.length > 0 && (
        <>
          {divider}
          <span className="self-center px-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            Estruct.
          </span>
          {struct.map(presetBtn)}
        </>
      )}
      {garden.length > 0 && (
        <>
          {divider}
          <span className="self-center px-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-500/80">
            Jardín
          </span>
          {garden.map(presetBtn)}
        </>
      )}
      {decor.length > 0 && (
        <>
          {divider}
          <span className="self-center px-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-500/80">
            Deco
          </span>
          {decor.map(presetBtn)}
        </>
      )}
      {divider}
      <span className="self-center px-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-400/90">
        Modelos 3D
      </span>
      <button
        type="button"
        onClick={() => modelFileRef.current?.click()}
        disabled={importing}
        title="Importar un modelo 3D (.glb) desde tu computadora"
        className="rounded-md border border-dashed border-violet-500/60 px-2.5 py-1.5 text-sm text-violet-300 hover:bg-violet-500/10 disabled:opacity-50"
      >
        {importing ? "Importando…" : "＋ Importar .glb"}
      </button>
      <input ref={modelFileRef} type="file" accept=".glb,.gltf,model/gltf-binary" onChange={onImportModel} className="hidden" />
      {models.map((m) => (
        <div key={m.id} className="relative">
          <button
            type="button"
            onClick={() => placeModel(m.id)}
            title="Colocar este modelo en el plano"
            className="rounded-md px-2.5 py-1.5 text-left text-neutral-300 hover:bg-neutral-800"
          >
            <span className="block max-w-[10rem] truncate text-sm leading-tight">{m.name}</span>
            <span className="block text-[10px] text-violet-300/80">
              {Math.round(m.width * 100)}×{Math.round(m.depth * 100)}×{Math.round(m.height * 100)} cm
            </span>
          </button>
          <button
            type="button"
            onClick={() => removeModel(m.id)}
            title="Quitar de la biblioteca"
            className={`${cornerBtn} -right-1 -top-1 hover:bg-red-600`}
          >
            ×
          </button>
        </div>
      ))}
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
