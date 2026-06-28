"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor } from "@/lib/store";
import { buildScene } from "@/lib/ai-build";
import { localParse, type SceneSpec } from "@/lib/ai-parse";
import { fileToScaledDataUrl } from "@/lib/image-input";
import { SparklesIcon, CameraIcon } from "./icons";

const EXAMPLES = [
  "habitación de 4x3",
  "cocina de 5x3 con bajo mesada de 1.2m, mesada y alacena",
  "placard de 1.8m con 3 puertas",
];

export default function AiPromptBar() {
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; analysis?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) {
      try {
        const url = await fileToScaledDataUrl(file);
        setImages((prev) => [...prev, url].slice(0, 6));
      } catch {
        window.alert("No se pudo leer la imagen.");
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const run = async (raw?: string) => {
    const d = (raw ?? text).trim();
    if ((!d && !images.length) || busy) return;
    setBusy(true);
    setMsg(null);

    let spec: SceneSpec = {};
    let source = "local";
    let imageIgnored = false;
    let analysis: string | undefined;
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: d, images: images.length ? images : undefined }),
      });
      const data = await res.json();
      spec = data.spec ?? {};
      source = data.source ?? "local";
      imageIgnored = !!data.imageIgnored;
      analysis = typeof data.analysis === "string" ? data.analysis : undefined;
    } catch {
      spec = localParse(d);
      source = "local";
    }

    const st = useEditor.getState();
    const built = buildScene(spec, st.wallDefaults);
    if (!built.walls.length && !built.furniture.length && !built.openings.length) {
      setMsg({
        ok: false,
        text: imageIgnored
          ? "Para leer fotos/planos configurá un proveedor de visión con saldo (ej. MiniMax-M3). Por ahora probá con texto."
          : spec.note || "No pude generar nada con esa descripción.",
        analysis,
      });
    } else {
      st.applyBatch(built.walls, built.furniture, built.openings);
      window.dispatchEvent(new CustomEvent("renderre:fit"));
      const parts: string[] = [];
      if (built.walls.length) parts.push(`${built.walls.length} muros`);
      if (built.openings.length) parts.push(`${built.openings.length} aberturas`);
      if (built.furniture.length) parts.push(`${built.furniture.length} muebles`);
      const viaLabel: Record<string, string> = {
        local: "parser local",
        ai: "IA",
        "ai-vision": "IA · visión (2 pasadas)",
        deepseek: "IA (DeepSeek)",
      };
      const via = viaLabel[source] ?? `IA (${source})`;
      setMsg({ ok: true, text: `✓ Generado: ${parts.join(" + ")} · ${via}`, analysis });
      setText("");
      setImages([]);
    }
    setBusy(false);
  };

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __buildScene: typeof buildScene }).__buildScene = buildScene;
    }
  });

  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-20 w-[min(660px,92%)] -translate-x-1/2">
      {msg && (
        <div
          className={[
            "mb-2 rounded-lg px-3 py-1.5 text-xs shadow-lg",
            msg.ok
              ? "border border-emerald-800/60 bg-emerald-950/70 text-emerald-200"
              : "border border-amber-800/60 bg-amber-950/70 text-amber-200",
          ].join(" ")}
        >
          <div>{msg.text}</div>
          {msg.analysis && (
            <details className="mt-1">
              <summary className="cursor-pointer select-none text-[11px] text-neutral-400 hover:text-neutral-200">
                Ver qué entendió la IA de la imagen
              </summary>
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-black/40 p-2 text-[11px] leading-snug text-neutral-300">
                {msg.analysis}
              </pre>
            </details>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900/95 px-3 py-2 shadow-2xl backdrop-blur">
        <SparklesIcon className="shrink-0 text-sky-400" />
        {images.map((src, i) => (
          <span key={i} className="relative shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="ref" className="h-8 w-8 rounded object-cover ring-1 ring-neutral-600" />
            <button
              type="button"
              onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
              className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-neutral-700 text-[10px] text-neutral-100 hover:bg-neutral-600"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") run();
          }}
          placeholder='Describí, o subí un plano/foto (PNG) e indicá la medida total'
          className="min-w-0 flex-1 bg-transparent text-sm text-neutral-100 outline-none placeholder:text-neutral-500"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          title="Subir plano o foto (PNG)"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
        >
          <CameraIcon width={18} height={18} />
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFile} className="hidden" />
        <button
          type="button"
          onClick={() => run()}
          disabled={busy}
          className="shrink-0 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {busy ? "Generando…" : "Generar"}
        </button>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => run(ex)}
            disabled={busy}
            className="rounded-full border border-neutral-800 bg-neutral-900/80 px-2.5 py-1 text-[11px] text-neutral-400 hover:border-neutral-600 hover:text-neutral-200 disabled:opacity-50"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
