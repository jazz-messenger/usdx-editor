import { useState } from 'react'
import { useYouTubePlayer } from '../hooks/useYouTubePlayer'

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/)
  return match?.[1] ?? null
}

interface GapSyncProps {
  gap: number
  onChange: (gap: number) => void
}

export function GapSync({ gap, onChange }: GapSyncProps) {
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const videoId = extractYouTubeId(youtubeUrl)
  const { containerRef, playerState, getCurrentTime } = useYouTubePlayer(videoId)

  const handleSync = () => {
    const ms = Math.round(getCurrentTime() * 1000)
    onChange(ms)
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
          onChange={(e) => setYoutubeUrl(e.target.value)}
        />

        {playerState === 'ready' && (
          <button className="btn-sync" onClick={handleSync} title="Aktuellen Abspielzeitpunkt als GAP übernehmen">
            ⏱ Jetzt!
          </button>
        )}
      </div>

      {videoId && (
        <div className="yt-player-wrap">
          {playerState === 'error' && (
            <div className="yt-error">Video konnte nicht geladen werden.</div>
          )}
          <div ref={containerRef} className="yt-player" />
          {playerState === 'ready' && (
            <p className="yt-hint">
              Video abspielen → beim ersten gesungenen Wort auf <strong>⏱ Jetzt!</strong> klicken.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
