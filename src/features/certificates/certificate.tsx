/**
 * Plantilla del certificado que la familia descarga al terminar un torneo.
 *
 * La dibuja Satori (`next/og`), que NO es un navegador: solo flexbox y un
 * subconjunto de CSS, sin grid, sin clases de Tailwind y sin variables CSS.
 * Por eso los colores de marca se repiten aquí como constantes (los mismos
 * valores que en globals.css).
 *
 * Se diseña para IMPRIMIRSE: tamaño carta horizontal a 200 ppp. El navy va solo
 * en las bandas de arriba y abajo —un fondo navy completo se come el tóner de
 * una impresora de casa— y el cuerpo queda claro. De paso resuelve que el
 * logotipo trae su propio fondo navy difuminado y solo se ve bien sobre navy.
 *
 * Privacidad: `name` llega de `public_players` (nombre + inicial) y las
 * estadísticas de `my_family_tournament_certificates`, que devuelve `null` en
 * las categorías en modo `team_stars`. Esta plantilla nunca debe recibir ni
 * mostrar otro dato de un menor.
 */

// Muestreados del logotipo.
const NAVY = "#010F2A";
const NAVY_SOFT = "#001743";
const GOLD = "#DFAF42";
const GOLD_BRIGHT = "#FFF08B";
const PAPER = "#FBF9F4";
const INK = "#0A2250";
const INK_SOFT = "#4A5873";

/** Carta horizontal a 200 ppp: 11 × 8,5 pulgadas. */
export const CERTIFICATE_SIZE = { width: 2200, height: 1700 } as const;

/** Puntos PostScript de una carta horizontal, para la página del PDF. */
export const CERTIFICATE_PAGE_PT = { width: 792, height: 612 } as const;

export type CertificateStat = { label: string; value: number };

export type CertificateData = {
  /** "Carlos M." — nombre + inicial, nunca el apellido completo. */
  name: string;
  teamName: string;
  teamColor: string;
  /** Escudo ya convertido a PNG en data URI (Satori no lee WebP). */
  teamLogo: string | null;
  /** "Boys Champions League · U10" */
  heading: string;
  /** "Academias · Copa de Navidad" */
  tournamentName: string;
  year: number;
  /**
   * Las cifras del torneo. Vacío en las categorías en modo `team_stars`: ahí el
   * certificado habla de participación y de valores, sin números individuales.
   */
  stats: CertificateStat[];
  /** Logo del patrocinador del espacio `certificado`, si hay alguno hoy. */
  sponsor: { name: string; text: string | null; logo: string | null } | null;
};

