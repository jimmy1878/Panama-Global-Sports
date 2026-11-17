/**
 * Comprueba que el DNS del dominio esté como tiene que estar.
 *
 * Dos cosas viven en el mismo dominio y es fácil romper una arreglando la otra:
 * la web (Vercel) y el correo de ingreso (Resend). Este script las mira juntas,
 * para que nadie borre un registro "de paso, para limpiar" y se entere una semana
 * después porque un papá no puede entrar.
 *
 *   npm run check:dns
 *
 * Pregunta directo a un resolutor público (Cloudflare, DNS sobre HTTPS), no a la
 * caché de Windows: lo que importa es lo que ve el resto del mundo.
 */

const DOMINIO = "panamaglobalsports.com";

/** Lo que Vercel pide para este proyecto. Sale de Settings → Domains → View DNS configuration. */
const VERCEL_A = "216.198.79.1";
const VERCEL_CNAME = "f29411d9a408ca07.vercel-dns-017.com";

/** IP de la página de parqueo de GoDaddy: si aparece, el cambio no se hizo o volvió solo. */
const PARQUEO = /^(15\.197\.|3\.33\.)/;

const comprobaciones = [
  {
    titulo: "Web · raíz apunta a Vercel",
    nombre: DOMINIO,
    tipo: "A",
    revisar: (v) =>
      v.includes(VERCEL_A)
        ? { ok: true, nota: VERCEL_A }
        : v.some((x) => PARQUEO.test(x))
          ? { ok: false, nota: `sigue en el parqueo de GoDaddy (${v.join(", ")})` }
          : { ok: false, nota: `esperaba ${VERCEL_A}, encontré ${v.join(", ") || "nada"}` },
  },
  {
    titulo: "Web · www apunta a Vercel",
    nombre: `www.${DOMINIO}`,
    tipo: "CNAME",
    revisar: (v) =>
      v.some((x) => x.replace(/\.$/, "") === VERCEL_CNAME)
        ? { ok: true, nota: VERCEL_CNAME }
        : { ok: false, nota: `esperaba ${VERCEL_CNAME}, encontré ${v.join(", ") || "nada"}` },
  },
  {
    titulo: "Correo · firma DKIM",
    nombre: `resend._domainkey.${DOMINIO}`,
    tipo: "TXT",
    revisar: (v) =>
      v.some((x) => x.includes("p="))
        ? { ok: true, nota: "clave presente" }
        : { ok: false, nota: "FALTA — sin esto el correo de ingreso cae en spam o no sale" },
  },
  {
    titulo: "Correo · ruta de envío (send)",
    nombre: `send.${DOMINIO}`,
    tipo: "CNAME",
    revisar: (v) =>
      v.some((x) => x.includes("rmta.net"))
        ? { ok: true, nota: v[0].replace(/\.$/, "") }
        : { ok: false, nota: "FALTA — lo creó Resend, no se borra" },
  },
  {
    titulo: "Correo · ruta de envío (rsend)",
    nombre: `rsend.${DOMINIO}`,
    tipo: "CNAME",
    revisar: (v) =>
      v.some((x) => x.includes("rmta.net"))
        ? { ok: true, nota: v[0].replace(/\.$/, "") }
        : { ok: false, nota: "FALTA — lo creó Resend, no se borra" },
  },
  {
    titulo: "Correo · SPF",
    nombre: `send.${DOMINIO}`,
    tipo: "TXT",
    revisar: (v) =>
      v.some((x) => x.includes("v=spf1"))
        ? { ok: true, nota: "presente" }
        : { ok: false, nota: "FALTA" },
  },
  {
    titulo: "Correo · DMARC",
    nombre: `_dmarc.${DOMINIO}`,
    tipo: "TXT",
    opcional: true,
    revisar: (v) =>
      v.some((x) => x.includes("v=DMARC1"))
        ? { ok: true, nota: v.find((x) => x.includes("v=DMARC1")).slice(0, 60) }
        : { ok: false, nota: "no hay (no impide enviar)" },
  },
];

/** Consulta por DNS sobre HTTPS; devuelve los valores ya limpios de comillas. */
async function consultar(nombre, tipo) {
  const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(nombre)}&type=${tipo}`, {
    headers: { accept: "application/dns-json" },
  });
  if (!r.ok) throw new Error(`${r.status} al consultar ${nombre}`);
  const { Answer = [] } = await r.json();
  return Answer.map((a) => String(a.data).replace(/^"|"$/g, ""));
}

console.log(`\nDNS de ${DOMINIO}\n`);

let fallos = 0;
for (const c of comprobaciones) {
  let resultado;
  try {
    resultado = c.revisar(await consultar(c.nombre, c.tipo));
  } catch (e) {
    resultado = { ok: false, nota: `no pude consultar: ${e.message}` };
  }
  const marca = resultado.ok ? "OK  " : c.opcional ? "--  " : "MAL ";
  console.log(` ${marca} ${c.titulo.padEnd(34)} ${resultado.nota}`);
  if (!resultado.ok && !c.opcional) fallos++;
}

console.log(
  fallos === 0
    ? "\nTodo en orden: la web apunta a Vercel y el correo sigue entero.\n"
    : `\n${fallos} ${fallos === 1 ? "cosa" : "cosas"} por arreglar. Los cambios de DNS tardan hasta una hora en verse.\n`,
);

process.exit(fallos === 0 ? 0 : 1);
