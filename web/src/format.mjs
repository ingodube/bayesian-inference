export function formatNumber(value) {
  if (value == null || !Number.isFinite(value)) return "Not defined";
  const magnitude = Math.abs(value);
  return new Intl.NumberFormat("en", {
    maximumSignificantDigits: 6,
    notation: magnitude !== 0 && (magnitude >= 1e7 || magnitude < 1e-4) ? "scientific" : "standard",
  }).format(value);
}
