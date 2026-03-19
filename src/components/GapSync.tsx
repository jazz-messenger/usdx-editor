import { useState, useEffect, useRef, useCallback } from 'react'
import { useYouTubePlayer } from '../hooks/useYouTubePlayer'

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/)
  return match?.[1] ?? null
}

function decodeHtml(str: string): string {
  const el = document.createElement('textarea')
  el.innerHTML = str
  return el.value
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

function openYouTubeSearch(artist: string | undefined, title: string | undefined) {
  const q = encodeURIComponent(`${artist ?? ''} ${title ?? ''} official video`.trim())
  window.open(`https://www.youtube.com/results?search_query=${q}`, '_blank')
}

// ── Component ─────────────────────────────────────────────────────────────────

interface GapSyncProps {
  gap: number
  onChange: (gap: number) => void
  /** Offset in seconds between video start and song start (from #VIDEOGAP). */
  videoGap: number
  onVideoGapChange: (vg: number) => void
  onTimeUpdate?: (currentMs: number) => void
  backgroundUrl?: string
  /** Object URL for a local video file (#VIDEO). Takes priority over YouTube. */
  videoUrl?: string
  /** Initial YouTube URL loaded from #VIDEOURL in the song file. */
  initialVideoUrl?: string
  /** Called whenever the user selects or clears a YouTube URL. */
  onVideoUrlChange?: (url: string) => void
  /** Called when the user clicks ↩ Start — App can use this to scroll to phrase 0. */
  onReset?: () => void
  artist?: string
  title?: string
}

export function GapSync({ gap, onChange, videoGap, onVideoGapChange, onTimeUpdate, backgroundUrl, videoUrl, initialVideoUrl, onVideoUrlChange, onReset, artist, title }: GapSyncProps) {

  // ── YouTube player ──────────────────────────────────────────────────────────
  const [youtubeUrl, setYoutubeUrl] = useState(initialVideoUrl ?? '')
  const updateYoutubeUrl = (url: string) => { setYoutubeUrl(url); onVideoUrlChange?.(url) }
  const videoId = extractYouTubeId(youtubeUrl)
  const {
    containerRef,
    playerState: ytPlayerState,
    isPlaying: ytIsPlaying,
    getCurrentTime: ytGetCurrentTime,
    getDuration: ytGetDuration,
    seekTo: ytSeekTo,
    play: ytPlay,
    pause: ytPause,
  } = useYouTubePlayer(videoId)

  const [ytDuration, setYtDuration] = useState(0)
  useEffect(() => {
    if (ytPlayerState === 'ready') setYtDuration(ytGetDuration())
    else setYtDuration(0)
  }, [ytPlayerState, ytGetDuration])

  // ── Local video player ──────────────────────────────────────────────────────
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const [localPlayerState, setLocalPlayerState] = useState<'idle' | 'ready' | 'error'>('idle')
  const [localIsPlaying, setLocalIsPlaying] = useState(false)
  const [localDuration, setLocalDuration] = useState(0)
  // Prevent RAF from overwriting videoTime while the user is dragging the slider
  const isDraggingSlider = useRef(false)

  // Reset local player state whenever the source changes
  useEffect(() => {
    setLocalPlayerState('idle')
    setLocalIsPlaying(false)
  }, [videoUrl])

  const localGetCurrentTime = useCallback(() => localVideoRef.current?.currentTime ?? 0, [])
  const localSeekTo = useCallback((s: number) => { if (localVideoRef.current) localVideoRef.current.currentTime = s }, [])
  const localPlay = useCallback(() => { localVideoRef.current?.play() }, [])
  const localPause = useCallback(() => { localVideoRef.current?.pause() }, [])

  // ── Video source preference ─────────────────────────────────────────────────
  // When a local file is present it is used by default. The user can toggle to
  // YouTube; preferYoutube=true makes the YouTube player the active source.
  const [preferYoutube, setPreferYoutube] = useState(false)

  // ── Unified player API — local file wins unless the user chose YouTube ──────
  const useLocal = Boolean(videoUrl) && !preferYoutube
  const playerState    = useLocal ? localPlayerState    : ytPlayerState
  const isPlaying      = useLocal ? localIsPlaying      : ytIsPlaying
  const getCurrentTime = useLocal ? localGetCurrentTime : ytGetCurrentTime
  const seekTo         = useLocal ? localSeekTo         : ytSeekTo
  const play           = useLocal ? localPlay           : ytPlay
  const pause          = useLocal ? localPause          : ytPause

  // ── Pause inactive player when source is switched ───────────────────────────
  useEffect(() => {
    if (preferYoutube) localPause()
    else ytPause()
  }, [preferYoutube]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Search state ────────────────────────────────────────────────────────────
  const [searchResults, setSearchResults] = useState<YtResult[] | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [searchMsg, setSearchMsg] = useState<string | null>(null)
  // Displayed video clock — updated by RAF while playing, or after seeks
  const [videoTime, setVideoTime] = useState(0)

  // Drive highlight updates and video clock via requestAnimationFrame (~60 fps).
  useEffect(() => {
    if (!isPlaying) return
    let rafId: number
    const tick = () => {
      const t = getCurrentTime()
      if (!isDraggingSlider.current) setVideoTime(t)
      onTimeUpdate?.((t - videoGap) * 1000)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [isPlaying, onTimeUpdate, getCurrentTime, videoGap])

  // Seek to VIDEOGAP position and start — puts video right at song beat 0.
  const handleStart = () => {
    seekTo(videoGap)
    play()
    onReset?.()
  }

  // Changing VIDEOGAP: update state AND immediately seek so the video frame
  // jumps to the new position for instant visual feedback.
  const handleVideoGapChange = (value: number) => {
    onVideoGapChange(value)
    if (playerState === 'ready') {
      seekTo(value)
      setTimeout(() => setVideoTime(getCurrentTime()), 200)
    }
  }

  // Set GAP from the current video position, corrected for VIDEOGAP.
  // GAP (ms into audio) = (videoTime − videoGap) × 1000
  const handleSync = () => {
    const ms = Math.round((getCurrentTime() - videoGap) * 1000)
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
      setShowResults(true)
    } else if (outcome.kind === 'quota') {
      setSearchMsg('Tageslimit erreicht — YouTube wird im neuen Tab geöffnet.')
      openYouTubeSearch(artist, title)
    } else {
      setSearchMsg('Keine Ergebnisse — bitte URL manuell einfügen.')
    }
  }

  const selectVideo = (vid: string) => {
    updateYoutubeUrl(`https://www.youtube.com/watch?v=${vid}`)
    setShowResults(false)   // hide list, but keep results cached for "andere Auswahl"
    setSearchMsg(null)
  }

  const isPlayerReady = playerState === 'ready'

  return (
    <div className="gap-sync">

      {/* ── Timing fields: 3-column grid — label | input+unit | [⏱ Jetzt!] ── */}
      <div className="gap-timing-grid">
        <label className="gap-sync-label" htmlFor="gap-input">GAP</label>
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
        {isPlayerReady
          ? (
            <button
              className="btn-sync"
              onClick={handleSync}
              title="Aktuellen Abspielzeitpunkt als GAP übernehmen"
            >
              ⏱ Jetzt!
            </button>
          )
          : <span />
        }

        <label className="gap-sync-label" htmlFor="videogap-input">VIDEOGAP</label>
        <div className="gap-input-group">
          <input
            id="videogap-input"
            type="number"
            className="gap-input"
            value={videoGap}
            step={0.1}
            onChange={(e) => handleVideoGapChange(Number(e.target.value))}
          />
          <span className="gap-unit">s</span>
        </div>
        <span />
      </div>

      {/* ── Source switcher — only shown when a local video file is present ── */}
      {videoUrl && (
        <div className="video-source-switcher">
          <button
            className={`vsw-btn${!preferYoutube ? ' vsw-btn--active' : ''}`}
            onClick={() => setPreferYoutube(false)}
          >
            📁 Lokale Datei
          </button>
          <button
            className={`vsw-btn${preferYoutube ? ' vsw-btn--active' : ''}`}
            onClick={() => setPreferYoutube(true)}
          >
            ▶ YouTube
          </button>
        </div>
      )}

      {/* ── YouTube URL row (shown without local video, or when user chose YouTube) ── */}
      {(!videoUrl || preferYoutube) && (
        <div className="gap-sync-row">
          <input
            type="url"
            className="youtube-input"
            placeholder="YouTube-URL (optional)"
            value={youtubeUrl}
            onChange={(e) => {
              updateYoutubeUrl(e.target.value)
              setShowResults(false)
              setSearchMsg(null)
            }}
          />
          {videoId
            ? (
              /* Clear selection → go back to search results if cached */
              <button
                className="btn-yt-clear"
                onClick={() => {
                  updateYoutubeUrl('')
                  setShowResults(searchResults !== null && searchResults.length > 0)
                }}
                title="Video-Auswahl zurücksetzen"
              >
                ✕
              </button>
            )
            : (artist || title) && (
              <button
                className="btn-yt-search"
                onClick={handleSearch}
                disabled={isSearching}
                title="Nach Official Video suchen"
              >
                {isSearching ? '…' : '🔍'}
              </button>
            )
          }
        </div>
      )}

      {/* "Andere Auswahl" — shown when a video is active but cached results exist */}
      {(!videoUrl || preferYoutube) && videoId && searchResults && !showResults && (
        <button className="btn-yt-other" onClick={() => setShowResults(true)}>
          🔍 Andere Auswahl
        </button>
      )}

      {/* Feedback message (quota / no results) */}
      {searchMsg && <div className="yt-search-msg">{searchMsg}</div>}

      {/* Search results — cached, only visible in YouTube mode */}
      {(!videoUrl || preferYoutube) && showResults && searchResults && searchResults.length > 0 && (
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

      {/* Background image preview (only when no video source is active) */}
      {!useLocal && !videoId && backgroundUrl && (
        <div className="bg-preview-wrap">
          <img className="bg-preview" src={backgroundUrl} alt="Background" />
          <span className="bg-preview-label">Hintergrundbild</span>
        </div>
      )}

      {/* ── Local video player (always mounted when videoUrl exists, hidden when YouTube is active) ── */}
      {videoUrl && (
        <div className={`local-video-wrap${!useLocal ? ' local-video-wrap--hidden' : ''}`}>
          {localPlayerState === 'error' && (
            <div className="yt-error">Video konnte nicht geladen werden.</div>
          )}
          <video
            ref={localVideoRef}
            className="local-video"
            src={videoUrl}
            onLoadedMetadata={() => setLocalDuration(localVideoRef.current?.duration ?? 0)}
            onCanPlay={() => setLocalPlayerState('ready')}
            onError={() => setLocalPlayerState('error')}
            onPlay={() => setLocalIsPlaying(true)}
            onPause={() => setLocalIsPlaying(false)}
            onEnded={() => setLocalIsPlaying(false)}
          />
        </div>
      )}

      {/* ── YouTube player — always mounted when videoId is set so the iframe
           is never destroyed on source toggle. CSS-hidden when local is active. ── */}
      {videoId && (
        <div className={`yt-player-wrap${useLocal ? ' yt-player-wrap--hidden' : ''}`}>
          {ytPlayerState === 'error' && (
            <div className="yt-error">Video konnte nicht geladen werden.</div>
          )}
          <div ref={containerRef} className="yt-player" />
        </div>
      )}

      {/* ── Seek slider — unified for local and YouTube, directly below the active video ── */}
      {isPlayerReady && (useLocal ? localDuration : ytDuration) > 0 && (
        <input
          type="range"
          className="seek-slider"
          min={0}
          max={useLocal ? localDuration : ytDuration}
          step={0.1}
          value={videoTime}
          onPointerDown={() => { isDraggingSlider.current = true }}
          onChange={(e) => {
            const t = Number(e.target.value)
            setVideoTime(t)
            seekTo(t)
            // Notify App even while paused so activePos updates and lyrics scroll
            onTimeUpdate?.((t - videoGap) * 1000)
          }}
          onPointerUp={() => { isDraggingSlider.current = false }}
          title="Vorspulen"
        />
      )}

      {/* ── Transport controls — shown below the video frame once player is ready ── */}
      {isPlayerReady && (
        <div className="gap-sync-transport">
          {/* Reset-to-start: always seeks to videoGap position */}
          <button
            className="btn-transport"
            onClick={handleStart}
            title={videoGap > 0 ? `Zu ${videoGap}s springen und abspielen` : 'Von Anfang abspielen'}
          >
            ↩ {videoGap > 0 ? `${videoGap}s` : 'Start'}
          </button>
          {/* Play/Pause toggle: resumes/pauses at current slider position */}
          <button
            className="btn-transport"
            onClick={isPlaying ? pause : play}
            title={isPlaying ? 'Pause' : 'Abspielen ab aktueller Position'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          {videoTime > 0 && (
            <span className="video-clock" title="Aktuelle Videoposition">
              {videoTime.toFixed(1)}s
            </span>
          )}
          {isPlaying && (
            <span className="yt-hint-live">Lyrics werden live hervorgehoben.</span>
          )}
        </div>
      )}

    </div>
  )
}
