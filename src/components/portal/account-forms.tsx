"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { sendInvitation, revokeInvitation } from "@/actions/invite";
import { changeMemberRole, removeMember, updateProfile } from "@/actions/portal-account";
import { closeLandlordAccount } from "@/actions/portal-account";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select, ValidationSummary } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

export function InviteForm() {
  const t = useTranslations("portal.account");
  const locale = useLocale() as Locale;
  const { toast } = useToast();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const email = String(fd.get("email") ?? "");
    setError(null);
    start(async () => {
      const r = await sendInvitation(locale, fd);
      if (!r.ok) setError(r.error === "exists" ? t("inviteExists") : t("inviteInvalid"));
      else {
        toast(t("inviteSent", { email }));
        form.reset();
        router.refresh();
      }
    });
  }
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      {error ? <ValidationSummary title={error} /> : null}
      <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
        <Input label={t("inviteEmail")} name="email" type="email" required />
        <Select label={t("inviteRole")} name="role" defaultValue="editor">
          <option value="editor">{t("roleEditor")}</option>
          <option value="owner">{t("roleOwner")}</option>
        </Select>
        <Button type="submit" loading={pending}>
          {t("inviteSend")}
        </Button>
      </div>
    </form>
  );
}

export function RevokeButton({ id }: { id: string }) {
  const t = useTranslations("portal.account");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="tertiary" size="sm" loading={pending} onClick={() => start(async () => { await revokeInvitation(locale, id); router.refresh(); })}>
      {t("revoke")}
    </Button>
  );
}

export function MemberControls({ userId, name, role, isSelf }: { userId: string; name: string; role: "owner" | "editor"; isSelf: boolean }) {
  const t = useTranslations("portal.account");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <Select label={t("changeRole")} hideLabel value={role} className="min-h-9 py-0 text-[13.5px]" onChange={(e) => start(async () => { const r = await changeMemberRole(locale, userId, e.target.value as "owner" | "editor"); toast(r.ok ? t("roleChanged") : t("lastOwner"), r.ok ? "success" : "error"); router.refresh(); })}>
        <option value="owner">{t("roleOwner")}</option>
        <option value="editor">{t("roleEditor")}</option>
      </Select>
      {!isSelf ? (
        <Button variant="tertiary" size="sm" onClick={() => setOpen(true)}>
          {t("removeMember")}
        </Button>
      ) : null}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("removeMemberTitle", { name })}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button variant="danger" loading={pending} onClick={() => start(async () => { const r = await removeMember(locale, userId); setOpen(false); toast(r.ok ? t("memberRemoved") : t("lastOwner"), r.ok ? "success" : "error"); router.refresh(); })}>
              {t("removeMember")}
            </Button>
          </>
        }
      >
        <p>{t("removeMemberBody")}</p>
      </Dialog>
    </div>
  );
}

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const t = useTranslations("portal.account");
  const ta = useTranslations("auth");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const { toast } = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pwError, setPwError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          start(async () => {
            const r = await updateProfile(locale, fd);
            if (r.ok) {
              toast(t("saved"));
              router.refresh();
            }
          });
        }}
        className="flex flex-col gap-3"
      >
        <Input label={t("name")} name="name" defaultValue={name} required autoComplete="name" />
        <Input label={t("email")} value={email} readOnly type="email" />
        <Button type="submit" variant="secondary" loading={pending} className="self-start">
          {tc("save")}
        </Button>
      </form>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const current = String(fd.get("current") ?? "");
          const next = String(fd.get("next") ?? "");
          setPwError(null);
          if (next.length < 10) return setPwError(ta("passwordHint"));
          const r = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
          if (r.error) setPwError(ta("invalidCredentials"));
          else {
            toast(t("passwordChanged"));
            (e.target as HTMLFormElement).reset();
          }
        }}
        className="flex flex-col gap-3"
      >
        <h3 className="text-h3">{t("changePassword")}</h3>
        {pwError ? <ValidationSummary title={pwError} /> : null}
        <Input label={t("currentPassword")} name="current" type="password" autoComplete="current-password" required />
        <Input label={ta("newPassword")} name="next" type="password" autoComplete="new-password" hint={ta("passwordHint")} required />
        <Button type="submit" variant="secondary" className="self-start">
          {t("changePassword")}
        </Button>
      </form>
    </div>
  );
}


export function CloseAccountForm({ organisation }: { organisation: string }) {
  const t = useTranslations("portal.account");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        {t("closeButton")}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("closeTitle")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const res = await closeLandlordAccount(locale, name);
                  if (!res.ok) {
                    setError(t("closeMismatch"));
                    return;
                  }
                  router.push("/portal/sign-in");
                  router.refresh();
                })
              }
            >
              {t("closeButton")}
            </Button>
          </>
        }
      >
        <p className="text-[14.5px] text-ink-2">{t("closeIntro")}</p>
        <div className="mt-3">
          <Input label={t("closeConfirmLabel")} value={name} onChange={(e) => setName(e.target.value)} placeholder={organisation} error={error ?? undefined} autoComplete="off" />
        </div>
      </Dialog>
    </>
  );
}
