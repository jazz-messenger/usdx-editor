/**
 * MusicBrainz release-group search — returns year and genre for a given
 * artist + title, or null values if nothing useful is found.
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

export interface MusicBrainzInfo {
  year: number | null
  genre: string | null
}

type ReleaseGroup = {
  score: number
  'first-release-date'?: string
  'primary-type'?: string
  tags?: Array<{ name: string; count: number }>
}

// Capitalise first letter of each word for display
function toTitleCase(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase())
}

export async function lookupReleaseInfo(
  artist: string,
  title: string
): Promise<MusicBrainzInfo> {
  const empty: MusicBrainzInfo = { year: null, genre: null }
  if (!artist.trim() || !title.trim()) return empty

  // Strip double-quotes to avoid breaking the Lucene query
  const a = artist.replace(/"/g, '')
  const t = title.replace(/"/g, '')
  const query = `releasegroup:"${t}" AND artist:"${a}"`
  const url =
    `https://musicbrainz.org/ws/2/release-group` +
    `?query=${encodeURIComponent(query)}&fmt=json&limit=5&inc=tags`

  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return empty
    const data = await res.json()

    const groups: ReleaseGroup[] = data['release-groups'] ?? []

    // Prefer Singles over Albums; within each type take the earliest year
    // among high-confidence matches (score ≥ 85).
    let bestYear: number | null = null
    let bestIsSingle = false
    let bestTags: Array<{ name: string; count: number }> = []

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
        bestTags = rg.tags ?? []
      }
    }

    // Pick the highest-voted tag as genre (exclude meta-tags like 'seen live')
    const EXCLUDE = new Set(['seen live', 'favorites', 'favourite', 'good'])
    const topTag = bestTags
      .filter(tag => !EXCLUDE.has(tag.name.toLowerCase()) && tag.count > 0)
      .sort((a, b) => b.count - a.count)[0]

    const genre = topTag ? toTitleCase(topTag.name) : null

    return { year: bestYear, genre }
  } catch {
    return empty
  }
}

/** Convenience wrapper — returns only the release year. */
export async function lookupReleaseYear(
  artist: string,
  title: string
): Promise<number | null> {
  return (await lookupReleaseInfo(artist, title)).year
}
