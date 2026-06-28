import { localParse } from "@/lib/ai-parse";
import { localParseFurniture } from "@/lib/ai-furniture";

export const runtime = "nodejs";

const SCENE_PROMPT = `Convertís descripciones en español (o PLANOS arquitectónicos) de espacios y muebles de MDF en un JSON.
Respondé SOLO con JSON válido (sin texto extra), con esta forma:
{
  "room"?: { "width": number, "depth": number },   // en metros, opcional
  "walls"?: [ { "a": [x,z], "b": [x,z], "thickness"?: number, "height"?: number } ], // metros
  "openings"?: [ { "wall": number, "kind": "door"|"window", "offset"?: number, "width"?: number, "height"?: number, "sill"?: number } ],
  "furniture"?: [ {
     "kind": "module"|"cabinet-base"|"cabinet-wall"|"shelf"|"countertop"|"wardrobe"|"table"|"tv"|"fridge"|"stove"|"sink"|"washer"|"toilet"|"bed"|"sofa"|"tv-stand"|"nightstand"|"desk"|"vanity",
     "x": number, "z": number, "rotDeg"?: number,
     "width"?: number, "depth"?: number, "height"?: number,
     "doors"?: number, "shelves"?: number, "baseHeight"?: number, "name"?: string
  } ]
}
Equipamiento (electrodomésticos/sanitarios): heladera=fridge, cocina/anafe=stove, lavarropas=washer,
inodoro=toilet, bacha/lavabo=sink, TV/tele=tv, cama=bed, sofá=sofa, mesa de luz=nightstand,
escritorio=desk, mueble de TV/rack=tv-stand, vanitory/mueble de baño=vanity.
Convenciones: unidades en METROS, plano XZ (x derecha, z hacia adelante), origen (0,0) en el centro.
"openings": "wall" es el índice 0-based en "walls"; "offset" es la distancia desde el extremo A del muro; ventana suele tener sill≈0.9.
"cabinet-wall" (alacena) suele ir a baseHeight 1.45. Elegí "kind" según el mueble (placard=wardrobe,
alacena=cabinet-wall, bajo mesada=cabinet-base, mesada=countertop, estantería=shelf, mesa=table, genérico=module).

PLANOS (vista en planta): trazá CADA muro como un segmento en "walls" en metros, leyendo las cotas del plano.
Si no hay cotas, fijá la escala con la medida total que indique el texto. Centrá el conjunto cerca del origen.
Numerá puertas y ventanas en "openings" referenciando el índice del muro. Para planos NO uses "room": listá los muros explícitamente.`;

const FURNITURE_PROMPT = `Convertís descripciones en español de UN mueble de MDF en un JSON.
Respondé SOLO con JSON válido (sin texto extra), con esta forma:
{
  "name"?: string,
  "width"?: number, "height"?: number, "depth"?: number, "panel"?: number, // METROS
  "color"?: string,
  "components"?: [ {
     "kind": "shelf"|"drawer"|"doorHinged"|"doorSliding"|"divider"|"board"|"rod",
     "count"?: number,                          // cajones apilados / hojas / puertas / estantes
     "region"?: "bottom"|"top"|"left"|"right"|"full",  // ubicación (opcional)
     "x"?: number, "y"?: number, "w"?: number, "h"?: number, // geometría exacta opcional, metros, x desde izq, y desde abajo
     "hinge"?: "left"|"right", "orient"?: "front"|"horizontal"|"vertical", "color"?: string
  } ]
}
Podés dar "color" (hex) por componente para combinar acabados (p. ej. carcasa blanca con frentes nogal).
Si no das x/y/w/h, el sistema ubica el componente automáticamente según "region" y "count".
Cajones=drawer, puertas batientes=doorHinged, corredizas=doorSliding, estantes=shelf, división=divider, placa/tablero=board, barral=rod.`;

