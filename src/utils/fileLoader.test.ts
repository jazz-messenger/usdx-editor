import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { findCoverFiles, fetchRemoteCovers } from './fileLoader'
import type { SongFileMap } from './fileLoader'
import type { UsdxHeader } from '../parser/usdxParser'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFile(name: string): File {
  return new File([], name)
}

function makeMap(...names: string[]): SongFileMap {
  const map: SongFileMap = new Map()
  for (const name of names) map.set(name.toLowerCase(), makeFile(name))
  return map
}

function emptyHeader(overrides: Partial<UsdxHeader> = {}): UsdxHeader {
  return { artist: 'A', title: 'T', audio: 'a.mp3', bpm: 120, gap: 0, ...overrides } as UsdxHeader
}

// ── findCoverFiles ────────────────────────────────────────────────────────────

describe('findCoverFiles', () => {
  it('returns empty array when no cover files present', () => {
    const files = makeMap('song.mp3', 'song.txt')
    expect(findCoverFiles(emptyHeader(), files)).toHaveLength(0)
  })

  it('returns file named in header.cover first', () => {
    const files = makeMap('MyArtist - MySong [CO].jpg', 'custom-cover.jpg')
    const header = emptyHeader({ cover: 'custom-cover.jpg' })
    const result = findCoverFiles(header, files)
    expect(result[0].name).toBe('custom-cover.jpg')
  })

  it('matches header.cover case-insensitively', () => {
    const files = makeMap('Cover.JPG')
    const header = emptyHeader({ cover: 'cover.jpg' })
    const result = findCoverFiles(header, files)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Cover.JPG')
  })

  it('picks up [co] files when no header.cover set', () => {
    const files = makeMap('Artist - Song [CO].jpg', 'song.mp3')
    const result = findCoverFiles(emptyHeader(), files)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Artist - Song [CO].jpg')
  })

  it('picks up cover.jpg fallback', () => {
    const files = makeMap('cover.jpg', 'song.mp3')
    const result = findCoverFiles(emptyHeader(), files)
    expect(result[0].name).toBe('cover.jpg')
  })

  it('deduplicates when header.cover is also a [co] file', () => {
    const files = makeMap('Artist - Song [CO].jpg')
    const header = emptyHeader({ cover: 'Artist - Song [CO].jpg' })
    const result = findCoverFiles(header, files)
    expect(result).toHaveLength(1)
  })

  it('returns multiple results: header cover first, then [co], then generic', () => {
    const files = makeMap('custom.jpg', 'Song [CO].jpg', 'cover.jpg')
    const header = emptyHeader({ cover: 'custom.jpg' })
    const result = findCoverFiles(header, files)
    expect(result.map((f) => f.name)).toEqual(['custom.jpg', 'Song [CO].jpg', 'cover.jpg'])
  })

  it('ignores [co] files with non-image extensions', () => {
    const files = makeMap('Song [CO].txt', 'Song [CO].mp4')
    const result = findCoverFiles(emptyHeader(), files)
    expect(result).toHaveLength(0)
  })

  it('supports webp and png extensions', () => {
    const files = makeMap('Song [CO].png', 'cover.webp')
    const result = findCoverFiles(emptyHeader(), files)
    expect(result.map((f) => f.name)).toContain('Song [CO].png')
    expect(result.map((f) => f.name)).toContain('cover.webp')
  })
})

// ── fetchRemoteCovers ─────────────────────────────────────────────────────────

describe('fetchRemoteCovers', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns up to 5 cover URLs with 600x600 resolution', async () => {
    const mockResults = Array.from({ length: 5 }, (_, i) => ({
      artworkUrl100: `https://example.com/${i + 1}100x100bb.jpg`,
    }))
    vi.mocked(fetch).mockResolvedValue({
      json: () => Promise.resolve({ results: mockResults }),
    } as Response)

    const urls = await fetchRemoteCovers('Artist', 'Title')
    expect(urls).toHaveLength(5)
    urls.forEach((url) => expect(url).toContain('600x600bb'))
  })

  it('builds the correct iTunes query URL', async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: () => Promise.resolve({ results: [] }),
    } as Response)

    await fetchRemoteCovers('Daft Punk', 'Get Lucky')
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('Daft%20Punk%20Get%20Lucky'),
    )
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('itunes.apple.com'),
    )
  })

  it('filters out results without artworkUrl100', async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: () =>
        Promise.resolve({
          results: [{ artworkUrl100: 'https://img.example.com/art100x100bb.jpg' }, {}],
        }),
    } as Response)

    const urls = await fetchRemoteCovers('A', 'T')
    expect(urls).toHaveLength(1)
  })

  it('returns empty array on network error', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))
    const urls = await fetchRemoteCovers('A', 'T')
    expect(urls).toEqual([])
  })

  it('returns empty array when results is missing', async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: () => Promise.resolve({}),
    } as Response)
    const urls = await fetchRemoteCovers('A', 'T')
    expect(urls).toEqual([])
  })
})
