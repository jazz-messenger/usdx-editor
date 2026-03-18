/**
 * MusicBrainz recording search — returns the earliest known release year
 * for a given artist + title, or null if nothing useful is found.
 *
 * API docs: https://musicbrainz.org/doc/MusicBrainz_API/Search
 * CORS:     supported for browser clients on https://musicbrainz.org/ws/2/
 * Rate:     max 1 req/s without auth token (fine for single-song lookups)
 */
export async function lookupReleaseYear(
  artist: string,
  title: string
): Promise<number | null> {
  if (!artist.trim() || !title.trim()) return null

  // Strip double-quotes to avoid breaking the Lucene query
  const a = artist.replace(/"/g, '')
  const t = title.replace(/"/g, '')
  const query = `recording:"${t}" AND artist:"${a}"`
  const url =
    `https://musicbrainz.org/ws/2/recording` +
    `?query=${encodeURIComponent(query)}&fmt=json&limit=5`

  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const data = await res.json()

    let earliest: number | null = null
    for (const rec of data.recordings ?? []) {
      // Only consider high-confidence matches
      if ((rec.score ?? 0) < 85) continue
      // first-release-date is the earliest date across all releases of this recording
      const year = parseInt((rec['first-release-date'] ?? '').slice(0, 4), 10)
      if (!isNaN(year) && year > 1900 && (earliest === null || year < earliest)) {
        earliest = year
      }
    }
    return earliest
  } catch {
    return null
  }
}
