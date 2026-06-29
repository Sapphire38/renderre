"use client";

import { useEditor } from "@/lib/store";
import { angleDeg, formatLen, totalLength, wallLength } from "@/lib/geometry";
import { OPENING_STYLES, defaultStyle } from "@/lib/openings";
import { WALL_KINDS } from "@/lib/walls";
import { SURFACE_SHAPES } from "@/lib/surfaces";
import type { Furniture, Opening, OpeningKind, RoofKind, Surface, SurfaceShape, Wall, WallKind } from "@/lib/types";
import { TrashIcon } from "./icons";
import MaterialControls from "./MaterialControls";

function MaterialBlock({ target }: { target: "selection" | "floor" }) {
  return (
    <div className="mt-3">
      <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        Material
      </h4>
      <MaterialControls target={target} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-neutral-800 px-4 py-3">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-sm text-neutral-400">{label}</span>
      {children}
    </div>
  );
}

function NumField({
  value,
  unit,
  step = 1,
  min,
  max,
  onFocus,
  onChange,
}: {
  value: number;
  unit: string;
  step?: number;
  min?: number;
  max?: number;
  onFocus?: () => void;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        value={Number.isFinite(value) ? value : ""}
        step={step}
        min={min}
        max={max}
        onFocus={onFocus}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!Number.isNaN(v)) onChange(v);
        }}
        className="w-20 rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-right text-sm text-neutral-100 outline-none focus:border-sky-600"
      />
      <span className="w-7 text-xs text-neutral-500">{unit}</span>
    </div>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function WallProps({ sel }: { sel: Wall }) {
  const removeWall = useEditor((s) => s.removeWall);
  const openings = useEditor((s) => s.openings);
  const selectOpening = useEditor((s) => s.selectOpening);
  const myOpenings = openings.filter((o) => o.wallId === sel.id);
  const beginEdit = () => useEditor.getState().pushHistory();
  const patch = (p: Partial<Wall>) => {
    const st = useEditor.getState();
    st.setWalls(st.walls.map((w) => (w.id === sel.id ? { ...w, ...p } : w)));
  };
  const len = wallLength(sel);
  const ang = angleDeg(sel.a, sel.b);
  const dir = len > 1e-6 ? { x: (sel.b.x - sel.a.x) / len, z: (sel.b.z - sel.a.z) / len } : { x: 1, z: 0 };
  const setLargo = (m: number) => patch({ b: { x: sel.a.x + dir.x * m, z: sel.a.z + dir.z * m } });
  const setAngulo = (deg: number) => {
    const r = (deg * Math.PI) / 180;
    patch({ b: { x: sel.a.x + Math.cos(r) * len, z: sel.a.z + Math.sin(r) * len } });
  };
  return (
    <Section title={sel.name ? `Muro: ${sel.name}` : "Muro seleccionado"}>
      <Row label="Nombre">
        <input
          value={sel.name ?? ""}
          placeholder="Muro"
          onFocus={beginEdit}
          onChange={(e) => patch({ name: e.target.value })}
          className="w-40 rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 outline-none focus:border-sky-600"
        />
      </Row>
      <Row label="Tipo">
        <select
          value={sel.kind ?? "solid"}
          onChange={(e) => {
            beginEdit();
            patch({ kind: e.target.value as WallKind });
          }}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 outline-none focus:border-sky-600"
        >
          {WALL_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Largo">
        <NumField value={+len.toFixed(2)} unit="m" step={0.05} min={0.05} max={50} onFocus={beginEdit} onChange={(v) => setLargo(clamp(v, 0.05, 50))} />
      </Row>
      <Row label="Ángulo">
        <NumField value={+ang.toFixed(1)} unit="°" step={1} onFocus={beginEdit} onChange={(v) => setAngulo(v)} />
      </Row>
      <Row label="Espesor">
        <NumField
          value={Math.round(sel.thickness * 100)}
          unit="cm"
          min={2}
          max={100}
          onFocus={beginEdit}
          onChange={(v) => patch({ thickness: clamp(v / 100, 0.02, 1) })}
        />
      </Row>
      <Row label="Altura (pareja)">
        <NumField
          value={sel.height}
          unit="m"
          step={0.1}
          min={0.1}
          max={6}
          onFocus={beginEdit}
          onChange={(v) => patch({ height: clamp(v, 0.1, 6), heightA: undefined, heightB: undefined })}
        />
      </Row>
      <Row label="Altura base">
        <NumField
          value={+(sel.base ?? 0).toFixed(2)}
          unit="m"
          step={0.1}
          min={0}
          max={6}
          onFocus={beginEdit}
          onChange={(v) => patch({ base: clamp(v, 0, 6) })}
        />
      </Row>
      <Row label="Alto en inicio (A)">
        <NumField
          value={+(sel.heightA ?? sel.height).toFixed(2)}
          unit="m"
          step={0.1}
          min={0.1}
          max={8}
          onFocus={beginEdit}
          onChange={(v) => patch({ heightA: clamp(v, 0.1, 8) })}
        />
      </Row>
      <Row label="Alto en fin (B)">
        <NumField
          value={+(sel.heightB ?? sel.height).toFixed(2)}
          unit="m"
          step={0.1}
          min={0.1}
          max={8}
          onFocus={beginEdit}
          onChange={(v) => patch({ heightB: clamp(v, 0.1, 8) })}
        />
      </Row>
      <Row label="Inicio X">
        <NumField value={+sel.a.x.toFixed(2)} unit="m" step={0.1} onFocus={beginEdit} onChange={(v) => patch({ a: { ...sel.a, x: v } })} />
      </Row>
      <Row label="Inicio Z">
        <NumField value={+sel.a.z.toFixed(2)} unit="m" step={0.1} onFocus={beginEdit} onChange={(v) => patch({ a: { ...sel.a, z: v } })} />
      </Row>
      <Row label="Fin X">
        <NumField value={+sel.b.x.toFixed(2)} unit="m" step={0.1} onFocus={beginEdit} onChange={(v) => patch({ b: { ...sel.b, x: v } })} />
      </Row>
      <Row label="Fin Z">
        <NumField value={+sel.b.z.toFixed(2)} unit="m" step={0.1} onFocus={beginEdit} onChange={(v) => patch({ b: { ...sel.b, z: v } })} />
      </Row>

      <div className="mt-3">
        <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Aberturas en este muro ({myOpenings.length})
        </h4>
        {myOpenings.length === 0 ? (
          <p className="text-xs text-neutral-600">
            Ninguna. Con la herramienta Abertura (O) hacé clic sobre el muro para agregar.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {myOpenings.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => selectOpening(o.id)}
                title="Seleccionar esta abertura"
                className="flex items-center justify-between rounded-md border border-neutral-800 px-2 py-1 text-left text-xs text-neutral-300 hover:border-sky-600 hover:bg-neutral-800"
              >
                <span>{(o.kind === "door" ? "🚪 " : "🪟 ") + (o.name || (o.kind === "door" ? "Puerta" : "Ventana"))}</span>
                <span className="text-neutral-500">
                  {Math.round(o.width * 100)} cm · a {Math.round(o.offset * 100)} cm
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <MaterialBlock target="selection" />
      <button
        type="button"
        onClick={() => removeWall(sel.id)}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-red-900/60 bg-red-950/40 py-1.5 text-sm text-red-300 hover:bg-red-900/40"
      >
        <TrashIcon width={15} height={15} /> Eliminar muro
      </button>
    </Section>
  );
}

function FurnitureProps({ sel }: { sel: Furniture }) {
  const removeFurniture = useEditor((s) => s.removeFurniture);
  const openWorkbench = useEditor((s) => s.openWorkbench);
  const beginEdit = () => useEditor.getState().pushHistory();
  const patch = (p: Partial<Furniture>) => {
    const st = useEditor.getState();
    st.setFurniture(st.furniture.map((f) => (f.id === sel.id ? { ...f, ...p } : f)));
  };
  const hasCarcass = ["module", "cabinet-base", "cabinet-wall", "shelf", "wardrobe"].includes(sel.kind);
  return (
    <Section title={`Mueble: ${sel.name}`}>
      <Row label="Nombre">
        <input
          value={sel.name}
          onFocus={beginEdit}
          onChange={(e) => patch({ name: e.target.value })}
          className="w-40 rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 outline-none focus:border-sky-600"
        />
      </Row>
      <Row label="Posición X">
        <NumField value={+sel.pos.x.toFixed(2)} unit="m" step={0.1} onFocus={beginEdit} onChange={(v) => patch({ pos: { ...sel.pos, x: v } })} />
      </Row>
      <Row label="Posición Z">
        <NumField value={+sel.pos.z.toFixed(2)} unit="m" step={0.1} onFocus={beginEdit} onChange={(v) => patch({ pos: { ...sel.pos, z: v } })} />
      </Row>
      <Row label="Ancho">
        <NumField value={Math.round(sel.width * 100)} unit="cm" min={5} max={600} onFocus={beginEdit} onChange={(v) => patch({ width: clamp(v / 100, 0.05, 6) })} />
      </Row>
      <Row label="Profundidad">
        <NumField value={Math.round(sel.depth * 100)} unit="cm" min={5} max={200} onFocus={beginEdit} onChange={(v) => patch({ depth: clamp(v / 100, 0.05, 2) })} />
      </Row>
      <Row label="Alto">
        <NumField value={Math.round(sel.height * 100)} unit="cm" min={1} max={400} onFocus={beginEdit} onChange={(v) => patch({ height: clamp(v / 100, 0.01, 4) })} />
      </Row>
      <Row label="Espesor MDF">
        <NumField value={Math.round(sel.panel * 1000)} unit="mm" min={3} max={50} onFocus={beginEdit} onChange={(v) => patch({ panel: clamp(v / 1000, 0.003, 0.05) })} />
      </Row>
      {hasCarcass && (
        <>
          <Row label="Estantes">
            <NumField value={sel.shelves} unit="" min={0} max={12} onFocus={beginEdit} onChange={(v) => patch({ shelves: clamp(Math.round(v), 0, 12) })} />
          </Row>
          <Row label="Puertas">
            <NumField value={sel.doors} unit="" min={0} max={6} onFocus={beginEdit} onChange={(v) => patch({ doors: clamp(Math.round(v), 0, 6) })} />
          </Row>
        </>
      )}
      <Row label="Altura base">
        <NumField value={Math.round(sel.baseHeight * 100)} unit="cm" min={0} max={300} onFocus={beginEdit} onChange={(v) => patch({ baseHeight: clamp(v / 100, 0, 3) })} />
      </Row>
      <Row label="Rotación">
        <NumField value={Math.round(sel.rotDeg)} unit="°" step={15} onFocus={beginEdit} onChange={(v) => patch({ rotDeg: ((v % 360) + 360) % 360 })} />
      </Row>
      <Row label="Color">
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(sel.color) ? sel.color : "#c9b18b"}
          onFocus={beginEdit}
          onChange={(e) => patch({ color: e.target.value })}
          className="h-7 w-12 cursor-pointer rounded border border-neutral-800 bg-neutral-950"
        />
      </Row>
      {sel.kind === "custom" && (
        <button
          type="button"
          onClick={() => openWorkbench(sel)}
          className="mt-2 w-full rounded-md border border-sky-800/60 bg-sky-950/40 py-1.5 text-sm text-sky-300 hover:bg-sky-900/40"
        >
          ✎ Editar en el taller
        </button>
      )}
      <MaterialBlock target="selection" />
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => {
            beginEdit();
            patch({ rotDeg: ((Math.round(sel.rotDeg) + 90) % 360 + 360) % 360 });
          }}
          className="flex-1 rounded-md border border-neutral-700 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
        >
          ↻ Rotar 90°
        </button>
        <button
          type="button"
          onClick={() => removeFurniture(sel.id)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-red-900/60 bg-red-950/40 py-1.5 text-sm text-red-300 hover:bg-red-900/40"
        >
          <TrashIcon width={15} height={15} /> Eliminar
        </button>
      </div>
    </Section>
  );
}

function OpeningProps({ sel }: { sel: Opening }) {
  const removeOpening = useEditor((s) => s.removeOpening);
  const beginEdit = () => useEditor.getState().pushHistory();
  const patch = (p: Partial<Opening>) => {
    const st = useEditor.getState();
    st.setOpenings(st.openings.map((o) => (o.id === sel.id ? { ...o, ...p } : o)));
  };
  const style = sel.style ?? defaultStyle(sel.kind);
  const hasLeaf = style === "swing" || style === "double" || style === "casement";
  const singleHinge = style === "swing" || style === "casement";
  return (
    <Section title={`Abertura: ${sel.name || (sel.kind === "door" ? "Puerta" : "Ventana")}`}>
      <Row label="Nombre">
        <input
          value={sel.name ?? ""}
          placeholder={sel.kind === "door" ? "Puerta" : "Ventana"}
          onFocus={beginEdit}
          onChange={(e) => patch({ name: e.target.value })}
          className="w-40 rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 outline-none focus:border-sky-600"
        />
      </Row>
      <Row label="Tipo">
        <select
          value={sel.kind}
          onChange={(e) => {
            beginEdit();
            const kind = e.target.value as OpeningKind;
            patch({ kind, sill: kind === "window" ? sel.sill || 0.9 : 0, style: defaultStyle(kind) });
          }}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 outline-none focus:border-sky-600"
        >
          <option value="door">Puerta</option>
          <option value="window">Ventana</option>
        </select>
      </Row>
      <Row label="Estilo">
        <select
          value={sel.style ?? defaultStyle(sel.kind)}
          onChange={(e) => {
            beginEdit();
            patch({ style: e.target.value });
          }}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 outline-none focus:border-sky-600"
        >
          {OPENING_STYLES[sel.kind].map((st) => (
            <option key={st.value} value={st.value}>
              {st.label}
            </option>
          ))}
        </select>
      </Row>
      {singleHinge && (
        <Row label="Bisagra">
          <select
            value={sel.hinge ?? "left"}
            onChange={(e) => {
              beginEdit();
              patch({ hinge: e.target.value as "left" | "right" });
            }}
            className="rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 outline-none focus:border-sky-600"
          >
            <option value="left">Izquierda</option>
            <option value="right">Derecha</option>
          </select>
        </Row>
      )}
      {hasLeaf && (
        <Row label="Abre hacia">
          <select
            value={sel.swing ?? "in"}
            onChange={(e) => {
              beginEdit();
              patch({ swing: e.target.value as "in" | "out" });
            }}
            className="rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 outline-none focus:border-sky-600"
          >
            <option value="in">Un lado</option>
            <option value="out">El otro</option>
          </select>
        </Row>
      )}
      <Row label="Ancho">
        <NumField value={Math.round(sel.width * 100)} unit="cm" min={20} max={400} onFocus={beginEdit} onChange={(v) => patch({ width: clamp(v / 100, 0.2, 4) })} />
      </Row>
      <Row label="Alto">
        <NumField value={Math.round(sel.height * 100)} unit="cm" min={20} max={300} onFocus={beginEdit} onChange={(v) => patch({ height: clamp(v / 100, 0.2, 3) })} />
      </Row>
      {sel.kind === "window" ? (
        <Row label="Antepecho">
          <NumField value={Math.round(sel.sill * 100)} unit="cm" min={0} max={200} onFocus={beginEdit} onChange={(v) => patch({ sill: clamp(v / 100, 0, 2) })} />
        </Row>
      ) : (
        <Row label="Altura desde el piso">
          <NumField value={Math.round(sel.sill * 100)} unit="cm" min={0} max={600} step={5} onFocus={beginEdit} onChange={(v) => patch({ sill: clamp(v / 100, 0, 6) })} />
        </Row>
      )}
      <Row label="Posición">
        <NumField value={Math.round(sel.offset * 100)} unit="cm" min={0} max={3000} onFocus={beginEdit} onChange={(v) => patch({ offset: Math.max(0, v / 100) })} />
      </Row>
      <button
        type="button"
        onClick={() => removeOpening(sel.id)}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-red-900/60 bg-red-950/40 py-1.5 text-sm text-red-300 hover:bg-red-900/40"
      >
        <TrashIcon width={15} height={15} /> Eliminar abertura
      </button>
    </Section>
  );
}

function SurfaceProps({ sel }: { sel: Surface }) {
  const removeSurface = useEditor((s) => s.removeSurface);
  const beginEdit = () => useEditor.getState().pushHistory();
  const patch = (p: Partial<Surface>) => {
    const st = useEditor.getState();
    st.setSurfaces(st.surfaces.map((x) => (x.id === sel.id ? { ...x, ...p } : x)));
  };
  // esquinas del rectángulo (para convertir rect→polígono sin cambiar la huella)
  const rectPts = (w: number, d: number) => [
    { x: -w / 2, z: -d / 2 }, { x: w / 2, z: -d / 2 }, { x: w / 2, z: d / 2 }, { x: -w / 2, z: d / 2 },
  ];
  // polígono regular de n lados inscripto en el bbox (rx, rz)
  const regularPts = (n: number, rx: number, rz: number) =>
    Array.from({ length: n }, (_, i) => {
      const t = (i / n) * Math.PI * 2 - Math.PI / 2;
      return { x: Math.cos(t) * rx, z: Math.sin(t) * rz };
    });
  return (
    <Section title={sel.name ? `Suelo: ${sel.name}` : "Superficie de suelo"}>
      <Row label="Nombre">
        <input
          value={sel.name ?? ""}
          placeholder="Suelo"
          onFocus={beginEdit}
          onChange={(e) => patch({ name: e.target.value })}
          className="w-40 rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 outline-none focus:border-sky-600"
        />
      </Row>
      <Row label="Forma">
        <select
          value={sel.shape ?? "rect"}
          onChange={(e) => {
            beginEdit();
            const shape = e.target.value as SurfaceShape;
            // al pasar a polígono, si no tiene vértices, arrancar con las 4 esquinas del rect
            if (shape === "polygon" && (!sel.points || sel.points.length < 3)) {
              patch({ shape, points: rectPts(sel.width, sel.depth) });
            } else {
              patch({ shape });
            }
          }}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 outline-none focus:border-sky-600"
        >
          {SURFACE_SHAPES.map((sh) => (
            <option key={sh.value} value={sh.value}>
              {sh.label}
            </option>
          ))}
        </select>
      </Row>
      {sel.shape === "polygon" && (
        <Row label="Vértices">
          <NumField
            value={sel.points?.length ?? 4}
            unit=""
            step={1}
            min={3}
            max={24}
            onFocus={beginEdit}
            onChange={(v) => patch({ points: regularPts(clamp(Math.round(v), 3, 24), sel.width / 2, sel.depth / 2) })}
          />
        </Row>
      )}
      <Row label={sel.shape === "circle" ? "Diámetro X" : "Ancho"}>
        <NumField value={+sel.width.toFixed(2)} unit="m" step={0.1} min={0.1} max={80} onFocus={beginEdit} onChange={(v) => patch({ width: clamp(v, 0.1, 80) })} />
      </Row>
      <Row label={sel.shape === "circle" ? "Diámetro Z" : "Largo (Z)"}>
        <NumField value={+sel.depth.toFixed(2)} unit="m" step={0.1} min={0.1} max={80} onFocus={beginEdit} onChange={(v) => patch({ depth: clamp(v, 0.1, 80) })} />
      </Row>
      <Row label="Posición X">
        <NumField value={+sel.pos.x.toFixed(2)} unit="m" step={0.1} onFocus={beginEdit} onChange={(v) => patch({ pos: { ...sel.pos, x: v } })} />
      </Row>
      <Row label="Posición Z">
        <NumField value={+sel.pos.z.toFixed(2)} unit="m" step={0.1} onFocus={beginEdit} onChange={(v) => patch({ pos: { ...sel.pos, z: v } })} />
      </Row>
      <Row label="Rotación">
        <NumField value={Math.round(sel.rotDeg)} unit="°" step={15} onFocus={beginEdit} onChange={(v) => patch({ rotDeg: ((v % 360) + 360) % 360 })} />
      </Row>
      <Row label="Espesor">
        <NumField value={Math.round((sel.thickness ?? 0.04) * 100)} unit="cm" min={1} max={50} onFocus={beginEdit} onChange={(v) => patch({ thickness: clamp(v / 100, 0.01, 0.5) })} />
      </Row>
      <Row label="Elevación">
        <NumField value={Math.round((sel.lift ?? 0.01) * 100)} unit="cm" min={0} max={100} onFocus={beginEdit} onChange={(v) => patch({ lift: clamp(v / 100, 0, 1) })} />
      </Row>
      <Row label="Pendiente">
        <NumField value={Math.round(sel.slopeDeg ?? 0)} unit="°" step={1} min={0} max={60} onFocus={beginEdit} onChange={(v) => patch({ slopeDeg: clamp(v, 0, 60) })} />
      </Row>
      {(sel.slopeDeg ?? 0) > 0 && (
        <Row label="Dirección pend.">
          <NumField value={Math.round(sel.slopeDir ?? 0)} unit="°" step={15} onFocus={beginEdit} onChange={(v) => patch({ slopeDir: ((v % 360) + 360) % 360 })} />
        </Row>
      )}
      <p className="mt-1 text-[11px] leading-snug text-neutral-600">
        La elevación apila suelos uno sobre otro (ej. deck sobre césped) y evita parpadeos.
      </p>
      <MaterialBlock target="selection" />
      <button
        type="button"
        onClick={() => removeSurface(sel.id)}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-red-900/60 bg-red-950/40 py-1.5 text-sm text-red-300 hover:bg-red-900/40"
      >
        <TrashIcon width={15} height={15} /> Eliminar superficie
      </button>
    </Section>
  );
}

function Defaults() {
  const wallDefaults = useEditor((s) => s.wallDefaults);
  const setWallDefaults = useEditor((s) => s.setWallDefaults);
  const grid = useEditor((s) => s.grid);
  const setGrid = useEditor((s) => s.setGrid);
  return (
    <>
      <Section title="Nuevos muros (por defecto)">
        <Row label="Espesor">
          <NumField value={Math.round(wallDefaults.thickness * 100)} unit="cm" min={2} max={100} onChange={(v) => setWallDefaults({ thickness: clamp(v / 100, 0.02, 1) })} />
        </Row>
        <Row label="Altura">
          <NumField value={wallDefaults.height} unit="m" step={0.1} min={0.1} max={6} onChange={(v) => setWallDefaults({ height: clamp(v, 0.1, 6) })} />
        </Row>
      </Section>
      <Section title="Cuadrícula">
        <Row label="Tamaño de celda">
          <select
            value={grid.cellM}
            onChange={(e) => setGrid({ cellM: parseFloat(e.target.value) })}
            className="rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 outline-none focus:border-sky-600"
          >
            <option value={0.1}>10 cm</option>
            <option value={0.25}>25 cm</option>
            <option value={0.5}>50 cm</option>
            <option value={1}>1 m</option>
          </select>
        </Row>
        <Row label="Imantar (snap)">
          <input type="checkbox" checked={grid.snap} onChange={(e) => setGrid({ snap: e.target.checked })} className="h-4 w-4 accent-sky-500" />
        </Row>
        <Row label="Mostrar cuadrícula">
          <input type="checkbox" checked={grid.showGrid} onChange={(e) => setGrid({ showGrid: e.target.checked })} className="h-4 w-4 accent-sky-500" />
        </Row>
      </Section>
    </>
  );
}

function RoofSection() {
  const activeLevel = useEditor((s) => s.activeLevel);
  const floors = useEditor((s) => s.floors);
  const roofs = useEditor((s) => s.roofs);
  const materials = useEditor((s) => s.materials);
  const setRoof = useEditor((s) => s.setRoof);
  const updateRoof = useEditor((s) => s.updateRoof);
  const removeRoof = useEditor((s) => s.removeRoof);
  const roof = roofs.find((r) => r.level === activeLevel);
  const floorName = floors[activeLevel]?.name ?? "piso";
  const chip = (active: boolean) =>
    [
      "grid h-7 w-7 place-items-center overflow-hidden rounded border",
      active ? "border-sky-400 ring-1 ring-sky-400" : "border-neutral-700 hover:border-neutral-500",
    ].join(" ");
  return (
    <Section title={`Techo · ${floorName}`}>
      <Row label="Tipo">
        <select
          value={roof?.kind ?? "none"}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "none") removeRoof(activeLevel);
            else setRoof(activeLevel, v as RoofKind);
          }}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 outline-none focus:border-sky-600"
        >
          <option value="none">Sin techo</option>
          <option value="flat">Losa plana</option>
          <option value="gable">A dos aguas</option>
          <option value="shed">Una caída</option>
        </select>
      </Row>
      {roof && (
        <>
          <Row label="Altura aleros">
            <NumField value={+roof.height.toFixed(2)} unit="m" step={0.1} min={0.1} max={12} onChange={(v) => updateRoof(activeLevel, { height: clamp(v, 0.1, 12) })} />
          </Row>
          {(roof.kind === "gable" || roof.kind === "shed") && (
            <>
              <Row label={roof.kind === "shed" ? "Alto lado alto" : "Alto cumbrera"}>
                <NumField value={+roof.rise.toFixed(2)} unit="m" step={0.1} min={0} max={6} onChange={(v) => updateRoof(activeLevel, { rise: clamp(v, 0, 6) })} />
              </Row>
              <Row label={roof.kind === "shed" ? "Pendiente" : "Cumbrera"}>
                <select
                  value={roof.ridgeAxis ?? "auto"}
                  onChange={(e) => updateRoof(activeLevel, { ridgeAxis: e.target.value === "auto" ? undefined : (e.target.value as "x" | "z") })}
                  className="rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 outline-none focus:border-sky-600"
                >
                  <option value="auto">Auto (lado largo)</option>
                  <option value="x">Eje X</option>
                  <option value="z">Eje Z</option>
                </select>
              </Row>
            </>
          )}
          <Row label="Alero (saliente)">
            <NumField value={Math.round((roof.overhang ?? 0) * 100)} unit="cm" min={0} max={150} onChange={(v) => updateRoof(activeLevel, { overhang: clamp(v / 100, 0, 1.5) })} />
          </Row>
          <div className="py-1">
            <div className="mb-1 text-sm text-neutral-400">Material</div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => updateRoof(activeLevel, { materialId: undefined })} title="Color por defecto" className={chip(!roof.materialId)}>
                <span className="text-[10px] text-neutral-400">—</span>
              </button>
              {materials.map((m) => (
                <button key={m.id} type="button" onClick={() => updateRoof(activeLevel, { materialId: m.id })} title={m.name} className={chip(roof.materialId === m.id)}>
                  {m.albedo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.albedo} alt={m.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="h-full w-full" style={{ background: m.color }} />
                  )}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-neutral-600">Cubre la huella de los muros del piso activo. Mirá el resultado en el 3D.</p>
        </>
      )}
    </Section>
  );
}

