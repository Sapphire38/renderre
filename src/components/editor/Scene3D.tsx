"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import { useEditor, selectedRefs } from "@/lib/store";
import { carcassPanels, footprintCorners } from "@/lib/furniture";
import { wallPieces } from "@/lib/openings";
import type { Furniture, Material, Opening, Wall } from "@/lib/types";
import { ExpandIcon, ShrinkIcon, FullscreenIcon } from "./icons";

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  if (Number.isNaN(n)) return hex;
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) + amt * 255)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) + amt * 255)));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) + amt * 255)));
  return `rgb(${r},${g},${b})`;
}

function usePbrMaterial(
  mat: Material | undefined,
  fallbackColor: string,
  repeatX: number,
  repeatY: number,
  selected: boolean,
): THREE.MeshStandardMaterial {
  const material = useMemo(() => {
    if (selected) {
      return new THREE.MeshStandardMaterial({ color: "#38bdf8", roughness: 0.6, metalness: 0 });
    }
    const m = new THREE.MeshStandardMaterial({
      color: mat?.color ?? fallbackColor,
      roughness: mat?.roughness ?? 0.85,
      metalness: mat?.metalness ?? 0,
    });
    if (mat?.albedo) {
      const t = new THREE.TextureLoader().load(mat.albedo);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeatX, repeatY);
      t.colorSpace = THREE.SRGBColorSpace;
      m.map = t;
      m.color.set("#ffffff");
    }
    if (mat?.normal) {
      const n = new THREE.TextureLoader().load(mat.normal);
      n.wrapS = n.wrapT = THREE.RepeatWrapping;
      n.repeat.set(repeatX, repeatY);
      m.normalMap = n;
    }
    m.needsUpdate = true;
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, mat?.id, mat?.albedo, mat?.normal, mat?.color, mat?.roughness, mat?.metalness, repeatX, repeatY, fallbackColor]);

  useEffect(() => {
    return () => {
      material.map?.dispose();
      material.normalMap?.dispose();
      material.dispose();
    };
  }, [material]);

  return material;
}

