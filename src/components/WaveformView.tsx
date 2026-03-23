import { useEffect, useRef, useState, useCallback } from 'react'
import { useLanguage } from '../i18n/LanguageContext'

interface WaveformViewProps {
  file: File | null
  gap: number                          // current GAP in ms
  playheadS: number                    // absolute playback position in seconds
  onSetGap: (ms: number) => void
}

const WAVEFORM_COLOR    = '#f9731680'  // accent-primary @ 50%
const WAVEFORM_COLOR_HI = '#fb923c'   // accent-primary-2
const GAP_COLOR         = '#f97316'   // accent-primary
const PLAYHEAD_COLOR    = 'rgba(255,255,255,0.75)'
const PENDING_COLOR     = 'rgba(255,255,255,0.4)'
const BG_COLOR          = '#0d0d1a'

function buildPeaks(channelData: Float32Array, samples: number): Float32Array {
  const blockSize = Math.floor(channelData.length / samples)
  const peaks = new Float32Array(samples)
  for (let i = 0; i < samples; i++) {
    let max = 0
    const start = i * blockSize
    for (let j = 0; j < blockSize; j++) {
      const v = Math.abs(channelData[start + j] ?? 0)
      if (v > max) max = v
    }
    peaks[i] = max
  }
  return peaks
}

export function WaveformView({ file, gap, playheadS, onSetGap }: WaveformViewProps) {
  const { t } = useLanguage()
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const wrapRef      = useRef<HTMLDivElement>(null)
  const [peaks, setPeaks]           = useState<Float32Array | null>(null)
  const [duration, setDuration]     = useState(0)
  const [pendingGapMs, setPendingGapMs] = useState<number | null>(null)
  const [status, setStatus]         = useState<'idle' | 'loading' | 'error'>('idle')

  // ── Decode audio ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!file) { setPeaks(null); setDuration(0); return }
    setStatus('loading')
    setPeaks(null)
    setPendingGapMs(null)

    const ctx = new AudioContext()
    file.arrayBuffer()
      .then(buf  => ctx.decodeAudioData(buf))
      .then(audio => {
        setDuration(audio.duration)
        // Use more samples for wider screens; 2000 is a good default
        setPeaks(buildPeaks(audio.getChannelData(0), 2000))
        setStatus('idle')
      })
      .catch(() => setStatus('error'))
      .finally(() => ctx.close())
  }, [file])

  // ── Draw ────────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)

    // Background
    ctx.fillStyle = BG_COLOR
    ctx.fillRect(0, 0, W, H)

    // Waveform bars
    if (peaks) {
      const barW = Math.max(1, W / peaks.length)
      for (let i = 0; i < peaks.length; i++) {
        const x = (i / peaks.length) * W
        const h = peaks[i] * H * 0.9
        ctx.fillStyle = peaks[i] > 0.5 ? WAVEFORM_COLOR_HI : WAVEFORM_COLOR
        ctx.fillRect(x, (H - h) / 2, barW, h)
      }
    }

    if (duration <= 0) return

    const xOf = (s: number) => (s / duration) * W

    // Pending GAP (white dashed)
    if (pendingGapMs !== null) {
      const x = xOf(pendingGapMs / 1000)
      ctx.save()
      ctx.strokeStyle = PENDING_COLOR
      ctx.lineWidth = 1
      ctx.setLineDash([5, 5])
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      ctx.restore()
    }

    // GAP marker (solid orange)
    const gapX = xOf(gap / 1000)
    ctx.strokeStyle = GAP_COLOR
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(gapX, 0); ctx.lineTo(gapX, H); ctx.stroke()

    // Playhead (white)
    if (playheadS > 0) {
      const px = xOf(playheadS)
      ctx.strokeStyle = PLAYHEAD_COLOR
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke()
    }
  }, [peaks, duration, gap, pendingGapMs, playheadS])

  useEffect(() => { draw() }, [draw])

  // ── Resize canvas to container ───────────────────────────────────────────────
  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const ro = new ResizeObserver(() => {
      canvas.width  = wrap.clientWidth
      canvas.height = 120
      draw()
    })
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [draw])

  // ── Click → pending GAP ──────────────────────────────────────────────────────
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    setPendingGapMs((x / rect.width) * duration * 1000)
  }

  const confirmGap = () => {
    if (pendingGapMs !== null) { onSetGap(pendingGapMs); setPendingGapMs(null) }
  }

  const setNow = () => onSetGap(playheadS * 1000)

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="waveform-view">
      <div ref={wrapRef} className="waveform-canvas-wrap">
        {status === 'loading' && (
          <div className="waveform-status">{t.waveform.loading}</div>
        )}
        {status === 'error' && (
          <div className="waveform-status waveform-status--error">{t.waveform.error}</div>
        )}
        {!file && status === 'idle' && (
          <div className="waveform-status">{t.waveform.noFile}</div>
        )}
        <canvas
          ref={canvasRef}
          className="waveform-canvas"
          style={{ display: peaks ? 'block' : 'none' }}
          onClick={handleClick}
        />
      </div>

      <div className="waveform-controls">
        <span className="waveform-hint">{t.waveform.hint}</span>
        <div className="waveform-actions">
          {pendingGapMs !== null && (
            <button className="btn-primary btn-sm" onClick={confirmGap}>
              {t.waveform.confirmGap((pendingGapMs / 1000).toFixed(2))}
            </button>
          )}
          <button className="btn-sync btn-sm" onClick={setNow} disabled={playheadS <= 0}>
            {t.waveform.syncNow}
          </button>
        </div>
      </div>
    </div>
  )
}