// --- Lectura de imágenes en 2 pasadas: primero "leer" en texto, después estructurar a JSON. ---
const READ_SCENE = `Sos un arquitecto que LEE planos en planta (vista cenital) y fotos de ambientes.
Observá la(s) imagen(es) con MÁXIMA atención y respondé en TEXTO (no JSON) un análisis detallado y ordenado:
1) ESCALA: buscá la medida total o la cota más grande; si hay escala (1:50, etc.) indicála. Decí en metros el ancho y el alto totales del recinto.
2) MUROS: recorré el perímetro y CADA muro interior. Para cada uno indicá su orientación (horizontal/vertical) y su LARGO leyendo las cotas escritas en el plano (números como 3.20, 4,50, 280, etc. — interpretá si están en m o cm). Numerá los muros 1,2,3…
3) ABERTURAS: listá puertas y ventanas, en qué muro están (nº), a qué distancia de un extremo y su ancho. Indicá si es puerta (con arco de barrido) o ventana.
4) MOBILIARIO/EQUIPAMIENTO visible: muebles, mesada, bajo mesada, alacena, heladera, cocina, bacha, inodoro, cama, etc., con su ubicación aproximada.
Sé concreto y numérico. Si una cota no se lee, estimá a partir de la escala y aclaralo. No inventes ambientes que no se ven.`;

const READ_FURNITURE = `Sos un mueblista que LEE fotos y planos de UN mueble de MDF.
Observá la(s) imagen(es) con MÁXIMA atención y respondé en TEXTO (no JSON) un análisis detallado:
1) MEDIDAS: ancho, alto y profundidad totales en metros (leé las cotas; interpretá m o cm). Espesor de placa si se ve.
2) DESPIECE: describí cada componente de adelante hacia atrás y de abajo hacia arriba — cajones (cuántos apilados), puertas batientes (cuántas y hacia qué lado abren), puertas corredizas, estantes (cuántos), divisiones verticales, barrales, tableros.
3) COLORES/ACABADOS: color de carcasa y de frentes (si difieren).
Sé concreto y numérico. No inventes partes que no se ven.`;

const VISION_NOTE =
  "\nSe incluyen una o más IMÁGENES (puede ser un PLANO + una TABLA de medidas, o fotos). " +
  "Combiná TODA la información: usá el plano/foto para la forma, topología y disposición; usá las tablas/cotas para los LARGOS exactos. " +
  "Respetá las medidas que también aparezcan en el texto. Si una pared tiene altura mín y máx, usá la máxima.";

type Provider = { base: string; model: string; key: string };

/** Quita los bloques de razonamiento <think>…</think> (modelos como MiniMax-M3). */
function stripThink(s: string): string {
  let out = s;
  const close = out.lastIndexOf("</think>");
  if (close >= 0) out = out.slice(close + "</think>".length);
  out = out.replace(/<think>[\s\S]*?<\/think>/gi, "");
  return out.trim() || s.trim();
}

function safeJson<T>(content: string): T | null {
  try {
    let c = content.trim();
    const fence = c.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) c = fence[1].trim();
    const start = c.indexOf("{");
    const end = c.lastIndexOf("}");
    if (start >= 0 && end > start) c = c.slice(start, end + 1);
    const obj = JSON.parse(c);
    if (obj && typeof obj === "object") return obj as T;
  } catch {
    /* ignore */
  }
  return null;
}

type ChatPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail?: string } };