export function Certificate(data: CertificateData) {
  const { width, height } = CERTIFICATE_SIZE;
  const individual = data.stats.length > 0;

  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        flexDirection: "column",
        backgroundColor: PAPER,
        fontFamily: "Geist",
      }}
    >
      {/* Marco dorado: el borde del diploma */}
      <div
        style={{
          position: "absolute",
          top: 34,
          left: 34,
          right: 34,
          bottom: 34,
          border: `8px solid ${GOLD}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 52,
          left: 52,
          right: 52,
          bottom: 52,
          border: `2px solid ${GOLD}`,
        }}
      />

      {/* Banda de marca. El logotipo trae fondo navy: aquí encaja. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 300,
          margin: "56px 56px 0 56px",
          backgroundColor: NAVY,
          backgroundImage: `linear-gradient(120deg, ${NAVY} 0%, ${NAVY_SOFT} 55%, ${NAVY} 100%)`,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            color: GOLD_BRIGHT,
            fontSize: 40,
            fontWeight: 900,
            letterSpacing: 14,
          }}
        >
          PANAMA GLOBAL SPORTS
          <div style={{ display: "flex", marginTop: 14, color: "#FFFFFF", fontSize: 30, fontWeight: 700, letterSpacing: 6 }}>
            {data.heading.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Cuerpo */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flex: 1,
          padding: "40px 120px",
        }}
      >
        <div style={{ display: "flex", color: INK_SOFT, fontSize: 46, fontWeight: 900, letterSpacing: 16 }}>
          CERTIFICADO DE PARTICIPACIÓN
        </div>
        <div style={{ display: "flex", width: 420, height: 5, marginTop: 24, backgroundColor: GOLD }} />

        {/* El nombre, que es lo que se busca al mirar un diploma */}
        <div
          style={{
            display: "flex",
            marginTop: 44,
            color: INK,
            fontSize: data.name.length > 20 ? 118 : 148,
            fontWeight: 900,
            textAlign: "center",
          }}
        >
          {data.name}
        </div>

        {/* Equipo */}
        <div style={{ display: "flex", alignItems: "center", marginTop: 28 }}>
          {data.teamLogo ? (
            // eslint-disable-next-line @next/next/no-img-element -- lo dibuja Satori, no el navegador: next/image no existe aquí
            <img src={data.teamLogo} width={96} height={96} style={{ marginRight: 24 }} alt="" />
          ) : (
            <div
              style={{
                display: "flex",
                width: 24,
                height: 72,
                marginRight: 24,
                backgroundColor: data.teamColor,
              }}
            />
          )}
          <div style={{ display: "flex", color: INK, fontSize: 56, fontWeight: 700 }}>{data.teamName}</div>
        </div>

        <div style={{ display: "flex", marginTop: 18, color: INK_SOFT, fontSize: 40, fontWeight: 500 }}>
          {/* El nombre del torneo suele traer el año; no se repite si ya está. */}
          {data.tournamentName.includes(String(data.year)) ? data.tournamentName : `${data.tournamentName} · ${data.year}`}
        </div>

        {individual ? (
          <div style={{ display: "flex", marginTop: 52 }}>
            {data.stats.map((stat) => (
              <div
                key={stat.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  width: 300,
                  paddingTop: 20,
                  paddingBottom: 20,
                  marginLeft: 12,
                  marginRight: 12,
                  border: `3px solid ${GOLD}`,
                }}
              >
                <div style={{ display: "flex", color: INK, fontSize: 86, fontWeight: 900 }}>{stat.value}</div>
                <div style={{ display: "flex", color: INK_SOFT, fontSize: 28, fontWeight: 700, letterSpacing: 4 }}>
                  {stat.label.toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              marginTop: 56,
              maxWidth: 1500,
              color: INK,
              fontSize: 44,
              fontWeight: 500,
              textAlign: "center",
            }}
          >
            Por jugar cada partido con ganas, cuidar a sus compañeros y respetar a sus rivales.
          </div>
        )}
      </div>

      {/* Pie: la marca y, si alguien lo compró, el espacio `certificado` */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 190,
          margin: "0 56px 56px 56px",
          padding: "0 56px",
          backgroundColor: NAVY,
          backgroundImage: `linear-gradient(120deg, ${NAVY} 0%, ${NAVY_SOFT} 60%, ${NAVY} 100%)`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", color: "#FFFFFF" }}>
          <div style={{ display: "flex", color: GOLD, fontSize: 32, fontWeight: 900, letterSpacing: 6 }}>
            PANAMA GLOBAL SPORTS
          </div>
          <div style={{ display: "flex", marginTop: 8, color: "#C7D2E8", fontSize: 26, fontWeight: 500 }}>
            Temporada {data.year} · Torneo finalizado
          </div>
        </div>

        {data.sponsor ? (
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                marginRight: 24,
                color: "#C7D2E8",
                fontSize: 24,
                fontWeight: 500,
                letterSpacing: 2,
              }}
            >
              {data.sponsor.text ?? "Presentado por"}
            </div>
            {data.sponsor.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- lo dibuja Satori, no el navegador
              <img src={data.sponsor.logo} height={96} style={{ maxWidth: 420 }} alt="" />
            ) : (
              <div style={{ display: "flex", color: "#FFFFFF", fontSize: 40, fontWeight: 900 }}>{data.sponsor.name}</div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
