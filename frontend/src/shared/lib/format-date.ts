export function formatDate(iso: string): string {
  // Date-only strings (YYYY-MM-DD) are parsed as UTC midnight by the spec,
  // which shifts the displayed date in non-UTC timezones. Splitting and
  // constructing with local midnight avoids the offset.
  const [year, month, day] = iso.split('T')[0].split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
