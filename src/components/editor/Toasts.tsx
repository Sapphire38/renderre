"use client";

import { useEffect } from "react";
import { useEditor } from "@/lib/store";
import type { Toast } from "@/lib/store";

function ToastItem({ id, text, kind }: Toast) {
  const removeToast = useEditor((s) => s.removeToast);
  useEffect(() => {
    const t = setTimeout(() => removeToast(id), 2600);
    return () => clearTimeout(t);
  }, [id, removeToast]);
  const color =
    kind === "ok"
      ? "border-emerald-700 bg-emerald-950/85 text-emerald-200"
      : kind === "warn"
        ? "border-amber-700 bg-amber-950/85 text-amber-200"
        : "border-neutral-700 bg-neutral-900/90 text-neutral-200";
  return <div className={`rounded-lg border px-3 py-1.5 text-xs shadow-lg ${color}`}>{text}</div>;
}

export default function Toasts() {
  const toasts = useEditor((s) => s.toasts);
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-1.5">
      {toasts.map((t) => (
        <ToastItem key={t.id} {...t} />
      ))}
    </div>
  );
}
