import { commandsAfter, markEditorSeen } from "@/lib/control-bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** El editor (navegador) hace poll de comandos nuevos. Marca el editor como conectado. */
export async function GET(req: Request) {
  markEditorSeen();
  const url = new URL(req.url);
  const after = Number(url.searchParams.get("after") ?? "0") || 0;
  const { commands, seq } = commandsAfter(after);
  return Response.json({ commands, seq });
}
