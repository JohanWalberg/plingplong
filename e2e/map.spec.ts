import { expect, test } from "@playwright/test";

/** A patch of Järfälla with nothing in it, which is how someone lands on an empty view. */
const EMPTY_VIEW = "/sv/karta?bbox=17.80,59.40,17.88,59.46";

const MAP = { role: "region" as const, name: "Karta över lediga bostäder" };

/** Drags the map sideways, the way a visitor pans it. */
async function panMap(page: import("@playwright/test").Page) {
  const box = await page.getByRole(MAP.role, { name: MAP.name }).boundingBox();
  if (!box) throw new Error("the map has no box to drag");
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.65, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, y, { steps: 12 });
  await page.mouse.up();
}

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

test("jumping to one of the nearest homes searches where it lands", async ({ page }) => {
  // The opening fit must not consume the visitor's first interaction: for a
  // while it did, and the map looked broken until you moved it twice.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(EMPTY_VIEW);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1000);
  // The opening fit leaves the bounds from the URL alone.
  await expect(page).toHaveURL(/bbox=17\.80,59\.40/);

  // Picking a home out of the "closest to here" list is an explicit ask to go
  // there, so it re-searches on arrival rather than asking a second time.
  await page.getByRole("button", { name: /Malmvägen 6/ }).click();
  await expect(page).not.toHaveURL(/bbox=17\.80,59\.40/, { timeout: 10_000 });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/bostad/, { timeout: 10_000 });
});

test("panning offers to search the new area instead of searching on its own", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(EMPTY_VIEW);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1000);

  const searchArea = page.getByRole("button", { name: "Sök i det här området" });
  await expect(searchArea).toBeHidden();

  await panMap(page);
  // The pan itself changes nothing: the visitor is still looking around.
  await expect(searchArea).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(/bbox=17\.80,59\.40/);

  await searchArea.click();
  await expect(page).not.toHaveURL(/bbox=17\.80,59\.40/, { timeout: 10_000 });
  await expect(searchArea).toBeHidden();
});

test("searching a place from the map keeps you on the map", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/sv/karta");
  await page.waitForLoadState("networkidle").catch(() => {});

  await page.getByRole("combobox", { name: /Sök efter kommun/ }).fill("Solna");
  await page.getByRole("option", { name: /Solna/ }).first().click();

  // The whole point: the map answers the search itself.
  await expect(page).toHaveURL(/\/sv\/karta\?.*place=solna/, { timeout: 10_000 });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Solna/, { timeout: 10_000 });
  await expect(page.getByRole(MAP.role, { name: MAP.name })).toBeVisible();

  // The map glides to the place, and that glide is not the visitor panning:
  // offering to search the view it was just told to show would be nonsense.
  await page.waitForTimeout(2000);
  await expect(page.getByRole("button", { name: "Sök i det här området" })).toBeHidden();
});

test("filters are usable from the map and keep the place", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/sv/karta?place=stockholm");
  await page.waitForLoadState("networkidle").catch(() => {});

  await page.getByRole("button", { name: /Filter/ }).click();
  await page.getByRole("button", { name: "2 rum", exact: true }).click();

  // The filter must not throw the scope away: place survives, and so does the map.
  await expect(page).toHaveURL(/place=stockholm/, { timeout: 10_000 });
  await expect(page).toHaveURL(/rooms=2/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Stockholm/);
});
