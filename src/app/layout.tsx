import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Renderre — Diseño de espacios",
  description:
    "Diseñá casas y muebles de MDF: trazá muros sobre una cuadrícula y visualizalos en 3D.",
};

// App de lienzo: se adapta al ancho real del dispositivo y respeta los bordes
// seguros (notch) en móviles. El zoom del navegador se limita porque el plano
// y la vista 3D tienen su propio zoom (rueda / pellizco).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
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
