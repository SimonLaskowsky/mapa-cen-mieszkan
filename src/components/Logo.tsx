interface LogoProps {
  showWordmark?: boolean;
  size?: number;
}

export default function Logo({ showWordmark = true, size = 28 }: LogoProps) {
  return (
    <div className="flex items-center gap-2.5">
      <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        className="shrink-0"
        aria-label="RynkoRadar"
      >
        {/* crosshair — subtle */}
        <line x1="1" y1="16" x2="31" y2="16" stroke="#00d4aa" strokeWidth="0.5" opacity="0.15" />
        <line x1="16" y1="1" x2="16" y2="31" stroke="#00d4aa" strokeWidth="0.5" opacity="0.15" />

        {/* concentric rings */}
        <circle cx="16" cy="16" r="14" fill="none" stroke="#00d4aa" strokeWidth="1" opacity="0.35" />
        <circle cx="16" cy="16" r="9" fill="none" stroke="#00d4aa" strokeWidth="1" opacity="0.55" />

        {/* center dot */}
        <circle cx="16" cy="16" r="1.5" fill="#00d4aa" />

        {/* rotating sweep — the "scanning" part */}
        <line
          className="logo-radar-sweep"
          x1="16"
          y1="16"
          x2="16"
          y2="2"
          stroke="#00d4aa"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {/* blip — diamond, matches the listing marker shape on the map */}
        <rect
          className="logo-radar-blip"
          x="20"
          y="7"
          width="3.5"
          height="3.5"
          fill="#00d4aa"
          transform="rotate(45 21.75 8.75)"
        />
      </svg>

      {showWordmark && (
        <h1 className="font-mono text-lg font-semibold tracking-tight leading-none">
          <span className="text-gray-300">RYNKO</span>
          <span className="text-[#00d4aa]">RADAR</span>
        </h1>
      )}
    </div>
  );
}
