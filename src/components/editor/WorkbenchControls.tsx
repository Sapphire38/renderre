"use client";

import { useState } from "react";
import { useEditor } from "@/lib/store";
import { FURNITURE_PRESETS, WORKSHOP_TEMPLATES, innerDepth } from "@/lib/furniture";
import { uid } from "@/lib/geometry";
import type { ComponentKind, FurnitureComponent } from "@/lib/types";
import { TrashIcon, CopyIcon } from "./icons";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
// Captura un snapshot para deshacer antes de empezar a editar un campo.
const beginEdit = () => useEditor.getState().pushDraftHistory();
// Conversión metros → unidad de display con 1 decimal (precisión de 1 mm).
const cm = (m: number) => Math.round(m * 1000) / 10;
const mm = (m: number) => Math.round(m * 10000) / 10;

function Num({
  label,
  value,
  unit,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  // Buffer de texto local: mientras se edita mostramos lo tipeado tal cual
  // (permite escribir decimales como "12.5" sin que se reformatee en cada tecla).
  // `null` = mostrar el valor externo. Se limpia al salir del campo.
  const [text, setText] = useState<string | null>(null);
  const display = text ?? (Number.isFinite(value) ? String(value) : "");
  return (
    <label className="flex items-center justify-between gap-2 py-1 text-sm">
      <span className="text-neutral-400">{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          type="number"
          value={display}
          min={min}
          max={max}
          step={step}
          onFocus={beginEdit}
          onChange={(e) => {
            setText(e.target.value);
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v)) onChange(v);
          }}
          onBlur={() => setText(null)}
          className="w-20 rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-right text-neutral-100 outline-none focus:border-sky-600"
        />
        <span className="w-7 text-xs text-neutral-500">{unit}</span>
      </span>
    </label>
  );
}

const ADD_BUTTONS: { kind: ComponentKind; label: string }[] = [
  { kind: "shelf", label: "Estante" },
  { kind: "drawer", label: "Cajón" },
  { kind: "doorHinged", label: "Puerta" },
  { kind: "doorSliding", label: "Corrediza" },
  { kind: "doorFlap", label: "Tapa vertical" },
  { kind: "divider", label: "División" },
  { kind: "board", label: "Placa" },
  { kind: "rod", label: "Barral" },
  { kind: "cleat", label: "Listón francés" },
];

