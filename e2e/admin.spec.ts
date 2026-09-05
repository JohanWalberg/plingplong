import { expect, test } from "@playwright/test";
import { expectAccessible, signIn } from "./helpers";

test("lead approves an application and the landlord appears", async ({ page }) => {
  await signIn(page, "lead@hyrabostad.se", "admin");
  await expectAccessible(page, "admin overview");
  await page.goto("/sv/admin/hyresvardar/ansokningar");
  await expectAccessible(page, "admin queue");
  // Pick whichever application is first in the pending list (the seed may already have been used).
  const first = page.getByRole("link", { name: /Ansluter källa|Publicerar manuellt/ }).first();
  await expect(first).toBeVisible();
  const name = (await first.locator("span.font-\\[650\\]").first().innerText()).trim();
  await first.click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await page.getByRole("button", { name: "Godkänn och öppna publicering" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Godkänn och öppna publicering" }).click();
  await expect(page.getByRole("dialog")).toBeHidden(); // the action has completed when the dialog closes
  await page.goto("/sv/admin/hyresvardar/ansokningar?tab=decided");
  await expect(page.getByRole("link", { name })).toBeVisible();
  await page.goto(`/sv/admin/hyresvardar?q=${encodeURIComponent(name.split(" ")[0])}`);
  await expect(page.getByRole("link", { name })).toBeVisible();
});

test("support cannot decide applications", async ({ page }) => {
  await signIn(page, "support@hyrabostad.se", "admin");
  await page.goto("/sv/admin/hyresvardar/ansokningar");
  await expect(page.getByRole("button", { name: "Godkänn och öppna publicering" })).toBeDisabled();
});

test("duplicate review and source detail render", async ({ page }) => {
  await signIn(page, "lead@hyrabostad.se", "admin");
  await page.goto("/sv/admin/dubbletter");
  await expect(page.getByText(/Träffsäkerhet 0,94/)).toBeVisible();
  await expectAccessible(page, "admin duplicates");
  await page.goto("/sv/admin/kallor");
  await page.getByRole("link", { name: /bostad.stockholm.se\/lediga-bostader/ }).click();
  await expect(page.getByRole("heading", { name: "Körningar" })).toBeVisible();
});
