"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { icons } from "@/components/ui/misc";
import { readSavedClient, writeSavedClient } from "@/lib/saved";
import { useToast } from "@/components/ui/toast";
import { beacon } from "./track";

/** Saves live in the browser; a save (not an unsave) is also counted for the landlord's statistics. */
export function SaveButton({ slug, listingId, size = "md", className = "", iconOnly = false }: { slug: string; listingId: string; size?: "md" | "lg"; className?: string; iconOnly?: boolean }) {
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
    if (!current.includes(slug)) beacon(listingId, "save");
    toast(next.includes(slug) ? tl("saved") : tl("removeSaved"), "info");
    router.refresh();
  }

  return (
    <Button variant="secondary" size={size} onClick={toggle} aria-pressed={saved} icon={saved ? icons.bookmarkFilled : icons.bookmark} className={className} aria-label={iconOnly ? (saved ? tl("saved") : t("saveHome")) : undefined}>
      {iconOnly ? null : saved ? tl("saved") : t("saveHome")}
    </Button>
  );
}
