import "server-only";
import sharp from "sharp";

const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Procesa una imagen subida: aplica la orientación, redimensiona y la guarda
 * como WebP. sharp NO copia metadatos por defecto → se eliminan EXIF y GPS.
 */
export async function processImage(file: File, opts: { size: number; fit: "cover" | "inside" }): Promise<Buffer> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    throw Object.assign(new Error("El archivo debe ser una foto (JPG, PNG, WebP o HEIC)."), { code: "P0001" });
  }
  if (file.size > MAX_BYTES) {
    throw Object.assign(new Error("La imagen es demasiado grande (máximo 4 MB)."), { code: "P0001" });
  }
  const input = Buffer.from(await file.arrayBuffer());
  return sharp(input, { failOn: "error" })
    .rotate()
    .resize(opts.size, opts.size, { fit: opts.fit, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
}

/** Devuelve el File si el campo trae un archivo real (no vacío). */
export function fileFrom(formData: FormData, name: string): File | null {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}
