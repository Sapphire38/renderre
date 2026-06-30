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
  "water-heater", "bathtub", "shower", "chair", "plant", "round-table", "coffee-table", "stairs",
  "prim-box", "prim-cylinder", "prim-sphere", "prim-cone", "prim-pyramid", "prim-wedge",
  "column", "column-sq",
  "tree", "pine", "palm", "bush", "potted-plant", "flowers", "bench", "fountain", "bbq", "umbrella", "rock",
  "streetlamp", "bollard-light", "table-lamp", "floor-lamp", "pendant-lamp", "wall-lamp",
  "pool", "pergola", "gazebo", "swing", "slide", "hammock", "trampoline", "planter-box", "clothesline", "mailbox", "flag", "car",
  "microwave", "range-hood", "dishwasher", "air-conditioner", "ceiling-fan", "water-tank", "bidet", "armchair", "dresser", "crib",
  "rug", "mirror", "painting", "curtain", "wall-clock", "lounger", "bicycle", "dog-house",
  "monitor", "office-chair", "bookcase", "whiteboard", "treadmill", "dumbbell-rack", "exercise-bike",
  "pet-bed", "aquarium", "bird-cage", "coat-rack", "motorcycle", "pickup", "playset", "seesaw", "sandbox",
  "kitchen-island", "corner-cabinet", "double-sink", "towel-rack", "medicine-cabinet", "wine-rack", "bar",
  "tent", "kayak", "campfire", "cooler", "boat", "van", "truck", "scooter",
];
const COMPONENT_KINDS = ["shelf", "drawer", "doorHinged", "doorSliding", "divider", "board", "rod"];
const WALL_KINDS = ["solid", "brick", "stone", "block", "glass", "hedge", "fence", "railing", "picket"];
const SURFACE_SHAPES = ["rect", "circle"];
// props comunes de un componente del taller (cm/m en metros, x desde izq, y desde abajo)
const COMPONENT_PROPS = {
  x: num, y: num, w: num, h: num,
  depth: { ...num, description: "profundidad en Z (m)" },
  depthInset: { ...num, description: "retiro desde el frente (m)" },
  count: num, hinge: { enum: ["left", "right"] }, orient: { enum: ["front", "horizontal", "vertical"] },
  shape: { enum: ["box", "cylinder", "sphere", "cone", "pyramid", "wedge"], description: "solo placa (board): forma 3D" },
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
      "Genera una escena (muros, aberturas, muebles) a partir de una descripción en lenguaje natural en español, usando el parser local del proyecto. Se SUMA a lo que ya hay. Ej: 'cocina de 4x3 con bajo mesada, mesada y alacena'. Para escenas exactas conviene renderre_apply_scene.",
    inputSchema: {
      type: "object",
      properties: {
        description: { ...str, description: "Descripción del espacio/mueble a generar" },
      },
      required: ["description"],
    },
    handler: (a) => runCommand("generate", { description: String(a.description || "") }, "Generar"),
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
    description:
      `Agrega un muro/cerco entre dos puntos [x,z] (metros) en el piso activo. kind ∈ ${WALL_KINDS.join(", ")} (solid=liso; brick/stone/block/glass/hedge=macizos; fence=alambrado, railing=reja, picket=cerco de madera, calados). Opcional: base (arranque), heightA/heightB (tope inclinado a dos aguas), materialId, name.`,
    inputSchema: { type: "object", properties: { a: vec2, b: vec2, kind: { enum: WALL_KINDS }, thickness: num, height: num, base: num, heightA: num, heightB: num, materialId: str, name: str }, required: ["a", "b"] },
    handler: (a) => runCommand("add_wall", a, "Agregar muro"),
  },
  {
    name: "renderre_add_surface",
    description:
      "Agrega una superficie de suelo (grabilla, césped, deck, agua, etc.) centrada en (x,z) o pos [x,z]. width/depth en metros (si se omiten, 2×2). shape: rect|circle. Apoyá varias superficies para distintos suelos; lift (m) las apila/eleva. Asigná materialId (de get_state.materials) o color.",
    inputSchema: {
      type: "object",
      properties: { pos: vec2, x: num, z: num, width: num, depth: num, shape: { enum: SURFACE_SHAPES }, rotDeg: num, thickness: num, lift: num, materialId: str, color: str, name: str },
    },
    handler: (a) => runCommand("add_surface", a, "Agregar suelo"),
  },
  {
    name: "renderre_update_surface",
    description:
      "Edita una superficie de suelo por id (de get_state.surfaces): mover (x,z), redimensionar (width/depth), rotar (rotDeg), forma (shape), espesor (thickness), elevación (lift), material (materialId; null para quitar), color o nombre.",
    inputSchema: {
      type: "object",
      properties: { id: str, x: num, z: num, width: num, depth: num, shape: { enum: SURFACE_SHAPES }, rotDeg: num, thickness: num, lift: num, materialId: str, color: str, name: str },
      required: ["id"],
    },
    handler: (a) => runCommand("update_surface", a, "Editar suelo"),
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
  {
    name: "renderre_fit_view_3d",
    description: "Encuadra la cámara de la vista 3D para ver todo el modelo.",
    inputSchema: { type: "object", properties: {} },
    handler: () => runCommand("fit_3d", {}, "Encuadrar 3D"),
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
        carcass: bool, back: bool,
      },
      required: ["id"],
    },
    handler: (a) => runCommand("update_furniture", a, "Editar mueble"),
  },
  {
    name: "renderre_update_wall",
    description:
      `Edita un muro existente por id: tipo (kind ∈ ${WALL_KINDS.join(", ")}), mover extremos a/b ([x,z]), espesor, alto, base (arranque), heightA/heightB (tope inclinado a dos aguas), nombre o material (materialId; null para quitarlo).`,
    inputSchema: { type: "object", properties: { id: str, kind: { enum: WALL_KINDS }, a: vec2, b: vec2, thickness: num, height: num, base: num, heightA: num, heightB: num, name: str, materialId: str }, required: ["id"] },
    handler: (a) => runCommand("update_wall", a, "Editar muro"),
  },
  {
    name: "renderre_delete",
    description: "Borra un elemento por id. kind: furniture | wall | opening | surface.",
    inputSchema: { type: "object", properties: { kind: { enum: ["furniture", "wall", "opening", "surface"] }, id: str }, required: ["kind", "id"] },
    handler: (a) => runCommand("delete", a, "Borrar"),
  },
  {
    name: "renderre_set_floor_material",
    description: "Asigna (o quita) el material global del piso. Pasá materialId (de get_state.materials) u omitilo para quitarlo.",
    inputSchema: { type: "object", properties: { materialId: str } },
    handler: (a) => runCommand("set_floor_material", a, "Material de piso"),
  },
  {
    name: "renderre_set_floor_level_material",
    description: "Asigna (o quita) el material del suelo SOLO de un nivel/piso (anula el global para ese piso). level = índice del piso (0 = planta baja); omití level para usar el activo. Omití materialId para quitarlo.",
    inputSchema: { type: "object", properties: { level: num, materialId: str } },
    handler: (a) => runCommand("set_floor_level_material", a, "Material de piso (nivel)"),
  },
  {
    name: "renderre_set_render",
    description: "Ajusta iluminación y fondo de la vista 3D. sunAzimuth (0..360°, dirección del sol en planta), sunElevation (1..90°, altura sobre el horizonte), sunIntensity (0..3), ambient (0..2, luz ambiente), background (color hex del cielo/fondo), shadows (true/false), lampLights (true/false: las luminarias proyectan luz real), lampIntensity (0..40). Pasá solo los campos que quieras cambiar.",
    inputSchema: { type: "object", properties: { sunAzimuth: num, sunElevation: num, sunIntensity: num, ambient: num, background: str, shadows: bool, lampLights: bool, lampIntensity: num } },
    handler: (a) => runCommand("set_render", a, "Ajustes de render"),
  },
  {
    name: "renderre_set_terrain",
    description: "Configura la malla de terreno esculpible (relieve del suelo). enabled (mostrar/ocultar en 3D), materialId (de get_state.materials), cols/rows/cell (tamaño de la grilla en celdas y metros — cambiarlo reinicia el relieve), reset (true = aplanar todo). El estado se lee en get_state.terrain.",
    inputSchema: { type: "object", properties: { enabled: bool, materialId: str, cols: num, rows: num, cell: num, reset: bool } },
    handler: (a) => runCommand("set_terrain", a, "Terreno"),
  },
  {
    name: "renderre_sculpt_terrain",
    description: "Esculpe el terreno con un pincel circular en el punto (x,z) en metros. radius (m), strength (m por aplicación), mode: raise (subir) | lower (bajar) | flatten (aplanar) | smooth (suavizar). Habilita el terreno automáticamente. Útil para hacer lomas, pozos o desniveles al recrear un terreno.",
    inputSchema: { type: "object", properties: { x: num, z: num, radius: num, strength: num, mode: { enum: ["raise", "lower", "flatten", "smooth"] } }, required: ["x", "z"] },
    handler: (a) => runCommand("sculpt_terrain", a, "Esculpir terreno"),
  },
  {
    name: "renderre_set_pricing",
    description: "Ajusta la lista de precios del despiece/presupuesto del Taller (moneda libre). Campos: boardW/boardH (tamaño de placa en m), boardPrice ($/placa), edgePrice ($/ml de canto), hingePrice, slidePrice (par), pullPrice, rodPrice, laborPerM2 ($/m²), yield (0..1 aprovechamiento). El despiece y presupuesto calculados se leen en get_state.cutlist. Pasá solo los campos a cambiar.",
    inputSchema: { type: "object", properties: { boardW: num, boardH: num, boardPrice: num, edgePrice: num, hingePrice: num, slidePrice: num, pullPrice: num, rodPrice: num, laborPerM2: num, yield: num } },
    handler: (a) => runCommand("set_pricing", a, "Lista de precios"),
  },
  {
    name: "renderre_place_custom",
    description: "Coloca en el plano un mueble guardado de la biblioteca (por libId o por name, de get_state.customLibrary).",
    inputSchema: { type: "object", properties: { libId: str, name: str } },
    handler: (a) => runCommand("place_custom", a, "Colocar guardado"),
  },
  {
    name: "renderre_place_model",
    description: "Coloca un modelo 3D importado (.glb) de la biblioteca del proyecto, por id o name (de get_state.models). El usuario los importa desde el catálogo con 'Importar .glb'.",
    inputSchema: { type: "object", properties: { id: str, name: str } },
    handler: (a) => runCommand("place_model", a, "Colocar modelo"),
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
    description: "Ajusta el mueble en edición en el Taller: nombre, medidas (width/height/depth/panel, m), color, fondo (back) y carcasa (carcass: false = sin la caja, solo componentes, para formas libres como una escalera).",
    inputSchema: { type: "object", properties: { name: str, width: num, height: num, depth: num, panel: num, color: str, back: bool, carcass: bool } },
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
  // ---- techos ----
  {
    name: "renderre_set_roof",
    description: "Pone (o cambia) el techo de un nivel. kind: flat (losa plana) | gable (a dos aguas) | shed (una caída). level omitido = activo. Cubre la huella de los muros del nivel.",
    inputSchema: { type: "object", properties: { level: num, kind: { enum: ["flat", "gable", "shed"] } }, required: ["kind"] },
    handler: (a) => runCommand("set_roof", a, "Poner techo"),
  },
  {
    name: "renderre_update_roof",
    description: "Ajusta el techo de un nivel: height (altura de aleros desde el piso), rise (cuánto sube la cumbrera, gable), overhang (alero saliente, m), ridgeAxis (x|z, dirección de la cumbrera), thickness, materialId.",
    inputSchema: { type: "object", properties: { level: num, height: num, rise: num, overhang: num, ridgeAxis: { enum: ["x", "z"] }, thickness: num, materialId: str } },
    handler: (a) => runCommand("update_roof", a, "Ajustar techo"),
  },
  {
    name: "renderre_remove_roof",
    description: "Quita el techo de un nivel (level omitido = activo).",
    inputSchema: { type: "object", properties: { level: num } },
    handler: (a) => runCommand("remove_roof", a, "Quitar techo"),
  },
  // ---- materiales ----
  {
    name: "renderre_add_material",
    description: "Crea un material de color sólido (luego asignalo por id con update_furniture/update_wall/set_floor_material). tileM=metros por repetición, roughness/metalness 0..1, opacity 0..1 (transparencia: agua/vidrio).",
    inputSchema: { type: "object", properties: { name: str, color: str, tileM: num, roughness: num, metalness: num, opacity: num }, required: ["name", "color"] },
    handler: (a) => runCommand("add_material", a, "Crear material"),
  },
  {
    name: "renderre_update_material",
    description: "Edita un material existente por id (nombre, color, tileM, roughness, metalness, opacity 0..1).",
    inputSchema: { type: "object", properties: { id: str, name: str, color: str, tileM: num, roughness: num, metalness: num, opacity: num }, required: ["id"] },
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
    description: "Selecciona un elemento por id. kind: wall | furniture | opening | surface.",
    inputSchema: { type: "object", properties: { kind: { enum: ["wall", "furniture", "opening", "surface"] }, id: str }, required: ["kind", "id"] },
    handler: (a) => runCommand("select", a, "Seleccionar"),
  },
  {
    name: "renderre_set_multi",
    description: "Fija una selección múltiple. refs = lista de { kind, id }.",
    inputSchema: {
      type: "object",
      properties: { refs: { type: "array", items: { type: "object", properties: { kind: { enum: ["wall", "furniture", "opening", "surface"] }, id: str }, required: ["kind", "id"] } } },
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
    description: "Cambia la herramienta activa del editor: select | wall | pan | furniture | opening | surface.",
    inputSchema: { type: "object", properties: { tool: { enum: ["select", "wall", "pan", "furniture", "opening", "surface"] } }, required: ["tool"] },
    handler: (a) => runCommand("set_tool", a, "Herramienta"),
  },
  {
    name: "renderre_set_wall_kind",
    description: `Fija el tipo de muro/cerco para los próximos trazos. kind ∈ ${WALL_KINDS.join(", ")}.`,
    inputSchema: { type: "object", properties: { kind: { enum: WALL_KINDS } }, required: ["kind"] },
    handler: (a) => runCommand("set_wall_kind", a, "Tipo de muro"),
  },
  {
    name: "renderre_set_surface_material",
    description: "Fija el material por defecto de las próximas superficies de suelo (materialId; omitir/null = sin material).",
    inputSchema: { type: "object", properties: { materialId: str } },
    handler: (a) => runCommand("set_surface_material", a, "Material de suelo"),
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
