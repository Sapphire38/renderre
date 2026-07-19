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

## Instalación (paquete `renderre-mcp`)

El server es un paquete npm instalable (sin dependencias). Tres maneras:

**A. Global desde el repo clonado** (sin publicar nada):

```bash
npm install -g ./mcp-server        # desde la raíz del repo
renderre-mcp                        # queda el comando disponible
```

**B. Desde npm** (una vez publicado con `cd mcp-server && npm publish`):

```bash
npx -y renderre-mcp
```

**C. Directo con node** (como hasta ahora): `node mcp-server/renderre-mcp.mjs`.

En todos los casos, la URL de la app se configura con la variable
`RENDERRE_URL` (default `http://localhost:3000`). Si el sistema está
desplegado, apuntala al dominio: `RENDERRE_URL=https://tu-dominio.com`.

## Uso con Claude Code

Ya hay un `.mcp.json` en la raíz del repo: al abrir el proyecto con Claude
Code, aprobá el server `renderre` cuando lo pida. Listo.

Para usarlo en **cualquier otro proyecto/carpeta** (con el paquete instalado):

```bash
claude mcp add renderre --env RENDERRE_URL=http://localhost:3000 -- renderre-mcp
# o, publicado en npm:
claude mcp add renderre --env RENDERRE_URL=http://localhost:3000 -- npx -y renderre-mcp
```

Verificá con `/mcp` que aparezca `renderre` conectado. Después abrí el editor
en el navegador y pedile a Claude, por ejemplo: *"abrí el taller y armame una
cajonera de 60×90 con 4 cajones"* — los cambios se ven en vivo.

## Uso con Claude Desktop

Agregá esto a `claude_desktop_config.json`
(macOS: `~/Library/Application Support/Claude/`,
Windows: `%APPDATA%\Claude\`) y reiniciá Claude Desktop:

```json
{
  "mcpServers": {
    "renderre": {
      "command": "npx",
      "args": ["-y", "renderre-mcp"],
      "env": { "RENDERRE_URL": "http://localhost:3000" }
    }
  }
}
```

Si no está publicado en npm, usá la ruta directa:

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

## ¿Y con claude.ai en el navegador?

Los conectores de **claude.ai** (web) no aceptan servers stdio como este:
necesitan un **MCP remoto** (Streamable HTTP) con URL pública. El camino es
exponer un endpoint MCP dentro de la propia app Next (p. ej. `/api/mcp/http`)
que reutilice el mismo bridge, desplegarla, y agregar esa URL como conector
personalizado en claude.ai (Settings → Connectors). Con Claude Code y Claude
Desktop este server stdio alcanza y funciona hoy.

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
