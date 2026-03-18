/**
 * MusicBrainz release-group search — returns the earliest known release year
 * for a given artist + title, or null if nothing useful is found.
 *
 * We query release-groups (not recordings) because a release group represents
 * the original concept of a release (single, album). Recordings include live
 * versions, remasters, and compilations with different dates.
 * Singles are preferred over albums when both are present.
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
  const query = `releasegroup:"${t}" AND artist:"${a}"`
  const url =
    `https://musicbrainz.org/ws/2/release-group` +
    `?query=${encodeURIComponent(query)}&fmt=json&limit=5`

  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const data = await res.json()

    const groups: Array<{ score: number; 'first-release-date'?: string; 'primary-type'?: string }> =
      data['release-groups'] ?? []

    // Prefer Singles over Albums; within each type take the earliest year
    // among high-confidence matches (score ≥ 85).
    let bestYear: number | null = null
    let bestIsSingle = false

    for (const rg of groups) {
      if ((rg.score ?? 0) < 85) continue
      const year = parseInt((rg['first-release-date'] ?? '').slice(0, 4), 10)
      if (isNaN(year) || year <= 1900) continue

      const isSingle = rg['primary-type'] === 'Single'
      const betterType = isSingle && !bestIsSingle
      const sameTypeEarlier = isSingle === bestIsSingle && (bestYear === null || year < bestYear)

      if (betterType || sameTypeEarlier) {
        bestYear = year
        bestIsSingle = isSingle
      }
    }
    return bestYear
  } catch {
    return null
  }
}