function FloorLevelMaterial() {
  const activeLevel = useEditor((s) => s.activeLevel);
  const floors = useEditor((s) => s.floors);
  const materials = useEditor((s) => s.materials);
  const setFloorLevelMaterial = useEditor((s) => s.setFloorLevelMaterial);
  const cur = floors[activeLevel]?.materialId;
  const name = floors[activeLevel]?.name ?? "piso";
  const chip = (active: boolean) =>
    [
      "grid h-7 w-7 place-items-center overflow-hidden rounded border",
      active ? "border-sky-400 ring-1 ring-sky-400" : "border-neutral-700 hover:border-neutral-500",
    ].join(" ");
  return (
    <div className="py-1">
      <div className="mb-1 text-sm text-neutral-400">Suelo de {name} (propio)</div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setFloorLevelMaterial(activeLevel, null)} title="Usar material global del piso" className={chip(!cur)}>
          <span className="text-[10px] text-neutral-400">—</span>
        </button>
        {materials.map((m) => (
          <button key={m.id} type="button" onClick={() => setFloorLevelMaterial(activeLevel, m.id)} title={m.name} className={chip(cur === m.id)}>
            {m.albedo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.albedo} alt={m.name} className="h-full w-full object-cover" />
            ) : (
              <span className="h-full w-full" style={{ background: m.color }} />
            )}
          </button>
        ))}
      </div>
      <p className="mt-1 text-[11px] leading-snug text-neutral-600">Anula el material global solo para este nivel.</p>
    </div>
  );
}

