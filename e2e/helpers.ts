import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export const PASSWORD = "hyrabostad-dev-1234";

/** Fails on serious and critical WCAG violations; logs the rest. */
export async function expectAccessible(page: Page, context: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude(".maplibregl-map").analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  if (results.violations.length) console.log(`[axe] ${context}:`, results.violations.map((v) => `${v.impact} ${v.id} (${v.nodes.length})`).join(", "));
  expect(serious, `${context}: ${serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`).join("\n")}`).toEqual([]);
}

export async function signIn(page: Page, email: string, surface: "portal" | "admin") {
  await page.goto(surface === "portal" ? "/sv/portal/logga-in" : "/sv/admin/logga-in");
  await page.getByLabel("E-postadress").fill(email);
  await page.getByLabel("Lösenord", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Logga in" }).click();
  await page.waitForURL(surface === "portal" ? /\/sv\/portal\/bostader/ : /\/sv\/admin$/);
}
