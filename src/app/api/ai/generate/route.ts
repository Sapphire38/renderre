import { localParse } from "@/lib/ai-parse";
import { localParseFurniture } from "@/lib/ai-furniture";

export const runtime = "nodejs";

/**
 * Descripción en español → SceneSpec, usando el parser local (heurístico).
 * Lo consume la tool `renderre_generate` del MCP. Sin LLM ni proveedores externos.
 */
export async function POST(req: Request) {
  let description = "";
  let mode: "scene" | "furniture" = "scene";
  try {
    const body = await req.json();
    description = String(body?.description ?? "");
    if (body?.mode === "furniture") mode = "furniture";
  } catch {
    /* ignore */
  }

  if (!description.trim()) {
    return Response.json({ spec: { note: "Escribí una descripción." }, source: "none" });
  }

  const spec = mode === "furniture" ? localParseFurniture(description) : localParse(description);
  return Response.json({ spec, source: "local" });
}
