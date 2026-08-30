import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const SCREENSHOTS = join(process.cwd(), "outputs", "20260830-filtros-graficos-v16", "screenshots");
const PRIVATE_KEYS = [
  "NomeRequerente",
  "ResponsavelTecnico",
  "PessoaResponsavelExterna",
  "TipoPessoaResponsavel",
  "ObservacaoUltimoTramite",
  "ResponsavelInterno",
];

mkdirSync(SCREENSHOTS, { recursive: true });

async function recordCount(page: Page): Promise<number> {
  return Number(await page.locator("[data-record-count]").getAttribute("data-record-count"));
}

async function waitForCount(page: Page, value: number) {
  await expect.poll(() => recordCount(page)).toBe(value);
}

async function openPanel(page: Page, indicator: "received" | "outputs" | "stock") {
  await page.goto(`/#/${indicator}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(`.bi-page[data-panel="${indicator}"]`)).toBeVisible();
  await expect(page.locator("[data-record-count]")).toBeVisible();
}

async function openFilters(page: Page) {
  await page.locator(".filter-launcher").click();
  await expect(page.getByRole("dialog", { name: "Filtros do painel" })).toBeVisible();
}

function watchRuntime(page: Page) {
  const failures: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => {
    const reason = request.failure()?.errorText ?? "";
    // O React cancela consultas anteriores ao trocar filtros rapidamente.
    if (reason.includes("ERR_ABORTED")) return;
    failures.push(`requestfailed: ${request.method()} ${request.url()} ${reason}`);
  });
  return failures;
}

test("recebidos: período homólogo, cross-filter e drill-down exato", async ({ page }) => {
  const failures = watchRuntime(page);
  await openPanel(page, "received");
  await waitForCount(page, 2898);
  await expect(page.getByText("2.898", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("2.825", { exact: true }).first()).toBeVisible();

  const month = page.locator(".month-columns [data-current-value]:not([data-current-value='0'])").first();
  const monthValue = Number(await month.getAttribute("data-current-value"));
  await month.click();
  await waitForCount(page, monthValue);

  const macro = page.locator("article:has(h2:text-is('Macroprocessos')) [data-visual-key]").first();
  const macroValue = Number(await macro.getAttribute("data-visual-value"));
  await macro.click();
  await waitForCount(page, macroValue);

  const category = page.locator("article:has(h2:text-is('Recebidos por categoria')) [data-visual-key]").first();
  const categoryValue = Number(await category.getAttribute("data-visual-value"));
  await category.click();
  await waitForCount(page, categoryValue);
  await expect(page.locator(".drill-breadcrumb")).toContainText("Macroprocesso");
  await expect(page.locator(".drill-breadcrumb")).toContainText("Categoria");

  await page.getByRole("button", { name: "Drill-up" }).click();
  await waitForCount(page, macroValue);
  await page.getByRole("button", { name: "Limpar seleção" }).click();
  await waitForCount(page, 2898);
  await page.screenshot({ path: join(SCREENSHOTS, "recebidos-desktop.png"), fullPage: true });
  expect(failures).toEqual([]);
});

test("saídas: composição, saldo e seleção combinada reconciliam", async ({ page }) => {
  const failures = watchRuntime(page);
  await openPanel(page, "outputs");
  await waitForCount(page, 2293);
  await expect(page.getByText("961", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("1.332", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("+605", { exact: true }).first()).toBeVisible();

  const month = page.locator(".flow-columns [data-output-value]:not([data-output-value='0'])").first();
  const monthValue = Number(await month.getAttribute("data-output-value"));
  await month.click();
  await waitForCount(page, monthValue);

  const category = page.locator("article:has(h2:text-is('Categorias com mais saídas')) [data-visual-key]").first();
  const categoryValue = Number(await category.getAttribute("data-visual-value"));
  await category.click();
  await waitForCount(page, categoryValue);

  const outputType = page.locator("article:has(h2:text-is('Concluído e Encerrado')) [data-visual-key]").first();
  const outputTypeValue = Number(await outputType.getAttribute("data-visual-value"));
  await outputType.click();
  await waitForCount(page, outputTypeValue);
  await expect(page.locator(".drill-breadcrumb")).toContainText("Tipo de saída");

  await page.getByRole("button", { name: "Limpar seleção" }).click();
  await waitForCount(page, 2293);
  await page.screenshot({ path: join(SCREENSHOTS, "saidas-desktop.png"), fullPage: true });
  expect(failures).toEqual([]);
});

test("estoque: responsabilidade, idade, categoria e status chegam aos protocolos exatos", async ({ page }) => {
  const failures = watchRuntime(page);
  await openPanel(page, "stock");
  await waitForCount(page, 2158);
  await expect(page.getByText("1.544", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("583", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("31", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("71,5%", { exact: true }).first()).toBeVisible();

  const responsibility = page.locator(".stacked-track [data-visual-key='Fila Interna SEPLAN']");
  await responsibility.click();
  await waitForCount(page, 1544);

  const age = page.locator("article:has(h2:text-is('Faixas desde a abertura')) [data-visual-key]").first();
  const ageValue = Number(await age.getAttribute("data-visual-value"));
  await age.click();
  await waitForCount(page, ageValue);

  const category = page.locator("article:has(h2:text-is('Categorias com maior estoque')) [data-visual-key]").first();
  const categoryValue = Number(await category.getAttribute("data-visual-value"));
  await category.click();
  await waitForCount(page, categoryValue);

  const status = page.locator(".bi-status-level [data-visual-key]").first();
  const statusValue = Number(await status.getAttribute("data-visual-value"));
  await status.click();
  await waitForCount(page, statusValue);
  await expect(page.locator(".drill-breadcrumb")).toContainText("Status");

  await page.getByRole("button", { name: "Limpar seleção" }).click();
  await waitForCount(page, 2158);
  await page.screenshot({ path: join(SCREENSHOTS, "estoque-desktop.png"), fullPage: true });
  expect(failures).toEqual([]);
});

test("API pública não contém campos privados e exporta somente a allowlist", async ({ request }) => {
  const response = await request.get("/api?action=analytics&indicator=stock&include_records=1&limit=25");
  expect(response.ok()).toBeTruthy();
  const body = await response.text();
  for (const key of PRIVATE_KEYS) expect(body).not.toContain(`\"${key}\"`);

  const csv = await request.get("/api?action=analytics-export&indicator=stock");
  expect(csv.ok()).toBeTruthy();
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const header = (await csv.text()).replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0];
  expect(header).toBe("protocol,protocol_id,opened,last_movement,macroprocess,category,status,days_without_movement,sector");
});

