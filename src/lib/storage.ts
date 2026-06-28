import type { ProjectData, SavedProject } from "./types";

const KEY = "renderre.projects.v1";

type Store = Record<string, SavedProject>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(s: Store): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch (err) {
    // Cuota llena o storage deshabilitado: lo dejamos pasar silenciosamente.
    console.warn("No se pudo guardar el proyecto en localStorage", err);
  }
}

export function listProjects(): SavedProject[] {
  return Object.values(read()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveProject(
  name: string,
  data: ProjectData,
  updatedAt: number,
): SavedProject {
  const s = read();
  const proj: SavedProject = { name, updatedAt, data };
  s[name] = proj;
  write(s);
  return proj;
}

export function loadProject(name: string): SavedProject | null {
  return read()[name] ?? null;
}

export function deleteProject(name: string): void {
  const s = read();
  delete s[name];
  write(s);
}

export function projectExists(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(read(), name);
}
