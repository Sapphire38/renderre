"use client";

import { useEffect, useMemo } from "react";
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

function Piece({ panel, baseColor, materials }: { panel: Panel; baseColor: string; materials: Material[] }) {
  const { pos, size, cylinder, cylAxis, shape, pivot, rotY, door } = panel;
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
  const local: [number, number, number] = pivot
    ? [pos[0] - pivot[0], pos[1] - pivot[1], pos[2] - pivot[2]]
    : pos;
  const node = (
    <mesh position={local} rotation={meshRot} castShadow receiveShadow>
      {geom}
      <meshStandardMaterial color={color} roughness={0.72} metalness={panel.color || matColor ? 0.2 : 0} />
    </mesh>
  );
  return pivot && rotY ? (
    <group position={pivot} rotation={[0, rotY, 0]}>
      {node}
    </group>
  ) : (
    node
  );
}

export default function WorkbenchPreview3D() {
  const draft = useEditor((s) => s.draft);
  const materials = useEditor((s) => s.materials);
  const panels = useMemo(() => (draft ? carcassPanels(draft) : []), [draft]);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __carcassPanels?: typeof carcassPanels }).__carcassPanels = carcassPanels;
    }
  }, []);
  if (!draft) return null;

  const totalH = draft.height + draft.baseHeight;
  const dist = Math.max(draft.width, draft.height, draft.depth) * 2 + 1.2;

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [dist * 0.65, totalH * 0.75 + 0.6, dist], fov: 45 }}
    >
      <color attach="background" args={["#0b0e14"]} />
      <hemisphereLight args={["#dfe7ff", "#15161a", 0.6]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[4, 9, 5]}
        intensity={1.25}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#0f1320" roughness={1} />
      </mesh>
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
      {panels.map((p, i) => (
        <Piece key={i} panel={p} baseColor={draft.color} materials={materials} />
      ))}
      <OrbitControls makeDefault enableDamping target={[0, totalH / 2, 0]} />
    </Canvas>
  );
}
