# Renderre

Editor para **diseñar casas y muebles de MDF** y simular espacios: trazás muros sobre una
cuadrícula en planta (2D), colocás muebles paramétricos y lo ves todo extruido en **3D** en tiempo
real. Podés **generar muros y muebles a partir de una descripción** ("habitación de 4x3 con un
placard de 1.8m y 3 puertas") y guardar los proyectos por nombre.

> Estado: muros + **muebles MDF** + **generación por IA**, todo en 2D + 3D, con proyectos guardables.

## Stack

- **Next.js 15** (App Router, TypeScript) + ruta API `/api/ai/generate`
- **react-three-fiber** + **drei** + **three** (vista 3D)
- **Zustand** (estado del editor, con undo/redo)
- **Tailwind CSS v4** (UI)
- Persistencia de proyectos en **localStorage** (capa abstraída en `src/lib/storage.ts`)

Unidades en **metros** (espesores en cm/mm en la UI).

## Cómo correr

```bash
npm install
npm run dev      # http://localhost:3000  (redirige a /editor)
npm run build    # build de producción
```

## Controlar desde Claude (MCP)

Renderre incluye un **servidor MCP** (`mcp-server/renderre-mcp.mjs`) que deja
manejar el editor desde **Claude** (Claude Code o Claude Desktop): podés pedirle
en lenguaje natural que trace muros, coloque muebles, abra puertas/ventanas,
genere una escena, guarde el proyecto, etc., y lo aplica **en vivo** sobre el
editor abierto en el navegador.

Cómo funciona: Claude habla por MCP (stdio) con `renderre-mcp.mjs`, que reenvía
los comandos por HTTP al *bridge* de la app (`/api/mcp/*`); el editor abierto en
el navegador hace polling y los aplica al instante.

```
Claude ──(MCP stdio)──► renderre-mcp.mjs ──(HTTP)──► Next.js /api/mcp/* ──► editor
```

**Puesta en marcha (Claude Code):**

1. Corré la app: `npm run dev`.
2. Abrí el editor en el navegador: `http://localhost:3000/editor` (necesario;
   si no está abierto los comandos quedan encolados).
3. Ya hay un `.mcp.json` en la raíz: al abrir el proyecto en Claude Code,
   aprobá el server `renderre`. Verificá con `/mcp` que figure conectado.

Para **Claude Desktop**, la lista completa de herramientas (`renderre_add_wall`,
`renderre_generate`, `renderre_apply_scene`, `renderre_get_state`, …) y el
ejemplo de configuración están en **[`mcp-server/README.md`](mcp-server/README.md)**.

Ejemplo de pedido:

> "Armá un dormitorio de 4×3 m con una puerta y una ventana, una cama contra la
> pared del fondo y una mesa de luz al lado."

## Funciones

### Muros (vista 2D en planta)
- Trazar muros encadenados; doble clic o `Esc` para terminar. Snap a la cuadrícula y a extremos.
- Cotas en vivo (longitud + ángulo). Seleccionar para editar **espesor/altura**, mover el cuerpo o
  arrastrar los extremos.

### Muebles de MDF y equipamiento
- Herramienta **Mueble (F)** con catálogo en grupos: **MDF** (módulo, bajo mesada, alacena, estantería,
  mesada, placard, mesa), **Equip.** (TV, heladera, cocina, bacha, lavarropas, inodoro, cama, sofá) y
  **Míos** (los del taller). Clic en el plano para colocar.
- Cada mueble es paramétrico: ancho, profundidad, alto, **espesor de placa MDF**, estantes, puertas,
  altura base, rotación y color. Se dibuja como carcasa de paneles en 3D.
- Seleccionar (V) para mover, **rotar** (tirador en el plano o `R` = 90°) y editar en el panel.

### Taller de muebles
- Botón **Taller** (barra superior): entorno a pantalla completa para diseñar un mueble en detalle.
- Carcasa paramétrica (ancho/alto/profundidad/espesor/fondo/color) + componentes combinables:
  **estante, cajón (apilables), puerta batiente, puerta corrediza, división, placa libre y barral**.
- **Color por componente**: cada componente puede tener su propio color (carcasa en un tono, frentes
  en otro), o "auto" para heredar el del mueble.
- **Editor de alzado frontal**: arrastrás y redimensionás los componentes sobre la cara del mueble,
  con **vista 3D en vivo** al lado (puertas que abren, cajones que salen).
- **IA en el taller**: describí el mueble ("placard 1.8x2.4 con 3 corredizas y 4 cajones a la
  izquierda") y arma la carcasa + componentes automáticamente (DeepSeek/MiniMax o parser local), con
  auto-layout por lados/regiones.
- "Guardar y colocar" lo agrega al plano y a tu biblioteca **Mis muebles** (reutilizable desde el
  catálogo). Los muebles propios se pueden volver a abrir con "✎ Editar en el taller".

### Generar por IA (texto → escena)
- Barra inferior: escribí una descripción y se crean los muros/muebles. Ej:
  - `habitación de 4x3`
  - `cocina de 5x3 con bajo mesada de 1.2m, mesada y alacena`
  - `placard de 1.8m con 3 puertas`
- Funciona **sin API key** con un parser local en español. Si configurás una key, usa el LLM
  (mejor comprensión). Ver "IA: proveedores".

### Materiales y texturas
- Librería de materiales (presets de MDF, melamina, madera, etc.). Asigná un material a un **muro,
  mueble o piso** desde el panel.
- **Subir una imagen → material PBR**: se usa como albedo y se genera un **normal map** (Sobel) en el
  navegador; se aplica con tiling (tamaño de textura) y rugosidad ajustables.
- Guía de fuentes CC0 (Poly Haven, ambientCG) en `docs/materiales-investigacion.json`.

### Puertas y ventanas
- Herramienta **Abertura (O)**: elegí puerta o ventana y hacé clic sobre un muro. Editá ancho, alto,
  antepecho (ventana) y posición; arrastrala a lo largo del muro.
- En 3D el muro se divide en segmentos alrededor del hueco (dintel arriba, antepecho abajo en
  ventanas); en 2D se ve el hueco con arco de puerta o línea de ventana.

### Vista 3D
- **⤢ Agrandar**: expande el 3D a toda la app para ver mejor (Esc para volver).
- **⛶ Pantalla completa**: fullscreen real del navegador.
- **⬇ PNG**: descarga la imagen renderizada del momento.

### Proyectos
- Guardar / abrir / nuevo, por nombre (localStorage). Guarda muros, muebles, aberturas y materiales.

### Atajos

| Tecla | Acción |
|-------|--------|
| `V` | Seleccionar |
| `W` | Trazar muro |
| `F` | Colocar mueble |
| `O` | Puerta / ventana |
| `H` / `Espacio` | Mover vista (pan) |
| `R` | Rotar mueble seleccionado 90° |
| `Shift` (al trazar) | Lock ortogonal (45°) |
| `G` / `M` | Cuadrícula / Imán on-off |
| `Supr` | Borrar selección |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Deshacer / Rehacer |

## IA: proveedores

La ruta `POST /api/ai/generate` intenta usar un LLM si hay variables de entorno; si no, cae al
parser local. Copiá `.env.example` a `.env.local` y completá una opción:

- **DeepSeek** (texto): `DEEPSEEK_API_KEY=...`
- **OpenAI-compatible** (MiniMax, OpenAI, etc.): `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`

### Visión (📷 subir foto / plano)
Las barras de IA (plano y Taller) tienen un botón **📷** para subir una imagen y recrear a partir de
ella + las medidas que tipees:
- **Plano arquitectónico (PNG)** → traza **muros + puertas y ventanas** (leyendo cotas o la medida
  total que indiques para la escala).
- **Foto** de un mueble/ambiente → lo reconstruye.

Requiere un proveedor con **visión**:
- **MiniMax-M3** (lee imágenes): `AI_BASE_URL=https://api.minimax.io/v1`, `AI_MODEL=MiniMax-M3`.
- También sirven GPT-4o, Gemini o Claude (cualquier endpoint OpenAI-compatible con visión).
- La **API de DeepSeek NO acepta imágenes** (solo texto). Sin proveedor de visión, la foto se ignora
  y se usa solo el texto (te lo avisa).

## Estructura

```
src/
  app/
    editor/page.tsx            # editor (solo cliente)
    api/ai/generate/route.ts   # IA: descripción → SceneSpec (LLM o fallback local)
  components/editor/
    EditorShell.tsx            # layout general
    ProjectBar.tsx             # guardar / abrir / nuevo
    Toolbar.tsx                # herramientas y toggles
    PlanCanvas.tsx             # canvas 2D: muros + muebles, snapping, edición, pan/zoom
    Scene3D.tsx                # vista 3D (muros + carcasas de muebles)
    PropertiesPanel.tsx        # propiedades de muro / mueble
    FurnitureCatalog.tsx       # catálogo de presets MDF
    OpeningBar.tsx             # selector puerta/ventana
    MaterialControls.tsx       # swatches + subir imagen + sliders de material
    AiPromptBar.tsx            # barra de generación por IA
    FurnitureWorkbench.tsx     # Taller: entorno a pantalla completa
    FrontElevationEditor.tsx   # editor visual del alzado frontal (drag/resize)
    WorkbenchControls.tsx      # carcasa + agregar/editar componentes
    WorkbenchPreview3D.tsx     # 3D en vivo del mueble en construcción
  lib/
    types.ts  geometry.ts  store.ts  storage.ts
    furniture.ts               # presets MDF + generación de paneles (carcasa)
    openings.ts                # aberturas: offset, segmentación del muro
    materials.ts  texture.ts   # presets de materiales + imagen → PBR (Sobel)
    ai-parse.ts                # parser local español → SceneSpec
    ai-build.ts                # SceneSpec → muros + muebles concretos
docs/
  materiales-investigacion.json  # fuentes CC0 de texturas (próximo: materiales)
```

## Roadmap

1. **Muros** ✅ — canvas 2D, trazado, snapping, cotas, edición, preview 3D, proyectos.
2. **Muebles MDF** ✅ — catálogo paramétrico, colocar/mover/rotar/editar en 2D + 3D.
3. **IA por descripción** ✅ — texto → muros + muebles (parser local + DeepSeek/MiniMax).
4. **Materiales y texturas** ✅ — librería + asignar a muros/muebles/piso + subir imagen → PBR
   (albedo + normal). Guía CC0 en `docs/materiales-investigacion.json`.
5. **Aberturas** ✅ — puertas y ventanas (huecos en muros) en 2D y 3D, editables.
6. **Render** — exportar PNG ✅. Pendiente: iluminación avanzada / HDRIs y uniones de esquina prolijas.
```
