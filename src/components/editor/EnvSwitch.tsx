"use client";

import { useEditor } from "@/lib/store";

/**
 * Switch de ambientes tipo pastilla: Taller (diseño de un mueble) · Mis muebles
 * (galería/listado con vista previa) · Plano (planta + render del proyecto).
 * El ambiente activo se resalta con el acento de la app.
 */
export default function EnvSwitch() {
  const workbenchOpen = useEditor((s) => s.workbenchOpen);
  const libraryOpen = useEditor((s) => s.libraryOpen);
  const setView = useEditor((s) => s.setView);
  const count = useEditor((s) => s.customLibrary.length);

  const active: "taller" | "library" | "plan" = workbenchOpen ? "taller" : libraryOpen ? "library" : "plan";
  const options = [
    { id: "taller" as const, label: "Taller" },
    { id: "library" as const, label: count > 0 ? `Muebles · ${count}` : "Muebles" },
    { id: "plan" as const, label: "Plano" },
  ];

  return (
    <div className="flex shrink-0 items-center rounded-full border border-neutral-800 bg-neutral-950 p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => setView(o.id)}
          className={[
            "whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors sm:px-3",
            active === o.id
              ? "bg-sky-400 text-neutral-950"
              : "text-neutral-400 hover:text-neutral-100",
          ].join(" ")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
