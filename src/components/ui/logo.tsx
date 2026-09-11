/**
 * Brand mark: the plingplong house with an open door and sound waves,
 * redrawn as SVG from the source PNG in public/brand/. Colours are the
 * brand's navy and amber, not the UI accent, so it reads as a logo.
 */
export const BRAND_NAVY = "#1b4a7a";
export const BRAND_AMBER = "#f5a800";

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
 * Wordmark "plingplong.se" in the logo's rounded lowercase: navy on light
 * grounds, off-white on dark ones, the ".se" always amber.
 */
export function Wordmark({ tone = "light", className = "text-[19px]" }: { tone?: "light" | "dark"; className?: string }) {
  return (
    <span className={`font-wordmark font-[800] leading-none tracking-[-0.02em] ${className}`} style={{ color: tone === "dark" ? "#ede8e0" : BRAND_NAVY }}>
      plingplong<span style={{ color: BRAND_AMBER }}>.se</span>
    </span>
  );
}

/** Logo mark and wordmark together, as used in every header. */
export function Logo({ tone = "light", size = "md" }: { tone?: "light" | "dark"; size?: "sm" | "md" }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark className={size === "sm" ? "h-6 w-6" : "h-8 w-8"} />
      <Wordmark tone={tone} className={size === "sm" ? "text-[16px]" : "text-[19px]"} />
    </span>
  );
}
