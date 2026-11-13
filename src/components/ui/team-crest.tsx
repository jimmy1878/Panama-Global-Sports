/* eslint-disable @next/next/no-img-element -- logos pequeños del bucket público; next/image no aporta aquí */
import type { Team } from "@/features/league/data";

const SIZES = { sm: "size-7 text-[9px]", md: "size-10 text-[11px]", lg: "size-16 text-base", xl: "size-20 text-lg" };

/** Escudo del equipo: el logo si existe; si no, sus colores con la abreviatura. */
export function TeamCrest({ team, size = "md" }: { team: Team; size?: keyof typeof SIZES }) {
  if (team.logoUrl) {
    return <img src={team.logoUrl} alt="" className={`${SIZES[size]} shrink-0 rounded-full object-contain`} />;
  }
  return (
    <span
      aria-hidden
      className={`${SIZES[size]} grid shrink-0 place-items-center rounded-full border-2 font-black`}
      style={{ backgroundColor: team.primaryColor, borderColor: team.secondaryColor, color: team.secondaryColor }}
    >
      {(team.shortName ?? team.name).slice(0, 3).toUpperCase()}
    </span>
  );
}
