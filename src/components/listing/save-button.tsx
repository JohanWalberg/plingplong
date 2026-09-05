"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { icons } from "@/components/ui/misc";
import { readSavedClient, writeSavedClient } from "@/lib/saved";
import { useToast } from "@/components/ui/toast";

export function SaveButton({ slug, size = "md", className = "" }: { slug: string; size?: "md" | "lg"; className?: string }) {
  const t = useTranslations("actions");
  const tl = useTranslations("listing");
  const { toast } = useToast();
  const router = useRouter();
  const [saved, setSaved] = useState(false);

  useEffect(() => setSaved(readSavedClient().includes(slug)), [slug]);

  function toggle() {
    const current = readSavedClient();
    const next = current.includes(slug) ? current.filter((s) => s !== slug) : [slug, ...current];
    writeSavedClient(next);
    setSaved(next.includes(slug));
    toast(next.includes(slug) ? tl("saved") : tl("removeSaved"), "info");
    router.refresh();
  }

  return (
    <Button variant="secondary" size={size} onClick={toggle} aria-pressed={saved} icon={saved ? icons.bookmarkFilled : icons.bookmark} className={className}>
      {saved ? tl("saved") : t("saveHome")}
    </Button>
  );
}
