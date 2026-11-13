import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Panama Global Sports",
    short_name: "PGS",
    description: "Ligas deportivas infantiles en Panamá: calendario, resultados en vivo, equipos y estadísticas.",
    lang: "es-PA",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f7f9",
    theme_color: "#005293",
    categories: ["sports", "kids"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Calendario", url: "/calendario", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Equipos", url: "/equipos", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Estadísticas", url: "/estadisticas", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
