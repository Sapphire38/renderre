"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import { useEditor } from "@/lib/store";
import { buildTerrainGeometry, heightColor01, heightRange, type TerrainMode } from "@/lib/terrain";
import type { Terrain, Wall, Floor } from "@/lib/types";

const MODE_LABEL: Record<TerrainMode, { label: string; icon: string }> = {
  raise: { label: "Subir", icon: "⛰" },
  lower: { label: "Bajar", icon: "🕳" },
  flatten: { label: "Aplanar", icon: "▬" },
  smooth: { label: "Suavizar", icon: "〰" },
};

const FLOOR_COLORS = ["#38bdf8", "#f59e0b", "#34d399", "#f472b6", "#a78bfa", "#facc15"];
const floorColor = (lvl: number) => FLOOR_COLORS[lvl % FLOOR_COLORS.length];

/** Malla de terreno coloreada por altura + esculpido con el puntero. */
function SculptMesh({
  terrain,
  mode,
  radius,
  strength,
  enabled,
  onHover,
}: {
  terrain: Terrain;
  mode: TerrainMode;
  radius: number;
  strength: number;
  enabled: boolean;
  onHover: (p: THREE.Vector3 | null) => void;
}) {
  const drawing = useRef(false);

  const geom = useMemo(() => {
    const { positions, indices, uvs } = buildTerrainGeometry(terrain);
    const { min, max } = heightRange(terrain);
    const colors = new Float32Array((positions.length / 3) * 3);
    for (let i = 0; i < positions.length / 3; i++) {
      const [r, g, b] = heightColor01(positions[i * 3 + 1], min, max);
      colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.setIndex(new THREE.BufferAttribute(indices, 1));
    g.computeVertexNormals();
    return g;
  }, [terrain.heights, terrain.cols, terrain.rows, terrain.cell, terrain.origin.x, terrain.origin.z]);
  useEffect(() => () => geom.dispose(), [geom]);

  const apply = (e: ThreeEvent<PointerEvent>) => {
    const inv = (e.nativeEvent as PointerEvent).shiftKey;
    let m: TerrainMode = mode;
    if (inv && mode === "raise") m = "lower";
    else if (inv && mode === "lower") m = "raise";
    useEditor.getState().sculptTerrain(e.point.x, e.point.z, radius, strength, m);
  };

  return (
    <mesh
      geometry={geom}
      receiveShadow
      onPointerDown={(e) => {
        // En modo "girar" el mesh no esculpe: dejamos que OrbitControls maneje el gesto.
        if (!enabled) return;
        if ((e.nativeEvent as PointerEvent).button !== 0) return; // sólo botón izquierdo/toque esculpe
        e.stopPropagation();
        drawing.current = true;
        (e.target as Element).setPointerCapture?.((e.nativeEvent as PointerEvent).pointerId);
        apply(e);
      }}
      onPointerMove={(e) => {
        onHover(enabled ? e.point.clone() : null);
        if (enabled && drawing.current) { e.stopPropagation(); apply(e); }
      }}
      onPointerUp={() => { drawing.current = false; }}
      onPointerOut={() => { drawing.current = false; onHover(null); }}
    >
      <meshStandardMaterial vertexColors roughness={1} metalness={0} />
    </mesh>
  );
}

/** Anillo del pincel sobre el terreno, en el punto bajo el cursor. */
function BrushRing({ pos, radius, mode }: { pos: THREE.Vector3 | null; radius: number; mode: TerrainMode }) {
  if (!pos) return null;
  const color = mode === "lower" ? "#f87171" : mode === "flatten" ? "#fbbf24" : mode === "smooth" ? "#a3e635" : "#38bdf8";
  return (
    <mesh position={[pos.x, pos.y + 0.03, pos.z]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <ringGeometry args={[Math.max(0.05, radius - 0.08), radius, 48]} />
      <meshBasicMaterial color={color} transparent opacity={0.55} side={THREE.DoubleSide} depthTest={false} />
    </mesh>
  );
}

/** Muros de la casa como referencia (semitransparentes), por nivel. */
function WallsReference({ walls, floors, hidden }: { walls: Wall[]; floors: Floor[]; hidden: Set<number> }) {
  return (
    <>
      {walls.map((w) => {
        const lvl = w.level ?? 0;
        if (hidden.has(lvl)) return null;
        const dx = w.b.x - w.a.x;
        const dz = w.b.z - w.a.z;
        const len = Math.hypot(dx, dz);
        if (len < 1e-3) return null;
        const h = w.height || 2.4;
        const base = w.base ?? 0;
        const elev = floors[lvl]?.elevation ?? 0;
        const mx = (w.a.x + w.b.x) / 2;
        const mz = (w.a.z + w.b.z) / 2;
        return (
          <mesh key={w.id} position={[mx, elev + base + h / 2, mz]} rotation={[0, Math.atan2(-dz, dx), 0]} raycast={() => null}>
            <boxGeometry args={[len, h, Math.max(w.thickness, 0.05)]} />
            <meshStandardMaterial color={floorColor(lvl)} transparent opacity={0.4} depthWrite={false} />
          </mesh>
        );
      })}
    </>
  );
}

function SceneSetup({ terrain }: { terrain: Terrain }) {
  const { camera } = useThree();
  const sizeX = terrain.cols * terrain.cell;
  const sizeZ = terrain.rows * terrain.cell;
  useEffect(() => {
    const d = Math.max(sizeX, sizeZ);
    camera.position.set(d * 0.55, d * 0.6 + 4, d * 0.85);
    camera.lookAt(0, 0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export default function TerrainEditor() {
  const [open, setOpen] = useState(false);
  const terrain = useEditor((s) => s.terrain);
  const setTerrain = useEditor((s) => s.setTerrain);
  const resizeTerrain = useEditor((s) => s.resizeTerrain);
  const resetTerrain = useEditor((s) => s.resetTerrain);
  const materials = useEditor((s) => s.materials);
  const walls = useEditor((s) => s.walls);
  const furniture = useEditor((s) => s.furniture);
  const floors = useEditor((s) => s.floors);

  const [mode, setMode] = useState<TerrainMode>("raise");
  // "sculpt" = un dedo/clic izq. esculpe · "orbit" = un dedo/clic izq. gira la vista.
  // Imprescindible en táctil, donde no hay botón derecho para rotar.
  const [viewMode, setViewMode] = useState<"sculpt" | "orbit">("sculpt");
  const [radius, setRadius] = useState(2.5);
  const [strength, setStrength] = useState(0.25);
  const [selFloor, setSelFloor] = useState(0);
  const [hiddenFloors, setHiddenFloors] = useState<Set<number>>(new Set());
  const [hover, setHover] = useState<THREE.Vector3 | null>(null);

  const minX = terrain.origin.x;
  const minZ = terrain.origin.z;

  const footprint = (lvl: number) => {
    let minBX = Infinity, minBZ = Infinity, maxBX = -Infinity, maxBZ = -Infinity, has = false;
    const acc = (x: number, z: number) => { minBX = Math.min(minBX, x); maxBX = Math.max(maxBX, x); minBZ = Math.min(minBZ, z); maxBZ = Math.max(maxBZ, z); has = true; };
    for (const w of walls) if ((w.level ?? 0) === lvl) { acc(w.a.x, w.a.z); acc(w.b.x, w.b.z); }
    for (const f of furniture) if ((f.level ?? 0) === lvl) acc(f.pos.x, f.pos.z);
    return { has, bbox: { minX: minBX, minZ: minBZ, maxX: maxBX, maxZ: maxBZ } };
  };

  const flattenToFloor = (lvl: number) => {
    const g = footprint(lvl);
    if (!g.has) return;
    const nx = terrain.cols + 1, nz = terrain.rows + 1;
    const h = terrain.heights.length === nx * nz ? [...terrain.heights] : new Array(nx * nz).fill(0);
    const e = floors[lvl]?.elevation ?? 0;
    const pad = 0.6;
    for (let iz = 0; iz < nz; iz++)
      for (let ix = 0; ix < nx; ix++) {
        const wx = minX + ix * terrain.cell, wz = minZ + iz * terrain.cell;
        if (wx >= g.bbox.minX - pad && wx <= g.bbox.maxX + pad && wz >= g.bbox.minZ - pad && wz <= g.bbox.maxZ + pad) h[iz * nx + ix] = e;
      }
    setTerrain({ enabled: true, heights: h });
  };

  const chip = (active: boolean) =>
    ["flex flex-col items-center gap-0.5 rounded-md py-2 text-xs", active ? "bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/50" : "text-neutral-300 hover:bg-neutral-800"].join(" ");
  const matChip = (active: boolean) =>
    ["grid h-7 w-7 place-items-center overflow-hidden rounded border", active ? "border-sky-400 ring-1 ring-sky-400" : "border-neutral-700 hover:border-neutral-500"].join(" ");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Editar el relieve del terreno (esculpir alturas en 3D)"
        className="pointer-events-auto fixed bottom-3 left-3 z-30 flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-900/90 px-3 py-2 text-sm text-neutral-200 shadow-xl backdrop-blur hover:border-sky-500 hover:bg-neutral-800"
      >
        ⛰ Terreno
      </button>
    );
  }

  const range = heightRange(terrain);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-neutral-950 text-neutral-200">
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-neutral-800 px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold">⛰ <span className="hidden sm:inline">Editor de </span>Terreno</span>
          <span className="hidden text-neutral-600 sm:inline">·</span>
          <span className="hidden text-xs text-neutral-500 sm:inline">relieve {range.min.toFixed(2)} … {range.max.toFixed(2)} m</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-neutral-400">
            <input type="checkbox" checked={terrain.enabled} onChange={(e) => setTerrain({ enabled: e.target.checked })} className="h-4 w-4 accent-sky-500" />
            <span className="hidden sm:inline">Mostrar en la escena</span>
            <span className="sm:hidden">En escena</span>
          </label>
          <button type="button" onClick={() => setOpen(false)} className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500">
            Listo
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Panel de herramientas: a la izquierda en escritorio, abajo (con scroll) en móvil. */}
        <div className="order-2 max-h-[45%] w-full shrink-0 overflow-auto border-t border-neutral-800 p-3 lg:order-1 lg:max-h-none lg:w-[250px] lg:border-r lg:border-t-0">
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Herramienta</h3>
          <div className="mb-3 grid grid-cols-2 gap-1.5">
            {(Object.keys(MODE_LABEL) as TerrainMode[]).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} className={chip(mode === m)}>
                <span className="text-base leading-none">{MODE_LABEL[m].icon}</span>
                {MODE_LABEL[m].label}
              </button>
            ))}
          </div>
          <label className="mb-2 block text-sm">
            <span className="flex justify-between text-neutral-400"><span>Tamaño del pincel</span><span className="text-neutral-300">{radius.toFixed(1)} m</span></span>
            <input type="range" min={0.5} max={Math.max(4, terrain.cols * terrain.cell / 2)} step={0.5} value={radius} onChange={(e) => setRadius(parseFloat(e.target.value))} className="w-full accent-sky-500" />
          </label>
          <label className="mb-3 block text-sm">
            <span className="flex justify-between text-neutral-400"><span>Intensidad</span><span className="text-neutral-300">{strength.toFixed(2)} m</span></span>
            <input type="range" min={0.02} max={1} step={0.02} value={strength} onChange={(e) => setStrength(parseFloat(e.target.value))} className="w-full accent-sky-500" />
          </label>

          <div className="rounded-md border border-neutral-800 bg-neutral-900/60 p-2 text-[11px] leading-relaxed text-neutral-400">
            <b className="text-neutral-300">Cómo se usa</b><br />
            • Modo <b>✏️ Esculpir</b>: arrastrá (o tocá) sobre el terreno para modelar el relieve.<br />
            • <b>Shift</b> mientras arrastrás = invertir (bajar/subir).<br />
            • Modo <b>🔄 Girar</b>: arrastrá para rotar la vista.<br />
            • Dos dedos (o rueda / botón derecho) = zoom y giro.
          </div>

          <h3 className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Tamaño del terreno</h3>
          <div className="grid grid-cols-3 gap-1.5 text-xs">
            {([["cols", terrain.cols], ["rows", terrain.rows]] as const).map(([k, v]) => (
              <label key={k} className="flex flex-col gap-0.5">
                <span className="text-neutral-500">{k === "cols" ? "Ancho" : "Largo"}</span>
                <input
                  type="number"
                  min={2}
                  max={120}
                  value={v}
                  onChange={(e) => {
                    const n = Math.max(2, Math.min(120, Math.round(parseFloat(e.target.value) || 2)));
                    resizeTerrain(k === "cols" ? n : terrain.cols, k === "rows" ? n : terrain.rows, terrain.cell);
                  }}
                  className="rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-right text-neutral-100 outline-none focus:border-sky-600"
                />
              </label>
            ))}
            <label className="flex flex-col gap-0.5">
              <span className="text-neutral-500">Celda m</span>
              <input
                type="number"
                min={0.2}
                max={5}
                step={0.1}
                value={terrain.cell}
                onChange={(e) => {
                  const c = Math.max(0.2, Math.min(5, parseFloat(e.target.value) || 1));
                  resizeTerrain(terrain.cols, terrain.rows, c);
                }}
                className="rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-right text-neutral-100 outline-none focus:border-sky-600"
              />
            </label>
          </div>
          <p className="mt-1 text-[10px] leading-snug text-neutral-600">Cambiar el tamaño reinicia el relieve.</p>

          <h3 className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Material</h3>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setTerrain({ materialId: undefined })} title="Color por altura" className={matChip(!terrain.materialId)}>
              <span className="text-[10px] text-neutral-400">—</span>
            </button>
            {materials.map((m) => (
              <button key={m.id} type="button" onClick={() => setTerrain({ materialId: m.id })} title={m.name} className={matChip(terrain.materialId === m.id)}>
                {m.albedo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.albedo} alt={m.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="h-full w-full" style={{ background: m.color }} />
                )}
              </button>
            ))}
          </div>

          <h3 className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Pisos (referencia)</h3>
          <p className="mb-1.5 text-[10px] leading-snug text-neutral-600">Los muros de cada piso se ven en 3D para ubicarte. Elegí uno y, si querés, llevá el terreno a su altura.</p>
          <div className="flex flex-col gap-1">
            {floors.map((f, lvl) => {
              const g = footprint(lvl);
              const sel = lvl === selFloor;
              const isHidden = hiddenFloors.has(lvl);
              return (
                <div key={lvl} className={["flex items-center gap-1.5 rounded-md border px-1.5 py-1", sel ? "border-sky-500/60 bg-neutral-800/60" : "border-neutral-800"].join(" ")}>
                  <button
                    type="button"
                    onClick={() => setHiddenFloors((prev) => { const n = new Set(prev); n.has(lvl) ? n.delete(lvl) : n.add(lvl); return n; })}
                    title={isHidden ? "Mostrar los muros de este piso" : "Ocultar los muros de este piso"}
                    className="text-xs"
                  >
                    {isHidden ? "🙈" : "👁"}
                  </button>
                  <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: floorColor(lvl) }} />
                  <button type="button" onClick={() => setSelFloor(lvl)} className="min-w-0 flex-1 truncate text-left text-xs text-neutral-200" title={`Seleccionar ${f.name}`}>
                    {f.name} <span className="text-neutral-500">· {f.elevation.toFixed(2)} m</span>
                  </button>
                  {!g.has && <span className="text-[9px] text-neutral-600">vacío</span>}
                </div>
              );
            })}
          </div>
          {footprint(selFloor).has && (
            <button
              type="button"
              onClick={() => flattenToFloor(selFloor)}
              title="Aplana el terreno bajo el piso seleccionado a su cota (que el suelo llegue al piso)"
              className="mt-2 w-full rounded-md border border-sky-700/60 bg-sky-950/40 py-1.5 text-xs text-sky-200 hover:bg-sky-900/40"
            >
              ⤓ Llevar terreno a la altura de {floors[selFloor]?.name}
            </button>
          )}

          <button
            type="button"
            onClick={resetTerrain}
            className="mt-4 w-full rounded-md border border-red-900/60 bg-red-950/40 py-1.5 text-sm text-red-300 hover:bg-red-900/40"
          >
            Aplanar todo (reset)
          </button>
        </div>

        {/* Vista 3D de esculpido */}
        <div className="relative order-1 min-h-0 min-w-0 flex-1 lg:order-2">
          <Canvas shadows dpr={[1, 2]} camera={{ fov: 45, near: 0.1, far: 1000 }} style={{ touchAction: "none" }}>
            <color attach="background" args={["#0e1420"]} />
            <hemisphereLight args={["#dfe7ff", "#20242c", 0.7]} />
            <ambientLight intensity={0.3} />
            <directionalLight position={[20, 30, 12]} intensity={1.4} castShadow shadow-mapSize={[2048, 2048]} />
            <SceneSetup terrain={terrain} />
            <SculptMesh terrain={terrain} mode={mode} radius={radius} strength={strength} enabled={viewMode === "sculpt"} onHover={setHover} />
            <BrushRing pos={hover} radius={radius} mode={mode} />
            <WallsReference walls={walls} floors={floors} hidden={hiddenFloors} />
            <Grid args={[200, 200]} cellSize={1} cellThickness={0.4} cellColor="#2a3850" sectionSize={5} sectionColor="#3b4a6b" fadeDistance={Math.max(40, terrain.cols * terrain.cell * 1.5)} infiniteGrid position={[0, -0.01, 0]} />
            <OrbitControls
              makeDefault
              enableDamping
              target={[0, 0, 0]}
              mouseButtons={
                viewMode === "orbit"
                  ? { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
                  : { MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
              }
              touches={
                viewMode === "orbit"
                  ? { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }
                  : { TWO: THREE.TOUCH.DOLLY_ROTATE }
              }
            />
          </Canvas>

          {/* Selector Esculpir / Girar: en táctil no hay botón derecho para rotar. */}
          <div className="pointer-events-auto absolute left-1/2 top-2 z-10 flex -translate-x-1/2 gap-0.5 rounded-lg border border-neutral-700 bg-neutral-900/90 p-0.5 text-xs shadow-lg backdrop-blur">
            <button
              type="button"
              onClick={() => setViewMode("sculpt")}
              className={["rounded-md px-3 py-1.5", viewMode === "sculpt" ? "bg-sky-500/25 text-sky-200 ring-1 ring-sky-500/50" : "text-neutral-300 hover:bg-neutral-800"].join(" ")}
            >
              ✏️ Esculpir
            </button>
            <button
              type="button"
              onClick={() => setViewMode("orbit")}
              className={["rounded-md px-3 py-1.5", viewMode === "orbit" ? "bg-sky-500/25 text-sky-200 ring-1 ring-sky-500/50" : "text-neutral-300 hover:bg-neutral-800"].join(" ")}
            >
              🔄 Girar
            </button>
          </div>

          <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-black/40 px-2 py-1 text-center text-[11px] text-neutral-300">
            {viewMode === "sculpt"
              ? "Arrastrá para esculpir · Shift = invertir · dos dedos = zoom/giro"
              : "Arrastrá para girar la vista · dos dedos = zoom"}
          </div>
        </div>
      </div>
    </div>
  );
}
