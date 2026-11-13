/** Fechas y horas siempre en hora de Panamá, en español. */
const TZ = "America/Panama";
const LOCALE = "es-PA";

const dayFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const longDayFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const timeFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const shortDateFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", day: "numeric", month: "short" });

/** "sáb, 14 nov" */
export function formatDay(iso: string) {
  return dayFmt.format(new Date(iso));
}

/** "sábado, 14 de noviembre" */
export function formatLongDay(iso: string) {
  const s = longDayFmt.format(new Date(iso));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "8:00 a. m." */
export function formatTime(iso: string) {
  return timeFmt.format(new Date(iso));
}

/** Clave de día en Panamá ("2026-11-14") para agrupar partidos. */
export function dayKey(iso: string) {
  return keyFmt.format(new Date(iso));
}

/** Fecha sin hora (columnas `date`, p. ej. inicio de temporada): "19 oct" */
export function formatDateOnly(date: string) {
  return shortDateFmt.format(new Date(`${date}T00:00:00Z`));
}
