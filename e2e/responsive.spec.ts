import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * Nothing may scroll sideways on a phone. The usual cause is a grid or flex
 * item, whose default min-width is its content, stretching the whole column;
 * the other is an absolutely positioned child (a visually hidden label)
 * escaping a scroll box that is not itself the containing block.
 */
const PHONE = { width: 390, height: 844 };

async function expectNoSideScroll(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle").catch(() => {});
  const { scrollWidth, viewport, widest } = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const clipped = (el: Element) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "auto" || ox === "scroll" || ox === "hidden") return true;
      }
      return false;
    };
    let widest = "";
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      const b = el.getBoundingClientRect();
      if (b.right <= vw + 1 || clipped(el)) continue;
      const parent = el.parentElement?.getBoundingClientRect();
      if (parent && parent.right > vw + 1) continue;
      widest ||= `${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ").slice(0, 4).join(".")}`;
    }
    return { scrollWidth: document.documentElement.scrollWidth, viewport: vw, widest };
  });
  expect(scrollWidth, `${path} scrolls sideways${widest ? `, widest: ${widest}` : ""}`).toBeLessThanOrEqual(viewport + 1);
}

test("public pages fit a phone", async ({ page }) => {
  await page.setViewportSize(PHONE);
  for (const path of ["/sv", "/sv/bostader/solna", "/sv/bostad/gustav-iiis-boulevard-46-solna", "/sv/karta", "/sv/sparade", "/sv/kommuner/solna", "/sv/hyresvardar", "/sv/tackning", "/sv/for-hyresvarder", "/sv/for-hyresvarder/skapa-konto", "/en/homes/solna"]) {
    await expectNoSideScroll(page, path);
  }
});

test("portal pages fit a phone", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await signIn(page, "anna.lindqvist@signalisten.se", "portal");
  for (const path of ["/sv/portal/bostader", "/sv/portal/bostader/ny", "/sv/portal/kallor", "/sv/portal/kallor/ny", "/sv/portal/statistik", "/sv/portal/konto"]) {
    await expectNoSideScroll(page, path);
  }
});

test("admin pages fit a phone", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await signIn(page, "lead@plingplong.se", "admin");
  for (const path of ["/sv/admin", "/sv/admin/kallor", "/sv/admin/hyresvardar/ansokningar", "/sv/admin/bostader", "/sv/admin/dubbletter", "/sv/admin/hyresvardar", "/sv/admin/tackning", "/sv/admin/installningar"]) {
    await expectNoSideScroll(page, path);
  }
});
