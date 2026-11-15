// Aplica las migraciones pendientes al proyecto de Supabase.
// - El id del proyecto se toma de NEXT_PUBLIC_SUPABASE_URL (.env.local).
// - Credencial: la sesión de `npx supabase login`. A propósito NO se usa el
//   SUPABASE_ACCESS_TOKEN de .env.local: ese es de solo lectura (sirve para
//   `npm run db:types`) y aplicar migraciones necesita permiso database_write.
// - La contraseña de la base la escribes tú cuando la CLI la pida.
// Uso: npm run db:push
//      npm run db:push -- --dry-run    ver qué haría, sin aplicar nada
//      npm run db:push -- --token      forzar el token de .env.local
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8");
const read = (name) => env.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim() || undefined;

const ref = read("NEXT_PUBLIC_SUPABASE_URL")?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
if (!ref) {
  console.error("No encontré NEXT_PUBLIC_SUPABASE_URL (https://<id>.supabase.co) en .env.local");
  process.exit(1);
}

// Por defecto se usa la sesión de `supabase login`, que sí puede escribir.
// Con --token se fuerza el de .env.local (solo si algún día tiene permiso).
const token = process.argv.includes("--token") ? read("SUPABASE_ACCESS_TOKEN") : undefined;

// Los argumentos extra (p. ej. --dry-run) se pasan tal cual a la CLI.
// --token es nuestro, no de la CLI: no se reenvía.
const extra = process.argv.slice(2).filter((a) => a !== "--token");

console.log(`Proyecto: ${ref}`);
console.log(token ? "Credencial: SUPABASE_ACCESS_TOKEN de .env.local" : "Credencial: sesión de `supabase login`");
console.log("Revisa la lista de migraciones antes de confirmar.\n");

// Se ejecuta a través del shell: en Windows, desde Node 20, no se puede lanzar
// un .cmd (npx.cmd) directamente — falla con EINVAL y sin imprimir nada.
// El id del proyecto ya está validado por la expresión regular (solo [a-z0-9]).
const command = ["npx", "--yes", "supabase@3.1.0", "db", "push", `--remote=${ref}`, ...extra].join(" ");

const { status, error } = spawnSync(command, {
  stdio: "inherit",
  shell: true,
  env: token ? { ...process.env, SUPABASE_ACCESS_TOKEN: token } : process.env,
});

if (error) {
  console.error("\nNo se pudo ejecutar la CLI de Supabase:", error.message);
  process.exit(1);
}
if (status !== 0) {
  console.error(`\nLa CLI terminó con código ${status}. Nada se aplicó.`);
  console.error(
    "Si dice 'Missing required permission(s): database_write', la cuenta no tiene\n" +
      "permiso de escritura en la API de Supabase. Ese permiso SOLO hace falta cuando\n" +
      "no se pasa la contraseña, así que hay dos salidas:\n" +
      "  · npm run db:push -- --password TU_CONTRASEÑA   (queda en el historial del shell)\n" +
      "  · pegar la migración en el SQL Editor del panel de Supabase\n" +
      "Si dice que no hay sesión, entra antes con `npx supabase@3.1.0 login`.",
  );
}
process.exit(status ?? 1);
