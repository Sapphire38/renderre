"use client";

import { useMemo, useState } from "react";
import { useEditor } from "@/lib/store";
import { cutList, hardwareOf, budgetOf } from "@/lib/cutlist";
import { nest } from "@/lib/nesting";
import type { Pricing } from "@/lib/types";

const money = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");
const mm = (m: number) => Math.round(m * 1000);

// Paleta estable por rol para colorear las piezas en el plano de corte.
const ROLE_COLORS = ["#38bdf8", "#34d399", "#f59e0b", "#a78bfa", "#f472b6", "#facc15", "#fb7185", "#22d3ee", "#a3e635"];
function roleColor(role: string): string {
  let h = 0;
  for (let i = 0; i < role.length; i++) h = (h * 31 + role.charCodeAt(i)) >>> 0;
  return ROLE_COLORS[h % ROLE_COLORS.length];
}

function PriceField({
  label,
  value,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span className="text-neutral-400">{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : ""}
        step={step}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!Number.isNaN(v)) onChange(v);
        }}
        className="w-28 rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-right text-neutral-100 outline-none focus:border-sky-600"
      />
    </label>
  );
}

export default function WorkbenchCutList({ onClose }: { onClose: () => void }) {
  const draft = useEditor((s) => s.draft);
  const pricing = useEditor((s) => s.pricing);
  const setPricing = useEditor((s) => s.setPricing);
  const materials = useEditor((s) => s.materials);
  const [showPrices, setShowPrices] = useState(false);
  const [tab, setTab] = useState<"list" | "cut">("list");

  // Despiece completo + cantidad A CORTAR por pieza (para comprar/cortar sólo lo que falta:
  // ej. tengo 2 de 3 puertas → pongo 1; o 1 de 2 laterales ya cortado → pongo 1).
  const allPieces = useMemo(() => (draft ? cutList(draft) : []), [draft]);
  const rowKey = (p: { role: string; largo: number; ancho: number; thickness: number; materialId?: string }) =>
    `${p.role}|${mm(p.largo)}|${mm(p.ancho)}|${mm(p.thickness)}|${p.materialId ?? ""}`;
  const [cutQty, setCutQty] = useState<Record<string, number>>({});
  const [includeHw, setIncludeHw] = useState(true);
  const qtyOf = (p: (typeof allPieces)[number]) => {
    const v = cutQty[rowKey(p)];
    return v === undefined ? p.qty : Math.max(0, Math.min(p.qty, v));
  };
  const pieces = useMemo(
    () => allPieces.map((p) => ({ ...p, qty: qtyOf(p) })).filter((p) => p.qty > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allPieces, cutQty],
  );
  const fullHw = useMemo(() => (draft ? hardwareOf(draft) : { hinges: 0, slides: 0, pulls: 0, rods: 0 }), [draft]);
  const hw = includeHw ? fullHw : { hinges: 0, slides: 0, pulls: 0, rods: 0 };
  const budget = useMemo(() => budgetOf(pieces, hw, pricing), [pieces, hw, pricing]);
  const nesting = useMemo(() => nest(pieces, pricing.boardW, pricing.boardH), [pieces, pricing.boardW, pricing.boardH]);
  const partial = !includeHw || allPieces.some((p) => qtyOf(p) !== p.qty);
  const setQty = (p: (typeof allPieces)[number], v: number) =>
    setCutQty((prev) => ({ ...prev, [rowKey(p)]: Math.max(0, Math.min(p.qty, Math.round(v) || 0)) }));

  if (!draft) return null;

  const matName = (id?: string) => (id ? materials.find((m) => m.id === id)?.name ?? "—" : "MDF");

  const exportCsv = () => {
    const rows = [
      ["Rol", "Largo (mm)", "Ancho (mm)", "Espesor (mm)", "Cant.", "Canto (ml c/u)", "Material"],
      ...pieces.map((p) => [
        p.role,
        String(mm(p.largo)),
        String(mm(p.ancho)),
        String(mm(p.thickness)),
        String(p.qty),
        p.edgeMeters.toFixed(2),
        matName(p.materialId),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `despiece-${draft.name.replace(/\s+/g, "_") || "mueble"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const set = (patch: Partial<Pricing>) => setPricing(patch);
  const card = "rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2";

  // El nesting da el conteo REAL de placas; recalculamos costo de material e importe total con él.
  const boards = nesting.totalBoards;
  const materialCost = boards * pricing.boardPrice;
  const total = materialCost + budget.cost.edge + budget.cost.hardware + budget.cost.labor;

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-neutral-950">
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-800 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-neutral-100">Despiece y presupuesto</span>
          <span className="text-neutral-600">·</span>
          <span className="text-sm text-neutral-400">{draft.name}</span>
          <div className="ml-2 flex rounded-md border border-neutral-800 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setTab("list")}
              className={["rounded px-2.5 py-1", tab === "list" ? "bg-sky-500/20 text-sky-200" : "text-neutral-400 hover:text-neutral-200"].join(" ")}
            >
              Despiece
            </button>
            <button
              type="button"
              onClick={() => setTab("cut")}
              className={["rounded px-2.5 py-1", tab === "cut" ? "bg-sky-500/20 text-sky-200" : "text-neutral-400 hover:text-neutral-200"].join(" ")}
            >
              Plano de corte
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:border-sky-500 hover:bg-neutral-800"
          >
            ⬇ Exportar CSV
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500"
          >
            Volver al diseño
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {/* Qué falta cortar: ajustá la cantidad "a cortar" de cada pieza en la tabla.
            Sirve para comprar/cortar sólo lo pendiente (ej. ya tenés 2 de 3 puertas). */}
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/60 p-2 text-xs">
          <span className="font-semibold uppercase tracking-wide text-neutral-500">A cortar:</span>
          <span className="text-neutral-500">ajustá la cantidad de cada pieza en la columna <b className="text-neutral-300">“A cortar”</b> (ej. te falta sólo 1 de 3 puertas).</span>
          <button type="button" onClick={() => setCutQty({})} className="rounded px-2 py-1 text-neutral-400 hover:bg-neutral-800">Todo</button>
          <button type="button" onClick={() => { const m: Record<string, number> = {}; allPieces.forEach((p) => (m[rowKey(p)] = 0)); setCutQty(m); }} className="rounded px-2 py-1 text-neutral-400 hover:bg-neutral-800">Nada</button>
          <label className="flex items-center gap-1.5 text-neutral-400">
            <input type="checkbox" checked={includeHw} onChange={(e) => setIncludeHw(e.target.checked)} className="h-3.5 w-3.5 accent-sky-500" />
            Incluir herrajes
          </label>
          {partial && <span className="ml-auto rounded bg-amber-500/15 px-2 py-0.5 text-amber-300">cálculo parcial</span>}
        </div>

        {/* Resumen */}
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <div className={card}>
            <div className="text-[11px] uppercase tracking-wide text-neutral-500">Piezas</div>
            <div className="text-lg font-semibold text-neutral-100">{budget.pieces}</div>
          </div>
          <div className={card}>
            <div className="text-[11px] uppercase tracking-wide text-neutral-500">Sup. de placa</div>
            <div className="text-lg font-semibold text-neutral-100">{budget.area.toFixed(2)} m²</div>
          </div>
          <div className={card}>
            <div className="text-[11px] uppercase tracking-wide text-neutral-500">Placas ({Math.round(nesting.yield * 100)}% aprov.)</div>
            <div className="text-lg font-semibold text-neutral-100">{boards}</div>
          </div>
          <div className={card}>
            <div className="text-[11px] uppercase tracking-wide text-neutral-500">Canto</div>
            <div className="text-lg font-semibold text-neutral-100">{budget.edgeMeters.toFixed(1)} ml</div>
          </div>
          <div className="rounded-lg border border-sky-700/60 bg-sky-950/40 px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-sky-400/80">Total estimado</div>
            <div className="text-lg font-semibold text-sky-200">{money(total)}</div>
          </div>
        </div>

        {tab === "cut" ? (
          <CutPlan nesting={nesting} />
        ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* Despiece */}
          <div>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Despiece</h3>
            <div className="overflow-x-auto rounded-lg border border-neutral-800">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-neutral-900 text-left text-[11px] uppercase tracking-wide text-neutral-500">
                    <th className="px-3 py-2 font-medium">Rol</th>
                    <th className="px-3 py-2 text-right font-medium">Largo</th>
                    <th className="px-3 py-2 text-right font-medium">Ancho</th>
                    <th className="px-3 py-2 text-right font-medium">Esp.</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                    <th className="px-3 py-2 text-center font-medium">A cortar</th>
                    <th className="px-3 py-2 text-right font-medium">Canto</th>
                    <th className="px-3 py-2 font-medium">Material</th>
                  </tr>
                </thead>
                <tbody>
                  {allPieces.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-neutral-500">
                        Este mueble no tiene placas de MDF (¿carcasa apagada y sin componentes?).
                      </td>
                    </tr>
                  ) : (
                    allPieces.map((p, i) => {
                      const q = qtyOf(p);
                      return (
                        <tr key={i} className={["border-t border-neutral-800/80", q === 0 ? "text-neutral-600" : "text-neutral-200"].join(" ")}>
                          <td className="px-3 py-1.5">{p.role}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{mm(p.largo)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{mm(p.ancho)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{mm(p.thickness)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{p.qty}</td>
                          <td className="px-3 py-1.5 text-center">
                            <input
                              type="number"
                              min={0}
                              max={p.qty}
                              value={q}
                              onChange={(e) => setQty(p, parseFloat(e.target.value))}
                              className={["w-14 rounded border bg-neutral-950 px-1.5 py-0.5 text-right tabular-nums outline-none focus:border-sky-600", q === 0 ? "border-neutral-800 text-neutral-500" : q < p.qty ? "border-amber-600/60 text-amber-300" : "border-neutral-700 text-neutral-100"].join(" ")}
                            />
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-neutral-500">
                            {p.edgeMeters > 0 ? (p.edgeMeters * q).toFixed(2) : "—"}
                          </td>
                          <td className="px-3 py-1.5 text-neutral-500">{matName(p.materialId)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-[11px] text-neutral-600">Medidas en milímetros. Canto = metros lineales de tapacanto por pieza.</p>

            {/* Herrajes */}
            <h3 className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Herrajes</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className={card}><div className="text-[11px] text-neutral-500">Bisagras</div><div className="font-semibold text-neutral-100">{hw.hinges}</div></div>
              <div className={card}><div className="text-[11px] text-neutral-500">Correderas (par)</div><div className="font-semibold text-neutral-100">{hw.slides}</div></div>
              <div className={card}><div className="text-[11px] text-neutral-500">Tiradores</div><div className="font-semibold text-neutral-100">{hw.pulls}</div></div>
              <div className={card}><div className="text-[11px] text-neutral-500">Barrales</div><div className="font-semibold text-neutral-100">{hw.rods}</div></div>
            </div>
          </div>

          {/* Costos + precios */}
          <div>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Costos</h3>
            <div className="space-y-1.5 rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-sm">
              <div className="flex justify-between"><span className="text-neutral-400">Placas ({boards})</span><span className="text-neutral-100">{money(materialCost)}</span></div>
              <div className="flex justify-between"><span className="text-neutral-400">Canto ({budget.edgeMeters.toFixed(1)} ml)</span><span className="text-neutral-100">{money(budget.cost.edge)}</span></div>
              <div className="flex justify-between"><span className="text-neutral-400">Herrajes</span><span className="text-neutral-100">{money(budget.cost.hardware)}</span></div>
              <div className="flex justify-between"><span className="text-neutral-400">Mano de obra</span><span className="text-neutral-100">{money(budget.cost.labor)}</span></div>
              <div className="mt-1 flex justify-between border-t border-neutral-800 pt-2 text-base font-semibold">
                <span className="text-neutral-200">Total</span><span className="text-sky-300">{money(total)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPrices((v) => !v)}
              className="mt-3 flex w-full items-center justify-between rounded-md border border-neutral-800 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
            >
              <span>Lista de precios</span>
              <span className="text-neutral-500">{showPrices ? "▲" : "▼"}</span>
            </button>
            {showPrices && (
              <div className="mt-2 space-y-1.5 rounded-lg border border-neutral-800 bg-neutral-900 p-3">
                <PriceField label="Placa estándar — ancho (m)" value={pricing.boardW} step={0.01} onChange={(v) => set({ boardW: Math.max(0.1, v) })} />
                <PriceField label="Placa estándar — alto (m)" value={pricing.boardH} step={0.01} onChange={(v) => set({ boardH: Math.max(0.1, v) })} />
                <PriceField label="Precio por placa" value={pricing.boardPrice} step={100} onChange={(v) => set({ boardPrice: Math.max(0, v) })} />
                <PriceField label="Canto ($/ml)" value={pricing.edgePrice} step={50} onChange={(v) => set({ edgePrice: Math.max(0, v) })} />
                <PriceField label="Bisagra ($)" value={pricing.hingePrice} step={50} onChange={(v) => set({ hingePrice: Math.max(0, v) })} />
                <PriceField label="Corredera par ($)" value={pricing.slidePrice} step={100} onChange={(v) => set({ slidePrice: Math.max(0, v) })} />
                <PriceField label="Tirador ($)" value={pricing.pullPrice} step={50} onChange={(v) => set({ pullPrice: Math.max(0, v) })} />
                <PriceField label="Barral ($)" value={pricing.rodPrice} step={50} onChange={(v) => set({ rodPrice: Math.max(0, v) })} />
                <PriceField label="Mano de obra ($/m²)" value={pricing.laborPerM2} step={500} onChange={(v) => set({ laborPerM2: Math.max(0, v) })} />
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

/** Plano de corte: una placa por SVG con las piezas acomodadas. */
function CutPlan({ nesting }: { nesting: ReturnType<typeof nest> }) {
  if (nesting.boards.length === 0) {
    return <p className="py-10 text-center text-neutral-500">No hay piezas de MDF para acomodar.</p>;
  }
  const PXM = 150; // px por metro
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-300">
        <span><b className="text-neutral-100">{nesting.totalBoards}</b> placas · {nesting.boards[0].w.toFixed(2)}×{nesting.boards[0].h.toFixed(2)} m</span>
        <span>Aprovechamiento <b className="text-sky-300">{Math.round(nesting.yield * 100)}%</b></span>
        <span className="text-neutral-500">{nesting.usedArea.toFixed(2)} / {nesting.totalArea.toFixed(2)} m²</span>
        {nesting.unplaced.length > 0 && (
          <span className="rounded bg-red-950/50 px-2 py-0.5 text-red-300">{nesting.unplaced.length} pieza(s) no entran en la placa</span>
        )}
      </div>
      <div className="flex flex-wrap gap-6">
        {nesting.boards.map((b) => (
          <div key={b.index}>
            <div className="mb-1 text-[11px] text-neutral-400">
              Placa {b.index + 1} · {Math.round(b.thickness * 1000)} mm
            </div>
            <svg
              width={b.w * PXM}
              height={b.h * PXM}
              viewBox={`0 0 ${b.w} ${b.h}`}
              className="rounded border border-neutral-700 bg-neutral-900"
            >
              <rect x={0} y={0} width={b.w} height={b.h} fill="#13161c" />
              {b.pieces.map((p, i) => (
                <g key={i}>
                  <rect
                    x={p.x}
                    y={p.y}
                    width={p.w}
                    height={p.h}
                    fill={roleColor(p.role) + "33"}
                    stroke={roleColor(p.role)}
                    strokeWidth={0.006}
                  />
                  <text
                    x={p.x + p.w / 2}
                    y={p.y + p.h / 2}
                    fill="#e5e7eb"
                    fontSize={Math.min(0.05, p.h / 3, p.w / 6)}
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {Math.round((p.rot ? p.h : p.w) * 1000)}×{Math.round((p.rot ? p.w : p.h) * 1000)}{p.rot ? " ↻" : ""}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-neutral-600">
        Empaquetado por estantes con giro 90°. Las piezas no se mezclan entre espesores/materiales. Medidas en mm.
      </p>
    </div>
  );
}
