# Renderre MCP server

Controlá el editor de **Renderre** desde Claude (Claude Code o Claude Desktop).

El server MCP (`renderre-mcp.mjs`) habla con el *bridge* HTTP de la app
(`/api/mcp/*`). La app, al tener el editor abierto en el navegador, hace
polling de los comandos y los aplica en vivo al diseño, y publica su estado
para que Claude pueda leerlo.

```
Claude  ──(MCP stdio)──►  renderre-mcp.mjs  ──(HTTP)──►  Next.js /api/mcp/*
                                                              ▲   │
                                          navegador (editor) ─┘   │ comandos
                                          aplica al store  ◄──────┘
```

## Requisitos

- **Node ≥ 18** (usa `fetch` global; el server no tiene dependencias).
- La app corriendo: `npm run dev` (o `npm run build && npm start`).
- El **editor abierto** en el navegador: `http://localhost:3000/editor`.
  Si no está abierto, los comandos quedan encolados y se avisa en la respuesta.

## Uso con Claude Code

Ya hay un `.mcp.json` en la raíz del repo. Al abrir el proyecto con Claude
Code, aprobá el server `renderre` cuando lo pida. Listo.

Verificá con `/mcp` que aparezca `renderre` conectado.

## Uso con Claude Desktop

Agregá esto a `claude_desktop_config.json`
(macOS: `~/Library/Application Support/Claude/`,
Windows: `%APPDATA%\Claude\`) y reiniciá Claude Desktop:

```json
{
  "mcpServers": {
    "renderre": {
      "command": "node",
      "args": ["RUTA_ABSOLUTA/renderre/mcp-server/renderre-mcp.mjs"],
      "env": { "RENDERRE_URL": "http://localhost:3000" }
    }
  }
}
```

(En Windows usá doble barra: `C:\\Users\\...\\mcp-server\\renderre-mcp.mjs`.)

## Herramientas

| Tool | Qué hace |
|------|----------|
| `renderre_get_state` | Lee el diseño actual (pisos, muros, muebles, aberturas, selección). |
| `renderre_generate` | Genera una escena desde una descripción en español (parser local). |
| `renderre_apply_scene` | Aplica una escena estructurada (`room`/`walls`/`openings`/`furniture`). |
| `renderre_add_wall` | Agrega un muro entre dos puntos `[x,z]`. |
| `renderre_add_furniture` | Agrega un mueble/equipamiento en `(x,z)`. |
| `renderre_add_opening` | Agrega puerta/ventana sobre un muro (`wallIndex`/`wallId`). |
| `renderre_add_floor` / `renderre_set_active_level` | Pisos / nivel activo. |
| `renderre_undo` / `renderre_redo` | Deshacer / rehacer. |
| `renderre_clear` / `renderre_new_project` | Vaciar / proyecto nuevo. |
| `renderre_save_project` | Guardar con nombre (en el navegador). |
| `renderre_fit_view` | Encuadrar la vista 2D. |

Coordenadas en **metros**, plano XZ (x → derecha, z → adelante), origen en el
centro. En `apply_scene`, `openings.wall` es el índice 0-based dentro de `walls`.

### Ejemplo

> "Armá un dormitorio de 4×3 m con una puerta y una ventana, una cama contra
> la pared del fondo y una mesa de luz al lado."

Claude puede usar `renderre_apply_scene` con los muros y aberturas exactos, o
`renderre_generate` con la descripción, y después `renderre_get_state` para
verificar y seguir ajustando.
