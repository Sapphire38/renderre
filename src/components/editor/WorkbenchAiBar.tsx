"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor } from "@/lib/store";
import { layoutFurnitureSpec, localParseFurniture, type FurnitureSpec } from "@/lib/ai-furniture";
import { fileToScaledDataUrl } from "@/lib/image-input";
import { SparklesIcon, CameraIcon } from "./icons";

const EXAMPLES = [
  "placard 1.8x2.4 con 3 puertas corredizas",
  "cómoda 0.8x1 con 4 cajones",
  "4 cajones a la izquierda y 2 puertas a la derecha",
];

export default function WorkbenchAiBar() {
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const loadDraft = useEditor((s) => s.loadDraft);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) {
      try {
        const url = await fileToScaledDataUrl(file);
        setImages((prev) => [...prev, url].slice(0, 4));
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

    let spec: FurnitureSpec = {};
    let source = "local";
    let imageIgnored = false;
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: d, mode: "furniture", images: images.length ? images : undefined }),
      });
      const data = await res.json();
      spec = data.spec ?? {};
      source = data.source ?? "local";
      imageIgnored = !!data.imageIgnored;
    } catch {
      spec = localParseFurniture(d);
      source = "local";
    }

    const hasContent = (spec.components?.length ?? 0) > 0 || spec.width != null || spec.height != null;
    if (!hasContent) {
      setMsg({
        ok: false,
        text: imageIgnored
          ? "Para leer fotos configurá un proveedor de visión (MiniMax-M3). Probá describiéndolo con texto."
          : spec.note || "No pude generar el mueble con esa descripción.",
      });
    } else {
      const furn = layoutFurnitureSpec(spec);
      loadDraft(furn);
      const via = source === "local" ? "parser local" : `IA (${source})`;
      setMsg({ ok: true, text: `✓ ${furn.components?.length ?? 0} componentes · ${via}` });
      setText("");
      setImages([]);
    }
    setBusy(false);
  };

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __wbRun: (s: string) => void }).__wbRun = run;
    }
  });

  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-20 w-[min(640px,92%)] -translate-x-1/2">
      {msg && (
        <div
          className={[
            "mb-2 rounded-lg px-3 py-1.5 text-xs shadow-lg",
            msg.ok
              ? "border border-emerald-800/60 bg-emerald-950/70 text-emerald-200"
              : "border border-amber-800/60 bg-amber-950/70 text-amber-200",
          ].join(" ")}
        >
          {msg.text}
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
          placeholder='Describí o subí una foto del mueble'
          className="min-w-0 flex-1 bg-transparent text-sm text-neutral-100 outline-none placeholder:text-neutral-500"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          title="Subir foto del mueble"
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
