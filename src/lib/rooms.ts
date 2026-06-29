import type { Vec2 } from "./types";

/**
 * Detección de "ambientes" (recintos cerrados) a partir de segmentos de muro.
 *
 * Devuelve los polígonos de las caras internas de la subdivisión planar formada
 * por los muros. Sirve para generar el piso SOLO donde los muros encierran un
 * ambiente: una medianera/perímetro abierto, un seto o muros sueltos no forman
 * un recinto y por lo tanto no generan piso.
 *
 * Algoritmo: se arma un grafo planar (snap de nodos + corte en junturas en T) y
 * se recorren las caras con half-edges (la "cara a la izquierda" de cada arista).
 * La cara no acotada (exterior) se descarta por su orientación/área.
 */

type Seg = { a: Vec2; b: Vec2 };

const TOL = 0.04; // 4 cm: tolerancia para unir extremos de muro

const keyOf = (x: number, z: number) => `${Math.round(x / TOL)}|${Math.round(z / TOL)}`;

function dist2(ax: number, az: number, bx: number, bz: number) {
  const dx = ax - bx, dz = az - bz;
  return dx * dx + dz * dz;
}

/** ¿El punto p está sobre el segmento a-b (no en los extremos)? Devuelve t∈(0,1) o null. */
function pointOnSeg(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number | null {
  const vx = bx - ax, vz = bz - az;
  const len2 = vx * vx + vz * vz;
  if (len2 < 1e-9) return null;
  const t = ((px - ax) * vx + (pz - az) * vz) / len2;
  if (t <= 1e-4 || t >= 1 - 1e-4) return null;
  const cx = ax + vx * t, cz = az + vz * t;
  if (dist2(px, pz, cx, cz) > TOL * TOL) return null;
  return t;
}

export function roomPolygons(segments: Seg[]): Vec2[][] {
  // 1) Nodos únicos (snap por tolerancia).
  const nodeOf = new Map<string, number>();
  const nodes: Vec2[] = [];
  const nodeId = (x: number, z: number): number => {
    const k = keyOf(x, z);
    let id = nodeOf.get(k);
    if (id === undefined) { id = nodes.length; nodes.push({ x, z }); nodeOf.set(k, id); }
    return id;
  };

  // 2) Aristas base (sin duplicar), a partir de los muros.
  const edgeSet = new Set<string>();
  let edges: [number, number][] = [];
  const addEdge = (n1: number, n2: number) => {
    if (n1 === n2) return;
    const k = n1 < n2 ? `${n1}-${n2}` : `${n2}-${n1}`;
    if (edgeSet.has(k)) return;
    edgeSet.add(k);
    edges.push([n1, n2]);
  };
  for (const s of segments) {
    if (dist2(s.a.x, s.a.z, s.b.x, s.b.z) < TOL * TOL) continue;
    addEdge(nodeId(s.a.x, s.a.z), nodeId(s.b.x, s.b.z));
  }

  // 3) Cortar aristas en junturas en T (un nodo que cae sobre el interior de otra arista).
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 50) {
    changed = false;
    const next: [number, number][] = [];
    for (const [e0, e1] of edges) {
      const a = nodes[e0], b = nodes[e1];
      let bestT: number | null = null;
      let bestNode = -1;
      for (let n = 0; n < nodes.length; n++) {
        if (n === e0 || n === e1) continue;
        const t = pointOnSeg(nodes[n].x, nodes[n].z, a.x, a.z, b.x, b.z);
        if (t !== null && (bestT === null || t < bestT)) { bestT = t; bestNode = n; }
      }
      if (bestNode >= 0) { next.push([e0, bestNode], [bestNode, e1]); changed = true; }
      else next.push([e0, e1]);
    }
    // re-deduplicar
    edgeSet.clear();
    edges = [];
    for (const [n1, n2] of next) addEdge(n1, n2);
  }

  // 4) Adyacencia + half-edges ordenados por ángulo en cada nodo.
  const adj: number[][] = nodes.map(() => []);
  for (const [n1, n2] of edges) { adj[n1].push(n2); adj[n2].push(n1); }
  const angle = (from: number, to: number) => Math.atan2(nodes[to].z - nodes[from].z, nodes[to].x - nodes[from].x);
  for (let n = 0; n < nodes.length; n++) adj[n].sort((p, q) => angle(n, p) - angle(n, q));

  // 5) Recorrido de caras: para cada half-edge (u->v), el siguiente es el más
  //    horario después de (v->u) alrededor de v. Eso traza la cara a la izquierda.
  const visited = new Set<string>();
  const heKey = (u: number, v: number) => `${u}>${v}`;
  const faces: number[][] = [];
  for (const [a, b] of edges) {
    for (const [u0, v0] of [[a, b], [b, a]] as [number, number][]) {
      if (visited.has(heKey(u0, v0))) continue;
      const face: number[] = [];
      let u = u0, v = v0;
      let safe = 0;
      while (safe++ < 100000) {
        visited.add(heKey(u, v));
        face.push(u);
        // en v, elegir el siguiente: el anterior (horario) a (v->u) en el orden CCW
        const nbrs = adj[v];
        const idx = nbrs.indexOf(u);
        const nextNode = nbrs[(idx - 1 + nbrs.length) % nbrs.length];
        u = v; v = nextNode;
        if (u === u0 && v === v0) break;
      }
      if (face.length >= 3) faces.push(face);
    }
  }

  // 6) Área firmada; quedarnos con las caras internas (acotadas) y descartar la exterior.
  const signedArea = (poly: number[]) => {
    let s = 0;
    for (let i = 0; i < poly.length; i++) {
      const p = nodes[poly[i]], q = nodes[poly[(i + 1) % poly.length]];
      s += p.x * q.z - q.x * p.z;
    }
    return s / 2;
  };
  const MIN_AREA = 0.05; // m²: descartar slivers
  const rooms: Vec2[][] = [];
  for (const face of faces) {
    const A = signedArea(face);
    // Con este recorrido (siguiente = vecino horario), las caras internas (acotadas)
    // quedan con área POSITIVA y la cara exterior (no acotada) con área negativa.
    if (A > MIN_AREA) rooms.push(face.map((n) => ({ ...nodes[n] })));
  }
  return rooms;
}
