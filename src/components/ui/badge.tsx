import type { ReactNode } from "react";
import type { Badge as BadgeModel, BadgeTone } from "@/lib/listing-display";

const tones: Record<BadgeTone, string> = {
  urgent: "bg-error-bg border-error-border text-error-text",
  soon: "bg-warning-bg border-warning-border text-warning-text",
  neutral: "bg-canvas border-line text-dark-3",
  info: "bg-info-bg border-info-border text-info-text",
  quiet: "bg-surface border-line text-muted",
};

const icons: Record<NonNullable<BadgeModel["icon"]>, ReactNode> = {
  warn: (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5">
      <path d="M8 2 14.5 13.5h-13L8 2z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 6.5v3.2M8 11.6v.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  clock: (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.5V8l2.3 1.6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  question: (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.2 6.3a1.9 1.9 0 1 1 2.7 1.7c-.6.3-.9.6-.9 1.2M8 11.4v.2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

export function Badge({ tone, icon, children, className = "" }: { tone: BadgeTone; icon?: BadgeModel["icon"]; children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[5px] border px-2 py-1 text-meta font-[650] leading-[1.35] ${tones[tone]} ${className}`}
    >
      {icon ? icons[icon] : null}
      {children}
    </span>
  );
}

export function BadgeList({ badges, className = "" }: { badges: BadgeModel[]; className?: string }) {
  if (!badges.length) return null;
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`} aria-label="">
      {badges.map((b) => (
        <li key={b.key} className="list-none">
          <Badge tone={b.tone} icon={b.icon}>
            {b.label}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

export type StatusTone = "success" | "warning" | "error" | "info" | "neutral" | "quiet";

const statusTones: Record<StatusTone, string> = {
  success: "bg-success-bg border-success-border text-success",
  warning: "bg-warning-bg border-warning-border text-warning-text",
  error: "bg-error-bg border-error-border text-error-text",
  info: "bg-info-bg border-info-border text-info-text",
  neutral: "bg-canvas border-line text-dark-3",
  quiet: "bg-surface border-line text-muted",
};

const statusGlyph: Record<StatusTone, string> = {
  success: "●",
  warning: "◐",
  error: "■",
  info: "?",
  neutral: "○",
  quiet: "○",
};

/** Status pill with a glyph so state is never colour-only. */
export function StatusPill({ tone, children, className = "" }: { tone: StatusTone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-[5px] border px-2 py-0.5 text-meta font-[650] ${statusTones[tone]} ${className}`}>
      <span aria-hidden="true" className="text-[10px]">
        {statusGlyph[tone]}
      </span>
      {children}
    </span>
  );
}
