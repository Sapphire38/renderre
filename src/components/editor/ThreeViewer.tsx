"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useEditor } from "@/lib/store";
import type { ProjectData } from "@/lib/types";
import { THREE_CHANNEL } from "./ThreeTabSync";

const Scene3D = dynamic(() => import("./Scene3D"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center text-xs text-neutral-500">Iniciando 3D…</div>
  ),
});

const CAM_KEY = "renderre-view3d-cam";

/**
 * Vista 3D en pestaña aparte (/view3d). Se sincroniza con el editor por BroadcastChannel.
 * Tiene cámara propia persistente (no se reencuadra al recibir cambios) y modo presentación.
 */
export default function ThreeViewer() {
  const [ready, setReady] = useState(false);
  const [present, setPresent] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(THREE_CHANNEL);
    let first = true;
    ch.onmessage = (e) => {
      const msg = e.data as { type?: string; name?: string; data?: ProjectData };
      if (msg?.type === "state" && msg.data) {
        try {
          useEditor.getState().loadData(msg.data, msg.name ?? "Vista 3D");
          if (first) {
            first = false;
            setReady(true);
            // Solo reencuadra la primera vez y si no hay una cámara guardada (cámara propia).
            const hasSavedCam = (() => {
              try { return !!localStorage.getItem(CAM_KEY); } catch { return false; }
            })();
            if (!hasSavedCam) setTimeout(() => window.dispatchEvent(new CustomEvent("renderre:fit3d")), 60);
          }
        } catch {
          /* ignorar payload inválido */
        }
      }
    };
    ch.postMessage({ type: "hello" });
    return () => ch.close();
  }, []);

  // Modo presentación: P / Esc lo togglean; al entrar intenta pantalla completa.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "p" || e.key === "P") setPresent((v) => !v);
      else if (e.key === "Escape" && present) setPresent(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [present]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    try {
      if (present && !document.fullscreenElement) el.requestFullscreen?.();
      else if (!present && document.fullscreenElement) document.exitFullscreen?.();
    } catch {
      /* fullscreen no disponible */
    }
  }, [present]);

  return (
    <div ref={wrapRef} className="relative h-dvh w-full bg-[#0b0e14]">
      <Scene3D chrome={!present} persistCameraKey={CAM_KEY} onOpenTab={undefined} />

      {!ready && (
        <div className="pointer-events-none fixed inset-0 grid place-items-center px-6 text-center text-sm text-neutral-400">
          Esperando datos del editor… mantené abierta la pestaña del editor de Renderre.
        </div>
      )}

      {!present ? (
        <button
          type="button"
          onClick={() => setPresent(true)}
          title="Modo presentación (P) · oculta la interfaz"
          className="absolute bottom-3 left-3 z-10 rounded-md bg-neutral-800/90 px-3 py-1.5 text-[12px] font-medium text-neutral-100 hover:bg-neutral-700"
        >
          ▶ Presentación
        </button>
      ) : (
        <div className="pointer-events-none fixed bottom-3 left-1/2 z-10 -translate-x-1/2 rounded bg-black/40 px-2 py-1 text-[11px] text-neutral-400 opacity-70">
          Modo presentación · P o Esc para salir
        </div>
      )}
    </div>
  );
}
