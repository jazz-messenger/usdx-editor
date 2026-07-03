// ── YouTube helpers: URL parsing + search via Data API v3 ────────────────────

export function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/)
  return match?.[1] ?? null
}

// API responses contain HTML entities (&amp; etc.) in titles/channel names.
// A detached <textarea> parses them as inert RCDATA — no script execution.
function decodeHtml(str: string): string {
  const el = document.createElement('textarea')
  el.innerHTML = str
  return el.value
}

export interface YtResult {
  videoId: string
  title: string
  author: string
  year: string
}

const YT_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined

export type SearchOutcome =
  | { kind: 'results'; items: YtResult[] }
  | { kind: 'quota' }
  | { kind: 'error' }

export async function searchYouTube(query: string): Promise<SearchOutcome> {
  if (!YT_API_KEY) return { kind: 'error' }

  try {
    const url =
      `https://www.googleapis.com/youtube/v3/search` +
      `?key=${YT_API_KEY}` +
      `&q=${encodeURIComponent(query)}` +
      `&type=video&part=snippet&maxResults=5`

    const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
    const data = await r.json()

    if (!r.ok) {
      const reason = data?.error?.errors?.[0]?.reason ?? ''
      if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
        return { kind: 'quota' }
      }
      return { kind: 'error' }
    }

    const items: YtResult[] = (data.items ?? []).map((item: {
      id: { videoId: string }
      snippet: { title: string; channelTitle: string; publishedAt?: string }
    }) => ({
      videoId: item.id.videoId,
      title: decodeHtml(item.snippet.title),
      author: decodeHtml(item.snippet.channelTitle),
      year: item.snippet.publishedAt
        ? new Date(item.snippet.publishedAt).getFullYear().toString()
        : '',
    }))

    return { kind: 'results', items }
  } catch {
    return { kind: 'error' }
  }
}

/** Opens a YouTube search for the song in a new tab (fallback when the API is unavailable). */
export function openYouTubeSearch(artist: string | undefined, title: string | undefined) {
  const q = encodeURIComponent(`${artist ?? ''} ${title ?? ''} official video`.trim())
  window.open(`https://www.youtube.com/results?search_query=${q}`, '_blank')
}
