import { pushCommand, isEditorConnected } from "@/lib/control-bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** El MCP server postea un comando para que lo aplique el editor abierto. */
export async function POST(req: Request) {
  let type = "";
  let args: Record<string, unknown> | undefined;
  try {
    const body = await req.json();
    type = String(body?.type ?? "");
    if (body?.args && typeof body.args === "object") args = body.args as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  if (!type) {
    return Response.json({ ok: false, error: "missing 'type'" }, { status: 400 });
  }
  const cmd = pushCommand(type, args);
  return Response.json({ ok: true, seq: cmd.seq, editorConnected: isEditorConnected() });
}
