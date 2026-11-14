/**
 * Plantilla de la tarjeta de resultado que se comparte en redes.
 *
 * La dibuja Satori (`next/og`), que NO es un navegador: solo flexbox y un
 * subconjunto de CSS, sin grid, sin clases de Tailwind y sin variables CSS.
 * Por eso los colores de marca se repiten aquí como constantes (los mismos
 * valores que `--brand-blue` y `--brand-red` en globals.css).
 *
 * Privacidad: los goleadores llegan de `public_match_scorers`, que ya devuelve
 * solo "nombre + inicial" y excluye en SQL las categorías en modo `team_stars`.
 * Esta plantilla nunca debe recibir ni mostrar otro dato de un menor.
 */

const BRAND_BLUE = "#005293";
const BRAND_RED = "#d21034";

export const CARD_FORMATS = {
  // Instagram (feed y stories)
  historia: { width: 1080, height: 1350, maxScorers: 10 },
  // WhatsApp (estado y chats)
  cuadrada: { width: 1080, height: 1080, maxScorers: 6 },
} as const;

export type CardFormat = keyof typeof CARD_FORMATS;

export const isCardFormat = (value: string | null): value is CardFormat => value === "historia" || value === "cuadrada";

export type CardTeam = {
  name: string;
  shortName: string | null;
  primaryColor: string;
  secondaryColor: string;
  /** Logo ya convertido a PNG en data URI (Satori no lee WebP). */
  logo: string | null;
};

export type CardScorer = { name: string; goals: number; minute: number | null };

export type CardData = {
  format: CardFormat;
  home: CardTeam;
  away: CardTeam;
  homeScore: number | null;
  awayScore: number | null;
  status: "scheduled" | "live" | "finished" | "postponed" | "cancelled";
  /** "Boys Champion League · U10" */
  heading: string;
  /** "Sábado, 14 de noviembre" */
  day: string;
  /** "9:00 a. m." */
  time: string;
  venue: string | null;
  homeScorers: CardScorer[];
  awayScorers: CardScorer[];
};

/** Nombres largos no caben: se recortan con puntos suspensivos. */
function clip(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function scorerLine({ name, goals, minute }: CardScorer) {
  const when = minute != null ? ` ${minute}'` : "";
  const times = goals > 1 ? ` ×${goals}` : "";
  return `${clip(name, 18)}${when}${times}`;
}

export function ResultCard(data: CardData) {
  const { width, height, maxScorers } = CARD_FORMATS[data.format];
  const tall = data.format === "historia";
  const hasScore = data.homeScore !== null && data.awayScore !== null;
  const crest = tall ? 210 : 180;
  const scoreSize = tall ? 170 : 150;
  const nameSize = tall ? 40 : 38;
  const scorerSize = tall ? 36 : 33;

  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        flexDirection: "column",
        fontFamily: "Geist",
        fontWeight: 500,
        color: "#ffffff",
        backgroundImage: `linear-gradient(160deg, #002e5c 0%, ${BRAND_BLUE} 58%, #0a6cb8 100%)`,
      }}
    >
      {/* Franja superior con los colores de los dos equipos */}
      <div style={{ display: "flex", height: 14, width: "100%" }}>
        <div style={{ flex: 1, backgroundColor: data.home.primaryColor }} />
        <div style={{ flex: 1, backgroundColor: data.away.primaryColor }} />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: tall ? "56px 64px 48px" : "44px 56px 40px",
        }}
      >
        {/* Liga, categoría y estado */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, letterSpacing: 1, opacity: 0.85 }}>
            {clip(data.heading.toUpperCase(), 34)}
          </div>
          <StatusChip status={data.status} />
        </div>

        {/* Bloque central: marcador y goleadores, centrados en el alto libre */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <TeamSide team={data.home} size={crest} nameSize={nameSize} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, padding: "0 28px" }}>
              {hasScore ? (
                <div style={{ display: "flex", alignItems: "center", fontSize: scoreSize, fontWeight: 900, lineHeight: 1 }}>
                  <span>{data.homeScore}</span>
                  <span style={{ margin: "0 20px", opacity: 0.5 }}>–</span>
                  <span>{data.awayScore}</span>
                </div>
              ) : (
                <div style={{ display: "flex", fontSize: tall ? 84 : 72, fontWeight: 900, lineHeight: 1 }}>{data.time}</div>
              )}
            </div>
            <TeamSide team={data.away} size={crest} nameSize={nameSize} />
          </div>

          {/* Goleadores (vacío en categorías sin ranking individual) */}
          <Scorers home={data.homeScorers} away={data.awayScorers} max={maxScorers} tall={tall} fontSize={scorerSize} />
        </div>

        {/* Fecha, hora y cancha */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            fontSize: 30,
            fontWeight: 500,
            opacity: 0.8,
            paddingTop: 32,
          }}
        >
          {/* Si no hay marcador, la hora ya va en grande en el centro: no se repite */}
          {clip([data.day, hasScore ? data.time : null, data.venue].filter(Boolean).join("  ·  "), 58)}
        </div>

        {/* Marca */}
        <div style={{ display: "flex", alignItems: "center", marginTop: 28 }}>
          <div style={{ display: "flex", width: 22, height: 22, backgroundColor: BRAND_RED, marginRight: 8 }} />
          <div style={{ display: "flex", width: 22, height: 22, backgroundColor: "#ffffff", marginRight: 16 }} />
          <div style={{ display: "flex", fontSize: 32, fontWeight: 900, letterSpacing: 2 }}>PANAMA GLOBAL SPORTS</div>
        </div>
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<CardData["status"], string> = {
  scheduled: "PRÓXIMO",
  live: "EN VIVO",
  finished: "FINAL",
  postponed: "APLAZADO",
  cancelled: "SUSPENDIDO",
};

