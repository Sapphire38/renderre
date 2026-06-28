import { setEditorState, getEditorState, markEditorSeen } from "@/lib/control-bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** El editor publica su estado actual. */
export async function POST(req: Request) {
  markEditorSeen();
  try {
    const body = await req.json();
    setEditorState(body);
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  return Response.json({ ok: true });
}

/** El MCP server lee el estado del editor. */
export async function GET() {
  return Response.json(getEditorState());
}
