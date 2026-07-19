"use client";

import { useEditor } from "@/lib/store";
import { saveProject } from "@/lib/storage";
import { SaveIcon } from "./icons";

/**
 * Switch de ambientes tipo pastilla: Taller (diseño de muebles, con su galería
 * adentro) · Plano (planta + render del proyecto). El activo se resalta con el
 * acento de la app.
 */
export default function EnvSwitch() {
  const workbenchOpen = useEditor((s) => s.workbenchOpen);
  const libraryOpen = useEditor((s) => s.libraryOpen);
  const setView = useEditor((s) => s.setView);

  const inTaller = workbenchOpen || libraryOpen;
  const options = [
    { id: "taller" as const, label: "Taller", active: inTaller },
    { id: "plan" as const, label: "Plano", active: !inTaller },
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
            o.active ? "bg-sky-400 text-neutral-950" : "text-neutral-400 hover:text-neutral-100",
          ].join(" ")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Guardar el PROYECTO completo (muebles de la biblioteca incluidos) sin salir
 * del ambiente actual — mismo guardado que el botón del plano.
 */
export function SaveProjectButton() {
  const projectName = useEditor((s) => s.projectName);
  const dirty = useEditor((s) => s.dirty);
  const exportData = useEditor((s) => s.exportData);
  const markSaved = useEditor((s) => s.markSaved);
  const pushToast = useEditor((s) => s.pushToast);

  const onSave = () => {
    const name = projectName.trim();
    if (!name) {
      window.alert("Poné un nombre al proyecto antes de guardar.");
      return;
    }
    saveProject(name, exportData(), Date.now());
    markSaved();
    pushToast(`Guardado: ${name}`, "ok");
  };

  return (
    <button
      type="button"
      onClick={onSave}
      title={`Guardar proyecto "${projectName}" (muebles incluidos)`}
      className="relative flex shrink-0 items-center gap-1.5 rounded-md bg-sky-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-sky-500"
    >
      <SaveIcon width={14} height={14} /> <span className="hidden sm:inline">Guardar</span>
      {dirty && <span title="Cambios sin guardar" className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-400" />}
    </button>
  );
}

/**
 * Sub-pestañas DENTRO del taller: Diseño (mueble en edición) · Mis muebles
 * (galería con vista previa). Estilo secundario para no competir con el
 * switch de ambientes.
 */
export function TallerTabs() {
  const libraryOpen = useEditor((s) => s.libraryOpen);
  const setView = useEditor((s) => s.setView);
  const count = useEditor((s) => s.customLibrary.length);

  const tabs = [
    { id: "taller" as const, label: "Diseño", active: !libraryOpen },
    { id: "library" as const, label: count > 0 ? `Mis muebles · ${count}` : "Mis muebles", active: libraryOpen },
  ];

  return (
    <div className="flex shrink-0 items-center rounded-md border border-neutral-800 bg-neutral-900 p-0.5 text-xs">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setView(t.id)}
          className={[
            "whitespace-nowrap rounded px-2.5 py-1 transition-colors",
            t.active ? "bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/40" : "text-neutral-400 hover:text-neutral-100",
          ].join(" ")}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
