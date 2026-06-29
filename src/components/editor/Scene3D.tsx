"use client";

import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { Grid, OrbitControls, useGLTF } from "@react-three/drei";
import { useEditor, selectedRefs } from "@/lib/store";
import { carcassPanels, footprintCorners } from "@/lib/furniture";
import { wallPieces } from "@/lib/openings";
import { isSolidWall, defaultWallColor, fencePieces } from "@/lib/walls";
import { modelFor, type ModelDef } from "@/lib/models";
import { roomPolygons } from "@/lib/rooms";
import type { Furniture, Material, Opening, Roof, Surface, Vec2, Wall } from "@/lib/types";
import { ExpandIcon, ShrinkIcon, FullscreenIcon } from "./icons";
import Terrain3D from "./Terrain3D";

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __rooms?: typeof roomPolygons }).__rooms = roomPolygons;
}

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
  opacity = 1,
  emissive?: string,
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
    const op = Math.min(opacity, mat?.opacity ?? 1);
    if (op < 1) {
      m.transparent = true;
      m.opacity = op;
      m.depthWrite = false;
    }
    if (emissive) {
      m.emissive = new THREE.Color(emissive);
      m.emissiveIntensity = 0.9;
    }
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
  }, [selected, mat?.id, mat?.albedo, mat?.normal, mat?.color, mat?.roughness, mat?.metalness, mat?.opacity, repeatX, repeatY, fallbackColor, opacity, emissive]);

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
  shape,
  opacity = 1,
  emissive,
  rot,
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
  shape?: "sphere" | "cone" | "pyramid" | "wedge";
  opacity?: number;
  emissive?: string;
  rot?: [number, number, number];
}) {
  const tileM = mat?.tileM ?? 1;
  const dims = [...size].sort((a, b) => b - a);
  const material = usePbrMaterial(
    mat,
    fallbackColor,
    Math.max(1, Math.round(dims[0] / tileM)),
    Math.max(1, Math.round(dims[1] / tileM)),
    selected,
    opacity,
    emissive,
  );
  // Geometría de cuña (prisma triangular) construida a mano; rampa que sube en +X.
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
  let meshRot: [number, number, number] | undefined = undefined;
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

  // Inclinación propia de la pieza (capó/parabrisas/proa), compuesta con la rotación de la geometría.
  const finalRot: [number, number, number] | undefined = rot
    ? [(meshRot?.[0] ?? 0) + rot[0], (meshRot?.[1] ?? 0) + rot[1], (meshRot?.[2] ?? 0) + rot[2]]
    : meshRot;

  if (pivot && rotY) {
    const local: [number, number, number] = [pos[0] - pivot[0], pos[1] - pivot[1], pos[2] - pivot[2]];
    return (
      <group position={pivot} rotation={[0, rotY, 0]}>
        <mesh position={local} rotation={finalRot} material={material} castShadow receiveShadow>
          {geom}
        </mesh>
      </group>
    );
  }
  return (
    <mesh position={pos} rotation={finalRot} material={material} castShadow receiveShadow>
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
  const base = wall.base ?? 0;
  const topA = wall.heightA ?? wall.height;
  const topB = wall.heightB ?? wall.height;
  const topMin = Math.min(topA, topB);
  const bodyH = Math.max(topMin - base, 0.01);
  const kind = wall.kind ?? "solid";
  const solid = isSolidWall(kind);
  const kindColor = defaultWallColor(kind);
  const glassOpacity = kind === "glass" ? 0.3 : 1;
  // Cercos calados (alambrado/reja/cerco de madera): postes + barrotes/alambres.
  const fenceBoxes = useMemo(
    () => (!solid ? fencePieces(len, bodyH, wall.thickness, kind) : []),
    [solid, len, bodyH, wall.thickness, kind],
  );
  // El cuerpo rectangular (con aberturas) va de la base hasta el tope más bajo.
  const bodyWall = useMemo<Wall>(
    () => ({ ...wall, base: 0, height: bodyH, heightA: undefined, heightB: undefined }),
    [wall, bodyH],
  );
  const pieces = useMemo(() => wallPieces(bodyWall, openings), [bodyWall, openings]);
  // Triángulo "piñón" para el tope inclinado (de topMin al tope más alto en una punta).
  const gableGeom = useMemo(() => {
    if (Math.abs(topA - topB) < 1e-4) return null;
    const half = len / 2;
    const yLow = bodyH; // = topMin - base (local)
    const shape = new THREE.Shape();
    if (topA >= topB) {
      shape.moveTo(-half, yLow);
      shape.lineTo(-half, topA - base);
      shape.lineTo(half, yLow);
    } else {
      shape.moveTo(half, yLow);
      shape.lineTo(half, topB - base);
      shape.lineTo(-half, yLow);
    }
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: wall.thickness, bevelEnabled: false });
    g.translate(0, 0, -wall.thickness / 2);
    return g;
  }, [topA, topB, base, bodyH, len, wall.thickness]);
  useEffect(() => () => gableGeom?.dispose(), [gableGeom]);
  if (len < 1e-4) return null;
  const mx = (wall.a.x + wall.b.x) / 2;
  const mz = (wall.a.z + wall.b.z) / 2;
  const rotY = Math.atan2(-dz, dx);

  // Cerco calado: una caja por poste/barrote/alambre.
  if (!solid) {
    return (
      <group position={[mx, yOffset + base, mz]} rotation={[0, rotY, 0]}>
        {fenceBoxes.map((b, i) => (
          <BoxPiece key={i} pos={b.pos} size={b.size} mat={mat} fallbackColor={kindColor} selected={selected} />
        ))}
      </group>
    );
  }

  const gableColor = selected ? "#38bdf8" : mat?.color ?? kindColor;
  return (
    <group position={[mx, yOffset + base, mz]} rotation={[0, rotY, 0]}>
      {pieces.map((p, i) => (
        <BoxPiece
          key={i}
          pos={[p.x, p.yc, 0]}
          size={[p.w, p.h, wall.thickness]}
          mat={mat}
          fallbackColor={kindColor}
          selected={selected}
          opacity={glassOpacity}
        />
      ))}
      {gableGeom && (
        <mesh geometry={gableGeom} castShadow receiveShadow>
          <meshStandardMaterial color={gableColor} roughness={mat?.roughness ?? 0.85} metalness={mat?.metalness ?? 0} transparent={glassOpacity < 1} opacity={glassOpacity} />
        </mesh>
      )}
    </group>
  );
}

