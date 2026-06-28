/**
 * Bus de control en memoria que conecta el MCP server (proceso externo) con el
 * editor abierto en el navegador.
 *
 * Flujo:
 *   Claude → MCP server → POST /api/mcp/command  → bus.queue
 *   navegador (editor) → GET /api/mcp/poll?after= → consume comandos y los aplica al store
 *   navegador → POST /api/mcp/state               → publica su estado
 *   Claude → MCP server → GET /api/mcp/state       → lee el estado
 *
 * Es un singleton en globalThis para sobrevivir a los reloads de HMR. Pensado
 * para uso local (un solo proceso de Next dev).
 */

export type ControlCommand = {
  seq: number;
  type: string;
  args?: Record<string, unknown>;
  ts: number;
};

type Bus = {
  seq: number;
  queue: ControlCommand[];
  state: unknown;
  stateTs: number;
  /** Última vez que el navegador hizo poll (para saber si el editor está conectado). */
  lastSeen: number;
};

const KEY = "__renderreControlBus";
const g = globalThis as unknown as Record<string, Bus | undefined>;

function getBus(): Bus {
  if (!g[KEY]) {
    g[KEY] = { seq: 0, queue: [], state: null, stateTs: 0, lastSeen: 0 };
  }
  return g[KEY]!;
}

const CONNECTED_MS = 4000;

export function pushCommand(type: string, args?: Record<string, unknown>): ControlCommand {
  const b = getBus();
  const cmd: ControlCommand = { seq: ++b.seq, type, args, ts: Date.now() };
  b.queue.push(cmd);
  if (b.queue.length > 300) b.queue = b.queue.slice(-300);
  return cmd;
}

export function commandsAfter(after: number): { commands: ControlCommand[]; seq: number } {
  const b = getBus();
  return { commands: b.queue.filter((c) => c.seq > after), seq: b.seq };
}

/** El navegador llama esto al hacer poll: marca que el editor está vivo. */
export function markEditorSeen(): void {
  getBus().lastSeen = Date.now();
}

export function isEditorConnected(): boolean {
  return Date.now() - getBus().lastSeen < CONNECTED_MS;
}

export function setEditorState(state: unknown): void {
  const b = getBus();
  b.state = state;
  b.stateTs = Date.now();
}

export function getEditorState(): { state: unknown; ts: number; connected: boolean } {
  const b = getBus();
  return { state: b.state, ts: b.stateTs, connected: isEditorConnected() };
}
