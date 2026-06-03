export function flattenMessages(messages: Record<string, unknown>, prefix = ''): Record<string, string> {
  const entries: Array<[string, string]> = [];

  for (const [key, value] of Object.entries(messages)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      entries.push([nextKey, value]);
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      entries.push(...Object.entries(flattenMessages(value as Record<string, unknown>, nextKey)));
    }
  }

  return Object.fromEntries(entries);
}