/** Modelo procedural (cajas) de un mueble/objeto. */
function ProceduralFurniture({
  f,
  mat,
  materials,
  selected,
}: {
  f: Furniture;
  mat?: Material;
  materials: Material[];
  selected: boolean;
}) {
  const panels = useMemo(() => carcassPanels(f), [f]);
  return (
    <>
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
            shape={p.shape}
            emissive={p.emissive}
            opacity={p.opacity ?? 1}
            rot={p.rot}
          />
        );
      })}
    </>
  );
}

/** Modelo externo (.glb) auto-escalado a las dimensiones del mueble. Suspende mientras carga. */
function GltfModel({ f, model }: { f: Furniture; model: ModelDef }) {
  const { scene } = useGLTF(model.url);
  const obj = useMemo(() => {
    const c = scene.clone(true);
    const box = new THREE.Box3().setFromObject(c);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    let s = model.scale ?? 1;
    if (model.scale == null && model.fit !== false) {
      s = Math.min(f.width / (size.x || 1), f.depth / (size.z || 1));
      if (!Number.isFinite(s) || s <= 0) s = 1;
    }
    c.scale.setScalar(s);
    c.position.set(-center.x * s, -box.min.y * s + (model.yOffset ?? 0), -center.z * s);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
    });
    return c;
  }, [scene, f.width, f.depth, model.scale, model.fit, model.yOffset]);
  return (
    <group position={[0, f.baseHeight, 0]} rotation={[0, ((model.rotDeg ?? 0) * Math.PI) / 180, 0]}>
      <primitive object={obj} />
    </group>
  );
}

