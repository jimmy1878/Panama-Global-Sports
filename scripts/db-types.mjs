// Genera src/types/database.ts desde el proyecto de Supabase.
// - El id del proyecto se toma de NEXT_PUBLIC_SUPABASE_URL (.env.local).
// - Credencial: SUPABASE_ACCESS_TOKEN en .env.local (token personal, nunca se sube a git)
//   o, si no está, el login guardado con `npx supabase login` en tu propia terminal.
// Uso: npm run db:types
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8");
const read = (name) => env.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim() || undefined;

const ref = read("NEXT_PUBLIC_SUPABASE_URL")?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
if (!ref) {
  console.error("No encontré NEXT_PUBLIC_SUPABASE_URL (https://<id>.supabase.co) en .env.local");
  process.exit(1);
}
const token = read("SUPABASE_ACCESS_TOKEN");

let out;
try {
  // El id ya está validado (solo [a-z0-9]); comando fijo, sin datos del usuario.
  out = execSync(
    `npx --yes supabase@3.1.0 gen types --lang typescript --remote=${ref} --schema public`,
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: token ? { ...process.env, SUPABASE_ACCESS_TOKEN: token } : process.env,
    },
  );
} catch (error) {
  out = String(error.stdout ?? "") + String(error.stderr ?? error.message);
}

// La CLI v3 informa los errores como JSON en la salida estándar.
if (!out.includes("export type Database")) {
  console.error(
    /AccessToken|access token|Unauthorized|401/i.test(out)
      ? "Falta la credencial de Supabase. Opciones:\n" +
          "  A) Crea un token en https://supabase.com/dashboard/account/tokens y ponlo en .env.local como SUPABASE_ACCESS_TOKEN=...\n" +
          "  B) Ejecuta `npm run db:types` en tu propia terminal después de `npx supabase login`."
      : out,
  );
  process.exit(1);
}

const header = "// Generado con `npm run db:types`. No editar a mano.\n\n";
const extras = '\nexport type AppRole = Database["public"]["Enums"]["app_role"];\n';
writeFileSync("src/types/database.ts", header + out.slice(out.indexOf("export type")) + extras);
console.log("✓ src/types/database.ts actualizado");
