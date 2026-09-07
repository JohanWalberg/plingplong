import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "danger" | "dark";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-[650] leading-tight text-center transition-colors select-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover hover:text-white hover:no-underline",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-bg hover:text-ink hover:no-underline",
  tertiary: "bg-transparent text-primary hover:text-primary-hover hover:underline px-2",
  danger: "bg-surface text-error-text border border-error-border hover:bg-error-bg hover:text-error-text hover:no-underline",
  dark: "bg-ink text-white hover:bg-dark-2 hover:text-white hover:no-underline",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-[13.5px]",
  md: "min-h-touch px-4 text-[15px]",
  lg: "min-h-[52px] px-5 text-[16px]",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: string;
  icon?: ReactNode;
};

/**
 * Submit buttons stay enabled and validate on submit; `loading` swaps the
 * label and marks the button busy without disabling it for keyboard users.
 */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  loadingLabel,
  icon,
  className = "",
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const cls = loading
    ? `${base} ${sizes[size]} bg-placeholder text-faint ${className}`
    : buttonClasses(variant, size, className);
  return (
    <button type={type} className={cls} aria-busy={loading || undefined} {...rest}>
      {!loading && icon}
      <span>{loading && loadingLabel ? loadingLabel : children}</span>
    </button>
  );
}