/** Si el .glb falla (ausente/ inválido), cae al modelo procedural. */
class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    /* el fallback procedural ya cubre el caso; no rompemos la escena */
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
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
  const a = (f.rotDeg * Math.PI) / 180;
  const model: ModelDef | undefined = f.modelUrl ? { url: f.modelUrl, fit: true } : modelFor(f.kind);
  const procedural = <ProceduralFurniture f={f} mat={mat} materials={materials} selected={selected} />;
  return (
    <group position={[f.pos.x, yOffset, f.pos.z]} rotation={[0, -a, 0]}>
      {model ? (
        <ModelBoundary fallback={procedural}>
          <Suspense fallback={procedural}>
            <GltfModel f={f} model={model} />
          </Suspense>
        </ModelBoundary>
      ) : (
        procedural
      )}
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
/** Piso de un ambiente: losa fina con la forma del polígono del recinto (no una caja). */
function RoomFloor({ poly, y, mat }: { poly: Vec2[]; y: number; mat?: Material }) {
  const tileM = mat?.tileM ?? 1;
  const geom = useMemo(() => {
    const shape = new THREE.Shape();
    poly.forEach((p, i) => (i ? shape.lineTo(p.x, p.z) : shape.moveTo(p.x, p.z)));
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false });
    return g;
  }, [poly]);
  useEffect(() => () => geom.dispose(), [geom]);

  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: mat?.color ?? "#171c28", roughness: mat?.roughness ?? 0.9, metalness: mat?.metalness ?? 0 });
    if (mat?.albedo) {
      const t = new THREE.TextureLoader().load(mat.albedo);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(1 / tileM, 1 / tileM); // uv en metros → una repetición cada tileM
      t.colorSpace = THREE.SRGBColorSpace;
      m.map = t;
      m.color.set("#ffffff");
    }
    if (mat?.normal) {
      const n = new THREE.TextureLoader().load(mat.normal);
      n.wrapS = n.wrapT = THREE.RepeatWrapping;
      n.repeat.set(1 / tileM, 1 / tileM);
      m.normalMap = n;
    }
    return m;
  }, [mat?.id, mat?.color, mat?.albedo, mat?.normal, mat?.roughness, mat?.metalness, tileM]);
  useEffect(() => () => { material.map?.dispose(); material.normalMap?.dispose(); material.dispose(); }, [material]);

  // Shape en XY → al piso (XZ) con rotación +90° en X; el espesor baja desde la cota y.
  return <mesh geometry={geom} material={material} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow castShadow />;
}

/** Superficie de suelo: losa fina (rectángulo o círculo/elipse) sobre el suelo del nivel. */
function Surface3D({
  s,
  mat,
  selected,
  yOffset = 0,
}: {
  s: Surface;
  mat?: Material;
  selected: boolean;
  yOffset?: number;
}) {
  const lift = s.lift ?? 0.01;
  const th = s.thickness ?? 0.04;
  const a = (s.rotDeg * Math.PI) / 180;
  const tileM = mat?.tileM ?? 1;
  const repX = Math.max(1, Math.min(80, Math.round(s.width / tileM)));
  const repZ = Math.max(1, Math.min(80, Math.round(s.depth / tileM)));
  const material = usePbrMaterial(mat, s.color ?? "#7d7468", repX, repZ, selected);
  return (
    <group position={[s.pos.x, yOffset + lift, s.pos.z]} rotation={[0, -a, 0]}>
      {s.shape === "circle" ? (
        <mesh position={[0, -th / 2, 0]} scale={[s.width, 1, s.depth]} material={material} receiveShadow castShadow>
          <cylinderGeometry args={[0.5, 0.5, th, 48]} />
        </mesh>
      ) : (
        <mesh position={[0, -th / 2, 0]} material={material} receiveShadow castShadow>
          <boxGeometry args={[s.width, th, s.depth]} />
        </mesh>
      )}
    </group>
  );
}

type Bounds3 = { minX: number; maxX: number; minZ: number; maxZ: number };

