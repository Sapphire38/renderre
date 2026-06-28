import type { CutPiece } from "./cutlist";

/** Una pieza ya ubicada sobre una placa (coordenadas en metros, origen arriba-izq). */
export type PlacedPiece = {
  x: number;
  y: number;
  w: number; // ancho ocupado en la placa
  h: number; // alto ocupado en la placa
  rot: boolean; // true si se giró 90°
  role: string;
};

/** Una placa con sus piezas acomodadas. */
export type NestedBoard = {
  index: number;
  w: number;
  h: number;
  thickness: number;
  materialId?: string;
  pieces: PlacedPiece[];
  usedArea: number;
};

export type NestResult = {
  boards: NestedBoard[];
  totalBoards: number;
  usedArea: number; // m² ocupados por piezas
  boardArea: number; // m² de una placa
  totalArea: number; // m² de todas las placas usadas
  yield: number; // 0..1 aprovechamiento real
  unplaced: { role: string; w: number; h: number; thickness: number }[];
};

type Rect = { w: number; h: number; role: string };
type Shelf = { y: number; height: number; cursorX: number };

/**
 * Acomoda las piezas del despiece en placas estándar con un empaquetado por
 * estantes (shelf / first-fit-decreasing) con giro 90°. Las piezas se agrupan
 * por espesor + material (no se mezclan en una misma placa).
 * kerf = ancho de corte de la sierra (m).
 */
export function nest(pieces: CutPiece[], boardW: number, boardH: number, kerf = 0.004): NestResult {
  const boards: NestedBoard[] = [];
  const unplaced: NestResult["unplaced"] = [];
  const boardArea = boardW * boardH;

  // Agrupar por espesor + material.
  const groups = new Map<string, { thickness: number; materialId?: string; rects: Rect[] }>();
  for (const p of pieces) {
    const key = `${p.thickness}|${p.materialId ?? ""}`;
    let g = groups.get(key);
    if (!g) {
      g = { thickness: p.thickness, materialId: p.materialId, rects: [] };
      groups.set(key, g);
    }
    for (let i = 0; i < p.qty; i++) g.rects.push({ w: p.largo, h: p.ancho, role: p.role });
  }

  for (const g of groups.values()) {
    // Orientar cada pieza con el lado mayor horizontal y ordenar por alto desc.
    const rects = g.rects
      .map((r) => (r.w >= r.h ? r : { ...r, w: r.h, h: r.w }))
      .sort((a, b) => b.h - a.h || b.w - a.w);

    // Placas de este grupo, cada una con sus estantes.
    const groupBoards: { board: NestedBoard; shelves: Shelf[] }[] = [];
    const newBoard = () => {
      const board: NestedBoard = {
        index: boards.length + groupBoards.length,
        w: boardW,
        h: boardH,
        thickness: g.thickness,
        materialId: g.materialId,
        pieces: [],
        usedArea: 0,
      };
      const entry = { board, shelves: [] as Shelf[] };
      groupBoards.push(entry);
      return entry;
    };

    for (const r of rects) {
      // ¿Entra en la placa de alguna forma (con o sin giro)?
      const fitsUpright = r.w + kerf <= boardW && r.h + kerf <= boardH;
      const fitsRot = r.h + kerf <= boardW && r.w + kerf <= boardH;
      if (!fitsUpright && !fitsRot) {
        unplaced.push({ role: r.role, w: r.w, h: r.h, thickness: g.thickness });
        continue;
      }

      let placed = false;
      for (const { board, shelves } of groupBoards) {
        // 1) intentar en un estante existente (sin giro, luego girado).
        for (const sh of shelves) {
          const tryPut = (w: number, h: number, rot: boolean) => {
            if (h <= sh.height + 1e-9 && sh.cursorX + w + kerf <= boardW) {
              board.pieces.push({ x: sh.cursorX, y: sh.y, w, h, rot, role: r.role });
              board.usedArea += w * h;
              sh.cursorX += w + kerf;
              return true;
            }
            return false;
          };
          if (tryPut(r.w, r.h, false) || tryPut(r.h, r.w, true)) {
            placed = true;
            break;
          }
        }
        if (placed) break;
        // 2) abrir un estante nuevo arriba del último.
        const usedH = shelves.reduce((m, s) => Math.max(m, s.y + s.height + kerf), 0);
        const startY = shelves.length ? usedH : 0;
        const putNewShelf = (w: number, h: number, rot: boolean) => {
          if (startY + h + kerf <= boardH && w + kerf <= boardW) {
            const sh: Shelf = { y: startY, height: h, cursorX: 0 };
            board.pieces.push({ x: 0, y: startY, w, h, rot, role: r.role });
            board.usedArea += w * h;
            sh.cursorX = w + kerf;
            shelves.push(sh);
            return true;
          }
          return false;
        };
        if (putNewShelf(r.w, r.h, false) || putNewShelf(r.h, r.w, true)) {
          placed = true;
          break;
        }
      }
      if (!placed) {
        // placa nueva
        const { board, shelves } = newBoard();
        const w = fitsUpright ? r.w : r.h;
        const h = fitsUpright ? r.h : r.w;
        board.pieces.push({ x: 0, y: 0, w, h, rot: !fitsUpright, role: r.role });
        board.usedArea += w * h;
        shelves.push({ y: 0, height: h, cursorX: w + kerf });
      }
    }
    for (const { board } of groupBoards) boards.push(board);
  }

  // Reindexar de forma global.
  boards.forEach((b, i) => (b.index = i));
  const usedArea = boards.reduce((s, b) => s + b.usedArea, 0);
  const totalArea = boards.length * boardArea;
  return {
    boards,
    totalBoards: boards.length,
    usedArea: Math.round(usedArea * 1000) / 1000,
    boardArea: Math.round(boardArea * 1000) / 1000,
    totalArea: Math.round(totalArea * 1000) / 1000,
    yield: totalArea > 0 ? Math.round((usedArea / totalArea) * 1000) / 1000 : 0,
    unplaced,
  };
}
