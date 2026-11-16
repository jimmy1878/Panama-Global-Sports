/**
 * Fondo de marca: el balón y las vetas de luz del logotipo.
 *
 * Es decoración pura (`aria-hidden`), dibujada en SVG para que escale sin peso
 * y acompañe al degradado `bg-brand-gradient`. El balón asoma por la derecha y
 * se recorta, como en el diseño.
 */
export function BrandBackdrop({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {/* Vetas de luz diagonales, como las que trae el logo debajo de sí */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1200 200"
        preserveAspectRatio="none"
        fill="none"
      >
        <path d="M-100 210 C 260 150, 520 120, 1300 40" stroke="#2BB0FF" strokeOpacity="0.14" strokeWidth="26" />
        <path d="M-100 240 C 300 180, 560 150, 1300 70" stroke="#2BB0FF" strokeOpacity="0.1" strokeWidth="14" />
      </svg>

      {/* Balón recortado por la derecha */}
      <svg
        className="absolute -top-16 -right-10 aspect-square h-[260%] opacity-90 md:-top-24 md:right-6"
        viewBox="0 0 200 200"
        fill="none"
      >
        <defs>
          <radialGradient id="pgs-ball" cx="38%" cy="30%" r="78%">
            <stop offset="0%" stopColor="#1C3D7A" />
            <stop offset="60%" stopColor="#0A1F4A" />
            <stop offset="100%" stopColor="#020D24" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="96" fill="url(#pgs-ball)" />
        <g stroke="#2BB0FF" strokeOpacity="0.45" strokeWidth="2.5" strokeLinejoin="round" fill="none">
          {/* Pentágono central y sus costuras */}
          <path d="M100 58 L132 81 L120 119 L80 119 L68 81 Z" />
          <path d="M100 58 L100 20" />
          <path d="M132 81 L168 69" />
          <path d="M120 119 L142 151" />
          <path d="M80 119 L58 151" />
          <path d="M68 81 L32 69" />
          {/* Pentágonos del borde, solo insinuados */}
          <path d="M100 20 L140 34 L168 69" />
          <path d="M168 69 L178 110 L142 151" />
          <path d="M142 151 L108 178 L58 151" />
          <path d="M58 151 L22 110 L32 69" />
          <path d="M32 69 L60 34 L100 20" />
          <circle cx="100" cy="100" r="96" strokeOpacity="0.55" />
        </g>
      </svg>
    </div>
  );
}
