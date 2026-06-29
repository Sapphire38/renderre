"use client";

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

export default function EditorShell() {
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
          <WallBar />
          <SurfaceBar />
          <TerrainEditor />
        </div>
        <aside className="flex w-[380px] shrink-0 flex-col border-l border-neutral-800">
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
