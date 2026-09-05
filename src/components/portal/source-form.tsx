"use client";

import { useActionState, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { connectSource, testConnection, type ConnectState, type TestState } from "@/actions/portal-sources";
import { Button } from "@/components/ui/button";
import { Input, Select, ValidationSummary } from "@/components/ui/form";
import { StatusPill } from "@/components/ui/badge";
import { Card, Callout, icons } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import type { CanonicalField } from "@/worker/adapters/types";

const SHOWN_FIELDS: CanonicalField[] = ["address", "area", "municipality", "rent", "rooms", "size", "floor", "moveIn", "deadline", "queue", "url", "externalId", "image"];
const IMPORTANT: CanonicalField[] = ["address", "rent", "rooms", "size", "deadline", "queue", "url"];

export function SourceForm() {
  const t = useTranslations("portal.source");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { toast } = useToast();
  const [kind, setKind] = useState<"feed" | "api" | "html">("feed");
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [test, testAction, testing] = useActionState<TestState, FormData>(testConnection.bind(null, locale), null);
  const [connect, connectAction, connecting] = useActionState<ConnectState, FormData>(connectSource.bind(null, locale), null);

  useEffect(() => {
    if (connect?.ok) {
      toast(kind === "html" ? t("htmlSaved") : t("connected"));
      router.push({ pathname: "/portal/sources/[id]", params: { id: connect.id } });
      router.refresh();
    }
  }, [connect, router, toast, t, kind]);

  const tested = test?.ok === true;
  const fieldLabel = (f: CanonicalField) => t(`field${f[0].toUpperCase()}${f.slice(1)}` as never);
  const errorText = (r: TestState) => {
    if (!r || r.ok) return null;
    if (r.errorClass === "auth") return t("errorAuth", { status: r.status ?? 401 });
    if (r.errorClass === "parse_error") return t("errorParse");
    if (r.errorClass === "empty") return t("errorEmpty");
    if (r.errorClass === "robots") return t("errorRobots");
    if (r.errorClass === "invalid") return t("errorInvalid");
    return t("errorUnreachable");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-6">
        <Card as="section" className="p-6">
          <div role="group" aria-label={t("typeLabel")} className="grid gap-2 sm:grid-cols-3">
            {(["feed", "api", "html"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`flex min-h-touch flex-col items-start rounded-md border px-4 py-3 text-left ${kind === k ? "border-ink bg-ink text-white" : "border-line-strong bg-surface hover:bg-bg"}`}>
                <span className="font-[650]">{t(k === "feed" ? "typeFeed" : k === "api" ? "typeApi" : "typeHtml")}</span>
                <span className={`text-meta ${kind === k ? "text-dark-muted" : "text-muted"}`}>{t(k === "feed" ? "typeFeedBody" : k === "api" ? "typeApiBody" : "typeHtmlBody")}</span>
              </button>
            ))}
          </div>

          <form action={testAction} className="mt-5 flex flex-col gap-4">
            <input type="hidden" name="kind" value={kind} />
            <Input label={kind === "html" ? t("urlLabelHtml") : t("urlLabel")} name="url" value={url} onChange={(e) => setUrl(e.target.value)} hint={t("urlHint")} inputMode="url" placeholder="https://" className="font-mono text-[14px]" required />
            {kind === "api" ? <Input label={t("apiKeyLabel")} name="apiKey" value={apiKey} onChange={(e) => setApiKey(e.target.value)} hint={t("apiKeyHint")} autoComplete="off" /> : null}
            {kind !== "html" ? (
              <Button type="submit" variant="dark" loading={testing} loadingLabel={t("testing")} className="self-start">
                {t("test")}
              </Button>
            ) : (
              <Callout tone="info" icon={icons.info}>
                {t("htmlNote")}
              </Callout>
            )}
          </form>
        </Card>

        {kind !== "html" ? (
          <Card as="section" className="p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-h3">{t("mapTitle")}</h2>
              {tested ? <StatusPill tone="success">{t("found", { count: test.count })}</StatusPill> : <StatusPill tone="quiet">{t("notTested")}</StatusPill>}
            </div>
            {test && !test.ok ? (
              <div className="mt-3">
                <ValidationSummary title={errorText(test) ?? ""} />
              </div>
            ) : null}
            {tested ? (
              <>
                <p className="mt-2 text-[14px] text-ink-2">{t("parsed", { count: test.count })}</p>
                <table className="mt-3 w-full text-[14px]">
                  <thead>
                    <tr className="border-b border-line text-left text-meta uppercase tracking-wide text-muted">
                      <th className="py-2 font-[650]">{t("colOurs")}</th>
                      <th className="py-2 font-[650]">{t("colTheirs")}</th>
                      <th className="py-2 font-[650]">{t("colStatus")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SHOWN_FIELDS.map((f) => {
                      const path = test.mapping[f];
                      const important = IMPORTANT.includes(f);
                      return (
                        <tr key={f} className="border-b border-hairline">
                          <td className="py-2 font-[600]">{fieldLabel(f)}</td>
                          <td className="py-2 font-mono text-[13px] text-ink-2">{path ?? "—"}</td>
                          <td className="py-2">
                            <StatusPill tone={path ? "success" : important ? "warning" : "quiet"}>{path ? t("stateOk") : important ? t("stateMissing") : t("stateOptional")}</StatusPill>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {test.warnings.includes("queue") ? (
                  <div className="mt-3">
                    <Callout tone="warning" icon={icons.warn}>
                      {t("warningQueue")}
                    </Callout>
                  </div>
                ) : null}
              </>
            ) : null}
          </Card>
        ) : null}

        <Card as="section" className="p-6">
          <form action={connectAction} className="flex flex-col gap-4">
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="url" value={url} />
            <input type="hidden" name="apiKey" value={apiKey} />
            {connect && !connect.ok ? <ValidationSummary title={connect.error === "testRequired" ? t("testRequired") : t("errorInvalid")} /> : null}
            <Select label={t("freqLabel")} name="fetchIntervalMinutes" defaultValue="60">
              <option value="60">{t("freqHourly")}</option>
              <option value="240">{t("freq4h")}</option>
              <option value="1440">{t("freqDaily")}</option>
            </Select>
            <Input label={t("contactLabel")} name="techContactEmail" type="email" placeholder="drift@foretaget.se" />
            <Select label={t("queueDefaultLabel")} name="queueDefault" hint={t("queueDefaultHint")} defaultValue="">
              <option value="">{t("queueDefaultNone")}</option>
              <option value="none">{t("fieldQueue")}: {locale === "sv" ? "Ingen kö krävs" : "No queue required"}</option>
              <option value="queue">{t("fieldQueue")}: {locale === "sv" ? "Bostadskö krävs" : "Housing queue required"}</option>
              <option value="points">{t("fieldQueue")}: {locale === "sv" ? "Köpoäng används" : "Queue points used"}</option>
            </Select>
            <Button type="submit" size="lg" loading={connecting} className="self-start">
              {t("connect")}
            </Button>
            {kind !== "html" && !tested ? <p className="text-meta text-muted">{t("testRequired")}</p> : null}
          </form>
        </Card>
      </div>

      <aside className="flex flex-col gap-4">
        <Card className="p-5">
          <h2 className="text-h3">{t("rulesTitle")}</h2>
          <ul className="mt-3 flex flex-col gap-2 text-[14px] text-ink-2">
            {([1, 2, 3, 4] as const).map((n) => (
              <li key={n} className="flex gap-2">
                <span className="mt-1 text-success">{icons.check}</span>
                {t(`rule${n}`)}
              </li>
            ))}
          </ul>
        </Card>
      </aside>
    </div>
  );
}
