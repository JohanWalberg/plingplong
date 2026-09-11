import { expect, test } from "@playwright/test";
import { expectAccessible, signIn } from "./helpers";

test("lead approves an application and the landlord appears", async ({ page }) => {
  await signIn(page, "lead@plingplong.se", "admin");
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
  await signIn(page, "support@plingplong.se", "admin");
  // The needs-info tab always has an undecided application in the seed.
  await page.goto("/sv/admin/hyresvardar/ansokningar?tab=needs_info");
  await expect(page.getByRole("button", { name: "Godkänn och öppna publicering" })).toBeDisabled();
});

test("duplicate review and source detail render", async ({ page }) => {
  await signIn(page, "lead@plingplong.se", "admin");
  await page.goto("/sv/admin/dubbletter");
  await expect(page.getByText(/Träffsäkerhet 0,94/)).toBeVisible();
  await expectAccessible(page, "admin duplicates");
  await page.goto("/sv/admin/kallor");
  await page.getByRole("link", { name: /bostad.stockholm.se\/lediga-bostader/ }).click();
  await expect(page.getByRole("heading", { name: "Körningar" })).toBeVisible();
});

test("lead edits a listing, removes it from search and restores it", async ({ page }) => {
  await signIn(page, "lead@plingplong.se", "admin");
  await page.goto("/sv/admin/bostader?q=Hornsgatan");
  await page.getByRole("link", { name: "Hornsgatan 152" }).click();
  await page.getByLabel("Hyra").fill("9990");
  await page.getByRole("button", { name: "Spara", exact: true }).click();
  await expect(page.getByText("Uppgifterna är sparade.")).toBeVisible();
  await expect(page.locator("td", { hasText: "rent_monthly" }).first()).toBeVisible();

  await page.getByRole("button", { name: "Ta bort från sökningen" }).click();
  await page.getByRole("dialog").getByLabel("Skäl").fill("Testtakedown");
  await page.getByRole("dialog").getByRole("button", { name: "Ta bort från sökningen" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  // A takedown is not the same as a home the feed stopped listing: the page goes entirely.
  expect((await page.goto("/sv/bostad/hornsgatan-152-stockholm"))?.status()).toBe(404);

  await page.goto("/sv/admin/bostader?q=Hornsgatan");
  await page.getByRole("link", { name: "Hornsgatan 152" }).click();
  await expect(page.getByText("Nedtagen").first()).toBeVisible();
  await page.getByRole("button", { name: "Visa igen" }).click();
  await expect(page.getByRole("button", { name: "Ta bort från sökningen" })).toBeVisible();
  // Restoring clears the takedown, so the page comes back.
  expect((await page.goto("/sv/bostad/hornsgatan-152-stockholm"))?.status()).toBe(200);
});
