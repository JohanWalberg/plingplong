"use client";

import { useEffect, useRef, type ReactNode, useId } from "react";
import { useTranslations } from "next-intl";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** "sheet" renders as a bottom sheet on small screens and a dialog on large. */
  variant?: "dialog" | "sheet";
  footer?: ReactNode;
  className?: string;
};

/**
 * Accessible modal built on the native <dialog> element: focus trap, Escape,
 * backdrop, and focus restore come from the platform. On small screens the
 * "sheet" variant slides up as a bottom sheet with a scrollable body.
 */
export function Dialog({ open, onClose, title, children, variant = "dialog", footer, className = "" }: DialogProps) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const t = useTranslations("common");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleClose = () => onClose();
    const handleClick = (e: MouseEvent) => {
      if (e.target === el) onClose();
    };
    el.addEventListener("close", handleClose);
    el.addEventListener("click", handleClick);
    return () => {
      el.removeEventListener("close", handleClose);
      el.removeEventListener("click", handleClick);
    };
  }, [onClose]);

  const sheet = variant === "sheet";
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`m-0 max-h-none max-w-none border-0 bg-transparent p-0 backdrop:bg-[#5b564e]/70 ${
        sheet
          ? "fixed inset-x-0 bottom-0 top-auto h-[94dvh] w-full sm:inset-0 sm:m-auto sm:h-auto sm:max-h-[90dvh] sm:w-[560px]"
          : "fixed inset-0 m-auto w-[min(92vw,560px)]"
      } ${className}`}
    >
      <div
        className={`flex max-h-[94dvh] flex-col bg-surface text-ink shadow-xl ${
          sheet ? "h-full rounded-t-2xl sm:h-auto sm:rounded-lg" : "rounded-lg"
        }`}
      >
        <header className="flex min-h-14 items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 id={titleId} className="text-h3">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="flex h-touch w-touch items-center justify-center rounded-md text-[22px] leading-none text-muted hover:bg-bg"
          >
            ×
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer> : null}
      </div>
    </dialog>
  );
}
