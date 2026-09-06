import { expect, test, type Page } from "@playwright/test";

async function openPanel(page: Page, indicator: "received" | "outputs" | "stock") {
  await page.goto(`/#/${indicator}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(`.bi-page[data-panel="${indicator}"]`)).toBeVisible();
  await expect(page.locator("[data-record-count]")).toBeVisible();
}

async function recordCount(page: Page) {
  return Number(await page.locator("[data-record-count]").getAttribute("data-record-count"));
}

test("recebidos mantém contexto da própria dimensão ao filtrar", async ({ page }) => {
  await openPanel(page, "received");

  const monthButtons = page.locator(".month-columns [data-month]");
  const monthCount = await monthButtons.count();
  expect(monthCount).toBeGreaterThan(1);
  const firstNonZeroMonth = page.locator(".month-columns [data-current-value]:not([data-current-value='0'])").first();
  await firstNonZeroMonth.click();
  await expect(page.locator(".month-columns [data-month]")).toHaveCount(monthCount);
  await expect(firstNonZeroMonth).toHaveClass(/selected/);

  await page.getByRole("button", { name: "Limpar seleção" }).click();
  const macroBars = page.locator("article:has(h2:text-is('Famílias de Processos')) [data-visual-key]");
  const macroCount = await macroBars.count();
  expect(macroCount).toBeGreaterThan(1);
  const firstMacro = macroBars.first();
  const selectedKey = await firstMacro.getAttribute("data-visual-key");
  const selectedValue = Number(await firstMacro.getAttribute("data-visual-value"));
  await firstMacro.click();
  await expect.poll(() => recordCount(page)).toBe(selectedValue);
  await expect(page.locator("article:has(h2:text-is('Famílias de Processos')) [data-visual-key]")).toHaveCount(macroCount);
  await expect(page.locator(`article:has(h2:text-is('Famílias de Processos')) [data-visual-key="${selectedKey}"]`)).toHaveClass(/selected/);
});

test("saídas mantém tipos de saída como contexto após seleção", async ({ page }) => {
  await openPanel(page, "outputs");
  const bars = page.locator("article:has(h2:text-is('Concluído e Encerrado')) [data-visual-key]");
  const count = await bars.count();
  expect(count).toBeGreaterThan(1);
  const first = bars.first();
  const value = Number(await first.getAttribute("data-visual-value"));
  await first.click();
  await expect.poll(() => recordCount(page)).toBe(value);
  await expect(page.locator("article:has(h2:text-is('Concluído e Encerrado')) [data-visual-key]")).toHaveCount(count);
  await expect(first).toHaveClass(/selected/);
});

test("estoque mantém responsabilidades como contexto após seleção", async ({ page }) => {
  await openPanel(page, "stock");
  const items = page.locator(".composition-legend [data-visual-key]");
  const count = await items.count();
  expect(count).toBeGreaterThan(1);
  const internal = page.locator(".composition-legend [data-visual-key='Fila Interna SEPLAN']");
  await internal.click();
  await expect.poll(() => recordCount(page)).toBe(1545);
  await expect(page.locator(".composition-legend [data-visual-key]")).toHaveCount(count);
  await expect(internal).toHaveClass(/selected/);
});
