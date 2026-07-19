"use client";

import { useEffect, useState } from "react";
import { useEditor } from "@/lib/store";
import FrontElevationEditor from "./FrontElevationEditor";
import WorkbenchControls from "./WorkbenchControls";
import WorkbenchPreview3D from "./WorkbenchPreview3D";
import WorkbenchCutList from "./WorkbenchCutList";
import EnvSwitch, { TallerTabs } from "./EnvSwitch";
import { CloseIcon, CabinetIcon, UndoIcon, RedoIcon, RulerIcon } from "./icons";
import { isTypingTarget } from "@/lib/dom";

export default function FurnitureWorkbench() {
  const open = useEditor((s) => s.workbenchOpen);
  const draft = useEditor((s) => s.draft);
  const setView = useEditor((s) => s.setView);
  const showDims = useEditor((s) => s.workbenchDims);
  const toggleDims = useEditor((s) => s.toggleWorkbenchDims);
  const undoDraft = useEditor((s) => s.undoDraft);
  const redoDraft = useEditor((s) => s.redoDraft);
  const canUndo = useEditor((s) => s.draftPast.length > 0);
  const canRedo = useEditor((s) => s.draftFuture.length > 0);
  const [showCutList, setShowCutList] = useState(false);
  // En móvil se muestra un solo panel a la vez (pestañas al pie). En lg+ conviven los tres.
  const [mobileTab, setMobileTab] = useState<"controls" | "elevation" | "3d">("elevation");

  // Atajos de teclado del taller (solo activos mientras está abierto).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const st = useEditor.getState();
      const meta = e.ctrlKey || e.metaKey;
      if (meta && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) st.redoDraft();
        else st.undoDraft();
        return;
      }
      if (meta && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        st.redoDraft();
        return;
      }
      if (meta && (e.key === "c" || e.key === "C")) {
        if (st.selectedComponentId) {
          e.preventDefault();
          st.copyComponent();
        }
        return;
      }
      if (meta && (e.key === "v" || e.key === "V")) {
        if (st.componentClipboard) {
          e.preventDefault();
          st.pasteComponent();
        }
        return;
      }
      if (meta && (e.key === "d" || e.key === "D")) {
        if (st.selectedComponentId) {
          e.preventDefault();
          st.duplicateComponent();
        }
        return;
      }
      if (e.key.startsWith("Arrow")) {
        if (st.selectedComponentId) {
          e.preventDefault();
          const step = e.shiftKey ? 0.1 : 0.01;
          const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          // En el alzado, "arriba" sube en Y; pantalla invertida → ArrowUp = +Y
          const dy = e.key === "ArrowUp" ? step : e.key === "ArrowDown" ? -step : 0;
          st.nudgeComponent(dx, dy);
        }
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (st.selectedComponentId) {
          e.preventDefault();
          st.removeComponent(st.selectedComponentId);
        }
        return;
      }
      if (e.key === "Escape") {
        // Cambia al plano conservando el borrador (se vuelve con el switch de ambientes).
        e.preventDefault();
        st.setView("plan");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open || !draft) return null;

  const toolBtn = "grid h-8 w-8 place-items-center rounded-md text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950 text-neutral-200">
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-neutral-800 px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <CabinetIcon width={18} height={18} className="hidden shrink-0 text-sky-400 sm:block" />
          <EnvSwitch />
          <TallerTabs />
          <span className="hidden truncate text-sm text-neutral-400 xl:inline">{draft.name}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={undoDraft} disabled={!canUndo} title="Deshacer (Ctrl+Z)" className={toolBtn}>
            <UndoIcon width={16} height={16} />
          </button>
          <button type="button" onClick={redoDraft} disabled={!canRedo} title="Rehacer (Ctrl+Y)" className={toolBtn}>
            <RedoIcon width={16} height={16} />
          </button>
          <button
            type="button"
            onClick={toggleDims}
            title="Mostrar / ocultar cotas"
            className={[
              "ml-1 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs",
              showDims ? "bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/40" : "text-neutral-400 hover:bg-neutral-800",
            ].join(" ")}
          >
            <RulerIcon width={15} height={15} /> <span className="hidden sm:inline">Cotas</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCutList((v) => !v)}
            title="Despiece, herrajes y presupuesto"
            className={[
              "ml-1 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs",
              showCutList ? "bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/40" : "text-neutral-400 hover:bg-neutral-800",
            ].join(" ")}
          >
            🧾 <span className="hidden sm:inline">Despiece</span>
          </button>
          <button
            type="button"
            onClick={() => setView("plan")}
            title="Ir al plano (Esc) — el mueble en edición se conserva"
            className="ml-1 grid h-8 w-8 place-items-center rounded-md text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
          >
            <CloseIcon />
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {showCutList && <WorkbenchCutList onClose={() => setShowCutList(false)} />}
        <div
          className={[
            mobileTab === "controls" ? "block" : "hidden",
            "w-full shrink-0 overflow-y-auto border-r border-neutral-800",
            "lg:block lg:w-[300px]",
          ].join(" ")}
        >
          <WorkbenchControls />
        </div>
        <div
          className={[
            mobileTab === "elevation" ? "block" : "hidden",
            "relative w-full shrink-0 border-r border-neutral-800",
            "lg:block lg:w-auto lg:min-w-0 lg:flex-1",
          ].join(" ")}
        >
          <FrontElevationEditor />
        </div>
        <div
          className={[
            mobileTab === "3d" ? "block" : "hidden",
            "relative w-full shrink-0",
            "lg:block lg:w-[38%] lg:min-w-[280px]",
          ].join(" ")}
        >
          <WorkbenchPreview3D />
          <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/40 px-2 py-1 text-[11px] text-neutral-400">
            Vista 3D · arrastrá para orbitar
          </div>
        </div>
      </div>

      {/* Pestañas de panel (solo móvil): un panel a la vez. */}
      <nav
        className="flex shrink-0 items-stretch border-t border-neutral-800 bg-neutral-900 lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {([
          { id: "controls", label: "Ajustes", icon: "⚙" },
          { id: "elevation", label: "Alzado", icon: "▤" },
          { id: "3d", label: "3D", icon: "◫" },
        ] as const).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setMobileTab(t.id)}
            className={[
              "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium",
              mobileTab === t.id ? "bg-sky-500/15 text-sky-300" : "text-neutral-400 active:bg-neutral-800",
            ].join(" ")}
          >
            <span className="text-base leading-none">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
