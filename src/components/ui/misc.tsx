import type { HTMLAttributes, ReactNode } from "react";

export function Skeleton({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={`skeleton ${className}`} {...rest} />;
}

export function Card({ children, className = "", as: Tag = "div", ...rest }: HTMLAttributes<HTMLElement> & { children: ReactNode; as?: "div" | "section" | "article" | "aside" }) {
  return (
    <Tag className={`rounded-md border border-line bg-surface shadow-[0_1px_2px_rgba(26,24,21,.04)] ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export function FilterChip({ label, onRemove, removeLabel }: { label: string; onRemove?: () => void; removeLabel?: string }) {
  return (
    <span className="inline-flex min-h-8 items-center gap-1 rounded-full border border-chip-border bg-primary-subtle pl-3 pr-1 text-[13px] font-[650] text-chip-text">
      {label}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel ?? `× ${label}`}
          className="flex h-7 w-7 items-center justify-center rounded-full text-[15px] leading-none hover:bg-[#f0dcd2]"
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

export function Kicker({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-[11px] font-[650] uppercase tracking-[.13em] text-faint ${className}`}>{children}</p>;
}

export function Callout({ tone, title, children, icon }: { tone: "warning" | "info" | "error" | "success"; title?: string; children: ReactNode; icon?: ReactNode }) {
  const cls = {
    warning: "border-warning-border bg-warning-bg text-warning-text",
    info: "border-info-border bg-info-bg text-info-text",
    error: "border-error-border bg-error-bg text-error-text",
    success: "border-success-border bg-success-bg text-success",
  }[tone];
  return (
    <div className={`flex gap-3 rounded-md border px-4 py-3 text-[14px] leading-relaxed ${cls}`}>
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <div>
        {title ? <p className="font-[650]">{title}</p> : null}
        <div className={title ? "mt-0.5" : ""}>{children}</div>
      </div>
    </div>
  );
}

export const icons = {
  refresh: (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0">
      <path d="M13 8a5 5 0 1 1-1.5-3.6M13 2v3h-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  external: (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 shrink-0">
      <path d="M6.5 3.5H3.5v9h9v-3M9 3h4v4M13 3 7.5 8.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  search: (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5 shrink-0">
      <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M13 13l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  pin: (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 shrink-0">
      <path d="M8 14s4.5-4.2 4.5-7.5a4.5 4.5 0 1 0-9 0C3.5 9.8 8 14 8 14z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="6.5" r="1.6" fill="currentColor" />
    </svg>
  ),
  bookmark: (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 shrink-0">
      <path d="M4 2.5h8v11l-4-2.6-4 2.6z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  ),
  bookmarkFilled: (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 shrink-0">
      <path d="M4 2.5h8v11l-4-2.6-4 2.6z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  ),
  check: (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 shrink-0">
      <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  funnel: (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 shrink-0">
      <path d="M2 3h12l-4.5 5.5V13l-3-1.5V8.5z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  ),
  warn: (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 shrink-0">
      <path d="M8 2 14.5 13.5h-13L8 2z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 6.5v3.2M8 11.6v.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  info: (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 shrink-0">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 7v4M8 5v.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  chevronDown: (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 shrink-0">
      <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  arrowRight: (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 shrink-0">
      <path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  share: (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 shrink-0">
      <path d="M8 2v8M5 5l3-3 3 3M3.5 9.5v3h9v-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  removed: (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 shrink-0">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

export { LogoMark } from "./logo";
