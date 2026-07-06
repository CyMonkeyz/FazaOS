export function envValue(...names: string[]) {
  for (const name of names) {
    const raw = process.env[name]?.trim();
    const value =
      raw?.startsWith('"') && raw.endsWith('"')
        ? raw.slice(1, -1).trim()
        : raw?.startsWith("'") && raw.endsWith("'")
          ? raw.slice(1, -1).trim()
          : raw;
    if (value) return value;
  }
  return undefined;
}

export function requiredEnv(label: string, ...names: string[]) {
  const value = envValue(...names);
  if (!value) throw new Error(`${label} belum dikonfigurasi di environment server.`);
  return value;
}
