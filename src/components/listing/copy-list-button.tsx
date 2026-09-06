"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/** Copies a plain-text list (one line per home) so a saved list can leave the browser. */
export function CopyListButton({ lines }: { lines: string[] }) {
  const t = useTranslations("listing");
  const { toast } = useToast();
  async function copy() {
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast(t("listCopied"), "success");
    } catch {
      toast(t("shareFailed"), "error");
    }
  }
  return (
    <Button variant="secondary" size="md" onClick={copy}>
      {t("copyList")}
    </Button>
  );
}
