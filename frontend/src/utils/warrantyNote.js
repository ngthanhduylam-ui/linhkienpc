export function formatWarrantyNote(note) {
  const rawValue = note === null || note === undefined ? "" : String(note).trim();

  if (!rawValue) return "Không ghi chú";
  if (rawValue.toLowerCase() === "không ghi chú") return "Không ghi chú";

  const compactSpaces = rawValue.replace(/\s+/g, " ");
  const warrantyMatch = compactSpaces.match(/^bh\s*(.+)$/i);

  if (warrantyMatch) {
    return `BH ${warrantyMatch[1].trim()}`;
  }

  return compactSpaces;
}
