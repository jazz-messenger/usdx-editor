import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchYouTube, extractYouTubeId } from './youtubeSearch'

// ── Helpers ────────────────────────────────────────────────────────────────────

function mockFetchJson(body: unknown, ok = true) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok,
    json: () => Promise.resolve(body),
  } as Response)
}

describe('extractYouTubeId', () => {
  it('extracts the id from watch URLs', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts the id from youtu.be short URLs', () => {
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts the id from embed URLs', () => {
    expect(extractYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('returns null for non-YouTube URLs', () => {
    expect(extractYouTubeId('https://example.com/video')).toBeNull()
  })
})

describe('searchYouTube (proxy client)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('calls the proxy endpoint, not the Google API', async () => {
    const spy = mockFetchJson({ kind: 'results', items: [] })
    await searchYouTube('abba dancing queen')
    const calledUrl = String(spy.mock.calls[0][0])
    expect(calledUrl).toContain('api/yt-search.php?q=abba%20dancing%20queen')
    expect(calledUrl).not.toContain('googleapis.com')
    expect(calledUrl).not.toContain('key=')
  })

  it('returns results passed through from the proxy', async () => {
    mockFetchJson({
      kind: 'results',
      items: [{ videoId: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', author: 'Rick Astley', year: '2009' }],
    })
    const outcome = await searchYouTube('rick astley')
    expect(outcome).toEqual({
      kind: 'results',
      items: [{ videoId: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', author: 'Rick Astley', year: '2009' }],
    })
  })

  it('drops malformed items without a videoId', async () => {
    mockFetchJson({
      kind: 'results',
      items: [{ title: 'kaputt' }, { videoId: 'dQw4w9WgXcQ', title: 'ok', author: 'a', year: '' }],
    })
    const outcome = await searchYouTube('x')
    expect(outcome.kind).toBe('results')
    if (outcome.kind === 'results') {
      expect(outcome.items).toHaveLength(1)
      expect(outcome.items[0].videoId).toBe('dQw4w9WgXcQ')
    }
  })

  it('passes quota through', async () => {
    mockFetchJson({ kind: 'quota' })
    expect(await searchYouTube('x')).toEqual({ kind: 'quota' })
  })

  it('returns error for non-ok responses', async () => {
    mockFetchJson({}, false)
    expect(await searchYouTube('x')).toEqual({ kind: 'error' })
  })

  it('returns error when the proxy is unreachable (e.g. local dev)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))
    expect(await searchYouTube('x')).toEqual({ kind: 'error' })
  })

  it('returns error for unexpected response shapes', async () => {
    mockFetchJson({ something: 'else' })
    expect(await searchYouTube('x')).toEqual({ kind: 'error' })
  })
})
