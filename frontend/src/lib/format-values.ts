const NUMBER_FORMATTER = new Intl.NumberFormat("es-AR");
const FILE_SIZE_FORMATTER = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 1,
});

export function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : NUMBER_FORMATTER.format(value);
}

export function formatFileSize(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) {
    return "—";
  }

  const units = ["B", "KB", "MB", "GB"] as const;
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${FILE_SIZE_FORMATTER.format(size)} ${units[unitIndex]}`;
}

export function abbreviateChecksum(
  value: string | null | undefined,
): string {
  if (!value) return "—";
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}
