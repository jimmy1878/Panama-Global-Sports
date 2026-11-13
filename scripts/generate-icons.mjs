// Genera los iconos PNG de la PWA en public/icons y src/app (icon.png, apple-icon.png).
// Uso: node scripts/generate-icons.mjs   (volver a ejecutar si cambia el diseño)
import { ImageResponse } from "next/og.js";
import { writeFile } from "node:fs/promises";
import { createElement as h } from "react";

const BLUE = "#005293";
const RED = "#d21034";

/** safe = fracción del lienzo que ocupa el contenido (los iconos "maskable" necesitan margen). */
function logo(size, { safe = 1, rounded = true } = {}) {
  const inner = Math.round(size * safe);
  return h(
    "div",
    {
      style: {
        width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center",
        background: BLUE, borderRadius: rounded ? size * 0.22 : 0,
      },
    },
    h(
      "div",
      { style: { width: inner, height: inner, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" } },
      h("div", { style: { color: "white", fontSize: inner * 0.36, fontWeight: 800, letterSpacing: -inner * 0.01, lineHeight: 1 } }, "PGS"),
      h("div", { style: { marginTop: inner * 0.06, width: inner * 0.42, height: Math.max(2, inner * 0.06), background: RED, borderRadius: inner } }),
    ),
  );
}

const targets = [
  ["public/icons/icon-192.png", 192, {}],
  ["public/icons/icon-512.png", 512, {}],
  ["public/icons/icon-maskable-512.png", 512, { safe: 0.7, rounded: false }],
  ["public/icons/badge-96.png", 96, {}],
  ["src/app/icon.png", 64, {}],
  ["src/app/apple-icon.png", 180, { safe: 0.85, rounded: false }],
];

for (const [path, size, opts] of targets) {
  const res = new ImageResponse(logo(size, opts), { width: size, height: size });
  await writeFile(path, Buffer.from(await res.arrayBuffer()));
  console.log("✓", path);
}