function BoxPiece({
  pos,
  size,
  mat,
  fallbackColor,
  selected,
  pivot,
  rotY,
  cylinder,
  cylAxis,
}: {
  pos: [number, number, number];
  size: [number, number, number];
  mat?: Material;
  fallbackColor: string;
  selected: boolean;
  pivot?: [number, number, number];
  rotY?: number;
  cylinder?: boolean;
  cylAxis?: "x" | "y" | "z";
}) {
  const tileM = mat?.tileM ?? 1;
  const dims = [...size].sort((a, b) => b - a);
  const material = usePbrMaterial(
    mat,
    fallbackColor,
    Math.max(1, Math.round(dims[0] / tileM)),
    Math.max(1, Math.round(dims[1] / tileM)),
    selected,
  );
  let geom = <boxGeometry args={size} />;
  let meshRot: [number, number, number] | undefined = undefined;
  if (cylinder) {
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

  if (pivot && rotY) {
    const local: [number, number, number] = [pos[0] - pivot[0], pos[1] - pivot[1], pos[2] - pivot[2]];
    return (
      <group position={pivot} rotation={[0, rotY, 0]}>
        <mesh position={local} rotation={meshRot} material={material} castShadow receiveShadow>
          {geom}
        </mesh>
      </group>
    );
  }
  return (
    <mesh position={pos} rotation={meshRot} material={material} castShadow receiveShadow>
      {geom}
    </mesh>
  );
}

function Wall3D({
  wall,
  openings,
  mat,
  selected,
  yOffset = 0,
}: {
  wall: Wall;
  openings: Opening[];
  mat?: Material;
  selected: boolean;
  yOffset?: number;
}) {
  const dx = wall.b.x - wall.a.x;
  const dz = wall.b.z - wall.a.z;
  const len = Math.hypot(dx, dz);
  const pieces = useMemo(() => wallPieces(wall, openings), [wall, openings]);
  if (len < 1e-4) return null;
  const mx = (wall.a.x + wall.b.x) / 2;
  const mz = (wall.a.z + wall.b.z) / 2;
  return (
    <group position={[mx, yOffset, mz]} rotation={[0, Math.atan2(-dz, dx), 0]}>
      {pieces.map((p, i) => (
        <BoxPiece
          key={i}
          pos={[p.x, p.yc, 0]}
          size={[p.w, p.h, wall.thickness]}
          mat={mat}
          fallbackColor="#d6d3cd"
          selected={selected}
        />
      ))}
    </group>
  );
}

function Furniture3D({
  f,
  mat,
  materials,
  selected,
  yOffset = 0,
}: {
  f: Furniture;
  mat?: Material;
  materials: Material[];
  selected: boolean;
  yOffset?: number;
}) {
  const panels = useMemo(() => carcassPanels(f), [f]);
  const a = (f.rotDeg * Math.PI) / 180;
  return (
    <group position={[f.pos.x, yOffset, f.pos.z]} rotation={[0, -a, 0]}>
      {panels.map((p, i) => {
        const panelMat = p.materialId ? materials.find((m) => m.id === p.materialId) : p.color ? undefined : mat;
        return (
          <BoxPiece
            key={i}
            pos={p.pos}
            size={p.size}
            mat={panelMat}
            fallbackColor={p.color ?? (p.door ? shade(f.color, -0.05) : f.color)}
            selected={selected}
            pivot={p.pivot}
            rotY={p.rotY}
            cylinder={p.cylinder}
            cylAxis={p.cylAxis}
          />
        );
      })}
    </group>
  );
}

function Floor({ mat }: { mat?: Material }) {
  const tileM = mat?.tileM ?? 1;
  const rep = Math.max(1, Math.min(80, Math.round(40 / tileM)));
  const material = usePbrMaterial(mat, "#0f1320", rep, rep, false);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} material={material} receiveShadow>
      <planeGeometry args={[80, 80]} />
    </mesh>
  );
}

/** Losa de piso de un nivel: cubre la huella (muros + muebles) a la altura del nivel. */
function FloorSlab({
  minX,
  maxX,
  minZ,
  maxZ,
  y,
  mat,
}: {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  y: number;
  mat?: Material;
}) {
  const w = Math.max(maxX - minX, 0.2);
  const d = Math.max(maxZ - minZ, 0.2);
  const tileM = mat?.tileM ?? 1;
  const repX = Math.max(1, Math.min(60, Math.round(w / tileM)));
  const repZ = Math.max(1, Math.min(60, Math.round(d / tileM)));
  const material = usePbrMaterial(mat, "#171c28", repX, repZ, false);
  const th = 0.06;
  return (
    <mesh position={[(minX + maxX) / 2, y - th / 2, (minZ + maxZ) / 2]} material={material} receiveShadow castShadow>
      <boxGeometry args={[w, th, d]} />
    </mesh>
  );
}

