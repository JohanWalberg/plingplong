import { expect, test } from "@playwright/test";
import { expectAccessible, signIn } from "./helpers";

test("owner publishes a home, it appears publicly, then unpublishes it", async ({ page }) => {
  await signIn(page, "anna.lindqvist@signalisten.se", "portal");
  await expectAccessible(page, "portal dashboard");
  await page.goto("/sv/portal/bostader/ny");
  await expectAccessible(page, "portal add");

  const address = `Testgatan ${Date.now() % 1000}`;
  await page.getByLabel("Gatuadress").fill(address);
  await page.getByLabel("Postnummer").fill("169 73");
  await page.getByLabel("Kommun").selectOption({ label: "Solna" });
  await page.getByLabel("Område").fill("Arenastaden");
  await page.getByLabel("Månadshyra").fill("9900");
  await page.getByLabel("Antal rum").fill("2");
  await page.getByLabel("Boarea").fill("55");
  await page.getByLabel("Köpoäng används").check();
  await page.getByLabel("Ansökningslänk").fill("https://signalisten.se/ledigt/test");
  await page.getByRole("button", { name: "Publicera bostaden" }).click();
  await page.waitForURL(/\/publicerad/);
  await expect(page.getByText("Bostaden är publicerad.")).toBeVisible();

  // Public page shows the direct-published mark.
  const slug = `${address.toLowerCase().replace(/\s+/g, "-")}-solna`;
  await page.goto(`/sv/bostad/${slug}`);
  await expect(page.getByText("Publicerad av hyresvärden").first()).toBeVisible();

  // Unpublish from the manage page.
  await page.goto("/sv/portal/bostader");
  await page.getByRole("link", { name: address }).first().click();
  await page.getByRole("button", { name: "Avpublicera" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Avpublicera" }).click();
  await expect(page.getByText("Avpublicerad").first()).toBeVisible();
  await page.goto(`/sv/bostad/${slug}`);
  await expect(page.getByText("Inte längre tillgänglig").first()).toBeVisible();
});

test("editor cannot publish", async ({ page }) => {
  await signIn(page, "redaktor@signalisten.se", "portal");
  await page.goto("/sv/portal/bostader/ny");
  await expect(page.getByRole("button", { name: "Publicera bostaden" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Spara utkast" })).toBeVisible();
});

test("validation summary appears on publish with missing fields", async ({ page }) => {
  await signIn(page, "anna.lindqvist@signalisten.se", "portal");
  await page.goto("/sv/portal/bostader/ny");
  await page.getByLabel("Gatuadress").fill("Ofullständig 1");
  await page.getByLabel("Kommun").selectOption({ label: "Solna" });
  await page.getByRole("button", { name: "Publicera bostaden" }).click();
  await expect(page.getByRole("alert").first()).toContainText(/uppgifter saknas|uppgift saknas/);
});
