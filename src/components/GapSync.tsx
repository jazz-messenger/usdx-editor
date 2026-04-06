import { useState, useEffect, useRef, useCallback } from 'react'
import { useYouTubePlayer } from '../hooks/useYouTubePlayer'
import { useLanguage } from '../i18n/LanguageContext'
import { Tooltip } from './Tooltip'

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

export interface GapSyncTiming {
  gap: number
  onChange: (gap: number) => void
  /** Offset in seconds between video start and song start (from #VIDEOGAP). */
  videoGap: number
  onVideoGapChange: (vg: number) => void
}

export interface GapSyncMedia {
  /** Object URL for a local video file (#VIDEO). Takes priority over audio and YouTube. */
  videoUrl?: string
  /** Object URL for a local audio file (#AUDIO). Used when no video is available. */
  audioUrl?: string
  backgroundUrl?: string
  /** Initial YouTube URL loaded from #VIDEOURL in the song file. */
  initialVideoUrl?: string
  /** Called whenever the user selects or clears a YouTube URL. */
  onVideoUrlChange?: (url: string) => void
  /** Called when the user picks a local video file via the file chooser. */
  onVideoFileSelect?: (file: File) => void
  /** Called when the user picks a local audio file via the file chooser. */
  onAudioFileSelect?: (file: File) => void
  /** When true, force the YouTube tab to be active (e.g. after user declines a video mismatch). */
  forceYoutube?: boolean
}

interface GapSyncProps {
  timing: GapSyncTiming
  media: GapSyncMedia
  song?: { artist?: string; title?: string }
  onTimeUpdate?: (currentMs: number) => void
  /** Called when the user clicks ↩ Start — App can use this to scroll to phrase 0. */
  onReset?: () => void
  /** Increment to trigger seek-to-GAP + play from WaveformView */
  startSignal?: number
}

/** Pure helper — determines whether a seek+play handover should fire. */
export function shouldHandover(pendingTime: number | null, playerState: string): boolean {
  return pendingTime !== null && playerState === 'ready'
}

