import { describe, it, expect, vi, beforeEach } from 'vitest'
import { lookupReleaseYear } from './musicbrainz'

// ── Helpers ────────────────────────────────────────────────────────────────────

type ReleaseGroup = {
  score: number
  'first-release-date'?: string
  'primary-type'?: string
}

function mockFetchOk(releaseGroups: ReleaseGroup[]) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ 'release-groups': releaseGroups }),
  } as Response)
}

function mockFetchFail() {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))
}

function mockFetchNotOk() {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false } as Response)
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('lookupReleaseYear', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('input validation (no network)', () => {
    it('returns null and does not fetch for empty artist', async () => {
      const spy = vi.spyOn(globalThis, 'fetch')
      const result = await lookupReleaseYear('', 'Some Song')
      expect(result).toBeNull()
      expect(spy).not.toHaveBeenCalled()
    })

    it('returns null and does not fetch for whitespace-only artist', async () => {
      const spy = vi.spyOn(globalThis, 'fetch')
      const result = await lookupReleaseYear('   ', 'Some Song')
      expect(result).toBeNull()
      expect(spy).not.toHaveBeenCalled()
    })

    it('returns null and does not fetch for empty title', async () => {
      const spy = vi.spyOn(globalThis, 'fetch')
      const result = await lookupReleaseYear('Some Artist', '')
      expect(result).toBeNull()
      expect(spy).not.toHaveBeenCalled()
    })

    it('returns null and does not fetch for whitespace-only title', async () => {
      const spy = vi.spyOn(globalThis, 'fetch')
      const result = await lookupReleaseYear('Some Artist', '   ')
      expect(result).toBeNull()
      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe('network error handling', () => {
    it('returns null when fetch throws', async () => {
      mockFetchFail()
      expect(await lookupReleaseYear('ABBA', 'Dancing Queen')).toBeNull()
    })

    it('returns null when response is not ok', async () => {
      mockFetchNotOk()
      expect(await lookupReleaseYear('ABBA', 'Dancing Queen')).toBeNull()
    })

    it('returns null when release-groups array is empty', async () => {
      mockFetchOk([])
      expect(await lookupReleaseYear('ABBA', 'Dancing Queen')).toBeNull()
    })
  })

  describe('score threshold', () => {
    it('ignores results with score below 85', async () => {
      mockFetchOk([
        { score: 84, 'first-release-date': '1976', 'primary-type': 'Single' },
      ])
      expect(await lookupReleaseYear('ABBA', 'Dancing Queen')).toBeNull()
    })

    it('accepts results with score of exactly 85', async () => {
      mockFetchOk([
        { score: 85, 'first-release-date': '1976', 'primary-type': 'Single' },
      ])
      expect(await lookupReleaseYear('ABBA', 'Dancing Queen')).toBe(1976)
    })

    it('accepts results with score above 85', async () => {
      mockFetchOk([
        { score: 100, 'first-release-date': '1976', 'primary-type': 'Single' },
      ])
      expect(await lookupReleaseYear('ABBA', 'Dancing Queen')).toBe(1976)
    })
  })

  describe('year extraction', () => {
    it('extracts the year from a full ISO date string', async () => {
      mockFetchOk([{ score: 95, 'first-release-date': '1976-08-16', 'primary-type': 'Single' }])
      expect(await lookupReleaseYear('ABBA', 'Dancing Queen')).toBe(1976)
    })

    it('extracts the year from a year-only string', async () => {
      mockFetchOk([{ score: 90, 'first-release-date': '1976', 'primary-type': 'Album' }])
      expect(await lookupReleaseYear('ABBA', 'Dancing Queen')).toBe(1976)
    })

    it('ignores entries with missing first-release-date', async () => {
      mockFetchOk([
        { score: 95, 'primary-type': 'Single' },
        { score: 90, 'first-release-date': '1976', 'primary-type': 'Album' },
      ])
      expect(await lookupReleaseYear('ABBA', 'Dancing Queen')).toBe(1976)
    })

    it('ignores entries with year <= 1900', async () => {
      mockFetchOk([
        { score: 95, 'first-release-date': '1900', 'primary-type': 'Single' },
        { score: 90, 'first-release-date': '1976', 'primary-type': 'Album' },
      ])
      expect(await lookupReleaseYear('ABBA', 'Dancing Queen')).toBe(1976)
    })

    it('ignores entries with unparseable date', async () => {
      mockFetchOk([
        { score: 95, 'first-release-date': 'unknown', 'primary-type': 'Single' },
        { score: 90, 'first-release-date': '1976', 'primary-type': 'Album' },
      ])
      expect(await lookupReleaseYear('ABBA', 'Dancing Queen')).toBe(1976)
    })
  })

  describe('type preference (Single > Album)', () => {
    it('prefers a later single over an earlier album', async () => {
      mockFetchOk([
        { score: 90, 'first-release-date': '1975', 'primary-type': 'Album' },
        { score: 92, 'first-release-date': '1976', 'primary-type': 'Single' },
      ])
      // Single year wins even though album year is earlier
      expect(await lookupReleaseYear('ABBA', 'Dancing Queen')).toBe(1976)
    })

    it('picks the earliest year among two albums when no single exists', async () => {
      mockFetchOk([
        { score: 88, 'first-release-date': '1980', 'primary-type': 'Album' },
        { score: 91, 'first-release-date': '1976', 'primary-type': 'Album' },
      ])
      expect(await lookupReleaseYear('ABBA', 'Dancing Queen')).toBe(1976)
    })

    it('picks the earliest year among two singles', async () => {
      mockFetchOk([
        { score: 90, 'first-release-date': '1988', 'primary-type': 'Single' },
        { score: 92, 'first-release-date': '1984', 'primary-type': 'Single' },
      ])
      expect(await lookupReleaseYear('ABBA', 'Dancing Queen')).toBe(1984)
    })
  })

  describe('URL construction', () => {
    it('encodes artist and title into the query URL', async () => {
      mockFetchOk([])
      await lookupReleaseYear('AC/DC', 'Highway to Hell')
      const url = (vi.mocked(globalThis.fetch).mock.calls[0][0] as string)
      expect(url).toContain('musicbrainz.org')
      expect(url).toContain(encodeURIComponent('Highway to Hell'))
    })

    it('strips double-quotes from artist/title to avoid breaking Lucene queries', async () => {
      mockFetchOk([])
      await lookupReleaseYear('Artist "Nickname" Band', 'Some "Song"')
      const url = (vi.mocked(globalThis.fetch).mock.calls[0][0] as string)
      // Double-quotes in query string would break the Lucene query syntax
      const rawQuery = decodeURIComponent(url.split('?query=')[1].split('&')[0])
      expect(rawQuery).not.toContain('""')
    })
  })
})