/** Dos faldones de un techo a dos aguas, sobre la huella, con cumbrera en el eje dado. */
function buildRoofGable(b: Bounds3, baseY: number, rise: number, axis: "x" | "z"): THREE.BufferGeometry {
  const ridgeY = baseY + rise;
  let v: number[];
  if (axis === "x") {
    const mz = (b.minZ + b.maxZ) / 2;
    v = [
      // faldón lado -Z
      b.minX, baseY, b.minZ, b.maxX, baseY, b.minZ, b.maxX, ridgeY, mz,
      b.minX, baseY, b.minZ, b.maxX, ridgeY, mz, b.minX, ridgeY, mz,
      // faldón lado +Z
      b.minX, baseY, b.maxZ, b.maxX, ridgeY, mz, b.maxX, baseY, b.maxZ,
      b.minX, baseY, b.maxZ, b.minX, ridgeY, mz, b.maxX, ridgeY, mz,
    ];
  } else {
    const mx = (b.minX + b.maxX) / 2;
    v = [
      // faldón lado -X
      b.minX, baseY, b.minZ, b.minX, baseY, b.maxZ, mx, ridgeY, b.maxZ,
      b.minX, baseY, b.minZ, mx, ridgeY, b.maxZ, mx, ridgeY, b.minZ,
      // faldón lado +X
      b.maxX, baseY, b.minZ, mx, ridgeY, b.minZ, mx, ridgeY, b.maxZ,
      b.maxX, baseY, b.minZ, mx, ridgeY, b.maxZ, b.maxX, baseY, b.maxZ,
    ];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

/** Techo de una sola caída (mono-pendiente): plano inclinado del lado bajo al alto. */
function buildRoofShed(b: Bounds3, baseY: number, rise: number, axis: "x" | "z"): THREE.BufferGeometry {
  const hiY = baseY + rise;
  let v: number[];
  if (axis === "x") {
    // borde alto corre a lo largo de X; pendiente en Z (bajo en -Z, alto en +Z)
    v = [
      b.minX, baseY, b.minZ, b.maxX, baseY, b.minZ, b.maxX, hiY, b.maxZ,
      b.minX, baseY, b.minZ, b.maxX, hiY, b.maxZ, b.minX, hiY, b.maxZ,
    ];
  } else {
    // borde alto corre a lo largo de Z; pendiente en X (bajo en -X, alto en +X)
    v = [
      b.minX, baseY, b.minZ, b.maxX, hiY, b.minZ, b.maxX, hiY, b.maxZ,
      b.minX, baseY, b.minZ, b.maxX, hiY, b.maxZ, b.minX, baseY, b.maxZ,
    ];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

/** Techo de un nivel: losa plana, a dos aguas o de una caída, sobre la huella de los muros. */
function Roof3D({ roof, bounds, elevation, mat }: { roof: Roof; bounds: Bounds3; elevation: number; mat?: Material }) {
  const w = Math.max(bounds.maxX - bounds.minX, 0.2);
  const d = Math.max(bounds.maxZ - bounds.minZ, 0.2);
  const tileM = mat?.tileM ?? 1;
  const repX = Math.max(1, Math.min(60, Math.round(w / tileM)));
  const repZ = Math.max(1, Math.min(60, Math.round(d / tileM)));
  const flatMat = usePbrMaterial(mat, "#7c8088", repX, repZ, false);
  const baseY = elevation + roof.height;
  const gable = useMemo(() => {
    const axis = roof.ridgeAxis ?? (w >= d ? "x" : "z");
    if (roof.kind === "gable") return buildRoofGable(bounds, baseY, roof.rise, axis);
    if (roof.kind === "shed") return buildRoofShed(bounds, baseY, roof.rise, axis);
    return null;
  }, [roof.kind, roof.rise, roof.ridgeAxis, bounds, baseY, w, d]);
  useEffect(() => () => gable?.dispose(), [gable]);

  if (roof.kind === "flat") {
    const th = roof.thickness ?? 0.12;
    return (
      <mesh position={[(bounds.minX + bounds.maxX) / 2, baseY + th / 2, (bounds.minZ + bounds.maxZ) / 2]} material={flatMat} castShadow receiveShadow>
        <boxGeometry args={[w, th, d]} />
      </mesh>
    );
  }
  if (!gable) return null;
  return (
    <mesh geometry={gable} castShadow receiveShadow>
      <meshStandardMaterial color={mat?.color ?? "#9a6a4a"} roughness={mat?.roughness ?? 0.85} metalness={mat?.metalness ?? 0} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** Encuadra la cámara 3D para ver todo (lo dispara el MCP vía renderre_fit_view_3d). */
function Fit3D() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | undefined;
  const walls = useEditor((s) => s.walls);
  const furniture = useEditor((s) => s.furniture);
  const floors = useEditor((s) => s.floors);
  useEffect(() => {
    const onFit = () => {
      const elev = (lvl?: number) => floors[lvl ?? 0]?.elevation ?? 0;
      let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity, maxY = 0, has = false;
      const addXZ = (x: number, z: number) => {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); has = true;
      };
      for (const w of walls) { addXZ(w.a.x, w.a.z); addXZ(w.b.x, w.b.z); maxY = Math.max(maxY, elev(w.level) + w.height); }
      for (const f of furniture) { for (const p of footprintCorners(f)) addXZ(p.x, p.z); maxY = Math.max(maxY, elev(f.level) + f.baseHeight + f.height); }
      if (!has) {
        camera.position.set(9, 9, 12);
        if (controls) { controls.target.set(0, 1, 0); controls.update(); } else camera.lookAt(0, 1, 0);
        return;
      }
      const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2, cy = Math.max(maxY, 1) / 2;
      const size = Math.max(maxX - minX, maxZ - minZ, maxY, 1);
      const dist = size * 1.5 + 3;
      camera.position.set(cx + dist * 0.7, cy + dist * 0.7, cz + dist);
      if (controls) { controls.target.set(cx, cy, cz); controls.update(); } else camera.lookAt(cx, cy, cz);
    };
    window.addEventListener("renderre:fit3d", onFit);
    return () => window.removeEventListener("renderre:fit3d", onFit);
  }, [walls, furniture, floors, camera, controls]);
  return null;
}

/** Guarda/restaura la cámara (posición + target) en localStorage. Para el visor en pestaña aparte. */
function CameraPersist({ storageKey }: { storageKey: string }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as
    | { target: THREE.Vector3; update: () => void; addEventListener: (t: string, f: () => void) => void; removeEventListener: (t: string, f: () => void) => void }
    | undefined;
  const restored = useRef(false);
  useEffect(() => {
    if (!controls) return;
    if (!restored.current) {
      restored.current = true;
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const v = JSON.parse(raw);
          camera.position.set(v.px, v.py, v.pz);
          controls.target.set(v.tx, v.ty, v.tz);
          controls.update();
        }
      } catch {
        /* sin cámara guardada */
      }
    }
    let t: ReturnType<typeof setTimeout> | null = null;
    const save = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        try {
          const tg = controls.target;
          localStorage.setItem(
            storageKey,
            JSON.stringify({ px: camera.position.x, py: camera.position.y, pz: camera.position.z, tx: tg.x, ty: tg.y, tz: tg.z }),
          );
        } catch {
          /* localStorage lleno: ignorar */
        }
      }, 400);
    };
    controls.addEventListener("change", save);
    return () => {
      if (t) clearTimeout(t);
      controls.removeEventListener("change", save);
    };
  }, [controls, camera, storageKey]);
  return null;
}

