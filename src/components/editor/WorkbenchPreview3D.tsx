"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import { carcassPanels, type Panel } from "@/lib/furniture";
import { useEditor } from "@/lib/store";
import type { Material } from "@/lib/types";

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  if (Number.isNaN(n)) return hex;
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) + amt * 255)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) + amt * 255)));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) + amt * 255)));
  return `rgb(${r},${g},${b})`;
}

export function Piece({ panel, baseColor, materials }: { panel: Panel & { offset?: [number, number, number] }; baseColor: string; materials: Material[] }) {
  const { pos, size, cylinder, cylAxis, shape, pivot, rotY, rotX, rot, door } = panel;
  const matColor = panel.materialId ? materials.find((m) => m.id === panel.materialId)?.color : undefined;
  const color = matColor ?? panel.color ?? (door ? shade(baseColor, -0.06) : baseColor);
  const wedgeGeom = useMemo(() => {
    if (shape !== "wedge") return null;
    const s = new THREE.Shape();
    s.moveTo(-size[0] / 2, -size[1] / 2);
    s.lineTo(size[0] / 2, -size[1] / 2);
    s.lineTo(-size[0] / 2, size[1] / 2);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: size[2], bevelEnabled: false });
    g.translate(0, 0, -size[2] / 2);
    return g;
  }, [shape, size]);
  useEffect(() => () => wedgeGeom?.dispose(), [wedgeGeom]);
  let geom = <boxGeometry args={size} />;
  let meshRot: [number, number, number] = [0, 0, 0];
  if (shape === "sphere") {
    geom = <sphereGeometry args={[size[0] / 2, 24, 16]} />;
  } else if (shape === "cone") {
    geom = <coneGeometry args={[Math.max(size[0], size[2]) / 2, size[1], 24]} />;
  } else if (shape === "pyramid") {
    geom = <coneGeometry args={[Math.max(size[0], size[2]) / 2 / Math.cos(Math.PI / 4), size[1], 4]} />;
    meshRot = [0, Math.PI / 4, 0];
  } else if (shape === "wedge" && wedgeGeom) {
    geom = <primitive object={wedgeGeom} attach="geometry" />;
  } else if (cylinder) {
    const ax = cylAxis ?? "x";
    if (ax === "y") {
      geom = <cylinderGeometry args={[size[0] / 2, size[0] / 2, size[1], 16]} />;
    } else if (ax === "z") {
      geom = <cylinderGeometry args={[size[0] / 2, size[0] / 2, size[2], 16]} />;
      meshRot = [Math.PI / 2, 0, 0];
    } else {
      geom = <cylinderGeometry args={[size[1] / 2, size[1] / 2, size[0], 16]} />;
      meshRot = [0, 0, Math.PI / 2];
    }
  }
  const off = panel.offset ?? [0, 0, 0];
  // El grupo-pivote solo aplica si hay rotación real. OJO: si la pieza está cerrada
  // (rot 0) hay que renderizar en coordenadas MUNDO — usar pos-pivot sin el grupo
  // deja la puerta/tapa corrida (metida en el piso o fuera del mueble).
  const pivoting = !!pivot && (!!rotY || !!rotX);
  const gpos: [number, number, number] = pivot ? [pivot[0] + off[0], pivot[1] + off[1], pivot[2] + off[2]] : pos;
  const local: [number, number, number] = pivoting
    ? [pos[0] - pivot![0], pos[1] - pivot![1], pos[2] - pivot![2]]
    : [pos[0] + off[0], pos[1] + off[1], pos[2] + off[2]];
  // Inclinación propia de la pieza (ej. brazos hidráulicos), compuesta con la rotación de la geometría.
  const finalRot: [number, number, number] = rot
    ? [meshRot[0] + rot[0], meshRot[1] + rot[1], meshRot[2] + rot[2]]
    : meshRot;
  const node = (
    <mesh position={local} rotation={finalRot} castShadow receiveShadow>
      {geom}
      <meshStandardMaterial color={color} roughness={0.72} metalness={panel.color || matColor ? 0.2 : 0} />
    </mesh>
  );
  // Pivote de giro: puertas batientes (rotY, eje vertical) y tapas verticales (rotX, eje horizontal).
  return pivoting ? (
    <group position={gpos} rotation={[rotX ?? 0, rotY ?? 0, 0]}>
      {node}
    </group>
  ) : (
    node
  );
}