function Scene() {
  const walls = useEditor((s) => s.walls);
  const furniture = useEditor((s) => s.furniture);
  const openings = useEditor((s) => s.openings);
  const materials = useEditor((s) => s.materials);
  const floorMaterialId = useEditor((s) => s.floorMaterialId);
  const floors = useEditor((s) => s.floors);
  const selection = useEditor((s) => s.selection);
  const multi = useEditor((s) => s.multi);
  const getMat = (id?: string) => materials.find((m) => m.id === id);
  const elevOf = (lvl?: number) => floors[lvl ?? 0]?.elevation ?? 0;
  const sel = new Set(selectedRefs(selection, multi).map((r) => `${r.kind}:${r.id}`));

  // Una losa de piso por nivel, dimensionada a la huella (muros + muebles) de ese nivel.
  const PAD = 0.15;
  const slabs = floors
    .map((fl, lvl) => {
      let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity, has = false;
      const add = (x: number, z: number) => {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
        has = true;
      };
      for (const w of walls) if ((w.level ?? 0) === lvl) { add(w.a.x, w.a.z); add(w.b.x, w.b.z); }
      for (const f of furniture) if ((f.level ?? 0) === lvl) for (const p of footprintCorners(f)) add(p.x, p.z);
      if (!has) return null;
      return { lvl, minX: minX - PAD, maxX: maxX + PAD, minZ: minZ - PAD, maxZ: maxZ + PAD, y: fl.elevation };
    })
    .filter((s): s is { lvl: number; minX: number; maxX: number; minZ: number; maxZ: number; y: number } => s !== null);

  return (
    <>
      <color attach="background" args={["#0b0e14"]} />
      <hemisphereLight args={["#dfe7ff", "#1a1a1a", 0.55]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[8, 14, 6]}
        intensity={1.25}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={0.5}
        shadow-camera-far={60}
      />

      <Floor mat={getMat(floorMaterialId)} />
      {slabs.map((s) => (
        <FloorSlab key={s.lvl} minX={s.minX} maxX={s.maxX} minZ={s.minZ} maxZ={s.maxZ} y={s.y} mat={getMat(floorMaterialId)} />
      ))}

      <Grid
        args={[60, 60]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#2a3850"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#46587d"
        fadeDistance={50}
        fadeStrength={1}
        infiniteGrid
        position={[0, 0.001, 0]}
      />

      {walls.map((w) => (
        <Wall3D
          key={w.id}
          wall={w}
          openings={openings}
          mat={getMat(w.materialId)}
          selected={sel.has(`wall:${w.id}`)}
          yOffset={elevOf(w.level)}
        />
      ))}
      {furniture.map((f) => (
        <Furniture3D
          key={f.id}
          f={f}
          mat={getMat(f.materialId)}
          materials={materials}
          selected={sel.has(`furniture:${f.id}`)}
          yOffset={elevOf(f.level)}
        />
      ))}

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.12}
        minDistance={1}
        maxDistance={120}
        maxPolarAngle={Math.PI / 2.02}
      />
    </>
  );
}

export default function Scene3D({
  big = false,
  onToggleBig,
}: {
  big?: boolean;
  onToggleBig?: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);

  const exportPng = () => {
    const cv = wrapRef.current?.querySelector("canvas");
    if (!cv) return;
    try {
      const url = cv.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `renderre-${Date.now()}.png`;
      a.click();
    } catch {
      window.alert("No se pudo exportar la imagen.");
    }
  };

  const toggleFullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  // Escape para salir del modo agrandado.
  useEffect(() => {
    if (!big) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) onToggleBig?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [big, onToggleBig]);

  const btn =
    "grid h-7 w-7 place-items-center rounded-md bg-neutral-800/90 text-neutral-100 hover:bg-neutral-700";

  return (
    <div ref={wrapRef} className="relative h-full w-full bg-[#0b0e14]">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ preserveDrawingBuffer: true }}
        camera={{ position: [9, 9, 12], fov: 50, near: 0.1, far: 500 }}
      >
        <Scene />
      </Canvas>
      <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/40 px-2 py-1 text-[11px] text-neutral-400">
        Vista 3D · arrastrá para orbitar · rueda para zoom{big ? " · Esc para volver" : ""}
      </div>
      <div className="absolute right-2 top-2 flex items-center gap-1">
        <button type="button" onClick={onToggleBig} title={big ? "Restaurar" : "Agrandar"} className={btn}>
          {big ? <ShrinkIcon width={16} height={16} /> : <ExpandIcon width={16} height={16} />}
        </button>
        <button type="button" onClick={toggleFullscreen} title="Pantalla completa" className={btn}>
          <FullscreenIcon width={16} height={16} />
        </button>
        <button
          type="button"
          onClick={exportPng}
          title="Exportar la vista 3D como PNG"
          className="rounded-md bg-neutral-800/90 px-2.5 py-1 text-[11px] font-medium text-neutral-100 hover:bg-neutral-700"
        >
          ⬇ PNG
        </button>
      </div>
    </div>
  );
}
