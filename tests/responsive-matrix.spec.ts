import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const VIEWPORTS = [1920, 1440, 1366, 1024, 768, 390] as const;
const ROUTES = [
  "overview",
  "received",
  "outputs",
  "stock",
  "processes",
  "indicators",
  "construction",
  "projects",
  "kpi04",
  "kpi05",
  "kpi06",
  "kpi07",
  "kpi08",
  "kpi09",
  "kpi11",
] as const;
const SCREENSHOTS = join(process.cwd(), "outputs", "responsive-matrix");

mkdirSync(SCREENSHOTS, { recursive: true });

async function assertViewportIntegrity(page: Page, route: string, width: number) {
  await page.goto(`/#/${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".topbar")).toBeVisible();
  await expect(page.locator("main.content")).toBeVisible();

  const geometry = await page.evaluate(() => ({
    viewport: window.innerWidth,
    html: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    contentRight: document.querySelector<HTMLElement>("main.content")?.getBoundingClientRect().right ?? 0,
  }));

  expect(geometry.viewport).toBe(width);
  expect(Math.max(geometry.html, geometry.body)).toBeLessThanOrEqual(width + 1);
  expect(geometry.contentRight).toBeLessThanOrEqual(width + 1);

  if (route === "received" && width <= 1180) {
    const columns = await page.locator('.bi-page[data-panel="received"]').evaluate((element) => getComputedStyle(element).gridTemplateColumns);
    expect(columns.trim().split(/\s+/)).toHaveLength(1);
  }

  await page.screenshot({ path: join(SCREENSHOTS, `${width}-${route}.png`), fullPage: false });
}

for (const width of VIEWPORTS) {
  test(`matriz responsiva ${width}px sem overflow estrutural`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width, height: width <= 768 ? 900 : 1000 });
    for (const route of ROUTES) {
      await assertViewportIntegrity(page, route, width);
    }
  });
}
