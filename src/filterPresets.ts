export interface FilterPreset {
  id: string;
  name: string;
  categories: string[];
  builtin?: boolean;
}

const STORAGE_KEY = "seplanbi.filter-presets.v1";
const MAX_PRESETS = 20;
const MAX_NAME_LENGTH = 48;

export const BUILTIN_FILTER_PRESETS: FilterPreset[] = [
  {
    id: "processos-de-obra",
    name: "Processos de Obra",
    builtin: true,
    categories: [
      "Alvará Atendimento",
      "Alvará de Ampliação",
      "Alvará de Construção",
      "Alvará de Demolição",
      "Alvará de Desdobro",
      "Alvará de Reforma",
      "Alvará de Regularização",
      "Alvará de Unificação",
      "Alvará Modificativo",
      "Anuência Administrativa",
      "Arborização Urbana",
      "Desarquivamento de Protocolo",
      "Fiscalização",
      "Habite-se",
      "Isenção de ISS",
      "Parcelamento do Solo",
      "Pavimentação Comunitária",
      "Rebaixamento de Guia da Calçada",
      "Retificação de Área",
    ],
  },
];

function cleanName(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_NAME_LENGTH) : "";
}

function cleanCategories(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))).slice(0, 100);
}

export function loadCustomFilterPresets(): FilterPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_PRESETS).flatMap((item, index) => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Record<string, unknown>;
      const name = cleanName(candidate.name);
      const categories = cleanCategories(candidate.categories);
      if (!name || !categories.length) return [];
      const rawId = typeof candidate.id === "string" ? candidate.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) : "";
      return [{ id: rawId || `custom-${index}`, name, categories }];
    });
  } catch {
    return [];
  }
}

export function saveCustomFilterPresets(presets: FilterPreset[]): void {
  if (typeof window === "undefined") return;
  const safe = presets.slice(0, MAX_PRESETS).map((preset, index) => ({
    id: preset.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || `custom-${index}`,
    name: cleanName(preset.name),
    categories: cleanCategories(preset.categories),
  })).filter((preset) => preset.name && preset.categories.length);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
}

export function allFilterPresets(custom = loadCustomFilterPresets()): FilterPreset[] {
  return [...BUILTIN_FILTER_PRESETS, ...custom];
}

export function presetCategoryValue(preset: FilterPreset, availableCategories: string[]): string {
  const allowed = new Set(availableCategories);
  return availableCategories.filter((category) => allowed.has(category) && preset.categories.includes(category)).join("|");
}

export function findPresetByCategoryValue(categoryValue: string): FilterPreset | null {
  if (!categoryValue) return null;
  const normalized = categoryValue.split("|").map((item) => item.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR")).join("|");
  for (const preset of allFilterPresets()) {
    const presetValue = preset.categories.slice().sort((a, b) => a.localeCompare(b, "pt-BR")).join("|");
    if (presetValue === normalized) return preset;
  }
  return null;
}