/** Altura local (m) del punto luminoso de una luminaria, o null si el mueble no es una luz. */
function lampEmitterY(f: Furniture): number | null {
  const H = f.height;
  switch (f.kind) {
    case "streetlamp": return H + 0.13;
    case "bollard-light": return H * 0.96;
    case "table-lamp": return H * 0.82;
    case "floor-lamp": return H * 0.9;
    case "pendant-lamp": return H * 0.16;
    case "wall-lamp": return H * 0.5;
    case "campfire": return H * 0.6;
    default: return null;
  }
}
const MAX_LAMP_LIGHTS = 24; // tope para no pasarnos de luces (perf WebGL)
const MAX_LAMP_SHADOWS = 3; // cuántas luminarias proyectan sombra (los cube shadow maps son caros)

function Scene({ persistCameraKey }: { persistCameraKey?: string }) {
  const walls = useEditor((s) => s.walls);
  const furniture = useEditor((s) => s.furniture);
  const openings = useEditor((s) => s.openings);
  const surfaces = useEditor((s) => s.surfaces);
  const materials = useEditor((s) => s.materials);
  const floorMaterialId = useEditor((s) => s.floorMaterialId);
  const floors = useEditor((s) => s.floors);
  const selection = useEditor((s) => s.selection);
  const multi = useEditor((s) => s.multi);
  const roofs = useEditor((s) => s.roofs);
  const render = useEditor((s) => s.render);
  const getMat = (id?: string) => materials.find((m) => m.id === id);
  // Posición del sol a partir de azimut/elevación (esféricas → cartesianas).
  const az = (render.sunAzimuth * Math.PI) / 180;
  const el = (render.sunElevation * Math.PI) / 180;
  const sunR = 18;
  const sunPos: [number, number, number] = [
    sunR * Math.cos(el) * Math.sin(az),
    Math.max(0.5, sunR * Math.sin(el)),
    sunR * Math.cos(el) * Math.cos(az),
  ];
  const elevOf = (lvl?: number) => floors[lvl ?? 0]?.elevation ?? 0;
  const sel = new Set(selectedRefs(selection, multi).map((r) => `${r.kind}:${r.id}`));

  // Luces reales de las luminarias (point lights cálidos), con tope de cantidad.
  // Las primeras MAX_LAMP_SHADOWS proyectan sombra (solo si las sombras están activas).
  const lampInt = render.lampIntensity ?? 8;
  const lamps =
    render.lampLights === false
      ? []
      : furniture
          .map((f) => {
            const y = lampEmitterY(f);
            return y == null ? null : { id: f.id, pos: [f.pos.x, elevOf(f.level) + f.baseHeight + y, f.pos.z] as [number, number, number] };
          })
          .filter((x): x is { id: string; pos: [number, number, number] } => x !== null)
          .slice(0, MAX_LAMP_LIGHTS)
          .map((l, i) => ({ ...l, shadow: render.shadows !== false && i < MAX_LAMP_SHADOWS }));

  // Piso por AMBIENTE: el suelo se genera sólo donde los muros encierran un recinto.
  // Así una medianera/perímetro abierto, un seto o muros sueltos NO generan piso (no
  // tapan el terreno). Sólo cuentan las paredes reales del edificio (no cercos/setos).
  const roomFloors = floors.flatMap((fl, lvl) => {
    if (fl.autoSlab === false) return [];
    const segs = walls
      .filter((w) => (w.level ?? 0) === lvl && !["hedge", "fence", "railing", "picket"].includes(w.kind ?? "solid"))
      .map((w) => ({ a: w.a, b: w.b }));
    return roomPolygons(segs).map((poly, i) => ({ key: `${lvl}-${i}`, poly, y: fl.elevation, lvl }));
  });

  // Techos: cubren la huella de los MUROS del nivel (+ alero/overhang).
  const roofsR = roofs
    .map((r) => {
      let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity, has = false;
      for (const w of walls) if ((w.level ?? 0) === r.level) {
        for (const p of [w.a, w.b]) {
          minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
          minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); has = true;
        }
      }
      if (!has) return null;
      const o = r.overhang ?? 0;
      return { roof: r, bounds: { minX: minX - o, maxX: maxX + o, minZ: minZ - o, maxZ: maxZ + o }, elevation: floors[r.level]?.elevation ?? 0 };
    })
    .filter((x): x is { roof: Roof; bounds: Bounds3; elevation: number } => x !== null);

  return (
    <>
      <color attach="background" args={[render.background]} />
      <hemisphereLight args={["#dfe7ff", "#1a1a1a", 0.55]} />
      <ambientLight intensity={render.ambient} />
      <directionalLight
        position={sunPos}
        intensity={render.sunIntensity}
        castShadow={render.shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={0.5}
        shadow-camera-far={60}
        shadow-radius={4}
        shadow-bias={-0.0004}
      />

      <Floor mat={getMat(floorMaterialId)} />
      <Terrain3D />
      {roomFloors.map((s) => (
        <RoomFloor key={s.key} poly={s.poly} y={s.y} mat={getMat(floors[s.lvl]?.materialId ?? floorMaterialId)} />
      ))}
      {surfaces.map((s) => (
        <Surface3D
          key={s.id}
          s={s}
          mat={getMat(s.materialId)}
          selected={sel.has(`surface:${s.id}`)}
          yOffset={elevOf(s.level)}
        />
      ))}
      {roofsR.map((r) => (
        <Roof3D key={r.roof.id} roof={r.roof} bounds={r.bounds} elevation={r.elevation} mat={getMat(r.roof.materialId)} />
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
      {lamps.map((l) => (
        <pointLight
          key={l.id}
          position={l.pos}
          color="#ffdca8"
          intensity={lampInt}
          distance={9}
          decay={2}
          castShadow={l.shadow}
          shadow-mapSize={[512, 512]}
          shadow-bias={-0.002}
        />
      ))}

      <Fit3D />
      {persistCameraKey && <CameraPersist storageKey={persistCameraKey} />}

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
  floating = false,
  onToggleFloat,
  onOpenTab,
  chrome = true,
  persistCameraKey,
}: {
  big?: boolean;
  onToggleBig?: () => void;
  floating?: boolean;
  onToggleFloat?: () => void;
  onOpenTab?: () => void;
  chrome?: boolean;
  persistCameraKey?: string;
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

  // Exportar PNG por evento (lo dispara el MCP vía renderre_export_png).
  useEffect(() => {
    const onExport = () => exportPng();
    window.addEventListener("renderre:exportpng", onExport);
    return () => window.removeEventListener("renderre:exportpng", onExport);
  }, []);

  // Escape para salir del modo agrandado o flotante.
  useEffect(() => {
    if (!big && !floating) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) (big ? onToggleBig : onToggleFloat)?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [big, floating, onToggleBig, onToggleFloat]);

  const btn =
    "grid h-7 w-7 place-items-center rounded-md bg-neutral-800/90 text-neutral-100 hover:bg-neutral-700";

  return (
    <div ref={wrapRef} className="relative h-full w-full bg-[#0b0e14]">
      <Canvas
        shadows="soft"
        dpr={[1, 2]}
        gl={{ preserveDrawingBuffer: true }}
        camera={{ position: [9, 9, 12], fov: 50, near: 0.1, far: 500 }}
      >
        <Scene persistCameraKey={persistCameraKey} />
      </Canvas>
      {chrome && (
      <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/40 px-2 py-1 text-[11px] text-neutral-400">
        Vista 3D · arrastrá para orbitar · rueda para zoom{big ? " · Esc para volver" : ""}
      </div>
      )}
      {chrome && (
      <div className="absolute right-2 top-2 flex items-center gap-1">
        {onOpenTab && (
          <button type="button" onClick={onOpenTab} title="Abrir la vista 3D en otra pestaña" className={btn}>
            ⧉↗
          </button>
        )}
        {onToggleFloat && (
          <button
            type="button"
            onClick={onToggleFloat}
            title={floating ? "Anclar la vista 3D" : "Abrir en ventana flotante"}
            className={btn}
          >
            {floating ? "⤓" : "⧉"}
          </button>
        )}
        {onToggleBig && (
          <button type="button" onClick={onToggleBig} title={big ? "Restaurar" : "Agrandar"} className={btn}>
            {big ? <ShrinkIcon width={16} height={16} /> : <ExpandIcon width={16} height={16} />}
          </button>
        )}
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
      )}
    </div>
  );
}
