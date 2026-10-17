/** Preserve live balances while editing metadata, and reject stale explicit corrections. */
export function financialPatch<T extends Record<string, unknown>>(payload: T, original: Record<string, unknown> | undefined | null, fields: string[], current?: Record<string, unknown>): T {
  const patch = {...payload};
  if (!original) return patch;
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(patch,field)) continue;
    const intended=Number(patch[field] ?? 0), previous=Number(original[field] ?? 0);
    if (!Number.isFinite(intended)) throw new Error(`${field} tidak valid.`);
    if (intended === previous) delete patch[field];
    else if (current && Number(current[field] ?? 0) !== previous) throw new Error(`Nilai ${field} sudah berubah sejak form dibuka. Muat ulang data sebelum melakukan koreksi.`);
  }
  return patch;
}