test("filtros globais, pesquisa e limpeza afetam o mesmo universo analítico", async ({ page }) => {
  await openPanel(page, "received");
  await waitForCount(page, 2898);

  await openFilters(page);
  await page.screenshot({ path: join(SCREENSHOTS, "filtros-drawer-desktop.png"), fullPage: true });
  await page.getByLabel("Mês").selectOption("1");
  await page.getByLabel("Macroprocesso").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect.poll(() => recordCount(page)).toBeLessThan(2898);
  await expect(page.locator(".filter-launcher")).toContainText("2 ativos");

  await openFilters(page);
  await expect(page.locator(".active-filter-strip")).toContainText("Mês: 1");
  await expect(page.locator(".active-filter-strip")).toContainText("Macroprocesso:");
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await waitForCount(page, 2898);

  const protocol = (await page.locator(".protocol-link").first().textContent())?.trim() ?? "";
  await openFilters(page);
  await page.getByLabel("Localizar protocolo").fill(protocol);
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await waitForCount(page, 1);
  await openFilters(page);
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await waitForCount(page, 2898);

  await page.goto("/#/stock");
  await waitForCount(page, 2158);
  await openFilters(page);
  await page.getByLabel("Status").selectOption("Em Análise");
  await page.getByLabel("Setor").selectOption({ index: 1 });
  await page.getByLabel("Responsabilidade").selectOption("Interno");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await openFilters(page);
  await expect(page.locator(".active-filter-strip")).toContainText("Status: Em Análise");
  await expect(page.locator(".active-filter-strip")).toContainText("Setor:");
  await expect(page.locator(".active-filter-strip")).toContainText("Responsabilidade: Interno");
  await expect.poll(() => recordCount(page)).toBeLessThan(2158);
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await waitForCount(page, 2158);
});

test("filtro lateral, escala dos gráficos e cores semânticas ficam legíveis", async ({ page }) => {
  await openPanel(page, "received");
  await expect(page.locator(".filter-bar")).toHaveCount(0);
  await openFilters(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Filtros do painel" })).toHaveCount(0);

  const currentBar = page.locator(".month-bars .current").first();
  const barWidth = (await currentBar.boundingBox())?.width ?? 0;
  const valueFont = Number.parseFloat(await page.locator(".month-values").first().evaluate((element) => getComputedStyle(element).fontSize));
  expect(barWidth).toBeGreaterThanOrEqual(24);
  expect(valueFont).toBeGreaterThanOrEqual(12);

  await openPanel(page, "stock");
  const internalColor = await page.locator(".stacked-track [data-visual-key='Fila Interna SEPLAN']").evaluate((element) => getComputedStyle(element).backgroundColor);
  const externalColor = await page.locator(".stacked-track [data-visual-key='Aguardando Responsável Externo']").evaluate((element) => getComputedStyle(element).backgroundColor);
  const paralyzedColor = await page.locator(".stacked-track [data-visual-key='Paralisado']").evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(new Set([internalColor, externalColor, paralyzedColor]).size).toBe(3);

  const youngestColor = await page.locator("[data-visual-key='0–30 dias'] > i em").evaluate((element) => getComputedStyle(element).backgroundColor);
  const oldestColor = await page.locator("[data-visual-key='181+ dias'] > i em").evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(youngestColor).not.toBe(oldestColor);
});

test("os três painéis são responsivos no viewport menor", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const indicator of ["received", "outputs", "stock"] as const) {
    await openPanel(page, indicator);
    const viewport = await page.evaluate(() => ({ body: document.body.scrollWidth, html: document.documentElement.scrollWidth, viewport: window.innerWidth }));
    expect(Math.max(viewport.body, viewport.html)).toBeLessThanOrEqual(viewport.viewport);
    await page.screenshot({ path: join(SCREENSHOTS, `${indicator}-mobile.png`), fullPage: true });
  }
});
