import { expect, test } from "@playwright/test";
import { expectAccessible } from "./helpers";

test("home → search Solna → filter → detail → language switch keeps state", async ({ page }) => {
  await page.goto("/sv");
  await expectAccessible(page, "home");
  await page.getByRole("searchbox").fill("Solna");
  await page.getByRole("button", { name: "Sök bostäder" }).first().click();
  await page.waitForURL(/\/sv\/bostader\/solna/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/bostäder i Solna/);
  await expectAccessible(page, "results");

  // Rooms filter writes URL state and updates the heading.
  await page.getByRole("button", { name: "2 rum", exact: true }).click();
  await page.waitForURL(/rooms=2/);
  await expect(page.getByRole("button", { name: /Ta bort filtret 2 rum/ })).toBeVisible();

  // Language switch keeps the entity and the query.
  await page.getByRole("button", { name: "en", exact: true }).click();
  await page.waitForURL(/\/en\/homes\/solna\?.*rooms=2/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/homes in Solna/);

  // Open the first listing.
  await page.getByRole("link", { name: "Gustav III:s Boulevard 46" }).first().click();
  await page.waitForURL(/\/en\/home\/gustav-iiis-boulevard-46-solna/);
  await expect(page.getByRole("link", { name: /Apply on landlord website/ })).toHaveAttribute("target", "_blank");
  await expect(page.getByText("This home is listed by multiple sources")).toBeVisible();
  await expectAccessible(page, "detail");
});

test("removed listing keeps its page and offers similar homes", async ({ page }) => {
  await page.goto("/sv/bostad/skolgatan-3-solna");
  await expect(page.getByText("Inte längre tillgänglig").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Liknande bostäder som är lediga nu" })).toBeVisible();
  await expectAccessible(page, "removed");
});

test("empty state offers concrete recovery actions", async ({ page }) => {
  await page.goto("/sv/bostader/solna?maxRent=4000&rooms=4");
  await expect(page.getByText("Inga bostäder matchar dina filter just nu.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Höj max hyra till/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Ta bort filtret 4\+ rum/ })).toBeVisible();
});

test("municipality and landlord pages", async ({ page }) => {
  await page.goto("/sv/kommuner/solna");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Hyresrätter i Solna");
  await expect(page.getByText(/av \d+ bevakas/)).toBeVisible();
  await expectAccessible(page, "municipality");
  await page.getByRole("link", { name: "AB Bostadsstiftelsen Signalisten i Solna" }).first().click();
  await page.waitForURL(/\/sv\/hyresvardar\//);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Signalisten");
  await expectAccessible(page, "landlord");
});
