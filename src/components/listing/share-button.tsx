"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { icons } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";

/**
 * Native share sheet where the browser has one (phones), otherwise the
 * link is copied and a toast confirms it. The URL is the page's canonical
 * address, which carries the Open Graph card when pasted.
 */
export function ShareButton({ title, size = "md", className = "", iconOnly = false }: { title: string; size?: "md" | "lg"; className?: string; iconOnly?: boolean }) {
  const t = useTranslations("listing");
  const { toast } = useToast();

  async function share() {
    const url = (document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null)?.href ?? window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // dismissed, or the share failed: fall through to copying
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast(t("linkCopied"), "success");
    } catch {
      toast(t("shareFailed"), "error");
    }
  }

  return (
    <Button variant="secondary" size={size} onClick={share} icon={icons.share} className={className} aria-label={iconOnly ? t("share") : undefined}>
      {iconOnly ? null : t("share")}
    </Button>
  );
}
