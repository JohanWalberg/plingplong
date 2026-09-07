"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import { addStaffByEmail, setStaffRole } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

const ROLES = ["support", "lead", "engineer"] as const;

export function StaffForm() {
  const t = useTranslations("admin.settings");
  const ta = useTranslations("auth");
  const te = useTranslations("admin.errors");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await addStaffByEmail(locale, String(fd.get("email") ?? ""), fd.get("role") as "support");
      if (!res.ok) {
        setError(res.error === "noUser" ? ta("inviteInvalid") : te(res.error));
        return;
      }
      toast(t("inviteSent"), "success");
      router.refresh();
    });
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <Input label={t("colEmail")} name="email" type="email" required error={error ?? undefined} hint={t("inviteHint")} />
      <Select label={t("colRole")} name="role" defaultValue="support">
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {t(`role${r[0].toUpperCase()}${r.slice(1)}` as "roleLead")}
          </option>
        ))}
      </Select>
      <Button type="submit" loading={pending} className="self-start">
        {t("invite")}
      </Button>
    </form>
  );
}

export function StaffRoleSelect({ userId, role }: { userId: string; role: string }) {
  const t = useTranslations("admin.settings");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Select
      label={t("colRole")}
      hideLabel
      defaultValue={role}
      disabled={pending}
      className="min-h-9 py-0 text-[13.5px]"
      onChange={(e) =>
        start(async () => {
          await setStaffRole(locale, userId, e.target.value as "support");
          router.refresh();
        })
      }
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {t(`role${r[0].toUpperCase()}${r.slice(1)}` as "roleLead")}
        </option>
      ))}
    </Select>
  );
}
