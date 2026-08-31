export function recordMatchesSearch(
  record: Record<string, unknown>,
  search: string,
  fields: string[],
) {
  const needle = search.trim().toLowerCase();
  if (!needle) {
    return true;
  }

  return fields.some((field) => {
    const value = record[field];
    return typeof value === "string" && value.toLowerCase().includes(needle);
  });
}
