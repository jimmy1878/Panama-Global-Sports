// Prueba las reglas que debe cumplir una crónica antes de guardarse.
// Son la garantía de privacidad: el prompt lo pide, esto lo comprueba.
// Uso: npm run test:rules
import { checkChronicle, countWords, MAX_WORDS, MIN_WORDS } from "../src/features/chronicles/rules.ts";

let failures = 0;
let passed = 0;
const ok = (name) => { passed++; console.log("  ✓ " + name); };
const bad = (name, detail) => { failures++; console.log("  ✗ " + name + (detail ? " → " + detail : "")); };
const check = (cond, name, detail) => (cond ? ok(name) : bad(name, detail));

/** Texto de relleno con el número de palabras pedido, para aislar cada regla. */
const filler = (words) => Array.from({ length: words }, () => "jugaron").join(" ");

const NAMES = ["Carlos M.", "Nicolás V.", "Diego Q."];
const codes = (text, names = NAMES) => checkChronicle(text, names).map((i) => i.code);

console.log("Conteo de palabras:");
check(countWords("  una   dos\ntres  ") === 3, "ignora espacios y saltos de línea");
check(codes(filler(MIN_WORDS)).length === 0, `${MIN_WORDS} palabras: válida`);
check(codes(filler(MAX_WORDS)).length === 0, `${MAX_WORDS} palabras: válida`);
check(codes(filler(MIN_WORDS - 1)).includes("word_count"), "una palabra menos: rechazada");
check(codes(filler(MAX_WORDS + 1)).includes("word_count"), "una palabra más: rechazada");

console.log("Apellidos:");
const body = (text) => `${text} ${filler(MIN_WORDS - countWords(text))}`;
check(codes(body("Carlos M. abrió el marcador.")).length === 0, "nombre + inicial: válido");
check(codes(body("Carlos Méndez abrió el marcador.")).includes("surname"), "apellido completo: rechazado");
check(codes(body("Carlos marcó y luego celebró.")).length === 0, "verbo después del nombre: válido");
check(codes(body("El gol fue de Carlos. Después vino otro.")).length === 0, "nombre al final de frase: válido");
check(codes(body("Nicolás V. y Diego Q. respondieron pronto.")).length === 0, "varios jugadores: válido");
check(
  codes(body("Nicolás Vega respondió pronto."), NAMES).includes("surname"),
  "apellido con acento en el nombre: rechazado",
);

console.log("Jugadores inventados:");
check(codes(body("Pedro G. marcó el primero.")).includes("unknown_player"), "jugador que no jugó: rechazado");
check(
  codes(body("Jugaron en Cancha Norte. Jaguares FC y Pumas FC se repartieron el campo.")).length === 0,
  "equipos y canchas no se confunden con jugadores",
);

console.log("Mismo nombre, dos niños:");
const twins = ["Carlos M.", "Carlos R."];
check(codes(body("Carlos M. asistió a Carlos R. en el segundo."), twins).length === 0,
  "dos Carlos con iniciales distintas: válido");
check(codes(body("Carlos Pérez asistió en el segundo."), twins).includes("surname"),
  "apellido con dos homónimos: rechazado");

console.log("Categorías sin nombres individuales:");
check(codes(body("Los dos equipos jugaron con enorme entrega esta tarde."), []).length === 0,
  "sin jugadores permitidos, un texto de equipo pasa");
check(codes(body("Carlos M. abrió el marcador."), []).includes("unknown_player"),
  "sin jugadores permitidos, nombrar a uno se rechaza");

console.log(failures ? `\n${failures} PRUEBA(S) FALLARON, ${passed} pasaron` : `\nTODAS LAS PRUEBAS PASARON (${passed})`);
process.exit(failures ? 1 : 0);
