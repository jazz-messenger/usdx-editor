import { useEffect, useRef, useState, useCallback } from 'react'
import { useLanguage } from '../i18n/LanguageContext'

interface WaveformViewProps {
  file: File | null
  gap: number                          // current GAP in ms
  playheadS: number                    // absolute playback position in seconds
  onSetGap: (ms: number) => void
}

const WAVEFORM_COLOR    = '#f9731680'
const WAVEFORM_COLOR_HI = '#fb923c'
const GAP_COLOR         = '#f97316'
const PLAYHEAD_COLOR    = 'rgba(255,255,255,0.75)'
const PENDING_COLOR     = 'rgba(255,255,255,0.4)'
const BG_COLOR          = '#0d0d1a'
const MINIMAP_BG        = 'rgba(255,255,255,0.06)'
const MINIMAP_WIN       = 'rgba(255,255,255,0.14)'

const ZOOM_STEP = 1.35
const ZOOM_MIN  = 1
const ZOOM_MAX  = 64
const MINIMAP_H = 18   // px reserved at canvas bottom when zoomed

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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef   = useRef<HTMLDivElement>(null)

  const [peaks, setPeaks]               = useState<Float32Array | null>(null)
  const [duration, setDuration]         = useState(0)
  const [pendingGapMs, setPendingGapMs] = useState<number | null>(null)
  const [status, setStatus]             = useState<'idle' | 'loading' | 'error'>('idle')
  const [zoom, setZoom]                 = useState(1)
  const [pan, setPan]                   = useState(0)   // 0..1 fraction of total duration

  // ── Reset zoom on new file ───────────────────────────────────────────────────
  useEffect(() => { setZoom(1); setPan(0) }, [file])

  // ── Decode audio ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!file) { setPeaks(null); setDuration(0); return }
    setStatus('loading')
    setPeaks(null)
    setPendingGapMs(null)

    const ctx = new AudioContext()
    file.arrayBuffer()
      .then(buf   => ctx.decodeAudioData(buf))
      .then(audio => {
        setDuration(audio.duration)
        setPeaks(buildPeaks(audio.getChannelData(0), 2000))
        setStatus('idle')
      })
      .catch(() => setStatus('error'))
      .finally(() => ctx.close())
  }, [file])

  // ── Clamp pan so view never exceeds audio bounds ─────────────────────────────
  const clampPan = useCallback(
    (p: number, z: number) => Math.max(0, Math.min(1 - 1 / z, p)),
    []
  )

  // ── Draw ────────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W  = canvas.width
    const H  = canvas.height
    const WH = zoom > 1 ? H - MINIMAP_H : H   // waveform height (leaves room for minimap)

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = BG_COLOR
    ctx.fillRect(0, 0, W, H)

    if (!peaks || duration <= 0) return

    const visStart = pan * duration
    const visDur   = duration / zoom
    const xOf      = (s: number) => ((s - visStart) / visDur) * W

    // ── Waveform bars ──────────────────────────────────────────────────────────
    const iStart = Math.max(0, Math.floor(pan * peaks.length) - 1)
    const iEnd   = Math.min(peaks.length, Math.ceil((pan + 1 / zoom) * peaks.length) + 1)
    const barW   = Math.max(1, W / (iEnd - iStart))

    for (let i = iStart; i < iEnd; i++) {
      const x = xOf((i / peaks.length) * duration)
      const h = peaks[i] * WH * 0.9
      ctx.fillStyle = peaks[i] > 0.5 ? WAVEFORM_COLOR_HI : WAVEFORM_COLOR
      ctx.fillRect(x, (WH - h) / 2, barW, h)
    }

    ctx.setLineDash([])

    // ── Pending GAP (dashed white) ─────────────────────────────────────────────
    if (pendingGapMs !== null) {
      const x = xOf(pendingGapMs / 1000)
      ctx.save()
      ctx.strokeStyle = PENDING_COLOR
      ctx.lineWidth = 1
      ctx.setLineDash([5, 5])
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WH); ctx.stroke()
      ctx.restore()
    }

    // ── GAP marker (solid orange) ──────────────────────────────────────────────
    const gapX = xOf(gap / 1000)
    ctx.strokeStyle = GAP_COLOR
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(gapX, 0); ctx.lineTo(gapX, WH); ctx.stroke()

    // ── Playhead (white) ───────────────────────────────────────────────────────
    if (playheadS > 0) {
      const px = xOf(playheadS)
      ctx.strokeStyle = PLAYHEAD_COLOR
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, WH); ctx.stroke()
    }

    // ── Minimap (only when zoomed in) ──────────────────────────────────────────
    if (zoom > 1) {
      const my = WH + 2
      const mh = MINIMAP_H - 4

      // Full-range waveform silhouette
      ctx.fillStyle = MINIMAP_BG
      const mBarW = Math.max(1, W / peaks.length)
      for (let i = 0; i < peaks.length; i++) {
        const x = (i / peaks.length) * W
        const h = Math.max(1, peaks[i] * mh)
        ctx.fillRect(x, my + (mh - h) / 2, mBarW, h)
      }

      // Viewport window highlight
      ctx.fillStyle = MINIMAP_WIN
      ctx.fillRect(pan * W, my, W / zoom, mh)

      // GAP in minimap
      ctx.strokeStyle = GAP_COLOR
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo((gap / 1000 / duration) * W, my)
      ctx.lineTo((gap / 1000 / duration) * W, my + mh)
      ctx.stroke()
    }
  }, [peaks, duration, gap, pendingGapMs, playheadS, zoom, pan])

  useEffect(() => { draw() }, [draw])

  // ── Resize canvas to container ───────────────────────────────────────────────
  useEffect(() => {
    const wrap   = wrapRef.current
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

  // ── Scroll-wheel zoom (mouse-centred) ────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onWheel = (e: WheelEvent) => {
      if (!duration) return
      e.preventDefault()

      const rect       = canvas.getBoundingClientRect()
      const mouseRatio = (e.clientX - rect.left) / rect.width

      // Time under the mouse cursor before zooming
      const timeAtMouse = pan * duration + mouseRatio * (duration / zoom)

      const factor  = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * factor))
      const newPan  = clampPan(
        (timeAtMouse - mouseRatio * (duration / newZoom)) / duration,
        newZoom
      )

      setZoom(newZoom)
      setPan(newPan)
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [duration, zoom, pan, clampPan])

  // ── Auto-pan to keep playhead visible during playback ───────────────────────
  useEffect(() => {
    if (!duration || zoom <= 1 || playheadS <= 0) return
    const visStart = pan * duration
    const visDur   = duration / zoom
    const margin   = visDur * 0.15

    if (playheadS < visStart + margin || playheadS > visStart + visDur - margin) {
      setPan(clampPan(playheadS / duration - 0.5 / zoom, zoom))
    }
  }, [playheadS, duration, zoom, pan, clampPan])

  // ── Click → pending GAP ──────────────────────────────────────────────────────
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!duration) return
    const rect  = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    setPendingGapMs((pan * duration + ratio * (duration / zoom)) * 1000)
  }

  const confirmGap = () => {
    if (pendingGapMs !== null) { onSetGap(pendingGapMs); setPendingGapMs(null) }
  }

  const setNow    = () => onSetGap(playheadS * 1000)
  const resetZoom = () => { setZoom(1); setPan(0) }

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
          {zoom > 1 && (
            <button className="btn-sm waveform-zoom-reset" onClick={resetZoom}>
              {t.waveform.zoomReset(Math.round(zoom))}
            </button>
          )}
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
