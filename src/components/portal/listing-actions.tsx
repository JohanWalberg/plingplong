"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { deleteDraft, extendDeadline, republishListing, unpublishListing } from "@/actions/portal-listings";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

type Props = { id: string; status: string; deadline: string | null; canPublish: boolean };

export function ListingActions({ id, status, deadline, canPublish }: Props) {
  const t = useTranslations("portal.perf");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { toast } = useToast();
  const [dialog, setDialog] = useState<"unpublish" | "extend" | "delete" | null>(null);
  const [date, setDate] = useState(deadline ?? "");
  const [pending, start] = useTransition();

  const close = () => setDialog(null);
  const done = (msg: string) => {
    close();
    toast(msg);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-2">
      {canPublish && (status === "active" || status === "expired") ? (
        <Button variant="secondary" onClick={() => setDialog("extend")}>
          {t("extend")}
        </Button>
      ) : null}
      {canPublish && status === "active" ? (
        <Button variant="danger" onClick={() => setDialog("unpublish")}>
          {t("unpublish")}
        </Button>
      ) : null}
      {canPublish && (status === "unpublished" || status === "expired") ? (
        <Button onClick={() => start(async () => { await republishListing(locale, id); done(t("republished")); })} loading={pending}>
          {t("republish")}
        </Button>
      ) : null}
      {status === "draft" ? (
        <Button variant="danger" onClick={() => setDialog("delete")}>
          {t("deleteDraft")}
        </Button>
      ) : null}
      {!canPublish ? <p className="text-meta text-muted">{t("ownerOnly")}</p> : null}

      <Dialog
        open={dialog === "unpublish"}
        onClose={close}
        title={t("unpublishTitle")}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              {tc("cancel")}
            </Button>
            <Button variant="danger" loading={pending} onClick={() => start(async () => { await unpublishListing(locale, id); done(t("unpublished")); })}>
              {t("unpublish")}
            </Button>
          </>
        }
      >
        <p>{t("unpublishBody")}</p>
        <p className="mt-2 text-meta text-muted">{t("unpublishNote")}</p>
      </Dialog>

      <Dialog
        open={dialog === "extend"}
        onClose={close}
        title={t("extendTitle")}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              {tc("cancel")}
            </Button>
            <Button loading={pending} onClick={() => start(async () => { const r = await extendDeadline(locale, id, date); if (r.ok) done(t("extendSaved")); })}>
              {tc("save")}
            </Button>
          </>
        }
      >
        <Input label={t("extendTitle")} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Dialog>

      <Dialog
        open={dialog === "delete"}
        onClose={close}
        title={t("deleteDraftTitle")}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              {tc("cancel")}
            </Button>
            <Button variant="danger" loading={pending} onClick={() => start(async () => { await deleteDraft(locale, id); })}>
              {t("deleteDraft")}
            </Button>
          </>
        }
      >
        <p>{t("deleteDraftBody")}</p>
      </Dialog>
    </div>
  );
}
