import { useState, useEffect } from 'react'
import { useYouTubePlayer } from '../hooks/useYouTubePlayer'

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/)
  return match?.[1] ?? null
}

// ── YouTube search via Data API v3 ────────────────────────────────────────────

interface YtResult {
  videoId: string
  title: string
  author: string
  year: string
}

const YT_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined

type SearchOutcome =
  | { kind: 'results'; items: YtResult[] }
  | { kind: 'quota' }
  | { kind: 'error' }

async function searchYouTube(query: string): Promise<SearchOutcome> {
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
      title: item.snippet.title,
      author: item.snippet.channelTitle,
      year: item.snippet.publishedAt
        ? new Date(item.snippet.publishedAt).getFullYear().toString()
        : '',
    }))

    return { kind: 'results', items }
  } catch {
    return { kind: 'error' }
  }
}

function openYouTubeSearch(artist: string | undefined, title: string | undefined) {
  const q = encodeURIComponent(`${artist ?? ''} ${title ?? ''} official video`.trim())
  window.open(`https://www.youtube.com/results?search_query=${q}`, '_blank')
}

// ── Component ─────────────────────────────────────────────────────────────────

interface GapSyncProps {
  gap: number
  onChange: (gap: number) => void
  onTimeUpdate?: (currentMs: number) => void
  backgroundUrl?: string
  artist?: string
  title?: string
}

export function GapSync({ gap, onChange, onTimeUpdate, backgroundUrl, artist, title }: GapSyncProps) {
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const videoId = extractYouTubeId(youtubeUrl)
  const { containerRef, playerState, isPlaying, getCurrentTime } = useYouTubePlayer(videoId)

  const [searchResults, setSearchResults] = useState<YtResult[] | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [searchMsg, setSearchMsg] = useState<string | null>(null)

  // Drive highlight updates via requestAnimationFrame while playing (~60fps)
  useEffect(() => {
    if (!isPlaying || !onTimeUpdate) return
    let rafId: number
    const tick = () => {
      onTimeUpdate(getCurrentTime() * 1000)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [isPlaying, onTimeUpdate, getCurrentTime])

  const handleSync = () => {
    const ms = Math.round(getCurrentTime() * 1000)
    onChange(ms)
  }

  const handleSearch = async () => {
    if (!artist && !title) return
    setIsSearching(true)
    setSearchResults(null)
    setSearchMsg(null)

    const outcome = await searchYouTube(`${artist ?? ''} ${title ?? ''} official video`.trim())
    setIsSearching(false)

    if (outcome.kind === 'results' && outcome.items.length > 0) {
      setSearchResults(outcome.items)
    } else if (outcome.kind === 'quota') {
      // Quota exceeded → fall back to YouTube search tab
      setSearchMsg('Tageslimit erreicht — YouTube wird im neuen Tab geöffnet.')
      openYouTubeSearch(artist, title)
    } else {
      setSearchMsg('Keine Ergebnisse — bitte URL manuell einfügen.')
    }
  }

  const selectVideo = (vid: string) => {
    setYoutubeUrl(`https://www.youtube.com/watch?v=${vid}`)
    setSearchResults(null)
    setSearchMsg(null)
  }

  return (
    <div className="gap-sync">
      <div className="gap-sync-row">
        <label className="gap-sync-label" htmlFor="gap-input">
          GAP
        </label>
        <div className="gap-input-group">
          <input
            id="gap-input"
            type="number"
            className="gap-input"
            value={gap}
            step={10}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <span className="gap-unit">ms</span>
        </div>

        <div className="gap-sync-divider" />

        <input
          type="url"
          className="youtube-input"
          placeholder="YouTube-URL zum Überprüfen (optional)"
          value={youtubeUrl}
          onChange={(e) => {
            setYoutubeUrl(e.target.value)
            setSearchResults(null)
            setSearchMsg(null)
          }}
        />

        {playerState === 'ready' && (
          <button className="btn-sync" onClick={handleSync} title="Aktuellen Abspielzeitpunkt als GAP übernehmen">
            ⏱ Jetzt!
          </button>
        )}
        {!videoId && (artist || title) && (
          <button
            className="btn-yt-search"
            onClick={handleSearch}
            disabled={isSearching}
            title="Nach Official Video suchen"
          >
            {isSearching ? '…' : '🔍'}
          </button>
        )}
      </div>

      {/* Feedback message (quota / no results) */}
      {searchMsg && <div className="yt-search-msg">{searchMsg}</div>}

      {/* Search results */}
      {searchResults && searchResults.length > 0 && (
        <div className="yt-search-results">
          {searchResults.map((r) => (
            <button key={r.videoId} className="yt-search-result" onClick={() => selectVideo(r.videoId)}>
              <img
                className="yt-result-thumb"
                src={`https://i.ytimg.com/vi/${r.videoId}/default.jpg`}
                alt=""
                loading="lazy"
              />
              <div className="yt-result-info">
                <span className="yt-result-title">{r.title}</span>
                <span className="yt-result-meta">{r.author}{r.year ? ` · ${r.year}` : ''}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {!videoId && backgroundUrl && (
        <div className="bg-preview-wrap">
          <img className="bg-preview" src={backgroundUrl} alt="Background" />
          <span className="bg-preview-label">Hintergrundbild</span>
        </div>
      )}

      {videoId && (
        <div className="yt-player-wrap">
          {playerState === 'error' && (
            <div className="yt-error">Video konnte nicht geladen werden.</div>
          )}
          <div ref={containerRef} className="yt-player" />
          {playerState === 'ready' && (
            <p className="yt-hint">
              Video abspielen → beim ersten gesungenen Wort auf <strong>⏱ Jetzt!</strong> klicken.
              {isPlaying && <span className="yt-hint-live"> Lyrics werden live hervorgehoben.</span>}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
