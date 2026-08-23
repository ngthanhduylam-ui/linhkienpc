export function formatWarrantyNote(note) {
  const rawValue = note === null || note === undefined ? "" : String(note).trim();

  if (!rawValue) return "Không ghi chú";
  return rawValue;
}
