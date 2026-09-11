"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

type FieldShellProps = {
  label: string;
  hint?: string;
  error?: string;
  optional?: string;
  id: string;
  children: ReactNode;
  className?: string;
};

export function FieldShell({ label, hint, error, optional, id, children, className = "" }: FieldShellProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-label font-[650] text-ink">
        {label}
        {optional ? <span className="ml-1.5 font-normal text-muted">({optional})</span> : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-meta text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-meta font-[600] text-error-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const inputClasses =
  "min-h-touch w-full rounded-md border border-line-strong bg-surface px-3 text-[15px] text-ink placeholder:text-faint " +
  "focus:border-blue focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue " +
  "aria-[invalid=true]:border-error";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: string;
  hint?: string;
  error?: string;
  optional?: string;
  suffix?: string;
  id?: string;
  wrapperClassName?: string;
};

export function Input({ label, hint, error, optional, suffix, id: givenId, className = "", wrapperClassName, ...rest }: InputProps) {
  const autoId = useId();
  const id = givenId ?? autoId;
  const described = [hint && !error ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional} id={id} className={wrapperClassName}>
      <div className="relative flex items-center">
        <input
          id={id}
          className={`${inputClasses} ${suffix ? "pr-16" : ""} ${className}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          {...rest}
        />
        {suffix ? <span className="pointer-events-none absolute right-3 text-[13.5px] text-muted">{suffix}</span> : null}
      </div>
    </FieldShell>
  );
}

type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & {
  label: string;
  hint?: string;
  error?: string;
  optional?: string;
  id?: string;
};

export function Textarea({ label, hint, error, optional, id: givenId, className = "", ...rest }: TextareaProps) {
  const autoId = useId();
  const id = givenId ?? autoId;
  const described = [hint && !error ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional} id={id}>
      <textarea
        id={id}
        className={`${inputClasses} min-h-[120px] py-2.5 leading-relaxed ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        {...rest}
      />
    </FieldShell>
  );
}

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> & {
  label: string;
  hint?: string;
  error?: string;
  id?: string;
  hideLabel?: boolean;
};

export function Select({ label, hint, error, id: givenId, hideLabel, className = "", children, ...rest }: SelectProps) {
  const autoId = useId();
  const id = givenId ?? autoId;
  const select = (
    <div className="relative">
      <select
        id={id}
        className={`${inputClasses} appearance-none pr-9 ${className}`}
        aria-invalid={error ? true : undefined}
        aria-label={hideLabel ? label : undefined}
        {...rest}
      >
        {children}
      </select>
      <svg aria-hidden="true" viewBox="0 0 16 16" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted">
        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
  if (hideLabel) return select;
  return (
    <FieldShell label={label} hint={hint} error={error} id={id}>
      {select}
    </FieldShell>
  );
}

type CheckProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> & {
  label: ReactNode;
  description?: string;
  id?: string;
  count?: number | string;
};

export function Checkbox({ label, description, id: givenId, count, className = "", ...rest }: CheckProps) {
  const autoId = useId();
  const id = givenId ?? autoId;
  return (
    <label htmlFor={id} className={`flex min-h-touch cursor-pointer items-start gap-3 py-2 ${className}`}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded-sm border-line-strong accent-primary"
        {...rest}
      />
      <span className="flex-1 text-[14.5px] leading-snug text-ink">
        <span className="flex items-baseline justify-between gap-3">
          <span>{label}</span>
          {count !== undefined ? <span className="text-meta text-muted tabular">{count}</span> : null}
        </span>
        {description ? <span className="mt-0.5 block text-meta text-muted">{description}</span> : null}
      </span>
    </label>
  );
}

export function Radio({ label, description, id: givenId, className = "", ...rest }: CheckProps) {
  const autoId = useId();
  const id = givenId ?? autoId;
  return (
    <label htmlFor={id} className={`flex min-h-touch cursor-pointer items-start gap-3 py-2 ${className}`}>
      <input id={id} type="radio" className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-primary" {...rest} />
      <span className="flex-1 text-[14.5px] leading-snug text-ink">
        <span className="block font-[600]">{label}</span>
        {description ? <span className="mt-0.5 block text-meta text-muted">{description}</span> : null}
      </span>
    </label>
  );
}

/** Boxed radio option, used for publishing route and apply route choices. */
export function RadioBox({ label, description, id: givenId, checked, className = "", ...rest }: CheckProps) {
  const autoId = useId();
  const id = givenId ?? autoId;
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 transition-colors ${
        checked ? "border-primary bg-primary-subtle" : "border-line bg-surface hover:border-line-strong"
      } ${className}`}
    >
      <input id={id} type="radio" checked={checked} className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-primary" {...rest} />
      <span className="flex-1 text-[14.5px] leading-snug text-ink">
        <span className="block font-[650]">{label}</span>
        {description ? <span className="mt-1 block text-meta text-ink-2">{description}</span> : null}
      </span>
    </label>
  );
}

export function Fieldset({ legend, hint, children, className = "" }: { legend: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <fieldset className={`m-0 min-w-0 border-0 p-0 ${className}`}>
      <legend className="mb-1 p-0 text-label font-[650] text-ink">{legend}</legend>
      {hint ? <p className="mb-2 text-meta text-muted">{hint}</p> : null}
      {children}
    </fieldset>
  );
}

/** Validation summary shown above a form on submit. Focused programmatically by the form. */
export function ValidationSummary({ title, body, items, id }: { title: string; body?: string; items?: string[]; id?: string }) {
  return (
    <div id={id} role="alert" tabIndex={-1} className="rounded-md border border-error-border bg-error-bg px-4 py-3 text-error-text">
      <p className="font-[650]">{title}</p>
      {body ? <p className="mt-1 text-[14px]">{body}</p> : null}
      {items?.length ? (
        <ul className="mt-2 list-disc pl-5 text-[14px]">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
