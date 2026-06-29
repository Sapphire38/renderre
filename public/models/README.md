# Modelos 3D (.glb) para Renderre

Acá van los modelos reales que reemplazan a los objetos hechos con cajas.
Cuando un tipo de objeto tiene un `.glb` registrado, el editor lo usa; si el archivo
falta o falla, cae automáticamente al modelo procedural (las cajas). Nunca rompe.

## Cómo agregar una Hilux / kayak / lo que sea

1. Conseguí un modelo **.glb** (glTF binario). Fuentes **CC0** (uso libre, sin atribución):
   - **Kenney** — https://kenney.nl/assets (ej. *Car Kit*, *Nature Kit*, *Furniture Kit*)
   - **Quaternius** — https://quaternius.com (ej. *Ultimate Vehicles*, *Ultimate Nature*)
   - **Poly Pizza** — https://poly.pizza (filtrá por licencia CC0)
2. Copiá el archivo a esta carpeta, ej. `public/models/hilux.glb`.
3. Registralo en `src/lib/models.ts`:

   ```ts
   export const FURNITURE_MODELS = {
     pickup: { url: "/models/hilux.glb", fit: true },
     kayak:  { url: "/models/kayak.glb",  fit: true },
   };
   ```

   Opciones por entrada:
   - `fit: true` (default) — auto-escala el modelo al ancho×profundidad del objeto.
   - `scale: 1.2` — escala manual (desactiva `fit`).
   - `rotDeg: 90` — gira el modelo si viene mirando para otro lado.
   - `yOffset: 0.1` — sube/baja para apoyarlo en el piso.

4. Listo: colocá el objeto (ej. "Camioneta") y se renderiza con el modelo real.

## Notas

- Usá `.glb` **sin compresión DRACO/Meshopt** (o configurá el decoder), para que cargue directo.
- Mantené los archivos livianos (pocos MB) — se sirven al navegador del usuario.
- `example-box.glb` es un cubo de prueba para verificar que el pipeline funciona.
- Respetá la licencia de cada modelo (CC0 es lo más seguro para uso comercial).