export function GapSync({ timing, media, song, onTimeUpdate, onReset, startSignal }: GapSyncProps) {
  const { gap, onChange, videoGap, onVideoGapChange } = timing
  const { videoUrl, audioUrl, backgroundUrl, initialVideoUrl, onVideoUrlChange, onVideoFileSelect, onAudioFileSelect, forceYoutube } = media
  const { artist, title } = song ?? {}
  const { t } = useLanguage()

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

  // ── Tab state: video | audio | youtube ─────────────────────────────────────
  type MediaTab = 'video' | 'audio' | 'youtube'
  const [activeTab, setActiveTab] = useState<MediaTab>(() => {
    if (forceYoutube) return 'youtube'
    if (videoUrl) return 'video'
    if (audioUrl) return 'audio'
    return 'youtube'
  })
  // Sync forceYoutube from parent (e.g. user declined mismatch banner)
  useEffect(() => { if (forceYoutube) setActiveTab('youtube') }, [forceYoutube])

  // Local media source depends on active tab — must be declared before local player hooks
  const localMediaUrl = activeTab === 'video' ? (videoUrl ?? null)
                      : activeTab === 'audio' ? (audioUrl ?? null)
                      : null

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
  }, [localMediaUrl])

  const localGetCurrentTime = useCallback(() => localVideoRef.current?.currentTime ?? 0, [])
  const localSeekTo = useCallback((s: number) => { if (localVideoRef.current) localVideoRef.current.currentTime = s }, [])
  const localPlay = useCallback(() => { localVideoRef.current?.play() }, [])
  const localPause = useCallback(() => { localVideoRef.current?.pause() }, [])

  // ── Unified player API ───────────────────────────────────────────────────────
  const useLocal = activeTab !== 'youtube' && Boolean(localMediaUrl)
  const playerState    = useLocal ? localPlayerState    : ytPlayerState
  const isPlaying      = useLocal ? localIsPlaying      : ytIsPlaying
  const getCurrentTime = useLocal ? localGetCurrentTime : ytGetCurrentTime
  const seekTo         = useLocal ? localSeekTo         : ytSeekTo
  const play           = useLocal ? localPlay           : ytPlay
  const pause          = useLocal ? localPause          : ytPause

  // ── Seamless handover when tab changes ───────────────────────────────────────
  const handoverTimeRef = useRef<number | null>(null)

  const switchTab = useCallback((tab: typeof activeTab) => {
    if (tab === activeTab) return
    handoverTimeRef.current = isPlaying ? getCurrentTime() : null
    setActiveTab(tab)
  }, [activeTab, isPlaying, getCurrentTime])

  // Pause the player that just became inactive
  useEffect(() => {
    if (!isPlayerReady) return
    if (activeTab === 'youtube') localPause()
    else ytPause()
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // Once the new player is ready, seek to the captured time and resume
  useEffect(() => {
    if (!shouldHandover(handoverTimeRef.current, playerState)) return
    const t = handoverTimeRef.current!
    handoverTimeRef.current = null
    seekTo(t)
    play()
  }, [playerState]) // eslint-disable-line react-hooks/exhaustive-deps

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
    onReset?.()
    seekTo(videoGap)
    play()
  }

  // External jump-to-GAP trigger from WaveformView — seeks to GAP position offset by VIDEOGAP
  const lastStartSignal = useRef(0)
  useEffect(() => {
    if (!startSignal || startSignal === lastStartSignal.current || playerState !== 'ready') return
    lastStartSignal.current = startSignal
    onReset?.()
    seekTo(videoGap + gap / 1000)
    play()
  }, [startSignal, playerState, gap, videoGap, seekTo, play, onReset])

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
      setSearchMsg(t.gapsync.quotaExceeded)
      openYouTubeSearch(artist, title)
    } else {
      setSearchMsg(t.gapsync.noResults)
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
        <label className="gap-sync-label" htmlFor="gap-input">
          {t.gapsync.gapLabel}
          <Tooltip text={t.gapsync.gapTooltip} />
        </label>
        <div className="gap-input-group">
          <input
            id="gap-input"
            type="number"
            className="gap-input"
            value={Math.round(gap)}
            step={10}
            onChange={(e) => onChange(Math.round(Number(e.target.value)))}
          />
          <span className="gap-unit">{t.gapsync.ms}</span>
        </div>
        {isPlayerReady
          ? (
            <Tooltip text={t.gapsync.syncTitle}>
              <button className="btn-sync" onClick={handleSync}>
                {t.gapsync.syncNow}
              </button>
            </Tooltip>
          )
          : <span />
        }

        <label className="gap-sync-label" htmlFor="videogap-input">
          {t.gapsync.videogapLabel}
          <Tooltip text={t.gapsync.videogapTooltip} />
        </label>
        <div className="gap-input-group">
          <input
            id="videogap-input"
            type="number"
            className="gap-input"
            value={videoGap}
            step={0.1}
            onChange={(e) => handleVideoGapChange(Number(e.target.value))}
          />
          <span className="gap-unit">{t.gapsync.s}</span>
        </div>
        <span />
      </div>

      {/* ── Source switcher — 3 fixed tabs ── */}
      <div className="video-source-switcher">
        <Tooltip text={t.gapsync.videoTabTooltip}>
          <button
            className={`vsw-btn${activeTab === 'video' ? ' vsw-btn--active' : ''}`}
            onClick={() => switchTab('video')}
          >
            {t.gapsync.videoTab}
          </button>
        </Tooltip>
        <Tooltip text={t.gapsync.audioTabTooltip}>
          <button
            className={`vsw-btn${activeTab === 'audio' ? ' vsw-btn--active' : ''}`}
            onClick={() => switchTab('audio')}
          >
            {t.gapsync.audioTab}
          </button>
        </Tooltip>
        <Tooltip text={t.gapsync.youtubeTooltip}>
          <button
            className={`vsw-btn${activeTab === 'youtube' ? ' vsw-btn--active' : ''}`}
            onClick={() => switchTab('youtube')}
          >
            {t.gapsync.youtube}
          </button>
        </Tooltip>
      </div>

      {/* ── Video empty state (no file selected yet) ── */}
      {activeTab === 'video' && !videoUrl && (
        <div className="media-empty-state">
          {onVideoFileSelect
            ? <label className="btn-choose-file">
                {t.gapsync.chooseVideoFile}
                <input type="file" accept="video/*" style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) { onVideoFileSelect(file); setActiveTab('video') }
                  }} />
              </label>
            : <span className="media-empty-hint">{t.gapsync.noVideoFile}</span>
          }
        </div>
      )}

      {/* ── Audio empty state (no file selected yet) ── */}
      {activeTab === 'audio' && !audioUrl && (
        <div className="media-empty-state">
          {onAudioFileSelect
            ? <label className="btn-choose-file">
                {t.gapsync.chooseAudioFile}
                <input type="file" accept="audio/*" style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) { onAudioFileSelect(file); setActiveTab('audio') }
                  }} />
              </label>
            : <span className="media-empty-hint">{t.gapsync.noAudioFile}</span>
          }
        </div>
      )}

      {/* ── YouTube URL row ── */}
      {activeTab === 'youtube' && (
        <div className="gap-sync-row">
          <input
            type="url"
            className="youtube-input"
            placeholder={t.gapsync.youtubeUrlPlaceholder}
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
                title={t.gapsync.clearVideo}
              >
                ✕
              </button>
            )
            : (artist || title) && (
              <button
                className="btn-yt-search"
                onClick={handleSearch}
                disabled={isSearching}
                title={t.gapsync.searchVideo}
              >
                {isSearching ? '…' : '🔍'}
              </button>
            )
          }
        </div>
      )}

      {/* "Andere Auswahl" — shown when a video is active but cached results exist */}
      {activeTab === 'youtube' && videoId && searchResults && !showResults && (
        <button className="btn-yt-other" onClick={() => setShowResults(true)}>
          {t.gapsync.otherResults}
        </button>
      )}

      {/* Feedback message (quota / no results) */}
      {searchMsg && <div className="yt-search-msg">{searchMsg}</div>}

      {/* Search results — cached, only visible in YouTube mode */}
      {activeTab === 'youtube' && showResults && searchResults && searchResults.length > 0 && (
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

      {/* Background image preview — shown when no active media (any tab) */}
      {!localMediaUrl && !videoId && backgroundUrl && (
        <div className="bg-preview-wrap">
          <img className="bg-preview" src={backgroundUrl} alt="" />
          <span className="bg-preview-label">{t.gapsync.background}</span>
        </div>
      )}

      {/* ── Local video/audio player ── */}
      {localMediaUrl && (
        <div className={`local-video-wrap${!useLocal ? ' local-video-wrap--hidden' : ''}${activeTab === 'audio' ? ' local-video-wrap--audio-only' : ''}`}>
          {localPlayerState === 'error' && (
            <div className="yt-error">{t.gapsync.videoError}</div>
          )}
          <video
            ref={localVideoRef}
            className="local-video"
            src={localMediaUrl}
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
        <div className={`yt-player-wrap${activeTab !== 'youtube' ? ' yt-player-wrap--hidden' : ''}`}>
          {ytPlayerState === 'error' && (
            <div className="yt-error">{t.gapsync.videoError}</div>
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
          title={t.gapsync.seekTitle}
        />
      )}

      {/* ── Transport controls — shown below the video frame once player is ready ── */}
      {isPlayerReady && (
        <>
          <div className="gap-sync-transport">
            {/* Reset-to-start: always seeks to videoGap position */}
            <Tooltip text={videoGap > 0 ? t.gapsync.startWithGap(videoGap) : t.gapsync.startFromBeginning}>
              <button className="btn-transport" onClick={handleStart}>
                {t.gapsync.startLabel(videoGap)}
              </button>
            </Tooltip>
            <Tooltip text={t.gapsync.jumpToGapTooltip}>
              <button className="btn-transport" onClick={() => { onReset?.(); seekTo(videoGap + gap / 1000); play() }}>
                {t.gapsync.jumpToGapLabel}
              </button>
            </Tooltip>
            <Tooltip text={isPlaying ? t.gapsync.pause : t.gapsync.play}>
              <button className="btn-transport" onClick={isPlaying ? pause : play}>
                {isPlaying ? '⏸' : '▶'}
              </button>
            </Tooltip>
            {videoTime > 0 && (
              <span className="video-clock">{Math.round(videoTime)}s</span>
            )}
          </div>
          {isPlaying && (
            <span className="yt-hint-live">{t.gapsync.liveHint}</span>
          )}
        </>
      )}

    </div>
  )
}
