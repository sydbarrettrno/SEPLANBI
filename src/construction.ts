export interface ConstructionAnnualPoint {
  year: number;
  permits: number;
  newConstruction: number;
  authorizedAreaM2: number;
  medianAreaM2: number;
  multifamily: number;
  residentialUnspecified: number;
  commercialServices: number;
  industrial: number;
  port: number;
  other: number;
}

export interface ConstructionYtdComparison {
  label: string;
  previous: number;
  current: number;
  changePercent: number;
  unit: "count" | "m2";
}

export const constructionPermitsData = {
  meta: {
    source: "Sistema IPM",
    extractedAt: "2026-09-04",
    currentCut: "2026-09-03",
    historicalFrom: 2016,
    historicalTo: 2025,
    note: "Alvará representa atividade autorizada. Para a série temporal é usada a Data de Liberação.",
  },
  totals: {
    permits: 9139,
    newConstruction: 4777,
    authorizedAreaM2: 1149029.94,
    medianAreaM2: 106.4,
  },
  annual: [
    { year: 2016, permits: 600, newConstruction: 351, authorizedAreaM2: 52393.04, medianAreaM2: 120.00, multifamily: 0, residentialUnspecified: 323, commercialServices: 13, industrial: 5, port: 0, other: 10 },
    { year: 2017, permits: 602, newConstruction: 392, authorizedAreaM2: 64360.72, medianAreaM2: 124.905, multifamily: 5, residentialUnspecified: 325, commercialServices: 15, industrial: 28, port: 0, other: 19 },
    { year: 2018, permits: 497, newConstruction: 273, authorizedAreaM2: 45236.34, medianAreaM2: 118.51, multifamily: 4, residentialUnspecified: 203, commercialServices: 11, industrial: 50, port: 0, other: 5 },
    { year: 2019, permits: 586, newConstruction: 403, authorizedAreaM2: 78809.65, medianAreaM2: 112.64, multifamily: 8, residentialUnspecified: 352, commercialServices: 14, industrial: 14, port: 0, other: 15 },
    { year: 2020, permits: 588, newConstruction: 429, authorizedAreaM2: 76457.93, medianAreaM2: 113.39, multifamily: 42, residentialUnspecified: 344, commercialServices: 22, industrial: 15, port: 0, other: 6 },
    { year: 2021, permits: 1346, newConstruction: 657, authorizedAreaM2: 92382.37, medianAreaM2: 97.47, multifamily: 93, residentialUnspecified: 529, commercialServices: 18, industrial: 15, port: 0, other: 2 },
    { year: 2022, permits: 1603, newConstruction: 864, authorizedAreaM2: 241664.03, medianAreaM2: 96.84, multifamily: 118, residentialUnspecified: 694, commercialServices: 42, industrial: 1, port: 0, other: 9 },
    { year: 2023, permits: 1162, newConstruction: 516, authorizedAreaM2: 140757.27, medianAreaM2: 95.91, multifamily: 103, residentialUnspecified: 377, commercialServices: 32, industrial: 0, port: 0, other: 4 },
    { year: 2024, permits: 1118, newConstruction: 485, authorizedAreaM2: 229847.26, medianAreaM2: 99.75, multifamily: 92, residentialUnspecified: 339, commercialServices: 43, industrial: 0, port: 0, other: 11 },
    { year: 2025, permits: 1037, newConstruction: 407, authorizedAreaM2: 127121.33, medianAreaM2: 104.00, multifamily: 86, residentialUnspecified: 291, commercialServices: 22, industrial: 0, port: 0, other: 8 },
  ] satisfies ConstructionAnnualPoint[],
  currentYtd: {
    permits: 773,
    newConstruction: 328,
    authorizedAreaM2: 155708.82,
    medianAreaM2: 104.375,
  },
  ytdComparison: [
    { label: "Alvarás totais", previous: 661, current: 773, changePercent: 16.94402420574888, unit: "count" },
    { label: "Construção nova", previous: 258, current: 328, changePercent: 27.13178294573644, unit: "count" },
    { label: "Área autorizada", previous: 88900.58, current: 155708.82, changePercent: 75.14938279727764, unit: "m2" },
  ] satisfies ConstructionYtdComparison[],
  availability: {
    coefficientOfUtilization: false,
    onerousGrant: false,
    residentialUnifamilyExplicit: false,
    logisticsExplicit: false,
  },
} as const;