function CompProps({ c }: { c: FurnitureComponent }) {
  const update = useEditor((s) => s.updateComponent);
  const remove = useEditor((s) => s.removeComponent);
  const duplicate = useEditor((s) => s.duplicateComponent);
  const draft = useEditor((s) => s.draft);
  const updateDraft = useEditor((s) => s.updateDraft);
  const draftColor = useEditor((s) => s.draft?.color);
  const draftDepth = useEditor((s) => s.draft?.depth ?? 0.5);
  const draftPanel = useEditor((s) => s.draft?.panel ?? 0.018);
  const materials = useEditor((s) => s.materials);
  const [nCopies, setNCopies] = useState(3);

  // Distribuye N copias del componente equiespaciadas en el interior del mueble.
  const distribute = (n: number, axis: "x" | "y") => {
    if (!draft) return;
    beginEdit();
    const t = draft.panel;
    const others = (draft.components ?? []).filter((x) => x.id !== c.id);
    const items: FurnitureComponent[] = [];
    for (let i = 1; i <= n; i++) {
      const f = i / (n + 1);
      if (axis === "x") {
        const center = t + (draft.width - 2 * t) * f;
        items.push({ ...c, id: uid(), x: clamp(center - c.w / 2, 0, draft.width - c.w) });
      } else {
        const center = t + (draft.height - 2 * t) * f;
        items.push({ ...c, id: uid(), y: clamp(center - c.h / 2, 0, draft.height - c.h) });
      }
    }
    updateDraft({ components: [...others, ...items] });
  };
  const set = (p: Partial<FurnitureComponent>) => update(c.id, p);
  // para controles de un solo clic (chips de material): snapshot + aplicar
  const setStep = (p: Partial<FurnitureComponent>) => {
    beginEdit();
    update(c.id, p);
  };
  const chip = (active: boolean) =>
    [
      "grid h-7 w-7 place-items-center overflow-hidden rounded border",
      active ? "border-sky-400 ring-1 ring-sky-400" : "border-neutral-700 hover:border-neutral-500",
    ].join(" ");
  return (
    <div className="border-t border-neutral-800 px-4 py-3">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        Componente seleccionado
      </h3>
      <Num label="X (desde izq.)" value={cm(c.x)} unit="cm" min={0} step={0.1} onChange={(v) => set({ x: Math.max(0, v / 100) })} />
      <Num label="Y (desde abajo)" value={cm(c.y)} unit="cm" min={0} step={0.1} onChange={(v) => set({ y: Math.max(0, v / 100) })} />
      <Num label="Ancho" value={cm(c.w)} unit="cm" min={1} step={0.1} onChange={(v) => set({ w: Math.max(0.02, v / 100) })} />
      <Num label="Alto" value={cm(c.h)} unit="cm" min={1} step={0.1} onChange={(v) => set({ h: Math.max(0.02, v / 100) })} />

      {(() => {
        // El espesor propio aplica a piezas planas de MDF (no al barral ni a placas con forma 3D).
        const shaped = c.kind === "board" && !!c.shape && c.shape !== "box";
        if (c.kind === "rod" || shaped) return null;
        return (
          <>
            <Num
              label="Espesor"
              value={mm(c.thickness ?? draftPanel)}
              unit="mm"
              min={3}
              max={50}
              step={0.1}
              onChange={(v) => set({ thickness: clamp(v / 1000, 0.003, 0.05) })}
            />
            {c.thickness != null && (
              <div className="-mt-1 flex justify-end pb-1">
                <button
                  type="button"
                  onClick={() => setStep({ thickness: undefined })}
                  title="Que la pieza siga el espesor MDF del mueble"
                  className="text-[11px] text-neutral-500 hover:text-neutral-300"
                >
                  ↺ usar espesor del mueble
                </button>
              </div>
            )}
          </>
        );
      })()}

      {(() => {
        const orient = c.orient ?? "front";
        const shaped = c.kind === "board" && !!c.shape && c.shape !== "box";
        const isFrontBoard = c.kind === "board" && orient === "front" && !shaped;
        const showDepth =
          c.kind === "shelf" || c.kind === "divider" || c.kind === "drawer" || c.kind === "cleat" || (c.kind === "board" && (orient !== "front" || shaped));
        const showInset = c.kind === "shelf" || c.kind === "divider" || c.kind === "board";
        // Profundidad interior útil (descuenta espesor Y retiro del fondo): el valor
        // que se muestra es directamente la medida de corte de la pieza.
        const innerD = draft ? innerDepth(draft) : draftDepth;
        const defaultDepth = c.kind === "drawer" ? Math.max(0.05, innerD - 0.02) : Math.max(0.02, innerD);
        return (
          <>
            {showDepth && (
              <Num
                label="Profundidad"
                value={cm(c.depth ?? defaultDepth)}
                unit="cm"
                min={2}
                max={cm(draftDepth)}
                step={0.1}
                onChange={(v) => set({ depth: clamp(v / 100, 0.02, draftDepth) })}
              />
            )}
            {showInset && (
              <Num
                label={isFrontBoard ? "Retiro del frente" : "Profundidad desde frente"}
                value={cm(c.depthInset ?? 0)}
                unit="cm"
                min={0}
                max={cm(draftDepth)}
                step={0.1}
                onChange={(v) => set({ depthInset: clamp(v / 100, 0, draftDepth) })}
              />
            )}
          </>
        );
      })()}

      <label className="flex items-center justify-between gap-2 py-1 text-sm">
        <span className="text-neutral-400">Color</span>
        <span className="flex items-center gap-2">
          {c.color && (
            <button
              type="button"
              onClick={() => setStep({ color: undefined })}
              title="Usar el color del mueble"
              className="text-[11px] text-neutral-500 hover:text-neutral-300"
            >
              auto
            </button>
          )}
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(c.color ?? "") ? (c.color as string) : draftColor ?? "#c9b18b"}
            onFocus={beginEdit}
            onChange={(e) => set({ color: e.target.value })}
            className="h-7 w-10 cursor-pointer rounded border border-neutral-800 bg-neutral-950"
          />
        </span>
      </label>

      <div className="py-1">
        <div className="mb-1 text-sm text-neutral-400">Material / textura</div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setStep({ materialId: undefined })} title="Sin material (usar color)" className={chip(!c.materialId)}>
            <span className="text-[10px] text-neutral-400">—</span>
          </button>
          {materials.map((m) => (
            <button key={m.id} type="button" onClick={() => setStep({ materialId: m.id })} title={m.name} className={chip(c.materialId === m.id)}>
              {m.albedo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.albedo} alt={m.name} className="h-full w-full object-cover" />
              ) : (
                <span className="h-full w-full" style={{ background: m.color }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {c.kind === "shelf" && (
        <label className="flex items-center justify-between gap-2 py-1 text-sm">
          <span className="text-neutral-400" title="Perforaciones cada 32 mm en los laterales + 4 soportes en el conteo de herrajes">
            Regulable (sistema 32)
          </span>
          <input
            type="checkbox"
            checked={c.adjustable === true}
            onFocus={beginEdit}
            onChange={(e) => set({ adjustable: e.target.checked })}
            className="h-4 w-4 accent-sky-500"
          />
        </label>
      )}
      {c.kind === "drawer" && (
        <Num label="Cajones" value={c.count ?? 1} unit="" min={1} max={8} onChange={(v) => set({ count: clamp(Math.round(v), 1, 8) })} />
      )}
      {c.kind === "doorSliding" && (
        <>
          <Num label="Hojas" value={c.count ?? 2} unit="" min={2} max={4} onChange={(v) => set({ count: clamp(Math.round(v), 2, 4) })} />
          {(() => {
            // Solape entre hojas. Por defecto: 12% del segmento (tope 4 cm), para que
            // no quede luz vertical al cerrar. Se puede sobreescribir por hoja.
            const nn = c.count ?? 2;
            const segM = c.w / nn;
            const autoM = Math.min(0.04, segM * 0.12);
            return (
              <>
                <Num
                  label="Solape"
                  value={cm(c.overlap ?? autoM)}
                  unit="cm"
                  min={0}
                  max={cm(segM)}
                  step={0.1}
                  onChange={(v) => set({ overlap: clamp(v / 100, 0, segM) })}
                />
                {c.overlap != null && (
                  <div className="-mt-1 flex justify-end pb-1">
                    <button
                      type="button"
                      onClick={() => setStep({ overlap: undefined })}
                      title="Volver al solape automático"
                      className="text-[11px] text-neutral-500 hover:text-neutral-300"
                    >
                      ↺ solape automático
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </>
      )}
      {c.kind === "doorFlap" && (
        <>
          <label className="flex items-center justify-between gap-2 py-1 text-sm">
            <span className="text-neutral-400">Abre hacia</span>
            <select
              value={c.flapDir ?? "up"}
              onFocus={beginEdit}
              onChange={(e) => set({ flapDir: e.target.value as "up" | "down" })}
              className="rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-sm text-neutral-100"
            >
              <option value="up">Arriba (rebatible)</option>
              <option value="down">Abajo (tipo bar)</option>
            </select>
          </label>
          {(c.flapDir ?? "up") === "up" && (
            <label className="flex items-center justify-between gap-2 py-1 text-sm">
              <span className="text-neutral-400" title="Pistones a gas que sostienen la tapa abierta">Brazos hidráulicos</span>
              <input
                type="checkbox"
                checked={c.pistons !== false}
                onFocus={beginEdit}
                onChange={(e) => set({ pistons: e.target.checked })}
                className="h-4 w-4 accent-sky-500"
              />
            </label>
          )}
        </>
      )}
      {c.kind === "doorHinged" && (
        <label className="flex items-center justify-between gap-2 py-1 text-sm">
          <span className="text-neutral-400">Bisagra</span>
          <select
            value={c.hinge ?? "left"}
            onFocus={beginEdit}
            onChange={(e) => set({ hinge: e.target.value as "left" | "right" })}
            className="rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-sm text-neutral-100"
          >
            <option value="left">Izquierda</option>
            <option value="right">Derecha</option>
          </select>
        </label>
      )}
      {c.kind === "board" && (
        <label className="flex items-center justify-between gap-2 py-1 text-sm">
          <span className="text-neutral-400">Forma</span>
          <select
            value={c.shape ?? "box"}
            onFocus={beginEdit}
            onChange={(e) => set({ shape: e.target.value as FurnitureComponent["shape"] })}
            className="rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-sm text-neutral-100"
          >
            <option value="box">Placa (caja)</option>
            <option value="cylinder">Cilindro</option>
            <option value="sphere">Esfera</option>
            <option value="cone">Cono</option>
            <option value="pyramid">Pirámide</option>
            <option value="wedge">Cuña / rampa</option>
          </select>
        </label>
      )}
      {c.kind === "board" && (!c.shape || c.shape === "box") && (
        <label className="flex items-center justify-between gap-2 py-1 text-sm">
          <span className="text-neutral-400">Orientación</span>
          <select
            value={c.orient ?? "front"}
            onFocus={beginEdit}
            onChange={(e) => set({ orient: e.target.value as "front" | "horizontal" | "vertical" })}
            className="rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-sm text-neutral-100"
          >
            <option value="front">Frontal</option>
            <option value="horizontal">Horizontal</option>
            <option value="vertical">Vertical</option>
          </select>
        </label>
      )}
      {(c.kind === "drawer" || c.kind === "doorHinged" || c.kind === "doorSliding" || c.kind === "doorFlap") && (
        <label className="block py-1 text-sm">
          <span className="text-neutral-400">Apertura (preview)</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={c.open ?? 0}
            onFocus={beginEdit}
            onChange={(e) => set({ open: parseFloat(e.target.value) })}
            className="w-full accent-sky-500"
          />
        </label>
      )}

      <div className="mt-3 rounded-md border border-neutral-800 p-2">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Distribuir copias</span>
          <input
            type="number"
            min={2}
            max={20}
            value={nCopies}
            onChange={(e) => setNCopies(clamp(Math.round(parseFloat(e.target.value) || 2), 2, 20))}
            className="w-14 rounded border border-neutral-800 bg-neutral-950 px-2 py-0.5 text-right text-sm text-neutral-100 outline-none focus:border-sky-600"
          />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => distribute(nCopies, "x")}
            title="N copias equiespaciadas en fila (horizontal)"
            className="rounded-md border border-neutral-700 px-2 py-1.5 text-sm text-neutral-200 hover:border-sky-500 hover:bg-neutral-800"
          >
            ⇆ En fila
          </button>
          <button
            type="button"
            onClick={() => distribute(nCopies, "y")}
            title="N copias equiespaciadas en columna (vertical) — ideal para estantes"
            className="rounded-md border border-neutral-700 px-2 py-1.5 text-sm text-neutral-200 hover:border-sky-500 hover:bg-neutral-800"
          >
            ⇅ En columna
          </button>
        </div>
        <p className="mt-1 text-[10px] leading-snug text-neutral-600">Reemplaza este componente por N iguales repartidos parejos.</p>
      </div>

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={duplicate}
          title="Duplicar (Ctrl+D)"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-neutral-700 py-1.5 text-sm text-neutral-200 hover:border-sky-500 hover:bg-neutral-800"
        >
          <CopyIcon width={15} height={15} /> Duplicar
        </button>
        <button
          type="button"
          onClick={() => remove(c.id)}
          title="Eliminar (Supr)"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-red-900/60 bg-red-950/40 py-1.5 text-sm text-red-300 hover:bg-red-900/40"
        >
          <TrashIcon width={15} height={15} /> Eliminar
        </button>
      </div>
    </div>
  );
}

export default function WorkbenchControls() {
  const draft = useEditor((s) => s.draft);
  const selectedId = useEditor((s) => s.selectedComponentId);
  const updateDraft = useEditor((s) => s.updateDraft);
  const addComponent = useEditor((s) => s.addComponent);
  const save = useEditor((s) => s.saveDraftToPlan);
  const saveToLibrary = useEditor((s) => s.saveDraftToLibrary);
  const newDraft = useEditor((s) => s.newDraft);
  const loadPresetBase = useEditor((s) => s.loadPresetBase);
  const loadTemplate = useEditor((s) => s.loadTemplate);
  const loadDraft = useEditor((s) => s.loadDraft);
  const customLibrary = useEditor((s) => s.customLibrary);
  const duplicateInLibrary = useEditor((s) => s.duplicateInLibrary);
  const removeFromLibrary = useEditor((s) => s.removeFromLibrary);

  if (!draft) return null;
  const sel = (draft.components ?? []).find((c) => c.id === selectedId) ?? null;
  const mdfPresets = FURNITURE_PRESETS.filter((p) => !p.category || p.category === "mdf");

  return (
    <div className="flex h-full flex-col overflow-auto bg-neutral-900 text-sm">
      <div className="border-b border-neutral-800 px-4 py-3">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Empezar desde una base
        </h3>
        <label className="flex items-center justify-between gap-2 py-1">
          <span className="text-neutral-400">Plantilla</span>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) loadTemplate(e.target.value);
              e.currentTarget.selectedIndex = 0;
            }}
            className="w-44 rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 outline-none focus:border-sky-600"
          >
            <option value="">Elegir variante…</option>
            {WORKSHOP_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id} title={t.hint}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center justify-between gap-2 py-1">
          <span className="text-neutral-400">Preset</span>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) loadPresetBase(e.target.value as (typeof mdfPresets)[number]["kind"]);
              e.currentTarget.selectedIndex = 0;
            }}
            className="w-44 rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 outline-none focus:border-sky-600"
          >
            <option value="">Elegir preset…</option>
            {mdfPresets.map((p) => (
              <option key={p.kind} value={p.kind}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-1 text-[11px] leading-snug text-neutral-600">
          Reemplaza lo que estés editando (podés deshacer con Ctrl+Z).
        </p>
      </div>

      {/* Biblioteca del taller: los muebles viven acá, aislados del plano. */}
      <div className="border-b border-neutral-800 px-4 py-3">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Mis muebles ({customLibrary.length})
        </h3>
        {customLibrary.length === 0 ? (
          <p className="text-[11px] leading-snug text-neutral-600">
            Todavía no guardaste ninguno. Usá <b className="text-neutral-400">Guardar mueble</b> abajo: queda en el
            proyecto sin necesidad de colocarlo en el plano.
          </p>
        ) : (
          <ul className="max-h-44 space-y-1 overflow-y-auto pr-1">
            {customLibrary.map((f) => (
              <li key={f.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => loadDraft(f)}
                  title={`Abrir "${f.name}" en el taller (${Math.round(f.width * 100)}×${Math.round(f.height * 100)}×${Math.round(f.depth * 100)} cm)`}
                  className={[
                    "min-w-0 flex-1 truncate rounded-md border px-2 py-1 text-left text-sm",
                    f.id === draft.id
                      ? "border-sky-700/60 bg-sky-500/10 text-sky-200"
                      : "border-neutral-800 text-neutral-200 hover:border-sky-600 hover:bg-neutral-800",
                  ].join(" ")}
                >
                  {f.name}
                </button>
                <button
                  type="button"
                  onClick={() => duplicateInLibrary(f.id)}
                  title="Duplicar"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
                >
                  <CopyIcon width={14} height={14} />
                </button>
                <button
                  type="button"
                  onClick={() => removeFromLibrary(f.id)}
                  title="Eliminar de la biblioteca"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded text-neutral-500 hover:bg-red-950/50 hover:text-red-300"
                >
                  <TrashIcon width={14} height={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-b border-neutral-800 px-4 py-3">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Mueble
        </h3>
        <label className="flex items-center justify-between gap-2 py-1">
          <span className="text-neutral-400">Nombre</span>
          <input
            value={draft.name}
            onFocus={beginEdit}
            onChange={(e) => updateDraft({ name: e.target.value })}
            className="w-44 rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-neutral-100 outline-none focus:border-sky-600"
          />
        </label>
        <Num label="Ancho" value={cm(draft.width)} unit="cm" min={10} max={400} step={0.1} onChange={(v) => updateDraft({ width: clamp(v / 100, 0.1, 4) })} />
        <Num label="Alto" value={cm(draft.height)} unit="cm" min={10} max={300} step={0.1} onChange={(v) => updateDraft({ height: clamp(v / 100, 0.1, 3) })} />
        <Num label="Profundidad" value={cm(draft.depth)} unit="cm" min={5} max={120} step={0.1} onChange={(v) => updateDraft({ depth: clamp(v / 100, 0.05, 1.2) })} />
        <Num label="Espesor MDF" value={mm(draft.panel)} unit="mm" min={3} max={50} step={0.1} onChange={(v) => updateDraft({ panel: clamp(v / 1000, 0.003, 0.05) })} />
        <Num
          label="Luz entre frentes"
          value={mm(draft.frontGap ?? 0.003)}
          unit="mm"
          min={0}
          max={20}
          step={0.5}
          onChange={(v) => updateDraft({ frontGap: clamp(v / 1000, 0, 0.02) })}
        />
        <Num
          label="Zócalo (alto)"
          value={mm(draft.plinth ?? 0)}
          unit="mm"
          min={0}
          max={mm(draft.height / 2)}
          step={5}
          onChange={(v) => updateDraft({ plinth: clamp(v / 1000, 0, draft.height / 2) })}
        />
        {(draft.plinth ?? 0) > 0.005 && (
          <Num
            label="Retiro zócalo"
            value={mm(draft.plinthInset ?? 0.05)}
            unit="mm"
            min={0}
            max={mm(draft.depth / 2)}
            step={5}
            onChange={(v) => updateDraft({ plinthInset: clamp(v / 1000, 0, draft.depth / 2) })}
          />
        )}
        <div className="flex items-center justify-between gap-2 py-1">
          <span className="text-neutral-400" title="Dibujar la caja (laterales, piso, techo). Apagalo para formas libres como una escalera.">Carcasa (caja)</span>
          <input type="checkbox" checked={draft.carcass !== false} onFocus={beginEdit} onChange={(e) => updateDraft({ carcass: e.target.checked })} className="h-4 w-4 accent-sky-500" />
        </div>
        <div className="flex items-center justify-between gap-2 py-1">
          <span className={draft.carcass === false ? "text-neutral-600" : "text-neutral-400"}>Fondo</span>
          <input type="checkbox" checked={draft.back !== false} disabled={draft.carcass === false} onFocus={beginEdit} onChange={(e) => updateDraft({ back: e.target.checked })} className="h-4 w-4 accent-sky-500 disabled:opacity-40" />
        </div>
        {draft.carcass !== false && draft.back !== false && (
          <>
            <Num
              label="Espesor fondo"
              value={mm(draft.backThickness ?? draft.panel)}
              unit="mm"
              min={3}
              max={50}
              step={0.1}
              onChange={(v) => updateDraft({ backThickness: clamp(v / 1000, 0.003, 0.05) })}
            />
            <Num
              label="Retiro fondo"
              value={mm(draft.backInset ?? 0)}
              unit="mm"
              min={0}
              max={mm(draft.depth / 2)}
              step={1}
              onChange={(v) => updateDraft({ backInset: clamp(v / 1000, 0, draft.depth / 2) })}
            />
            <div className="flex items-center justify-between gap-2 py-1">
              <span className="text-neutral-400" title="El fondo entra 6 mm por lado en ranura de laterales/piso/techo. La pieza del despiece sale 12 mm más grande.">
                Fondo ranurado
              </span>
              <input
                type="checkbox"
                checked={draft.backGroove === true}
                onFocus={beginEdit}
                onChange={(e) => updateDraft({ backGroove: e.target.checked })}
                className="h-4 w-4 accent-sky-500"
              />
            </div>
            <p className="-mt-0.5 pb-1 text-[10px] leading-snug text-neutral-600">
              Fondo típico: 3 mm. Con retiro de 18–20 mm queda el hueco para colgar el mueble con
              listón francés embutido (agregalo como componente).
            </p>
          </>
        )}
        <div className="flex items-center justify-between gap-2 py-1">
          <span className="text-neutral-400">Color</span>
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(draft.color) ? draft.color : "#c9b18b"}
            onFocus={beginEdit}
            onChange={(e) => updateDraft({ color: e.target.value })}
            className="h-7 w-12 cursor-pointer rounded border border-neutral-800 bg-neutral-950"
          />
        </div>
      </div>

      <div className="border-b border-neutral-800 px-4 py-3">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Agregar componente
        </h3>
        <div className="grid grid-cols-2 gap-1.5">
          {ADD_BUTTONS.map((b) => (
            <button
              key={b.kind}
              type="button"
              onClick={() => addComponent(b.kind)}
              className="rounded-md border border-neutral-700 px-2 py-1.5 text-sm text-neutral-200 hover:border-sky-500 hover:bg-neutral-800"
            >
              + {b.label}
            </button>
          ))}
        </div>
      </div>

      {sel ? (
        <CompProps c={sel} />
      ) : (
        <div className="border-t border-neutral-800 px-4 py-3 text-xs leading-relaxed text-neutral-500">
          Agregá componentes y posicionálos en el alzado. Hacé clic en uno para editarlo.
        </div>
      )}

      <div className="mt-auto space-y-2 border-t border-neutral-800 p-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={newDraft}
            title="Empezar un mueble nuevo en blanco (lo actual se puede recuperar con Ctrl+Z si no lo guardaste)"
            className="flex-1 rounded-md border border-neutral-700 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            + Nuevo
          </button>
          <button
            type="button"
            onClick={saveToLibrary}
            title="Guardar/actualizar en Mis muebles sin colocarlo en el plano"
            className="flex-1 rounded-md bg-sky-600 py-2 text-sm font-medium text-white hover:bg-sky-500"
          >
            Guardar mueble
          </button>
        </div>
        <button
          type="button"
          onClick={save}
          title="Guardar en Mis muebles y colocar una copia en el plano del proyecto"
          className="w-full rounded-md border border-sky-700/60 bg-sky-500/10 py-2 text-sm font-medium text-sky-300 hover:bg-sky-500/20"
        >
          Colocar en el plano ↗
        </button>
      </div>
    </div>
  );
}
