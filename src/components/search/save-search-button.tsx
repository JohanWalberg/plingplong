"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { icons } from "@/components/ui/misc";
import { readSavedSearches, writeSavedSearches } from "@/lib/saved";
import { useToast } from "@/components/ui/toast";

export function SaveSearchButton({ label }: { label: string }) {
  const t = useTranslations("actions");
  const tl = useTranslations("listing");
  const { toast } = useToast();
  const [href, setHref] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const h = window.location.pathname + window.location.search;
    setHref(h);
    setSaved(readSavedSearches().some((s) => s.href === h));
  }, []);
  function toggle() {
    const list = readSavedSearches();
    const next = saved ? list.filter((s) => s.href !== href) : [{ label, href, savedAt: new Date().toISOString() }, ...list];
    writeSavedSearches(next);
    setSaved(!saved);
    toast(saved ? tl("removeSaved") : tl("saved"), "info");
  }
  return (
    <Button variant="tertiary" size="sm" onClick={toggle} aria-pressed={saved} icon={saved ? icons.bookmarkFilled : icons.bookmark}>
      {saved ? tl("saved") : t("saveSearch")}
    </Button>
  );
}
