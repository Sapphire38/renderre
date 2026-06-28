import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Renderre — Diseño de espacios",
  description:
    "Diseñá casas y muebles de MDF: trazá muros sobre una cuadrícula y visualizalos en 3D.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
