"use client";

import { useEffect, useState } from "react";
import { useEditor } from "@/lib/store";
import FrontElevationEditor from "./FrontElevationEditor";
import WorkbenchControls from "./WorkbenchControls";
import WorkbenchPreview3D from "./WorkbenchPreview3D";
import WorkbenchAiBar from "./WorkbenchAiBar";
import WorkbenchCutList from "./WorkbenchCutList";
import { CloseIcon, CabinetIcon, UndoIcon, RedoIcon, RulerIcon } from "./icons";
import { isTypingTarget } from "@/lib/dom";

export default function FurnitureWorkbench() {
  const open = useEditor((s) => s.workbenchOpen);
  const draft = useEditor((s) => s.draft);
  const close = useEditor((s) => s.closeWorkbench);
  const showDims = useEditor((s) => s.workbenchDims);
  const toggleDims = useEditor((s) => s.toggleWorkbenchDims);
  const undoDraft = useEditor((s) => s.undoDraft);
  const redoDraft = useEditor((s) => s.redoDraft);
  const canUndo = useEditor((s) => s.draftPast.length > 0);
  const canRedo = useEditor((s) => s.draftFuture.length > 0);
  const [showCutList, setShowCutList] = useState(false);

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
        e.preventDefault();
        st.closeWorkbench();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open || !draft) return null;

  const toolBtn = "grid h-8 w-8 place-items-center rounded-md text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950 text-neutral-200">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-800 px-4">
        <div className="flex items-center gap-2">
          <CabinetIcon width={18} height={18} className="text-sky-400" />
          <span className="text-sm font-semibold">Taller de muebles</span>
          <span className="text-neutral-600">·</span>
          <span className="text-sm text-neutral-400">{draft.name}</span>
        </div>
        <div className="flex items-center gap-1">
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
            <RulerIcon width={15} height={15} /> Cotas
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
            🧾 Despiece
          </button>
          <button
            type="button"
            onClick={close}
            title="Cerrar (Esc)"
            className="ml-1 grid h-8 w-8 place-items-center rounded-md text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
          >
            <CloseIcon />
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {showCutList && <WorkbenchCutList onClose={() => setShowCutList(false)} />}
        <div className="w-[300px] shrink-0 border-r border-neutral-800">
          <WorkbenchControls />
        </div>
        <div className="relative min-w-0 flex-1 border-r border-neutral-800">
          <FrontElevationEditor />
          <WorkbenchAiBar />
        </div>
        <div className="relative w-[38%] min-w-[280px]">
          <WorkbenchPreview3D />
          <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/40 px-2 py-1 text-[11px] text-neutral-400">
            Vista 3D · arrastrá para orbitar
          </div>
        </div>
      </div>
    </div>
  );
}
