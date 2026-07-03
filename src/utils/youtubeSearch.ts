// ── YouTube helpers: URL parsing + search via server-side proxy ──────────────

export function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/)
  return match?.[1] ?? null
}

export interface YtResult {
  videoId: string
  title: string
  author: string
  year: string
}

export type SearchOutcome =
  | { kind: 'results'; items: YtResult[] }
  | { kind: 'quota' }
  | { kind: 'error' }

/**
 * Searches YouTube via the server-side proxy (public/api/yt-search.php),
 * which holds the API key — the key never ships in the client bundle.
 * The proxy already answers in the SearchOutcome shape and decodes HTML
 * entities server-side. Without a deployed proxy (e.g. local dev), the fetch
 * fails and this resolves to { kind: 'error' }.
 */
export async function searchYouTube(query: string): Promise<SearchOutcome> {
  try {
    const url = `${import.meta.env.BASE_URL}api/yt-search.php?q=${encodeURIComponent(query)}`
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return { kind: 'error' }
    const data = await r.json()

    if (data?.kind === 'quota') return { kind: 'quota' }
    if (data?.kind === 'results' && Array.isArray(data.items)) {
      const items: YtResult[] = data.items
        .filter((it: unknown): it is YtResult =>
          typeof it === 'object' && it !== null &&
          typeof (it as YtResult).videoId === 'string' && (it as YtResult).videoId !== ''
        )
        .map((it: YtResult) => ({
          videoId: it.videoId,
          title: typeof it.title === 'string' ? it.title : '',
          author: typeof it.author === 'string' ? it.author : '',
          year: typeof it.year === 'string' ? it.year : '',
        }))
      return { kind: 'results', items }
    }
    return { kind: 'error' }
  } catch {
    return { kind: 'error' }
  }
}

/** Opens a YouTube search for the song in a new tab (fallback when the proxy is unavailable). */
export function openYouTubeSearch(artist: string | undefined, title: string | undefined) {
  const q = encodeURIComponent(`${artist ?? ''} ${title ?? ''} official video`.trim())
  window.open(`https://www.youtube.com/results?search_query=${q}`, '_blank')
}
