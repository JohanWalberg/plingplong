"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button, type ButtonVariant, type ButtonSize } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

type ActionProps = {
  /** A bound server action, e.g. `runSourceSync.bind(null, locale, id)`. */
  action?: () => Promise<unknown>;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  successMessage?: string;
  className?: string;
  disabled?: boolean;
};

/** Button that runs a server action with the current locale, then refreshes. */
export function ActionButton({ action, children, variant = "secondary", size = "sm", successMessage, className, disabled }: ActionProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      loading={pending}
      disabled={disabled}
      onClick={() =>
        start(async () => {
          try {
            await action?.();
            if (successMessage) toast(successMessage, "success");
            router.refresh();
          } catch (e) {
            toast((e as Error).message, "error");
          }
        })
      }
    >
      {children}
    </Button>
  );
}

type ConfirmProps = ActionProps & { title: string; body?: string; confirmLabel: string; textareaLabel?: string; textareaRequired?: boolean; actionWithText?: (text: string) => Promise<unknown> };

/** Button that opens a confirmation dialog (optionally with a message field) before running the action. */
export function ConfirmActionButton({ title, body, confirmLabel, textareaLabel, textareaRequired, actionWithText, action, children, variant = "secondary", size = "sm", successMessage, className, disabled }: ConfirmProps) {
  const router = useRouter();
  const { toast } = useToast();
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    if (textareaRequired && !text.trim()) {
      setError(tc("required"));
      return;
    }
    start(async () => {
      try {
        if (actionWithText) await actionWithText(text.trim());
        else await action?.();
        setOpen(false);
        if (successMessage) toast(successMessage, "success");
        router.refresh();
      } catch (e) {
        toast((e as Error).message, "error");
      }
    });
  }

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)} disabled={disabled}>
        {children}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button variant={variant === "danger" ? "danger" : "primary"} onClick={run} loading={pending}>
              {confirmLabel}
            </Button>
          </>
        }
      >
        {body ? <p className="text-[14.5px] text-ink-2">{body}</p> : null}
        {textareaLabel ? (
          <div className="mt-3">
            <Textarea label={textareaLabel} value={text} onChange={(e) => setText(e.target.value)} error={error ?? undefined} />
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
