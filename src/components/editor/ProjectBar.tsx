"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor } from "@/lib/store";
import {
  deleteProject,
  listProjects,
  loadProject,
  saveProject,
} from "@/lib/storage";
import { SCHEMA_VERSION, type ProjectData, type SavedProject } from "@/lib/types";
import { PlusIcon, SaveIcon, FolderIcon, TrashIcon, ChevronDownIcon, CabinetIcon, DownloadIcon, UploadIcon } from "./icons";

function fmtDate(ts: number): string {
  try {
    return new Date(ts).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function ProjectBar() {
  const projectName = useEditor((s) => s.projectName);
  const setProjectName = useEditor((s) => s.setProjectName);
  const dirty = useEditor((s) => s.dirty);
  const exportData = useEditor((s) => s.exportData);
  const loadData = useEditor((s) => s.loadData);
  const newProject = useEditor((s) => s.newProject);
  const markSaved = useEditor((s) => s.markSaved);
  const openWorkbench = useEditor((s) => s.openWorkbench);
  const pushToast = useEditor((s) => s.pushToast);

  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadJson = (filename: string, obj: unknown) => {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadProject = (name: string, data: ProjectData) => {
    const safe = (name || "proyecto").trim() || "proyecto";
    downloadJson(`${safe.replace(/[^\w\-]+/g, "_")}.renderre.json`, {
      app: "renderre",
      schemaVersion: SCHEMA_VERSION,
      name: safe,
      exportedAt: Date.now(),
      data,
    });
    pushToast(`Exportado: ${safe}`, "ok");
  };

  const onExport = () => downloadProject(projectName, exportData());

  // Backup completo: todos los proyectos guardados en un solo archivo (para mudar de PC).
  const onExportAll = () => {
    const all = listProjects();
    if (!all.length) {
      pushToast("No hay proyectos guardados para exportar", "warn");
      return;
    }
    downloadJson("renderre-backup.json", {
      app: "renderre",
      kind: "backup",
      schemaVersion: SCHEMA_VERSION,
      exportedAt: Date.now(),
      projects: all,
    });
    pushToast(`Backup de ${all.length} proyecto${all.length > 1 ? "s" : ""} exportado`, "ok");
  };

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    try {
      const obj = JSON.parse(await file.text());
      // Backup completo: { projects: SavedProject[] } → restaura todos a este equipo.
      if (Array.isArray(obj?.projects)) {
        let n = 0;
        for (const p of obj.projects) {
          if (p && typeof p.name === "string" && p.data && Array.isArray(p.data.walls)) {
            saveProject(p.name, p.data, typeof p.updatedAt === "number" ? p.updatedAt : Date.now());
            n++;
          }
        }
        refresh();
        setOpen(true);
        pushToast(`Importados ${n} proyecto${n === 1 ? "" : "s"} (abrilos desde “Abrir”)`, "ok");
        return;
      }
      // Proyecto único.
      const data = (obj?.data ?? obj) as ProjectData;
      if (!data || typeof data !== "object" || !Array.isArray(data.walls)) {
        throw new Error("formato inválido");
      }
      if (dirty && !window.confirm("Hay cambios sin guardar. ¿Importar igual?")) return;
      const name = (typeof obj?.name === "string" && obj.name) || file.name.replace(/\.(renderre\.)?json$/i, "");
      loadData(data, name);
      pushToast(`Importado: ${name}`, "ok");
    } catch {
      window.alert("No se pudo importar: el archivo no es un proyecto Renderre válido.");
    }
  };

  const refresh = () => setProjects(listProjects());

  useEffect(() => {
    if (!open) return;
    refresh();
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const onSave = () => {
    const name = projectName.trim();
    if (!name) {
      window.alert("Poné un nombre al proyecto antes de guardar.");
      return;
    }
    saveProject(name, exportData(), Date.now());
    markSaved();
    refresh();
    pushToast(`Guardado: ${name}`, "ok");
  };

  const onNew = () => {
    if (dirty && !window.confirm("Hay cambios sin guardar. ¿Crear un proyecto nuevo igual?")) return;
    newProject();
  };

  const onOpenProject = (p: SavedProject) => {
    if (dirty && !window.confirm("Hay cambios sin guardar. ¿Abrir otro proyecto igual?")) return;
    const fresh = loadProject(p.name) ?? p;
    loadData(fresh.data, fresh.name);
    setOpen(false);
  };

  const onDelete = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar el proyecto "${name}"?`)) return;
    deleteProject(name);
    refresh();
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-neutral-800 bg-neutral-900 px-3">
      <div className="flex items-center gap-2">
        <div className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-sky-500 to-indigo-600 text-sm font-bold text-white">
          R
        </div>
        <span className="text-sm font-semibold tracking-tight text-neutral-100">Renderre</span>
        <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
          Sprint 1
        </span>
      </div>

      <div className="mx-1 h-6 w-px bg-neutral-800" />

      <div className="flex items-center gap-2">
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          spellCheck={false}
          className="w-56 rounded-md border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-100 outline-none focus:border-sky-600"
          placeholder="Nombre del proyecto"
        />
        {dirty && (
          <span title="Cambios sin guardar" className="h-2 w-2 rounded-full bg-amber-400" />
        )}
      </div>

      <div className="flex-1" />

      <button
        type="button"
        onClick={() => openWorkbench()}
        title="Crear un mueble en el taller"
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-sky-300 hover:bg-neutral-800"
      >
        <CabinetIcon width={16} height={16} /> Taller
      </button>

      <button
        type="button"
        onClick={onNew}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
      >
        <PlusIcon width={16} height={16} /> Nuevo
      </button>

      <button
        type="button"
        onClick={onExport}
        title="Descargar el proyecto actual como archivo (.renderre.json)"
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
      >
        <DownloadIcon width={16} height={16} /> Exportar
      </button>

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        title="Importar un proyecto desde un archivo"
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
      >
        <UploadIcon width={16} height={16} /> Importar
      </button>
      <input ref={fileRef} type="file" accept=".json,application/json" onChange={onImportFile} className="hidden" />

      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
        >
          <FolderIcon width={16} height={16} /> Abrir <ChevronDownIcon width={14} height={14} />
        </button>
        {open && (
          <div className="absolute right-0 top-full z-30 mt-1 max-h-96 w-72 overflow-auto rounded-lg border border-neutral-800 bg-neutral-900 p-1 shadow-xl">
            {projects.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-neutral-500">
                No hay proyectos guardados todavía.
              </div>
            ) : (
              projects.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => onOpenProject(p)}
                  className="group flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left hover:bg-neutral-800"
                >
                  <FolderIcon width={16} height={16} className="text-neutral-500" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-neutral-100">{p.name}</div>
                    <div className="text-[11px] text-neutral-500">
                      {p.data.walls.length} muros · {fmtDate(p.updatedAt)}
                    </div>
                  </div>
                  <span
                    role="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.stopPropagation();
                      const fresh = loadProject(p.name) ?? p;
                      downloadProject(fresh.name, fresh.data);
                    }}
                    title="Exportar a archivo"
                    className="rounded p-1 text-neutral-600 opacity-0 hover:bg-neutral-700 hover:text-sky-400 group-hover:opacity-100"
                  >
                    <DownloadIcon width={15} height={15} />
                  </span>
                  <span
                    role="button"
                    tabIndex={-1}
                    onClick={(e) => onDelete(e, p.name)}
                    title="Eliminar"
                    className="rounded p-1 text-neutral-600 opacity-0 hover:bg-neutral-700 hover:text-red-400 group-hover:opacity-100"
                  >
                    <TrashIcon width={15} height={15} />
                  </span>
                </button>
              ))
            )}
            {projects.length > 0 && (
              <button
                type="button"
                onClick={onExportAll}
                title="Descargar todos los proyectos en un archivo (para mudar de PC)"
                className="mt-1 flex w-full items-center gap-2 border-t border-neutral-800 px-2.5 py-2 text-left text-xs text-neutral-300 hover:bg-neutral-800"
              >
                <DownloadIcon width={15} height={15} className="text-sky-400" />
                Exportar todos (backup)
              </button>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onSave}
        className="flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500"
      >
        <SaveIcon width={16} height={16} /> Guardar
      </button>
    </header>
  );
}
