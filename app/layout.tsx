import type { Metadata } from "next";
import "./globals.css";

// Leaflet CSS (OK en Server Components)
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";

import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "MAP-IA",
  description: "Asistente geoespacial con IA (OSM + IDEE)",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        {children}
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
