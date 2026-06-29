"use client";

import { useEditor } from "@/lib/store";
import { WALL_KINDS } from "@/lib/walls";

export default function WallBar() {
  const tool = useEditor((s) => s.tool);
  const wallKind = useEditor((s) => s.wallKind);
  const setWallKind = useEditor((s) => s.setWallKind);

  if (tool !== "wall") return null;

  const chip = (active: boolean) =>
    [
      "rounded-md px-3 py-1.5 text-sm transition-colors",
      active ? "bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/50" : "text-neutral-300 hover:bg-neutral-800",
    ].join(" ");

  return (
    <div className="pointer-events-auto absolute left-1/2 top-3 z-20 flex max-w-[95%] -translate-x-1/2 flex-wrap items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900/95 p-1.5 shadow-xl backdrop-blur">
      <span className="self-center pl-1 pr-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Tipo</span>
      {WALL_KINDS.map((k) => (
        <button key={k.value} type="button" onClick={() => setWallKind(k.value)} className={chip(wallKind === k.value)}>
          {k.label}
        </button>
      ))}
      <span className="self-center px-2 text-[11px] text-neutral-500">← clic para empezar a trazar</span>
    </div>
  );
}
