import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GapSync } from './GapSync'
import { LanguageProvider } from '../i18n/LanguageContext'
import type { GapSyncTiming, GapSyncMedia } from './GapSync'

function makeTiming(overrides: Partial<GapSyncTiming> = {}): GapSyncTiming {
  return { gap: 5000, onChange: vi.fn(), videoGap: 0, onVideoGapChange: vi.fn(), ...overrides }
}

const emptyMedia: GapSyncMedia = {}

function renderGapSync(timing = makeTiming(), media = emptyMedia) {
  render(
    <LanguageProvider>
      <GapSync timing={timing} media={media} />
    </LanguageProvider>
  )
  return timing
}

describe('GapSync', () => {
  it('renders GAP input with current value', () => {
    renderGapSync()
    // GAP is displayed in ms
    const input = screen.getByDisplayValue('5000')
    expect(input).toBeInTheDocument()
  })

  it('renders VIDEOGAP input', () => {
    renderGapSync(makeTiming({ videoGap: 2 }))
    expect(screen.getByDisplayValue('2')).toBeInTheDocument()
  })

  it('calls onChange when GAP input is edited', async () => {
    const timing = makeTiming({ gap: 0 })
    render(
      <LanguageProvider>
        <GapSync timing={timing} media={emptyMedia} />
      </LanguageProvider>
    )
    const gapInput = screen.getAllByRole('spinbutton')[0]
    await userEvent.clear(gapInput)
    await userEvent.type(gapInput, '1500')
    expect(timing.onChange).toHaveBeenCalled()
  })

  it('calls onVideoGapChange when VIDEOGAP input is edited', async () => {
    const timing = makeTiming({ videoGap: 0 })
    render(
      <LanguageProvider>
        <GapSync timing={timing} media={emptyMedia} />
      </LanguageProvider>
    )
    const inputs = screen.getAllByRole('spinbutton')
    const videoGapInput = inputs[1]
    await userEvent.clear(videoGapInput)
    await userEvent.type(videoGapInput, '3')
    expect(timing.onVideoGapChange).toHaveBeenCalled()
  })

  it('renders background image label when backgroundUrl is provided', () => {
    const media: GapSyncMedia = { backgroundUrl: 'blob:bg' }
    render(
      <LanguageProvider>
        <GapSync timing={makeTiming()} media={media} />
      </LanguageProvider>
    )
    expect(screen.getByText(/hintergrundbild/i)).toBeInTheDocument()
  })

  it('renders GAP and VIDEOGAP labels', () => {
    renderGapSync()
    expect(screen.getByText('GAP')).toBeInTheDocument()
    expect(screen.getByText('VIDEOGAP')).toBeInTheDocument()
  })

  describe('tooltips (#10)', () => {
    it('renders ⓘ icon next to GAP label', () => {
      renderGapSync()
      const icons = screen.getAllByText('ⓘ')
      expect(icons.length).toBeGreaterThanOrEqual(2)
    })

    it('shows GAP tooltip text on hover', () => {
      renderGapSync()
      const icons = screen.getAllByText('ⓘ')
      fireEvent.mouseEnter(icons[0].closest('.tooltip-wrap')!)
      expect(screen.getByRole('tooltip')).toBeInTheDocument()
    })

    it('shows VIDEOGAP tooltip text on hover', () => {
      renderGapSync()
      const icons = screen.getAllByText('ⓘ')
      fireEvent.mouseEnter(icons[1].closest('.tooltip-wrap')!)
      expect(screen.getByRole('tooltip')).toBeInTheDocument()
    })

    it('hides tooltip after mouse leaves', () => {
      renderGapSync()
      const wrap = screen.getAllByText('ⓘ')[0].closest('.tooltip-wrap')!
      fireEvent.mouseEnter(wrap)
      expect(screen.getByRole('tooltip')).toBeInTheDocument()
      fireEvent.mouseLeave(wrap)
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })
  })
})
