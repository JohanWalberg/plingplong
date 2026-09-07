import { expect, test } from "@playwright/test";

/** A patch of Järfälla with nothing in it, which is how someone lands on an empty view. */
const EMPTY_VIEW = "/sv/karta?bbox=17.80,59.40,17.88,59.46";

test("an empty map view says what it is missing and offers a way out", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(EMPTY_VIEW);
  await page.waitForLoadState("networkidle").catch(() => {});

  // Not just "no homes": how many there are, and the closest ones with distances.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Inga bostäder i det här kartutsnittet");
  await expect(page.getByRole("heading", { name: "Närmast härifrån" })).toBeVisible();
  await expect(page.getByText(/\d+([.,]\d+)? km härifrån/).first()).toBeVisible();

  const showAll = page.getByRole("link", { name: /Visa alla \d+ lediga bostäder/ });
  await expect(showAll).toBeVisible();
  await showAll.click();
  await expect(page).toHaveURL(/\/sv\/karta$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/\d+ bostäder/);
});

test("the first map movement updates the results", async ({ page }) => {
  // The opening fit must not consume the visitor's first interaction: for a
  // while it did, and the map looked broken until you moved it twice.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(EMPTY_VIEW);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1000);
  // The opening fit leaves the bounds from the URL alone.
  await expect(page).toHaveURL(/bbox=17\.80,59\.40/);

  await page.getByRole("button", { name: /Malmvägen 6/ }).click();
  await expect(page).not.toHaveURL(/bbox=17\.80,59\.40/, { timeout: 10_000 });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/bostad/, { timeout: 10_000 });
});
