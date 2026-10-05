// Match the existing note-group key semantics; never use this key as display/storage text.
function noteKey(note) {
  return note.trim().toUpperCase().replace(/\s+/g, "");
}

export function getInventoryNoteSuggestions(groups, query = "") {
  const seen = new Set();
  const filter = noteKey(query);
  return (Array.isArray(groups) ? groups : []).flatMap((group) => {
    const note = typeof group?.note === "string" ? group.note.trim() : "";
    const key = noteKey(note);
    if (group?.is_no_note || !key || key === "__NO_NOTE__" || key === "KHÔNGGHICHÚ" || seen.has(key)) return [];
    seen.add(key);
    return key.includes(filter) ? [note] : [];
  });
}
