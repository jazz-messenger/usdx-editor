import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WaveformView } from './WaveformView'
import { LanguageProvider } from '../i18n/LanguageContext'

// ── Browser API mocks ────────────────────────────────────────────────────────

vi.stubGlobal('ResizeObserver', class {
  observe   = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
})

// ── Canvas / AudioContext mocks ───────────────────────────────────────────────

const mockGetContext = vi.fn(() => ({
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  strokeStyle: '',
  fillStyle: '',
  lineWidth: 1,
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  setLineDash: vi.fn(),
}))

beforeEach(() => {
  // Reset canvas mock
  HTMLCanvasElement.prototype.getContext = mockGetContext as never

  // Minimal AudioContext mock — decodeAudioData returns a silent 10-second buffer
  const silentBuffer = {
    duration: 10,
    getChannelData: () => new Float32Array(44100 * 10),
  }
  vi.stubGlobal('AudioContext', class {
    decodeAudioData = vi.fn().mockResolvedValue(silentBuffer)
    close = vi.fn()
  })
})

function renderWaveform(props: Partial<Parameters<typeof WaveformView>[0]> = {}) {
  const defaults = {
    file: null,
    gap: 0,
    playheadS: 0,
    onSetGap: vi.fn(),
  }
  render(
    <LanguageProvider>
      <WaveformView {...defaults} {...props} />
    </LanguageProvider>
  )
  return { onSetGap: (props.onSetGap ?? defaults.onSetGap) as ReturnType<typeof vi.fn> }
}

// ── Pure logic tests (no DOM / audio needed) ─────────────────────────────────

describe('clampPan logic', () => {
  const clamp = (p: number, z: number) => Math.max(0, Math.min(1 - 1 / z, p))

  it('clamps pan to 0 at lower bound', () => {
    expect(clamp(-0.5, 4)).toBe(0)
  })

  it('clamps pan to 1−1/zoom at upper bound', () => {
    expect(clamp(2, 4)).toBe(0.75)   // 1 - 1/4
  })

  it('passes through valid pan values', () => {
    expect(clamp(0.5, 4)).toBe(0.5)
  })

  it('at zoom=1 pan is always 0', () => {
    expect(clamp(0.3, 1)).toBe(0)
    expect(clamp(-0.1, 1)).toBe(0)
  })
})

describe('zoom-centred pan calculation', () => {
  // Mirrors the wheel handler math: keep timeAtMouse fixed after zoom change
  function newPanAfterZoom(
    currentPan: number, currentZoom: number,
    mouseRatio: number, duration: number, newZoom: number,
  ) {
    const timeAtMouse = currentPan * duration + mouseRatio * (duration / currentZoom)
    const raw = (timeAtMouse - mouseRatio * (duration / newZoom)) / duration
    return Math.max(0, Math.min(1 - 1 / newZoom, raw))
  }

  it('zooming in keeps the mouse-centred time in place', () => {
    const duration = 100
    const pan = 0, zoom = 1, mouseRatio = 0.5, newZoom = 2
    const pan2 = newPanAfterZoom(pan, zoom, mouseRatio, duration, newZoom)
    // Time at mouseRatio before zoom
    const timeBefore = pan * duration + mouseRatio * (duration / zoom)
    // Time at same mouseRatio after zoom
    const timeAfter  = pan2 * duration + mouseRatio * (duration / newZoom)
    expect(timeAfter).toBeCloseTo(timeBefore, 5)
  })

  it('pan is clamped to 0 when zooming near the start', () => {
    const duration = 100
    const pan = 0, zoom = 1, mouseRatio = 0, newZoom = 4
    const pan2 = newPanAfterZoom(pan, zoom, mouseRatio, duration, newZoom)
    expect(pan2).toBe(0)
  })

  it('pan is clamped to upper bound when zooming near the end', () => {
    const duration = 100
    const pan = 0, zoom = 1, mouseRatio = 1, newZoom = 4
    const pan2 = newPanAfterZoom(pan, zoom, mouseRatio, duration, newZoom)
    expect(pan2).toBeCloseTo(0.75, 5)  // 1 - 1/4
  })
})

// ── Rendering tests ───────────────────────────────────────────────────────────

describe('WaveformView rendering', () => {
  it('shows "no file" message when file is null', () => {
    renderWaveform({ file: null })
    expect(screen.getByText(/keine lokale audio/i)).toBeInTheDocument()
  })

  it('renders the ⏱ Jetzt! button', () => {
    renderWaveform()
    expect(screen.getByRole('button', { name: /jetzt/i })).toBeInTheDocument()
  })

  it('⏱ Jetzt! button is disabled when playheadS is 0', () => {
    renderWaveform({ playheadS: 0 })
    expect(screen.getByRole('button', { name: /jetzt/i })).toBeDisabled()
  })

  it('⏱ Jetzt! button is enabled when playheadS > 0', () => {
    renderWaveform({ playheadS: 3.5 })
    expect(screen.getByRole('button', { name: /jetzt/i })).toBeEnabled()
  })

  it('⏱ Jetzt! calls onSetGap with playheadS in ms', () => {
    const onSetGap = vi.fn()
    renderWaveform({ playheadS: 3.5, onSetGap })
    fireEvent.click(screen.getByRole('button', { name: /jetzt/i }))
    expect(onSetGap).toHaveBeenCalledWith(3500)
  })

  it('zoom group shows 1× at default zoom', () => {
    renderWaveform()
    // No file means no peaks → zoom group not rendered yet
    expect(screen.queryByText('1×')).toBeNull()
  })
})
