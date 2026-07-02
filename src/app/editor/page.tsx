"use client";

import dynamic from "next/dynamic";

const EditorShell = dynamic(
  () => import("@/components/editor/EditorShell"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-dvh w-full items-center justify-center bg-neutral-950 text-neutral-400">
        Cargando editor…
      </div>
    ),
  },
);

export default function EditorPage() {
  return <EditorShell />;
}