/** Llamada cruda a un endpoint OpenAI-compatible. Devuelve el texto del mensaje. */
async function chat(
  p: Provider,
  system: string,
  user: string | ChatPart[],
  opts: { json?: boolean; temperature?: number } = {},
): Promise<string | null> {
  const res = await fetch(`${p.base.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.key}` },
    body: JSON.stringify({
      model: p.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: opts.temperature ?? 0.2,
      stream: false,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}`);
  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  return content ?? null;
}

async function chatJson<T>(
  p: Provider,
  system: string,
  user: string | ChatPart[],
  opts: { temperature?: number } = {},
): Promise<T | null> {
  const txt = await chat(p, system, user, { json: true, temperature: opts.temperature });
  return txt ? safeJson<T>(txt) : null;
}

const imageParts = (images: string[]): ChatPart[] =>
  images.map((url) => ({ type: "image_url", image_url: { url, detail: "high" } }));

export async function POST(req: Request) {
  let description = "";
  let mode: "scene" | "furniture" = "scene";
  let images: string[] = [];
  const isImg = (v: unknown): v is string => typeof v === "string" && v.startsWith("data:image");
  try {
    const body = await req.json();
    description = String(body?.description ?? "");
    if (body?.mode === "furniture") mode = "furniture";
    if (Array.isArray(body?.images)) images = body.images.filter(isImg).slice(0, 6);
    else if (isImg(body?.image)) images = [body.image];
  } catch {
    /* ignore */
  }
  if (!description.trim() && !images.length) {
    return Response.json({ spec: { note: "Escribí una descripción o subí una imagen." }, source: "none" });
  }

  const system = mode === "furniture" ? FURNITURE_PROMPT : SCENE_PROMPT;
  const readSys = mode === "furniture" ? READ_FURNITURE : READ_SCENE;
  const prompt = description.trim() || "Recreá lo que ves en la imagen como mueble/espacio de MDF.";
  const localFallback = () => (mode === "furniture" ? localParseFurniture(description) : localParse(description));

  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const aiKey = process.env.AI_API_KEY;
  const aiBase = process.env.AI_BASE_URL;
  const aiModel = process.env.AI_MODEL;

  // Proveedor de VISIÓN: se puede apuntar a otra plataforma con mejor lectura de imagen
  // definiendo AI_VISION_API_KEY / AI_VISION_BASE_URL / AI_VISION_MODEL. Si no, usa AI_*.
  const visionKey = process.env.AI_VISION_API_KEY || aiKey;
  const visionBase = process.env.AI_VISION_BASE_URL || aiBase;
  const visionModel = process.env.AI_VISION_MODEL || aiModel;

  // Proveedor de TEXTO para estructurar (pasada 2): DeepSeek si hay, si no AI_*, si no el de visión.
  const textProvider: Provider | null = deepseekKey
    ? { base: "https://api.deepseek.com", model: "deepseek-chat", key: deepseekKey }
    : aiKey && aiBase && aiModel
      ? { base: aiBase, model: aiModel, key: aiKey }
      : null;

  try {
    if (images.length) {
      if (visionKey && visionBase && visionModel) {
        const vision: Provider = { base: visionBase, model: visionModel, key: visionKey };
        // Pasada 1: LEER la imagen a texto (OCR + razonamiento espacial).
        let analysis: string | null = null;
        try {
          const raw = await chat(vision, readSys + VISION_NOTE, [{ type: "text", text: prompt }, ...imageParts(images)], {
            temperature: 0.2,
          });
          analysis = raw ? stripThink(raw) : null;
        } catch {
          analysis = null;
        }
        // Pasada 2: ESTRUCTURAR el análisis (+ texto del usuario) a JSON, sin imagen.
        if (analysis && analysis.trim()) {
          const structurer = textProvider ?? vision;
          const structUser = `Descripción del usuario: ${prompt}\n\nANÁLISIS DETALLADO DE LA(S) IMAGEN(ES):\n${analysis.trim()}`;
          const spec = await chatJson(structurer, system, structUser, { temperature: 0.1 });
          if (spec) return Response.json({ spec, source: "ai-vision", imageUsed: true, analysis: analysis.trim() });
        }
        // Respaldo: una sola pasada imagen→JSON.
        const spec = await chatJson(vision, system + VISION_NOTE, [{ type: "text", text: prompt }, ...imageParts(images)], {
          temperature: 0.2,
        });
        if (spec) return Response.json({ spec, source: "ai", imageUsed: true, analysis: analysis ?? undefined });
      }
      // Sin proveedor de visión: usamos solo el texto.
      return Response.json({ spec: localFallback(), source: "local", imageIgnored: true });
    }

    // Solo texto.
    if (textProvider) {
      const spec = await chatJson(textProvider, system, prompt, { temperature: 0.2 });
      if (spec) return Response.json({ spec, source: deepseekKey ? "deepseek" : "ai" });
    }
  } catch {
    // si el proveedor falla, caemos al parser local (texto)
  }

  return Response.json({ spec: localFallback(), source: "local", imageIgnored: images.length ? true : undefined });
}
