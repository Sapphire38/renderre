#!/usr/bin/env node
// @ts-nocheck
/**
 * Renderre MCP server (stdio, JSON-RPC 2.0, sin dependencias).
 *
 * Permite manejar el editor Renderre abierto en el navegador desde Claude.
 * Habla con el "bridge" HTTP de la app Next.js (rutas /api/mcp/*).
 *
 * Requisitos: Node >= 18 (usa fetch global) y la app corriendo (npm run dev).
 * Config: variable de entorno RENDERRE_URL (por defecto http://localhost:3000).
 *
 * Uso en Claude Code: ya hay un .mcp.json en la raíz del repo.
 * Uso en Claude Desktop: ver mcp-server/README.md.
 */

const BASE = (process.env.RENDERRE_URL || "http://localhost:3000").replace(/\/$/, "");
const PROTOCOL_VERSION = "2024-11-05";

const log = (...a) => process.stderr.write("[renderre-mcp] " + a.join(" ") + "\n");

// ---------------------------------------------------------------- HTTP bridge
async function postCommand(type, args) {
  const res = await fetch(`${BASE}/api/mcp/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, args }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
async function getState() {
  const res = await fetch(`${BASE}/api/mcp/state`, { headers: { "cache-control": "no-cache" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const editorHint =
  "Abrí el editor de Renderre en el navegador (http://localhost:3000/editor) para que reciba los comandos.";

async function runCommand(type, args, label) {
  let r;
  try {
    r = await postCommand(type, args || {});
  } catch (e) {
    return errorText(
      `No pude contactar a Renderre en ${BASE}. ¿Está corriendo la app (npm run dev)?\nDetalle: ${e.message}`,
    );
  }
  const conn = r.editorConnected ? "" : `\n⚠ El editor no parece estar abierto. ${editorHint}`;
  return okText(`${label || type} enviado (seq ${r.seq}).${conn}`);
}

// ---------------------------------------------------------------- MCP tools
const num = { type: "number" };
const str = { type: "string" };
const bool = { type: "boolean" };
const vec2 = { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2, description: "[x, z] en metros" };

const FURNITURE_KINDS = [
  "module", "cabinet-base", "cabinet-wall", "shelf", "countertop", "wardrobe", "table",
  "tv", "fridge", "stove", "sink", "washer", "toilet", "bed", "sofa", "tv-stand", "nightstand", "desk", "vanity",
];
const COMPONENT_KINDS = ["shelf", "drawer", "doorHinged", "doorSliding", "divider", "board", "rod"];
// props comunes de un componente del taller (cm/m en metros, x desde izq, y desde abajo)
const COMPONENT_PROPS = {
  x: num, y: num, w: num, h: num,
  depth: { ...num, description: "profundidad en Z (m)" },
  depthInset: { ...num, description: "retiro desde el frente (m)" },
  count: num, hinge: { enum: ["left", "right"] }, orient: { enum: ["front", "horizontal", "vertical"] },
  open: { ...num, description: "0..1 apertura para previsualizar" },
  color: str, materialId: str,
};

const TOOLS = [
  {
    name: "renderre_get_state",
    description:
      "Lee el estado actual del editor Renderre abierto: proyecto, pisos, muros, muebles, aberturas y selección. Útil para saber qué hay antes de modificar (los ids/índices de muros sirven para add_opening).",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      let s;
      try {
        s = await getState();
      } catch (e) {
        return errorText(`No pude contactar a Renderre en ${BASE}. ¿Está corriendo (npm run dev)?\n${e.message}`);
      }
      if (!s.connected || !s.state) {
        return okText(`El editor no está abierto o todavía no publicó su estado. ${editorHint}`);
      }
      return okText(JSON.stringify(s.state, null, 2));
    },
  },
  {
    name: "renderre_generate",
    description:
      "Genera una escena (muros, aberturas, muebles) a partir de una descripción en lenguaje natural en español, usando la IA del proyecto. Se SUMA a lo que ya hay. Ej: 'cocina de 4x3 con bajo mesada, mesada y alacena'.",
    inputSchema: {
      type: "object",
      properties: {
        description: { ...str, description: "Descripción del espacio/mueble a generar" },
        images: { type: "array", items: str, description: "Opcional: imágenes como data URLs (data:image/...) para lectura por visión" },
      },
      required: ["description"],
    },
    handler: (a) => {
      const payload = { description: String(a.description || "") };
      if (Array.isArray(a.images) && a.images.length) payload.images = a.images;
      return runCommand("generate", payload, "Generar");
    },
  },
  {
    name: "renderre_apply_scene",
    description:
      "Aplica una escena estructurada (se SUMA a lo existente). Coordenadas en metros, plano XZ (x derecha, z adelante). 'openings.wall' es el índice 0-based dentro de 'walls'. Ideal para construир planos exactos.",
    inputSchema: {
      type: "object",
      properties: {
        room: { type: "object", description: "Atajo: cuarto rectangular { width, depth, x?, z?, wallThickness?, wallHeight? }" },
        walls: {
          type: "array",
          items: { type: "object", properties: { a: vec2, b: vec2, thickness: num, height: num }, required: ["a", "b"] },
        },
        openings: {
          type: "array",
          items: {
            type: "object",
            properties: { wall: num, kind: { enum: ["door", "window"] }, offset: num, width: num, height: num, sill: num },
            required: ["wall", "kind"],
          },
        },
        furniture: {
          type: "array",
          items: {
            type: "object",
            properties: { kind: { enum: FURNITURE_KINDS }, x: num, z: num, rotDeg: num, width: num, depth: num, height: num, name: str, color: str },
            required: ["kind", "x", "z"],
          },
        },
      },
    },
    handler: (a) => runCommand("apply_scene", { spec: a }, "Aplicar escena"),
  },
  {
    name: "renderre_add_wall",
    description: "Agrega un muro entre dos puntos [x,z] (metros) en el piso activo.",
    inputSchema: { type: "object", properties: { a: vec2, b: vec2, thickness: num, height: num }, required: ["a", "b"] },
    handler: (a) => runCommand("add_wall", a, "Agregar muro"),
  },
  {
    name: "renderre_add_furniture",
    description: `Agrega un mueble o equipamiento en (x,z). kind ∈ ${FURNITURE_KINDS.join(", ")}.`,
    inputSchema: {
      type: "object",
      properties: {
        kind: { enum: FURNITURE_KINDS }, x: num, z: num, rotDeg: num,
        width: num, depth: num, height: num, panel: num, doors: num, shelves: num, baseHeight: num, color: str, name: str, materialId: str,
      },
      required: ["kind", "x", "z"],
    },
    handler: (a) => runCommand("add_furniture", a, "Agregar mueble"),
  },
  {
    name: "renderre_add_opening",
    description:
      "Agrega una puerta o ventana sobre un muro. Indicá wallIndex (índice en la lista de muros de get_state) o wallId. offset = distancia desde el extremo A (def: centro). Podés fijar estilo (puerta: swing|double|sliding; ventana: fixed|sliding|casement), bisagra y lado de apertura.",
    inputSchema: {
      type: "object",
      properties: {
        wallIndex: num, wallId: str, kind: { enum: ["door", "window"] }, offset: num, width: num, height: num, sill: num,
        style: str, hinge: { enum: ["left", "right"] }, swing: { enum: ["in", "out"] }, name: str,
      },
      required: ["kind"],
    },
    handler: (a) => runCommand("add_opening", a, "Agregar abertura"),
  },
  {
    name: "renderre_update_opening",
    description:
      "Edita una abertura existente por id (de get_state.openings): tipo (door/window), estilo, bisagra, lado de apertura, ancho/alto/antepecho, posición (offset) y nombre.",
    inputSchema: {
      type: "object",
      properties: {
        id: str, kind: { enum: ["door", "window"] }, style: str, hinge: { enum: ["left", "right"] }, swing: { enum: ["in", "out"] },
        offset: num, width: num, height: num, sill: num, name: str,
      },
      required: ["id"],
    },
    handler: (a) => runCommand("update_opening", a, "Editar abertura"),
  },
  {
    name: "renderre_add_floor",
    description: "Agrega un piso/nivel nuevo encima y lo deja activo.",
    inputSchema: { type: "object", properties: {} },
    handler: () => runCommand("add_floor", {}, "Agregar piso"),
  },
  {
    name: "renderre_set_active_level",
    description: "Cambia el piso activo (0 = planta baja).",
    inputSchema: { type: "object", properties: { level: num }, required: ["level"] },
    handler: (a) => runCommand("set_active_level", { level: Number(a.level) || 0 }, "Cambiar piso"),
  },
  {
    name: "renderre_clear",
    description: "Borra todo (muros, muebles y aberturas) del proyecto actual.",
    inputSchema: { type: "object", properties: {} },
    handler: () => runCommand("clear", {}, "Limpiar"),
  },
  {
    name: "renderre_new_project",
    description: "Crea un proyecto nuevo y vacío.",
    inputSchema: { type: "object", properties: {} },
    handler: () => runCommand("new_project", {}, "Proyecto nuevo"),
  },
  {
    name: "renderre_save_project",
    description: "Guarda el proyecto actual con un nombre (en el navegador del usuario).",
    inputSchema: { type: "object", properties: { name: str }, required: ["name"] },
    handler: (a) => runCommand("save_project", { name: String(a.name || "") }, "Guardar"),
  },
  {
    name: "renderre_list_projects",
    description: "Lista los proyectos guardados (nombre y fecha de última edición) en el navegador del usuario.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      let s;
      try {
        s = await getState();
      } catch (e) {
        return errorText(`No pude contactar a Renderre en ${BASE}. ¿Está corriendo (npm run dev)?\n${e.message}`);
      }
      if (!s.connected || !s.state) return okText(`El editor no está abierto. ${editorHint}`);
      const list = s.state.savedProjects || [];
      if (!list.length) return okText("No hay proyectos guardados todavía.");
      const lines = list
        .slice()
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        .map((p) => `• ${p.name}${p.updatedAt ? `  (${new Date(p.updatedAt).toLocaleString()})` : ""}`);
      return okText(`Proyectos guardados:\n${lines.join("\n")}`);
    },
  },
  {
    name: "renderre_open_project",
    description: "Abre/carga un proyecto guardado por nombre (reemplaza lo que esté abierto). Usá renderre_list_projects para ver los nombres.",
    inputSchema: { type: "object", properties: { name: str }, required: ["name"] },
    handler: (a) => runCommand("open_project", { name: String(a.name || "") }, "Abrir proyecto"),
  },
  {
    name: "renderre_undo",
    description: "Deshace el último cambio.",
    inputSchema: { type: "object", properties: {} },
    handler: () => runCommand("undo", {}, "Deshacer"),
  },
  {
    name: "renderre_redo",
    description: "Rehace el último cambio deshecho.",
    inputSchema: { type: "object", properties: {} },
    handler: () => runCommand("redo", {}, "Rehacer"),
  },
  {
    name: "renderre_fit_view",
    description: "Encuadra la vista 2D para ver todo el plano.",
    inputSchema: { type: "object", properties: {} },
    handler: () => runCommand("fit_view", {}, "Encuadrar"),
  },

  // ---- editar / borrar elementos existentes (usá los id de get_state) ----
  {
    name: "renderre_update_furniture",
    description:
      "Edita un mueble existente por id (de get_state): moverlo (x,z), rotarlo, redimensionar, recolorear, renombrar o asignarle un material (materialId; null para quitarlo).",
    inputSchema: {
      type: "object",
      properties: {
        id: str, x: num, z: num, rotDeg: num, width: num, depth: num, height: num, panel: num,
        doors: num, shelves: num, baseHeight: num, color: str, name: str, materialId: str,
      },
      required: ["id"],
    },
    handler: (a) => runCommand("update_furniture", a, "Editar mueble"),
  },
  {
    name: "renderre_update_wall",
    description:
      "Edita un muro existente por id: mover sus extremos a/b ([x,z], cambia largo/ángulo/posición), espesor, alto, nombre o material (materialId; null para quitarlo).",
    inputSchema: { type: "object", properties: { id: str, a: vec2, b: vec2, thickness: num, height: num, name: str, materialId: str }, required: ["id"] },
    handler: (a) => runCommand("update_wall", a, "Editar muro"),
  },
  {
    name: "renderre_delete",
    description: "Borra un elemento por id. kind: furniture | wall | opening.",
    inputSchema: { type: "object", properties: { kind: { enum: ["furniture", "wall", "opening"] }, id: str }, required: ["kind", "id"] },
    handler: (a) => runCommand("delete", a, "Borrar"),
  },
  {
    name: "renderre_set_floor_material",
    description: "Asigna (o quita) el material del piso. Pasá materialId (de get_state.materials) u omitilo para quitarlo.",
    inputSchema: { type: "object", properties: { materialId: str } },
    handler: (a) => runCommand("set_floor_material", a, "Material de piso"),
  },
  {
    name: "renderre_place_custom",
    description: "Coloca en el plano un mueble guardado de la biblioteca (por libId o por name, de get_state.customLibrary).",
    inputSchema: { type: "object", properties: { libId: str, name: str } },
    handler: (a) => runCommand("place_custom", a, "Colocar guardado"),
  },

  // ---- Taller de muebles a medida ----
  {
    name: "renderre_open_workbench",
    description:
      "Abre el Taller para diseñar un mueble MDF a medida. Opciones: `preset` (arranca desde un preset MDF: module|cabinet-base|cabinet-wall|shelf|countertop|wardrobe|table|tv-stand|nightstand|desk con estantes/puertas como componentes), `libId`/`libName` (editar uno de mis muebles guardados), o `baseId` (editar una copia de un mueble del plano). Sin nada: arranca en blanco.",
    inputSchema: { type: "object", properties: { preset: { enum: FURNITURE_KINDS }, libId: str, libName: str, baseId: str } },
    handler: (a) => runCommand("open_workbench", a, "Abrir taller"),
  },
  {
    name: "renderre_set_draft",
    description: "Ajusta el mueble en edición en el Taller: nombre, medidas (width/height/depth/panel, m), color y si tiene fondo (back).",
    inputSchema: { type: "object", properties: { name: str, width: num, height: num, depth: num, panel: num, color: str, back: bool } },
    handler: (a) => runCommand("set_draft", a, "Ajustar mueble"),
  },
  {
    name: "renderre_add_component",
    description: `Agrega un componente al mueble en edición (Taller). kind ∈ ${COMPONENT_KINDS.join(", ")}. Posición por la cara frontal (x desde izq, y desde abajo). Podés fijar profundidad (depth) y retiro (depthInset).`,
    inputSchema: { type: "object", properties: { kind: { enum: COMPONENT_KINDS }, ...COMPONENT_PROPS }, required: ["kind"] },
    handler: (a) => runCommand("add_component", a, "Agregar componente"),
  },
  {
    name: "renderre_update_component",
    description: "Edita un componente del mueble en edición por id (de get_state.draft.components). Si omitís id, usa el seleccionado.",
    inputSchema: { type: "object", properties: { id: str, ...COMPONENT_PROPS } },
    handler: (a) => runCommand("update_component", a, "Editar componente"),
  },
  {
    name: "renderre_remove_component",
    description: "Quita un componente del mueble en edición por id (o el seleccionado si lo omitís).",
    inputSchema: { type: "object", properties: { id: str } },
    handler: (a) => runCommand("remove_component", a, "Quitar componente"),
  },
  {
    name: "renderre_save_draft",
    description: "Guarda el mueble en edición en la biblioteca y lo coloca en el plano (cierra el Taller).",
    inputSchema: { type: "object", properties: {} },
    handler: () => runCommand("save_draft", {}, "Guardar mueble"),
  },
  {
    name: "renderre_close_workbench",
    description: "Cierra el Taller sin guardar el mueble en edición.",
    inputSchema: { type: "object", properties: {} },
    handler: () => runCommand("close_workbench", {}, "Cerrar taller"),
  },
  // ---- Taller: historial, portapapeles y cotas ----
  {
    name: "renderre_undo_draft",
    description: "Deshace el último cambio DENTRO del Taller (historial del mueble en edición).",
    inputSchema: { type: "object", properties: {} },
    handler: () => runCommand("undo_draft", {}, "Deshacer (taller)"),
  },
  {
    name: "renderre_redo_draft",
    description: "Rehace el último cambio deshecho dentro del Taller.",
    inputSchema: { type: "object", properties: {} },
    handler: () => runCommand("redo_draft", {}, "Rehacer (taller)"),
  },
  {
    name: "renderre_duplicate_component",
    description: "Duplica un componente del mueble en edición (por id, o el seleccionado).",
    inputSchema: { type: "object", properties: { id: str } },
    handler: (a) => runCommand("duplicate_component", a, "Duplicar componente"),
  },
  {
    name: "renderre_nudge_component",
    description: "Mueve un poco el componente seleccionado del Taller (dx, dy en metros, relativo).",
    inputSchema: { type: "object", properties: { dx: num, dy: num } },
    handler: (a) => runCommand("nudge_component", a, "Mover componente"),
  },
  {
    name: "renderre_toggle_dims",
    description: "Muestra/oculta las cotas en el alzado del Taller.",
    inputSchema: { type: "object", properties: {} },
    handler: () => runCommand("toggle_dims", {}, "Cotas"),
  },
  // ---- pisos / niveles ----
  {
    name: "renderre_rename_floor",
    description: "Renombra un piso/nivel (level 0 = planta baja; omitido = activo).",
    inputSchema: { type: "object", properties: { level: num, name: str }, required: ["name"] },
    handler: (a) => runCommand("rename_floor", a, "Renombrar piso"),
  },
  {
    name: "renderre_set_floor_elevation",
    description: "Cambia la elevación/altura de arranque (m) de un piso (level omitido = activo).",
    inputSchema: { type: "object", properties: { level: num, elevation: num }, required: ["elevation"] },
    handler: (a) => runCommand("set_floor_elevation", a, "Elevación de piso"),
  },
  {
    name: "renderre_remove_floor",
    description: "Elimina un piso (level omitido = activo). Reindexa los elementos; debe quedar al menos uno.",
    inputSchema: { type: "object", properties: { level: num } },
    handler: (a) => runCommand("remove_floor", a, "Eliminar piso"),
  },
  // ---- materiales ----
  {
    name: "renderre_add_material",
    description: "Crea un material de color sólido (luego asignalo por id con update_furniture/update_wall/set_floor_material). tileM=metros por repetición, roughness/metalness 0..1.",
    inputSchema: { type: "object", properties: { name: str, color: str, tileM: num, roughness: num, metalness: num }, required: ["name", "color"] },
    handler: (a) => runCommand("add_material", a, "Crear material"),
  },
  {
    name: "renderre_update_material",
    description: "Edita un material existente por id (nombre, color, tileM, roughness, metalness).",
    inputSchema: { type: "object", properties: { id: str, name: str, color: str, tileM: num, roughness: num, metalness: num }, required: ["id"] },
    handler: (a) => runCommand("update_material", a, "Editar material"),
  },
  // ---- biblioteca custom ----
  {
    name: "renderre_remove_from_library",
    description: "Quita un mueble guardado de la biblioteca (por libId o name de get_state.customLibrary).",
    inputSchema: { type: "object", properties: { libId: str, name: str } },
    handler: (a) => runCommand("remove_from_library", a, "Quitar de biblioteca"),
  },
  // ---- selección y operaciones de grupo ----
  {
    name: "renderre_select",
    description: "Selecciona un elemento por id. kind: wall | furniture | opening.",
    inputSchema: { type: "object", properties: { kind: { enum: ["wall", "furniture", "opening"] }, id: str }, required: ["kind", "id"] },
    handler: (a) => runCommand("select", a, "Seleccionar"),
  },
  {
    name: "renderre_set_multi",
    description: "Fija una selección múltiple. refs = lista de { kind, id }.",
    inputSchema: {
      type: "object",
      properties: { refs: { type: "array", items: { type: "object", properties: { kind: { enum: ["wall", "furniture", "opening"] }, id: str }, required: ["kind", "id"] } } },
      required: ["refs"],
    },
    handler: (a) => runCommand("set_multi", a, "Selección múltiple"),
  },
  {
    name: "renderre_clear_selection",
    description: "Limpia la selección.",
    inputSchema: { type: "object", properties: {} },
    handler: () => runCommand("clear_selection", {}, "Limpiar selección"),
  },
  {
    name: "renderre_copy_selection",
    description: "Copia la selección actual al portapapeles.",
    inputSchema: { type: "object", properties: {} },
    handler: () => runCommand("copy_selection", {}, "Copiar"),
  },
  {
    name: "renderre_paste",
    description: "Pega lo copiado (con un pequeño offset).",
    inputSchema: { type: "object", properties: {} },
    handler: () => runCommand("paste", {}, "Pegar"),
  },
  {
    name: "renderre_nudge_selection",
    description: "Mueve la selección por un delta (dx, dz en metros).",
    inputSchema: { type: "object", properties: { dx: num, dz: num } },
    handler: (a) => runCommand("nudge_selection", a, "Mover selección"),
  },
  {
    name: "renderre_remove_selected",
    description: "Elimina la selección actual (uno o varios elementos).",
    inputSchema: { type: "object", properties: {} },
    handler: () => runCommand("remove_selected", {}, "Eliminar selección"),
  },
  {
    name: "renderre_assign_material_to_selection",
    description: "Asigna un material a toda la selección (materialId; omitir/null para quitar).",
    inputSchema: { type: "object", properties: { materialId: str } },
    handler: (a) => runCommand("assign_material_to_selection", a, "Material a selección"),
  },
  // ---- proyectos / ajustes / exportar ----
  {
    name: "renderre_delete_project",
    description: "Elimina un proyecto guardado por nombre (del navegador del usuario).",
    inputSchema: { type: "object", properties: { name: str }, required: ["name"] },
    handler: (a) => runCommand("delete_project", a, "Eliminar proyecto"),
  },
  {
    name: "renderre_set_project_name",
    description: "Cambia el nombre del proyecto actual (sin guardar).",
    inputSchema: { type: "object", properties: { name: str }, required: ["name"] },
    handler: (a) => runCommand("set_project_name", a, "Renombrar proyecto"),
  },
  {
    name: "renderre_set_grid",
    description: "Configura la cuadrícula: cellM (m por celda), snap (imantar), showGrid (mostrar).",
    inputSchema: { type: "object", properties: { cellM: num, snap: bool, showGrid: bool } },
    handler: (a) => runCommand("set_grid", a, "Cuadrícula"),
  },
  {
    name: "renderre_set_wall_defaults",
    description: "Cambia los valores por defecto de los muros nuevos (thickness, height en m).",
    inputSchema: { type: "object", properties: { thickness: num, height: num } },
    handler: (a) => runCommand("set_wall_defaults", a, "Defaults de muro"),
  },
  {
    name: "renderre_set_tool",
    description: "Cambia la herramienta activa del editor: select | wall | pan | furniture | opening.",
    inputSchema: { type: "object", properties: { tool: { enum: ["select", "wall", "pan", "furniture", "opening"] } }, required: ["tool"] },
    handler: (a) => runCommand("set_tool", a, "Herramienta"),
  },
  {
    name: "renderre_export_png",
    description: "Descarga la vista 3D actual como PNG (en el navegador del usuario).",
    inputSchema: { type: "object", properties: {} },
    handler: () => runCommand("export_png", {}, "Exportar PNG"),
  },
  {
    name: "renderre_export_project",
    description: "Devuelve el proyecto actual como JSON (ProjectData) para guardarlo en disco / llevarlo a otra PC.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      let s;
      try {
        s = await getState();
      } catch (e) {
        return errorText(`No pude contactar a Renderre en ${BASE}. ¿Está corriendo (npm run dev)?\n${e.message}`);
      }
      if (!s.connected || !s.state) return okText(`El editor no está abierto. ${editorHint}`);
      const payload = { app: "renderre", name: s.state.projectName, exportedAt: s.ts, data: s.state.project };
      return okText(JSON.stringify(payload, null, 2));
    },
  },
];

const TOOL_MAP = new Map(TOOLS.map((t) => [t.name, t]));

const okText = (text) => ({ content: [{ type: "text", text }] });
const errorText = (text) => ({ content: [{ type: "text", text }], isError: true });

// ---------------------------------------------------------------- JSON-RPC
function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}
function reply(id, result) {
  send({ jsonrpc: "2.0", id, result });
}
function replyError(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

async function handle(msg) {
  const { id, method, params } = msg;
  const isRequest = id !== undefined && id !== null;

  switch (method) {
    case "initialize":
      reply(id, {
        protocolVersion: (params && params.protocolVersion) || PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "renderre", version: "0.1.0" },
      });
      return;
    case "notifications/initialized":
    case "initialized":
      return; // notificación, sin respuesta
    case "ping":
      if (isRequest) reply(id, {});
      return;
    case "tools/list":
      reply(id, { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
      return;
    case "tools/call": {
      const name = params && params.name;
      const args = (params && params.arguments) || {};
      const tool = TOOL_MAP.get(name);
      if (!tool) {
        replyError(id, -32602, `Herramienta desconocida: ${name}`);
        return;
      }
      try {
        const result = await tool.handler(args);
        reply(id, result);
      } catch (e) {
        reply(id, errorText(`Error ejecutando ${name}: ${e && e.message ? e.message : String(e)}`));
      }
      return;
    }
    default:
      if (isRequest) replyError(id, -32601, `Método no soportado: ${method}`);
      return;
  }
}

// ---------------------------------------------------------------- stdio loop
let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let nl;
  while ((nl = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      log("JSON inválido:", line.slice(0, 200));
      continue;
    }
    Promise.resolve(handle(msg)).catch((e) => log("handler error:", e && e.message));
  }
});
process.stdin.on("end", () => process.exit(0));

log(`listo. RENDERRE_URL=${BASE}`);
