/**
 * Brand mark: the plingplong house with an open door and sound waves,
 * redrawn as SVG from the source PNG in public/brand/. Colours are the
 * brand's navy and amber, not the UI accent, so it reads as a logo.
 */
export const BRAND_NAVY = "#063b72";
export const BRAND_AMBER = "#ffb31a";

export function LogoMark({ className = "h-8 w-8", title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      {/* house */}
      <path d="M10 30 L32 10 L54 30 V54 H10 Z" fill={BRAND_NAVY} />
      <rect x="42" y="14" width="6" height="10" fill={BRAND_NAVY} />
      {/* open door */}
      <path d="M20 54 V36 a8 8 0 0 1 16 0 V54 Z" fill="#ffffff" />
      <circle cx="31" cy="45" r="1.8" fill={BRAND_NAVY} />
      {/* sound waves */}
      <path d="M41 39 a6 6 0 0 1 0 8" fill="none" stroke={BRAND_AMBER} strokeWidth="3" strokeLinecap="round" />
      <path d="M45.5 35.5 a11 11 0 0 1 0 15" fill="none" stroke={BRAND_AMBER} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Wordmark "plingplong.se" drawn as SVG text in the brand's heavy rounded
 * weight: navy on light grounds, off-white on dark ones, the ".se" amber.
 * An image, not body copy, so the accent is not held to text contrast.
 */
export function Wordmark({ tone = "light", className = "h-[22px]" }: { tone?: "light" | "dark"; className?: string }) {
  const fill = tone === "dark" ? "#f5f8fc" : "#052b55";
  return (
    <svg viewBox="0 0 176 30" className={className} role="img" aria-label="plingplong.se">
      <text x="0" y="24" fontFamily="var(--font-wordmark)" fontWeight="800" fontSize="27" letterSpacing="-0.5" fill={fill}>
        plingplong
        <tspan fill={BRAND_AMBER}>.se</tspan>
      </text>
    </svg>
  );
}

/** Logo mark and wordmark together, as used in every header. */
export function Logo({ tone = "light", size = "md" }: { tone?: "light" | "dark"; size?: "sm" | "md" }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark className={size === "sm" ? "h-6 w-6" : "h-8 w-8"} />
      <Wordmark tone={tone} className={size === "sm" ? "h-[18px]" : "h-[22px]"} />
    </span>
  );
}
