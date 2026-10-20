const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Normalize the optional `deletedIds` of a sync PUT body.
 *
 * Returns `null` when the field is present but not an array of strings (the
 * route answers 400). Otherwise keeps only UUID-shaped ids, drops any id that
 * is also being upserted in `items`, and removes duplicates.
 */
export function normalizeDeletedIds(
  raw: unknown,
  items: ReadonlyArray<{ id?: unknown }>,
): string[] | null {
  if (raw === undefined) return []
  if (!Array.isArray(raw) || !raw.every((id) => typeof id === 'string')) {
    return null
  }

  const upserted = new Set(items.map((item) => item?.id))
  const seen = new Set<string>()
  for (const id of raw as string[]) {
    if (UUID_PATTERN.test(id) && !upserted.has(id)) seen.add(id)
  }
  return [...seen]
}