export default function WorkbenchPreview3D() {
  const draft = useEditor((s) => s.draft);
  const materials = useEditor((s) => s.materials);
  const [explode, setExplode] = useState(0);
  const [openAll, setOpenAll] = useState(0);
  const [turntable, setTurntable] = useState(false);
  const [present, setPresent] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __carcassPanels?: typeof carcassPanels }).__carcassPanels = carcassPanels;
    }
  }, []);

  // Para "abrir todo" aplicamos la apertura a una copia del mueble (no muta el draft).
  const shownDraft = useMemo(() => {
    if (!draft) return null;
    if (openAll <= 0) return draft;
    return { ...draft, components: (draft.components ?? []).map((c) => ({ ...c, open: openAll })) };
  }, [draft, openAll]);

  // Paneles + offset de explosión (cada pieza se aleja del centro del mueble).
  const panels = useMemo(() => {
    if (!shownDraft) return [];
    const ps = carcassPanels(shownDraft);
    if (explode <= 0) return ps as (Panel & { offset?: [number, number, number] })[];
    const cy = shownDraft.baseHeight + shownDraft.height / 2;
    const K = explode * 0.5; // hasta 0.5 m de separación
    return ps.map((p) => {
      const dx = p.pos[0];
      const dy = p.pos[1] - cy;
      const dz = p.pos[2];
      const len = Math.hypot(dx, dy, dz) || 1;
      return { ...p, offset: [(dx / len) * K, (dy / len) * K, (dz / len) * K] as [number, number, number] };
    });
  }, [shownDraft, explode]);

  if (!draft) return null;

  const totalH = draft.height + draft.baseHeight;
  const dist = Math.max(draft.width, draft.height, draft.depth) * 2 + 1.2;
  const bg = present ? "#1a2230" : "#0b0e14";

  return (
    <div className="relative h-full w-full">
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [dist * 0.65, totalH * 0.75 + 0.6, dist], fov: 45 }}
    >
      <color attach="background" args={[bg]} />
      <hemisphereLight args={["#dfe7ff", "#15161a", present ? 0.85 : 0.6]} />
      <ambientLight intensity={present ? 0.4 : 0.25} />
      <directionalLight
        position={[4, 9, 5]}
        intensity={present ? 1.6 : 1.25}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
      />
      {present && <directionalLight position={[-5, 4, -3]} intensity={0.5} />}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color={present ? "#222b3a" : "#0f1320"} roughness={1} />
      </mesh>
      {!present && (
      <Grid
        args={[30, 30]}
        cellSize={0.1}
        cellThickness={0.5}
        cellColor="#243049"
        sectionSize={1}
        sectionThickness={1}
        sectionColor="#3b4a6b"
        fadeDistance={16}
        fadeStrength={1}
        infiniteGrid
        position={[0, 0, 0]}
      />
      )}
      {panels.map((p, i) => (
        <Piece key={i} panel={p} baseColor={draft.color} materials={materials} />
      ))}
      <OrbitControls makeDefault enableDamping autoRotate={turntable} autoRotateSpeed={1.4} target={[0, totalH / 2, 0]} />
    </Canvas>

    {/* Barra de presentación */}
    <div className="pointer-events-auto absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/90 px-3 py-2 text-[11px] text-neutral-300 shadow-xl backdrop-blur">
      <label className="flex items-center gap-1.5" title="Separar las piezas (vista explosionada)">
        <span>Explosión</span>
        <input type="range" min={0} max={1} step={0.02} value={explode} onChange={(e) => setExplode(parseFloat(e.target.value))} className="w-16 accent-sky-500" />
      </label>
      <label className="flex items-center gap-1.5" title="Abrir puertas y cajones">
        <span>Abrir</span>
        <input type="range" min={0} max={1} step={0.05} value={openAll} onChange={(e) => setOpenAll(parseFloat(e.target.value))} className="w-16 accent-sky-500" />
      </label>
      <button
        type="button"
        onClick={() => setTurntable((v) => !v)}
        className={["rounded px-2 py-1", turntable ? "bg-sky-500/20 text-sky-200" : "hover:bg-neutral-800"].join(" ")}
        title="Girar automáticamente"
      >
        ⟳ Girar
      </button>
      <button
        type="button"
        onClick={() => setPresent((v) => !v)}
        className={["rounded px-2 py-1", present ? "bg-sky-500/20 text-sky-200" : "hover:bg-neutral-800"].join(" ")}
        title="Modo presentación (sin grilla, luz suave)"
      >
        ✨ Presentación
      </button>
    </div>
    </div>
  );
}
