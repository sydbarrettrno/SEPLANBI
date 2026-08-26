const numberFormatter = new Intl.NumberFormat("pt-BR");
const percentFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

export const formatNumber = (value: number | null | undefined) =>
  value == null ? "—" : numberFormatter.format(value);

export const formatPercent = (value: number | null | undefined) =>
  value == null ? "—" : `${percentFormatter.format(value)}%`;

export const formatDays = (value: number | null | undefined) =>
  value == null ? "—" : `${numberFormatter.format(value)} dias`;

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

export function monthLabel(value: string): string {
  const [year, month] = value.split("-");
  const labels = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  return `${labels[Number(month) - 1] ?? month}/${year.slice(2)}`;
}

export function statusTone(status: string): "good" | "warning" | "critical" | "neutral" {
  const normalized = status.toLocaleUpperCase("pt-BR");
  if (normalized.includes("ENCERRADO") || normalized.includes("DISPONÍVEL")) return "good";
  if (normalized.includes("NÃO INTEGRADA") || normalized.includes("COMPLEMENTAR")) return "neutral";
  if (normalized.includes("AGUARDANDO") || normalized.includes("PARCIAL")) return "warning";
  if (normalized.includes("SUSPENSO") || normalized.includes("PARADO")) return "critical";
  return "neutral";
}
