"use client";

import { useState } from "react";
import Toolbar from "./Toolbar";
import ProjectBar from "./ProjectBar";
import PlanCanvas from "./PlanCanvas";
import PropertiesPanel from "./PropertiesPanel";
import FurnitureCatalog from "./FurnitureCatalog";
import OpeningBar from "./OpeningBar";
import WallBar from "./WallBar";
import SurfaceBar from "./SurfaceBar";
import FloorBar from "./FloorBar";
import FurnitureWorkbench from "./FurnitureWorkbench";
import TerrainEditor from "./TerrainEditor";
import Viewport3D from "./Viewport3D";
import ThreeTabSync from "./ThreeTabSync";
import Toasts from "./Toasts";
import McpBridge from "./McpBridge";
import { CameraIcon, CloseIcon } from "./icons";

export default function EditorShell() {
  // En móvil/tablet la vista 3D + propiedades se muestran como un panel deslizable.
  // En escritorio (lg+) van ancladas a la derecha como siempre.
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <div
      className="flex h-dvh w-full flex-col overflow-hidden bg-neutral-950 text-neutral-200"
      style={{
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <ProjectBar />
      <div className="flex min-h-0 flex-1">
        <Toolbar />
        <div className="relative min-w-0 flex-1">
          <PlanCanvas />
          <FloorBar />
          <FurnitureCatalog />
          <OpeningBar />
          <WallBar />
          <SurfaceBar />
          <TerrainEditor />

          {/* Botón para abrir la vista 3D / propiedades en móvil. */}
          {!panelOpen && (
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              title="Ver 3D y propiedades"
              className="absolute z-20 flex items-center gap-2 rounded-full bg-sky-600 px-4 py-3 text-sm font-medium text-white shadow-lg active:bg-sky-500 lg:hidden"
              style={{
                bottom: "calc(1rem + env(safe-area-inset-bottom))",
                right: "calc(1rem + env(safe-area-inset-right))",
              }}
            >
              <CameraIcon width={18} height={18} /> 3D
            </button>
          )}
        </div>

        {/* Fondo oscuro detrás del panel deslizable (solo móvil). */}
        {panelOpen && (
          <div
            onClick={() => setPanelOpen(false)}
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            aria-hidden
          />
        )}

        <aside
          className={[
            "fixed inset-y-0 right-0 z-40 flex w-[88%] max-w-[420px] flex-col border-l border-neutral-800 bg-neutral-950 shadow-2xl transition-transform duration-300 ease-out",
            panelOpen ? "translate-x-0" : "translate-x-full",
            "lg:static lg:z-auto lg:w-[380px] lg:max-w-none lg:translate-x-0 lg:shadow-none lg:transition-none",
          ].join(" ")}
        >
          {/* Barra superior del panel (solo móvil) para poder cerrarlo. */}
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-neutral-800 px-3 lg:hidden">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
              Vista 3D y propiedades
            </span>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              title="Cerrar panel"
              className="grid h-8 w-8 place-items-center rounded-md text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            >
              <CloseIcon />
            </button>
          </div>
          <Viewport3D />
          <div className="min-h-0 flex-1 overflow-auto">
            <PropertiesPanel />
          </div>
        </aside>
      </div>
      <FurnitureWorkbench />
      <Toasts />
      <ThreeTabSync />
      <McpBridge />
    </div>
  );
}
