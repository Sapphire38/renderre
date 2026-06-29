"use client";

import { useEditor } from "@/lib/store";
import {
  CursorIcon,
  WallIcon,
  HandIcon,
  UndoIcon,
  RedoIcon,
  TrashIcon,
  GridIcon,
  MagnetIcon,
  FitIcon,
  CabinetIcon,
  DoorIcon,
  SurfaceIcon,
} from "./icons";

function TBtn({
  active,
  disabled,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={[
        "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
        active
          ? "bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/50"
          : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100",
        disabled ? "opacity-30 hover:bg-transparent" : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

const Sep = () => <div className="my-1 h-px w-7 self-center bg-neutral-800" />;

export default function Toolbar() {
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const grid = useEditor((s) => s.grid);
  const setGrid = useEditor((s) => s.setGrid);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const clearAll = useEditor((s) => s.clearAll);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const hasWalls = useEditor((s) => s.walls.length > 0);

  const fit = () => window.dispatchEvent(new CustomEvent("renderre:fit"));
  const onClear = () => {
    if (hasWalls && window.confirm("¿Borrar todos los muros del plano?")) clearAll();
  };

  return (
    <div className="flex w-12 flex-col items-center gap-1 border-r border-neutral-800 bg-neutral-900 py-2">
      <TBtn active={tool === "select"} title="Seleccionar (V)" onClick={() => setTool("select")}>
        <CursorIcon />
      </TBtn>
      <TBtn active={tool === "wall"} title="Trazar muro (W)" onClick={() => setTool("wall")}>
        <WallIcon />
      </TBtn>
      <TBtn active={tool === "furniture"} title="Colocar mueble (F)" onClick={() => setTool("furniture")}>
        <CabinetIcon />
      </TBtn>
      <TBtn active={tool === "opening"} title="Puerta / ventana (O)" onClick={() => setTool("opening")}>
        <DoorIcon />
      </TBtn>
      <TBtn active={tool === "surface"} title="Suelo / superficie de jardín (S)" onClick={() => setTool("surface")}>
        <SurfaceIcon />
      </TBtn>
      <TBtn active={tool === "pan"} title="Mover vista (H / Espacio)" onClick={() => setTool("pan")}>
        <HandIcon />
      </TBtn>

      <Sep />

      <TBtn
        active={grid.showGrid}
        title="Mostrar cuadrícula (G)"
        onClick={() => setGrid({ showGrid: !grid.showGrid })}
      >
        <GridIcon />
      </TBtn>
      <TBtn
        active={grid.snap}
        title="Imantar a la cuadrícula (M)"
        onClick={() => setGrid({ snap: !grid.snap })}
      >
        <MagnetIcon />
      </TBtn>
      <TBtn title="Encuadrar todo" onClick={fit}>
        <FitIcon />
      </TBtn>

      <Sep />

      <TBtn title="Deshacer (Ctrl+Z)" disabled={!canUndo} onClick={undo}>
        <UndoIcon />
      </TBtn>
      <TBtn title="Rehacer (Ctrl+Shift+Z)" disabled={!canRedo} onClick={redo}>
        <RedoIcon />
      </TBtn>

      <div className="flex-1" />

      <TBtn title="Vaciar plano" disabled={!hasWalls} onClick={onClear}>
        <TrashIcon />
      </TBtn>
    </div>
  );
}
