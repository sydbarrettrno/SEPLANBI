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
  await expect(page.locator(`.app-shell[data-route="${route}"]`)).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".topbar")).toBeVisible();
  await expect(page.locator("main.content")).toBeVisible();

  // Algumas rotas montam tabelas/matrizes após a primeira pintura do React.
  // Aguarda o layout convergir antes de medir overflow estrutural, sem esconder
  // um overflow persistente: se não estabilizar em 5 s, a asserção detalhada
  // abaixo ainda falha e lista os elementos ofensores.
  await page
    .waitForFunction(
      (limit) =>
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= limit + 1,
      width,
      { timeout: 5_000, polling: 100 },
    )
    .catch(() => undefined);

  const geometry = await page.evaluate(() => {
    const viewport = window.innerWidth;
    const offenders = Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          tag: element.tagName.toLowerCase(),
          className: typeof element.className === "string" ? element.className : "",
          left: Math.round(rect.left * 10) / 10,
          right: Math.round(rect.right * 10) / 10,
          width: Math.round(rect.width * 10) / 10,
          overflowX: style.overflowX,
          position: style.position,
        };
      })
      .filter((item) => item.width > 0 && (item.right > viewport + 1 || item.left < -1))
      .sort((a, b) => Math.max(b.right - viewport, -b.left) - Math.max(a.right - viewport, -a.left))
      .slice(0, 12);

    return {
      viewport,
      html: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      contentRight: document.querySelector<HTMLElement>("main.content")?.getBoundingClientRect().right ?? 0,
      offenders,
    };
  });

  expect(geometry.viewport).toBe(width);
  expect(
    Math.max(geometry.html, geometry.body),
    `${route} @ ${width}px overflow; offenders=${JSON.stringify(geometry.offenders)}`,
  ).toBeLessThanOrEqual(width + 1);
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
