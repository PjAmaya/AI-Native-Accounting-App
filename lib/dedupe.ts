function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function buildDedupeKey(name: string, postalCode: string) {
  const key = `${normalize(name)}|${normalize(postalCode)}`;
  return key.startsWith("|") || key.endsWith("|") ? null : key;
}
