"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import { useEditor } from "@/lib/store";
import { carcassPanels } from "@/lib/furniture";
import { cutList, weightOf } from "@/lib/cutlist";
import { Piece } from "./WorkbenchPreview3D";
import EnvSwitch, { TallerTabs, SaveProjectButton } from "./EnvSwitch";
import { CabinetIcon, CopyIcon, TrashIcon } from "./icons";
import type { Furniture } from "@/lib/types";

const cm = (m: number) => Math.round(m * 100);

/** Vista previa 3D de un mueble de la galería (con giro y apertura). */
function LibraryPreview({ f, open, turntable }: { f: Furniture; open: number; turntable: boolean }) {
  const materials = useEditor((s) => s.materials);
  const shown = useMemo(() => {
    if (open <= 0) return f;
    return { ...f, components: (f.components ?? []).map((c) => ({ ...c, open })) };
  }, [f, open]);
  const panels = useMemo(() => carcassPanels(shown), [shown]);
  const totalH = f.height + f.baseHeight;
  const dist = Math.max(f.width, totalH, f.depth) * 2 + 1.2;
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [dist * 0.65, totalH * 0.75 + 0.6, dist], fov: 45 }}>
      <color attach="background" args={["#0b0e14"]} />
      <hemisphereLight args={["#dfe7ff", "#15161a", 0.6]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[4, 9, 5]}
        intensity={1.25}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#0f1320" roughness={1} />
      </mesh>
      <Grid
        args={[30, 30]}
        cellSize={0.1}
        cellThickness={0.5}
        cellColor="#243049"
        sectionSize={1}
        sectionThickness={1}
        sectionColor="#3b4a6b"
        fadeDistance={16}
        fadeStrength={1}
        infiniteGrid
        position={[0, 0, 0]}
      />
      {panels.map((p, i) => (
        <Piece key={i} panel={p} baseColor={f.color} materials={materials} />
      ))}
      <OrbitControls makeDefault enableDamping autoRotate={turntable} autoRotateSpeed={1.4} target={[0, totalH / 2, 0]} />
    </Canvas>
  );
}

/**
 * Ambiente "Mis muebles": galería de los muebles creados en el taller.
 * Listado a la izquierda, vista previa 3D grande a la derecha y acciones
 * (editar en el taller, duplicar, colocar en el plano, eliminar).
 */
