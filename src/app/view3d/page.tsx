"use client";

import dynamic from "next/dynamic";

const ThreeViewer = dynamic(() => import("@/components/editor/ThreeViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-neutral-950 text-neutral-400">
      Cargando vista 3D…
    </div>
  ),
});

export default function View3DPage() {
  return <ThreeViewer />;
}