function RenderSection() {
  const render = useEditor((s) => s.render);
  const setRender = useEditor((s) => s.setRender);
  return (
    <Section title="Render / Iluminación">
      <Row label="Sol · dirección">
        <NumField value={Math.round(render.sunAzimuth)} unit="°" min={0} max={360} step={5} onChange={(v) => setRender({ sunAzimuth: ((v % 360) + 360) % 360 })} />
      </Row>
      <Row label="Sol · altura">
        <NumField value={Math.round(render.sunElevation)} unit="°" min={1} max={90} step={1} onChange={(v) => setRender({ sunElevation: clamp(v, 1, 90) })} />
      </Row>
      <Row label="Sol · intensidad">
        <NumField value={+render.sunIntensity.toFixed(2)} unit="" min={0} max={3} step={0.05} onChange={(v) => setRender({ sunIntensity: clamp(v, 0, 3) })} />
      </Row>
      <Row label="Luz ambiente">
        <NumField value={+render.ambient.toFixed(2)} unit="" min={0} max={2} step={0.05} onChange={(v) => setRender({ ambient: clamp(v, 0, 2) })} />
      </Row>
      <Row label="Fondo / cielo">
        <input
          type="color"
          value={render.background}
          onChange={(e) => setRender({ background: e.target.value })}
          className="h-7 w-12 cursor-pointer rounded border border-neutral-800 bg-neutral-950"
        />
      </Row>
      <Row label="Sombras">
        <input type="checkbox" checked={render.shadows} onChange={(e) => setRender({ shadows: e.target.checked })} className="h-4 w-4 accent-sky-500" />
      </Row>
      <Row label="Luz de lámparas">
        <input type="checkbox" checked={render.lampLights !== false} onChange={(e) => setRender({ lampLights: e.target.checked })} className="h-4 w-4 accent-sky-500" />
      </Row>
      <Row label="Intensidad lámparas">
        <NumField value={+(render.lampIntensity ?? 8).toFixed(1)} unit="" min={0} max={40} step={1} onChange={(v) => setRender({ lampIntensity: clamp(v, 0, 40) })} />
      </Row>
      <p className="mt-1 text-[11px] leading-snug text-neutral-600">
        Las farolas, veladores, apliques, etc. proyectan luz cálida real (hasta 24 a la vez).
      </p>
    </Section>
  );
}

