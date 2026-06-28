"use client";

import { useEditor } from "@/lib/store";
import { OPENING_STYLES } from "@/lib/openings";
import type { OpeningKind } from "@/lib/types";

const LABELS: Record<OpeningKind, string> = { door: "Puerta", window: "Ventana" };

export default function OpeningBar() {
  const tool = useEditor((s) => s.tool);
  const kind = useEditor((s) => s.openingKind);
  const setKind = useEditor((s) => s.setOpeningKind);
  const style = useEditor((s) => s.openingStyle);
  const setStyle = useEditor((s) => s.setOpeningStyle);

  if (tool !== "opening") return null;

  const chip = (active: boolean) =>
    [
      "rounded-md px-3 py-1.5 text-sm transition-colors",
      active ? "bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/50" : "text-neutral-300 hover:bg-neutral-800",
    ].join(" ");

  return (
    <div className="pointer-events-auto absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900/95 p-1.5 shadow-xl backdrop-blur">
      {(["door", "window"] as OpeningKind[]).map((k) => (
        <button key={k} type="button" onClick={() => setKind(k)} className={chip(kind === k)}>
          {LABELS[k]}
        </button>
      ))}
      <div className="mx-1 h-7 w-px self-center bg-neutral-700" />
      <span className="self-center px-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Estilo</span>
      {OPENING_STYLES[kind].map((st) => (
        <button key={st.value} type="button" onClick={() => setStyle(st.value)} className={chip(style === st.value)}>
          {st.label}
        </button>
      ))}
      <span className="self-center px-2 text-[11px] text-neutral-500">← hacé clic sobre un muro</span>
    </div>
  );
}
