"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Toolbar from "./Toolbar";
import ProjectBar from "./ProjectBar";
import PlanCanvas from "./PlanCanvas";
import PropertiesPanel from "./PropertiesPanel";
import FurnitureCatalog from "./FurnitureCatalog";
import OpeningBar from "./OpeningBar";
import FloorBar from "./FloorBar";
import AiPromptBar from "./AiPromptBar";
import FurnitureWorkbench from "./FurnitureWorkbench";
import Toasts from "./Toasts";
import McpBridge from "./McpBridge";

// El 3D se carga solo en cliente (three.js usa APIs del navegador).
const Scene3D = dynamic(() => import("./Scene3D"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center text-xs text-neutral-500">
      Iniciando 3D…
    </div>
  ),
});

export default function EditorShell() {
  const [big, setBig] = useState(false);
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-neutral-950 text-neutral-200">
      <ProjectBar />
      <div className="flex min-h-0 flex-1">
        <Toolbar />
        <div className="relative min-w-0 flex-1">
          <PlanCanvas />
          <FloorBar />
          <FurnitureCatalog />
          <OpeningBar />
          <AiPromptBar />
        </div>
        <aside className="flex w-[380px] shrink-0 flex-col border-l border-neutral-800">
          <div
            className={
              big
                ? "fixed inset-0 z-40 bg-neutral-950"
                : "h-[44%] min-h-0 border-b border-neutral-800"
            }
          >
            <Scene3D big={big} onToggleBig={() => setBig((v) => !v)} />
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <PropertiesPanel />
          </div>
        </aside>
      </div>
      <FurnitureWorkbench />
      <Toasts />
      <McpBridge />
    </div>
  );
}