export default function FurnitureLibrary() {
  const open = useEditor((s) => s.libraryOpen);
  const library = useEditor((s) => s.customLibrary);
  const loadDraft = useEditor((s) => s.loadDraft);
  const duplicateInLibrary = useEditor((s) => s.duplicateInLibrary);
  const removeFromLibrary = useEditor((s) => s.removeFromLibrary);
  const placeCustom = useEditor((s) => s.placeCustom);
  const importToLibrary = useEditor((s) => s.importToLibrary);
  const setView = useEditor((s) => s.setView);
  const pushToast = useEditor((s) => s.pushToast);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openAll, setOpenAll] = useState(0);
  const [turntable, setTurntable] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  // Exporta el mueble seleccionado como archivo .mueble.json (compartible entre proyectos).
  const exportFurniture = (f: Furniture) => {
    const blob = new Blob(
      [JSON.stringify({ app: "renderre", kind: "mueble", version: 1, mueble: f }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(f.name || "mueble").trim().replace(/[^\w\-]+/g, "_")}.mueble.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Importa uno o varios muebles desde archivos .mueble.json (o un proyecto con customLibrary).
  const onImportFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    let n = 0;
    for (const file of Array.from(files)) {
      try {
        const obj = JSON.parse(await file.text()) as Record<string, unknown>;
        const candidates: unknown[] = Array.isArray(obj)
          ? obj
          : obj?.mueble
            ? [obj.mueble]
            : Array.isArray(obj?.muebles)
              ? (obj.muebles as unknown[])
              : Array.isArray((obj?.data as Record<string, unknown>)?.customLibrary)
                ? ((obj.data as Record<string, unknown>).customLibrary as unknown[])
                : [obj];
        for (const c of candidates) {
          const f = c as Furniture;
          if (f && typeof f.width === "number" && typeof f.height === "number" && typeof f.depth === "number") {
            importToLibrary({ ...f, name: f.name || "Mueble importado" });
            n++;
          }
        }
      } catch {
        pushToast(`No pude leer "${file.name}" (¿es un .mueble.json válido?)`, "warn");
      }
    }
    if (!n) pushToast("El archivo no tiene muebles válidos", "warn");
    if (fileRef.current) fileRef.current.value = "";
  };

  // Selección estable: si el elegido desaparece (o no hay), cae al primero.
  const sel = library.find((f) => f.id === selectedId) ?? library[0] ?? null;
  useEffect(() => {
    if (sel && sel.id !== selectedId) setSelectedId(sel.id);
  }, [sel, selectedId]);

  const pieces = useMemo(() => (sel ? cutList(sel) : []), [sel]);

  if (!open) return null;

  const actionBtn =
    "flex items-center justify-center gap-1.5 rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-sky-500 hover:bg-neutral-800";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950 text-neutral-200">
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-neutral-800 px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <CabinetIcon width={18} height={18} className="hidden shrink-0 text-sky-400 sm:block" />
          <EnvSwitch />
          <TallerTabs />
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <span className="hidden text-sm text-neutral-500 lg:inline">
            {library.length} {library.length === 1 ? "mueble guardado" : "muebles guardados"} en el proyecto
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            multiple
            className="hidden"
            onChange={(e) => onImportFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            title="Importar muebles desde archivos .mueble.json"
            className="flex items-center gap-1.5 rounded-md border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-200 hover:border-sky-500 hover:bg-neutral-800"
          >
            ⤒ <span className="hidden sm:inline">Importar</span>
          </button>
          <SaveProjectButton />
        </div>
      </header>

      {library.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <CabinetIcon width={40} height={40} className="text-neutral-700" />
          <p className="max-w-sm text-sm text-neutral-400">
            Todavía no hay muebles guardados. Diseñá uno en el taller y usá{" "}
            <b className="text-neutral-200">Guardar mueble</b>: va a aparecer acá para previsualizarlo y editarlo.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setView("taller")}
              className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
            >
              Ir al taller
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:border-sky-500 hover:bg-neutral-800"
            >
              ⤒ Importar mueble
            </button>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Listado */}
          <div className="max-h-56 w-full shrink-0 overflow-y-auto border-b border-neutral-800 lg:max-h-none lg:w-[320px] lg:border-b-0 lg:border-r">
            <ul className="p-2">
              {library.map((f) => {
                const active = sel?.id === f.id;
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(f.id)}
                      onDoubleClick={() => loadDraft(f)}
                      title="Clic: previsualizar · doble clic: editar en el taller"
                      className={[
                        "mb-1 w-full rounded-lg border px-3 py-2 text-left",
                        active
                          ? "border-sky-700/70 bg-sky-500/10"
                          : "border-neutral-800 hover:border-neutral-600 hover:bg-neutral-900",
                      ].join(" ")}
                    >
                      <div className={["truncate text-sm font-medium", active ? "text-sky-200" : "text-neutral-100"].join(" ")}>
                        {f.name}
                      </div>
                      <div className="mt-0.5 text-[11px] text-neutral-500">
                        {cm(f.width)} × {cm(f.height)} × {cm(f.depth)} cm · {(f.components ?? []).length} comp.
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Vista previa + acciones */}
          {sel && (
            <div className="relative min-h-0 flex-1">
              <LibraryPreview f={sel} open={openAll} turntable={turntable} />

              {/* Ficha del mueble */}
              <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-black/50 px-3 py-2 text-xs text-neutral-300 backdrop-blur">
                <div className="text-sm font-semibold text-neutral-100">{sel.name}</div>
                <div className="mt-0.5 text-neutral-400">
                  {cm(sel.width)} × {cm(sel.height)} × {cm(sel.depth)} cm · MDF {Math.round(sel.panel * 1000)} mm
                </div>
                <div className="text-neutral-500">
                  {pieces.reduce((a, p) => a + p.qty, 0)} piezas · {weightOf(pieces).toFixed(1)} kg estim.
                </div>
              </div>

              {/* Controles de la vista */}
              <div className="absolute bottom-16 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/90 px-3 py-2 text-[11px] text-neutral-300 shadow-xl backdrop-blur sm:bottom-3 sm:left-3 sm:translate-x-0">
                <label className="flex items-center gap-1.5" title="Abrir puertas y cajones">
                  <span>Abrir</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={openAll}
                    onChange={(e) => setOpenAll(parseFloat(e.target.value))}
                    className="w-16 accent-sky-500"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setTurntable((v) => !v)}
                  className={["rounded px-2 py-1", turntable ? "bg-sky-500/20 text-sky-200" : "hover:bg-neutral-800"].join(" ")}
                  title="Girar automáticamente"
                >
                  ⟳ Girar
                </button>
              </div>

              {/* Acciones */}
              <div className="absolute bottom-3 right-3 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => exportFurniture(sel)}
                  title="Descargar este mueble como archivo .mueble.json (para compartir o llevar a otro proyecto)"
                  className={actionBtn}
                >
                  ⤓ Exportar
                </button>
                <button
                  type="button"
                  onClick={() => duplicateInLibrary(sel.id)}
                  title="Duplicar este mueble"
                  className={actionBtn}
                >
                  <CopyIcon width={15} height={15} /> Duplicar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    placeCustom(sel.id);
                    setView("plan");
                    pushToast(`"${sel.name}" colocado en el plano`);
                  }}
                  title="Colocar una copia en el plano del proyecto"
                  className={actionBtn}
                >
                  ↗ Colocar en plano
                </button>
                <button
                  type="button"
                  onClick={() => removeFromLibrary(sel.id)}
                  title="Eliminar de la biblioteca"
                  className="flex items-center justify-center gap-1.5 rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300 hover:bg-red-900/40"
                >
                  <TrashIcon width={15} height={15} /> Eliminar
                </button>
                <button
                  type="button"
                  onClick={() => loadDraft(sel)}
                  title="Abrir en el taller para editarlo"
                  className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
                >
                  ✎ Editar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