function StatusChip({ status }: { status: CardData["status"] }) {
  const label = STATUS_LABEL[status];
  return (
    <div
      style={{
        display: "flex",
        fontSize: 28,
        fontWeight: 900,
        letterSpacing: 2,
        padding: "10px 24px",
        borderRadius: 999,
        backgroundColor: status === "live" ? BRAND_RED : "rgba(255,255,255,0.18)",
      }}
    >
      {label}
    </div>
  );
}

/** Los dos lados se reparten el ancho que deja el marcador: nunca lo desbordan. */
function TeamSide({ team, size, nameSize }: { team: CardTeam; size: number; nameSize: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, minWidth: 0 }}>
      {team.logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- lo dibuja Satori, no el navegador: next/image no existe aquí
        <img src={team.logo} width={size} height={size} style={{ objectFit: "contain" }} alt="" />
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: team.primaryColor,
            border: `6px solid ${team.secondaryColor}`,
            color: team.secondaryColor,
            fontSize: size / 3.4,
            fontWeight: 900,
          }}
        >
          {(team.shortName ?? team.name).slice(0, 3).toUpperCase()}
        </div>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          width: "100%",
          marginTop: 24,
          fontSize: nameSize,
          fontWeight: 700,
          textAlign: "center",
          lineHeight: 1.15,
        }}
      >
        {clip(team.name, 20)}
      </div>
    </div>
  );
}

/** Dos columnas de goleadores; si no caben todos, "y N más". */
function Scorers({
  home,
  away,
  max,
  tall,
  fontSize,
}: {
  home: CardScorer[];
  away: CardScorer[];
  max: number;
  tall: boolean;
  fontSize: number;
}) {
  if (!home.length && !away.length) return null;

  const perSide = Math.ceil(max / 2);
  const hidden = Math.max(0, home.length - perSide) + Math.max(0, away.length - perSide);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        marginTop: tall ? 56 : 36,
        paddingTop: tall ? 40 : 28,
        borderTop: "2px solid rgba(255,255,255,0.25)",
      }}
    >
      <div style={{ display: "flex" }}>
        <ScorerColumn scorers={home.slice(0, perSide)} align="flex-start" fontSize={fontSize} />
        <ScorerColumn scorers={away.slice(0, perSide)} align="flex-end" fontSize={fontSize} />
      </div>
      {hidden > 0 ? (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 16, fontSize: 26, opacity: 0.7 }}>
          {`y ${hidden} ${hidden === 1 ? "gol más" : "goles más"}`}
        </div>
      ) : null}
    </div>
  );
}

function ScorerColumn({
  scorers,
  align,
  fontSize,
}: {
  scorers: CardScorer[];
  align: "flex-start" | "flex-end";
  fontSize: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align, flex: 1, minWidth: 0 }}>
      {scorers.map((s, i) => (
        <div key={i} style={{ display: "flex", fontSize, fontWeight: 500, marginBottom: 10 }}>
          {scorerLine(s)}
        </div>
      ))}
    </div>
  );
}