export default function PropertiesPanel() {
  const walls = useEditor((s) => s.walls);
  const furniture = useEditor((s) => s.furniture);
  const openings = useEditor((s) => s.openings);
  const surfaces = useEditor((s) => s.surfaces);
  const selection = useEditor((s) => s.selection);

  const selWall = selection?.kind === "wall" ? walls.find((w) => w.id === selection.id) : null;
  const selFurn =
    selection?.kind === "furniture" ? furniture.find((f) => f.id === selection.id) : null;
  const selOpening =
    selection?.kind === "opening" ? openings.find((o) => o.id === selection.id) : null;
  const selSurface =
    selection?.kind === "surface" ? surfaces.find((x) => x.id === selection.id) : null;

  return (
    <div className="flex h-full flex-col bg-neutral-900 text-sm">
      <Section title="Proyecto">
        <Row label="Muros">
          <span className="text-neutral-200">{walls.length}</span>
        </Row>
        <Row label="Muebles">
          <span className="text-neutral-200">{furniture.length}</span>
        </Row>
        <Row label="Aberturas">
          <span className="text-neutral-200">{openings.length}</span>
        </Row>
        <Row label="Suelos">
          <span className="text-neutral-200">{surfaces.length}</span>
        </Row>
        <Row label="Longitud muros">
          <span className="text-neutral-200">{formatLen(totalLength(walls))}</span>
        </Row>
      </Section>

      {selWall ? (
        <WallProps sel={selWall} />
      ) : selFurn ? (
        <FurnitureProps sel={selFurn} />
      ) : selOpening ? (
        <OpeningProps sel={selOpening} />
      ) : selSurface ? (
        <SurfaceProps sel={selSurface} />
      ) : (
        <Section title="Selección">
          <p className="py-2 text-xs leading-relaxed text-neutral-500">
            Nada seleccionado. Con <span className="text-neutral-300">Seleccionar (V)</span> hacé clic
            en un muro o mueble para editarlo. Con <span className="text-neutral-300">Mueble (F)</span>{" "}
            elegí un módulo del catálogo y hacé clic para colocarlo.
          </p>
        </Section>
      )}

      <Defaults />

      <Section title="Piso">
        <MaterialControls target="floor" />
        <FloorLevelMaterial />
      </Section>

      <RoofSection />

      <RenderSection />

      <div className="mt-auto px-4 py-3 text-[11px] leading-relaxed text-neutral-600">
        Atajos: <span className="text-neutral-400">V</span> seleccionar ·{" "}
        <span className="text-neutral-400">W</span> muro · <span className="text-neutral-400">F</span>{" "}
        mueble · <span className="text-neutral-400">R</span> rotar · <span className="text-neutral-400">Ctrl+Z</span> deshacer
      </div>
    </div>
  );
}
