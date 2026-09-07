import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

// Runs last (file name): closing the seeded landlord removes its users, so reseed afterwards.
test("owner closes the landlord account; users are gone and homes unpublished", async ({ page }) => {
  await signIn(page, "anna.lindqvist@signalisten.se", "portal");
  await page.goto("/sv/portal/konto");
  await page.getByRole("button", { name: "Avsluta kontot" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Skriv organisationens namn för att bekräfta").fill("fel namn");
  await dialog.getByRole("button", { name: "Avsluta kontot" }).click();
  await expect(dialog.getByText("Namnet stämmer inte.")).toBeVisible();
  await dialog.getByLabel("Skriv organisationens namn för att bekräfta").fill("AB Bostadsstiftelsen Signalisten i Solna");
  await dialog.getByRole("button", { name: "Avsluta kontot" }).click();
  await page.waitForURL(/\/portal\/logga-in/);

  // The direct listing is now unpublished publicly.
  await page.goto("/sv/bostad/solnavagen-51-solna");
  await expect(page.getByText("Inte längre tillgänglig").first()).toBeVisible();

  // Closing the account is an objection, so what the feed put in search goes with it.
  await page.goto("/sv/bostad/rasundavagen-102-solna");
  await expect(page.getByText("Inte längre tillgänglig").first()).toBeVisible();
  await page.goto("/sv/bostader/solna");
  await expect(page.getByRole("link", { name: /Råsundavägen 102/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Hagalundsgatan 17/ })).toHaveCount(0);
  // A home another landlord's source also publishes stays: only this landlord withdrew.
  await expect(page.getByRole("link", { name: /Gustav III/ })).toHaveCount(1);

  // The owner can no longer sign in.
  await page.goto("/sv/portal/logga-in");
  await page.getByLabel("E-postadress").fill("anna.lindqvist@signalisten.se");
  await page.getByLabel("Lösenord", { exact: true }).fill("hyrabostad-dev-1234");
  await page.getByRole("button", { name: "Logga in" }).click();
  await expect(page.getByRole("alert").first()).toContainText("Fel e-postadress eller lösenord.");
});
