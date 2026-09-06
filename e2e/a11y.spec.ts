import { test, type Page } from "@playwright/test";
import { expectAccessible, signIn } from "./helpers";

/**
 * Axe sweep of the pages the flow tests do not visit. Detail pages are
 * reached through the first link on their index so the sweep survives
 * seed changes. Serious and critical violations fail; the rest are logged.
 */
async function firstDetail(page: Page, index: string, pattern: RegExp, context: string) {
  await page.goto(index);
  const href = await page.locator(`a[href]`).evaluateAll((as, re) => (as as HTMLAnchorElement[]).map((a) => a.getAttribute("href")!).find((h) => new RegExp(re).test(h)) ?? null, pattern.source);
  if (!href) throw new Error(`${context}: no link matching ${pattern} on ${index}`);
  await page.goto(href);
  await expectAccessible(page, context);
}

test("public pages outside the flows", async ({ page }) => {
  for (const [path, ctx] of [
    ["/sv/karta", "map"],
    ["/sv/kommuner", "municipalities"],
    ["/sv/hyresvardar", "landlords"],
    ["/sv/tackning", "coverage"],
    ["/sv/sparade", "saved"],
    ["/sv/sa-fungerar-det", "how it works"],
    ["/sv/fragor-och-svar", "faq"],
    ["/sv/kontakt", "contact"],
    ["/sv/personuppgifter", "privacy"],
    ["/sv/villkor", "terms"],
    ["/sv/om-insamling", "about collection"],
    ["/sv/for-hyresvarder", "landlord landing"],
    ["/sv/for-hyresvarder/skapa-konto", "sign-up"],
    ["/sv/portal/logga-in", "portal sign-in"],
    ["/sv/portal/glomt-losenord", "forgot password"],
    ["/sv/admin/logga-in", "admin sign-in"],
    ["/sv/finns-inte", "not found"],
  ] as const) {
    await page.goto(path);
    await expectAccessible(page, ctx);
  }
});

test("portal pages", async ({ page }) => {
  await signIn(page, "anna.lindqvist@signalisten.se", "portal");
  for (const [path, ctx] of [
    ["/sv/portal/kallor", "portal sources"],
    ["/sv/portal/kallor/ny", "portal add source"],
    ["/sv/portal/statistik", "portal statistics"],
    ["/sv/portal/konto", "portal account"],
    ["/sv/portal/bostader?status=draft", "portal drafts"],
  ] as const) {
    await page.goto(path);
    await expectAccessible(page, ctx);
  }
  await firstDetail(page, "/sv/portal/kallor", /\/portal\/kallor\/[0-9a-f-]{36}$/, "portal source detail");
  await firstDetail(page, "/sv/portal/bostader", /\/portal\/bostader\/[0-9a-f-]{36}$/, "portal home detail");
  await page.goto(page.url() + "/redigera");
  await expectAccessible(page, "portal home edit");
});

test("admin pages", async ({ page }) => {
  await signIn(page, "lead@hyrabostad.se", "admin");
  for (const [path, ctx] of [
    ["/sv/admin/kallor", "admin sources"],
    ["/sv/admin/kallor/ny", "admin add source"],
    ["/sv/admin/hyresvardar", "admin landlords"],
    ["/sv/admin/hyresvardar/ny", "admin add landlord"],
    ["/sv/admin/bostader", "admin listings"],
    ["/sv/admin/tackning", "admin coverage"],
    ["/sv/admin/installningar", "admin settings"],
  ] as const) {
    await page.goto(path);
    await expectAccessible(page, ctx);
  }
  await firstDetail(page, "/sv/admin/kallor", /\/admin\/kallor\/[0-9a-f-]{36}$/, "admin source detail");
  await firstDetail(page, "/sv/admin/hyresvardar", /\/admin\/hyresvardar\/[0-9a-f-]{36}$/, "admin landlord detail");
  await firstDetail(page, "/sv/admin/bostader", /\/admin\/bostader\/[0-9a-f-]{36}$/, "admin listing detail");
});
