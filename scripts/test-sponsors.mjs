// Prueba la regla que decide qué patrocinador va en cada espacio.
// Es dinero: si falla, se le cobra a una marca un espacio que no salió.
// Uso: npm run test:sponsors
import { pickSponsor } from "../src/features/sponsors/pick.ts";

let failures = 0;
let passed = 0;
const ok = (name) => { passed++; console.log("  ✓ " + name); };
const bad = (name, detail) => { failures++; console.log("  ✗ " + name + (detail ? " → " + detail : "")); };
const check = (cond, name, detail) => (cond ? ok(name) : bad(name, detail));

/** Una asignación mínima; lo que no se nombra no influye en la regla. */
const place = (sponsorName, scope, scopeId, extra = {}) => ({
  id: `${sponsorName}-${scope}-${scopeId}`,
  slotCode: "liga_header",
  scope,
  scopeId,
  priority: 0,
  rotationWeight: 1,
  text: null,
  linkUrl: null,
  imageUrl: null,
  logoDarkUrl: null,
  sponsorName,
  ...extra,
});

const CONTEXT = {
  categoria: "cat-u10",
  torneo: "tor-navidad",
  circuito: "cir-academias",
  liga: "liga-boys",
  organizacion: "org-pgs",
};

console.log("Ámbito más específico:");
const todos = [
  place("Organización", "organizacion", "org-pgs"),
  place("Liga", "liga", "liga-boys"),
  place("Circuito", "circuito", "cir-academias"),
  place("Torneo", "torneo", "tor-navidad"),
  place("Categoría", "categoria", "cat-u10"),
];
check(pickSponsor(todos, "liga_header", CONTEXT)?.sponsorName === "Categoría",
  "con todos los niveles ocupados gana la categoría");
check(pickSponsor(todos.slice(0, 4), "liga_header", CONTEXT)?.sponsorName === "Torneo",
  "sin categoría gana el torneo");
check(pickSponsor(todos.slice(0, 3), "liga_header", CONTEXT)?.sponsorName === "Circuito",
  "sin torneo gana el circuito");
check(pickSponsor(todos.slice(0, 2), "liga_header", CONTEXT)?.sponsorName === "Liga",
  "sin circuito gana la liga");
check(pickSponsor(todos.slice(0, 1), "liga_header", CONTEXT)?.sponsorName === "Organización",
  "solo queda la organización");

console.log("Lo que no aplica:");
check(pickSponsor([], "liga_header", CONTEXT) === null, "sin asignaciones no se pinta nada");
check(pickSponsor(todos, "partido_pagina", CONTEXT) === null, "otro espacio no hereda el logo");
check(pickSponsor([place("Otra liga", "liga", "liga-girls")], "liga_header", CONTEXT) === null,
  "la liga de al lado no cuenta");
check(pickSponsor(todos, "liga_header", { liga: "liga-boys" })?.sponsorName === "Liga",
  "una página que solo conoce su liga usa la de la liga");

console.log("Prioridad y rotación:");
const empate = [
  place("A", "liga", "liga-boys", { rotationWeight: 1 }),
  place("B", "liga", "liga-boys", { rotationWeight: 3 }),
];
check(pickSponsor(empate, "liga_header", CONTEXT, () => 0)?.sponsorName === "A",
  "con el azar al mínimo sale la primera");
check(pickSponsor(empate, "liga_header", CONTEXT, () => 0.99)?.sponsorName === "B",
  "con el azar al máximo sale la segunda");
check(pickSponsor(empate, "liga_header", CONTEXT, () => 0.3)?.sponsorName === "B",
  "el peso 3 se lleva la mayor parte del rango");

const conPrioridad = [
  place("Normal", "liga", "liga-boys", { rotationWeight: 50 }),
  place("Fijada", "liga", "liga-boys", { priority: 10, rotationWeight: 1 }),
];
check(pickSponsor(conPrioridad, "liga_header", CONTEXT, () => 0.99)?.sponsorName === "Fijada",
  "la prioridad manda sobre el peso");

// Con 1 y 3, la segunda debe salir aproximadamente tres de cada cuatro veces
let b = 0;
for (let i = 0; i < 4000; i++) {
  if (pickSponsor(empate, "liga_header", CONTEXT, Math.random)?.sponsorName === "B") b++;
}
const parte = b / 4000;
check(parte > 0.70 && parte < 0.80, `reparto real según el peso (B salió ${(parte * 100).toFixed(1)} % de 4000)`);

console.log(failures ? `\n${failures} PRUEBA(S) FALLARON, ${passed} pasaron` : `\nTODAS LAS PRUEBAS PASARON (${passed})`);
process.exit(failures ? 1 : 0);
