"use client";

import { useEffect } from "react";
import { useEditor } from "@/lib/store";

export const THREE_CHANNEL = "renderre-3d";

/**
 * Emite el estado del editor por BroadcastChannel para que la vista 3D abierta en
 * otra pestaña (/view3d) se mantenga sincronizada en vivo. Una sola vía: editor → visor.
 */
export default function ThreeTabSync() {
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(THREE_CHANNEL);
    let t: ReturnType<typeof setTimeout> | null = null;
    const post = () => {
      try {
        const s = useEditor.getState();
        ch.postMessage({ type: "state", name: s.projectName, data: s.exportData() });
      } catch {
        /* estado no serializable: ignorar este tick */
      }
    };
    const schedule = () => {
      if (t) clearTimeout(t);
      t = setTimeout(post, 250);
    };
    const unsub = useEditor.subscribe(schedule);
    // Cuando una pestaña-visor saluda, le mandamos el estado actual enseguida.
    ch.onmessage = (e) => {
      if (e.data?.type === "hello") post();
    };
    return () => {
      if (t) clearTimeout(t);
      unsub();
      ch.close();
    };
  }, []);
  return null;
}
