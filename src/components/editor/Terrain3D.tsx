"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useEditor } from "@/lib/store";
import { buildTerrainGeometry } from "@/lib/terrain";

/** Renderiza la malla de terreno esculpible (si está habilitada) dentro del Canvas 3D. */
export default function Terrain3D() {
  const terrain = useEditor((s) => s.terrain);
  const materials = useEditor((s) => s.materials);
  const mat = terrain.materialId ? materials.find((m) => m.id === terrain.materialId) : undefined;

  const geom = useMemo(() => {
    const { positions, indices, uvs } = buildTerrainGeometry(terrain);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    g.setIndex(new THREE.BufferAttribute(indices, 1));
    g.computeVertexNormals();
    return g;
    // recomputar cuando cambian alturas o grilla
  }, [terrain.heights, terrain.cols, terrain.rows, terrain.cell, terrain.origin.x, terrain.origin.z]);
  useEffect(() => () => geom.dispose(), [geom]);

  const sizeX = terrain.cols * terrain.cell;
  const sizeZ = terrain.rows * terrain.cell;
  const tileM = mat?.tileM ?? 2;
  const repX = Math.max(1, Math.min(80, Math.round(sizeX / tileM)));
  const repZ = Math.max(1, Math.min(80, Math.round(sizeZ / tileM)));

  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: mat?.color ?? terrain.color ?? "#6f8f4e",
      roughness: mat?.roughness ?? 0.95,
      metalness: mat?.metalness ?? 0,
    });
    if (mat?.albedo) {
      const t = new THREE.TextureLoader().load(mat.albedo);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repX, repZ);
      t.colorSpace = THREE.SRGBColorSpace;
      m.map = t;
      m.color.set("#ffffff");
    }
    if (mat?.normal) {
      const n = new THREE.TextureLoader().load(mat.normal);
      n.wrapS = n.wrapT = THREE.RepeatWrapping;
      n.repeat.set(repX, repZ);
      m.normalMap = n;
    }
    return m;
  }, [mat?.id, mat?.color, mat?.albedo, mat?.normal, mat?.roughness, mat?.metalness, terrain.color, repX, repZ]);
  useEffect(() => () => { material.map?.dispose(); material.normalMap?.dispose(); material.dispose(); }, [material]);

  if (!terrain.enabled) return null;
  return <mesh geometry={geom} material={material} receiveShadow castShadow />;
}
