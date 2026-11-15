// Prueba que el procesado de la galería borra los metadatos de las fotos.
//
// Es la garantía de privacidad más importante de la fase 9: una foto de celular
// lleva en el EXIF la ubicación GPS exacta donde se tomó. Si eso sobrevive, se
// publica dónde juega un niño. Esta prueba usa el MISMO pipeline de sharp que
// src/features/gallery/process.ts.
//
// Uso: npm run test:media
import sharp from "sharp";

let failures = 0;
let passed = 0;
const check = (cond, name, detail) => {
  if (cond) { passed++; console.log("  ✓ " + name); }
  else { failures++; console.log("  ✗ " + name + (detail ? " → " + detail : "")); }
};

/** Igual que process.ts: rotate() aplica la orientación y sharp descarta el resto. */
const procesar = (input, size, quality) =>
  sharp(input, { failOn: "error" })
    .rotate()
    .resize(size, size, { fit: "inside", withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();

// Una foto como la que sale de un celular: marca, modelo y coordenadas
const conGps = await sharp({ create: { width: 1200, height: 900, channels: 3, background: { r: 30, g: 90, b: 150 } } })
  .withExif({
    IFD0: { Make: "Apple", Model: "iPhone 15", Orientation: "6" },
    GPS: {
      GPSLatitudeRef: "N", GPSLatitude: "8/1 58/1 0/1",
      GPSLongitudeRef: "W", GPSLongitude: "79/1 31/1 0/1",
    },
  })
  .jpeg()
  .toBuffer();

console.log("Metadatos:");
const antes = await sharp(conGps).metadata();
check(antes.exif != null && antes.exif.length > 0, `la foto de prueba sí trae EXIF (${antes.exif?.length} bytes)`);

const full = await procesar(conGps, 1600, 82);
const despues = await sharp(full).metadata();
check(despues.exif == null, "la foto procesada no tiene EXIF", despues.exif ? `${despues.exif.length} bytes` : "");

const crudo = full.toString("latin1");
const rastros = ["GPS", "Apple", "iPhone"].filter((t) => crudo.includes(t));
check(rastros.length === 0, "no quedan rastros de GPS ni del modelo en los bytes", rastros.join(", "));

console.log("Formato y tamaño:");
check(despues.format === "webp", "se guarda en WebP", despues.format);
const grande = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: { r: 10, g: 10, b: 10 } } }).jpeg().toBuffer();
const reducida = await sharp(await procesar(grande, 1600, 82)).metadata();
check(reducida.width === 1600 && reducida.height === 1200, `una foto de 4000px se reduce a 1600 (${reducida.width}x${reducida.height})`);
const thumb = await sharp(await procesar(grande, 480, 70)).metadata();
check(thumb.width === 480, `la miniatura queda en 480 (${thumb.width})`);
const pequena = await sharp(await procesar(await sharp({ create: { width: 300, height: 200, channels: 3, background: { r: 1, g: 2, b: 3 } } }).jpeg().toBuffer(), 1600, 82)).metadata();
check(pequena.width === 300, "una foto pequeña no se agranda");

console.log("Archivos rotos:");
let rechazado = false;
try { await procesar(Buffer.from("esto no es una imagen"), 1600, 82); } catch { rechazado = true; }
check(rechazado, "un archivo que no es imagen se rechaza");

console.log(failures ? `\n${failures} PRUEBA(S) FALLARON, ${passed} pasaron` : `\nTODAS LAS PRUEBAS PASARON (${passed})`);
process.exit(failures ? 1 : 0);
