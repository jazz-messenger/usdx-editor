import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HeaderEditor } from './HeaderEditor'
import { LanguageProvider } from '../i18n/LanguageContext'
import type { HeaderEditValues, HeaderEditHandlers } from './HeaderEditor'
import type { UsdxHeader } from '../parser/usdxParser'

function makeHeader(overrides: Partial<UsdxHeader> = {}): UsdxHeader {
  return { title: 'Teardrops', artist: 'Womack And Womack', bpm: 120, gap: 0, ...overrides } as UsdxHeader
}

function makeValues(overrides: Partial<HeaderEditValues> = {}): HeaderEditValues {
  return { title: 'Teardrops', artist: 'Womack And Womack', year: 1988, genres: [], languages: [], edition: [], tags: '', ...overrides }
}

function makeHandlers(overrides: Partial<HeaderEditHandlers> = {}): HeaderEditHandlers {
  return {
    setTitle: vi.fn(), setArtist: vi.fn(), setYear: vi.fn(),
    setGenres: vi.fn(), setLanguages: vi.fn(), setEdition: vi.fn(), setTags: vi.fn(),
    ...overrides,
  }
}

function renderEditor(headerOverrides: Partial<UsdxHeader> = {}, valuesOverrides: Partial<HeaderEditValues> = {}) {
  const handlers = makeHandlers()
  render(
    <LanguageProvider>
      <HeaderEditor
        header={makeHeader(headerOverrides)}
        files={new Map()}
        filename="song.txt"
        values={makeValues(valuesOverrides)}
        handlers={handlers}
        suggestedYear={null}
        suggestedGenre={null}
        singstarMatch={null}
        onAcceptYear={vi.fn()} onDismissYear={vi.fn()}
        onAcceptGenre={vi.fn()} onDismissGenre={vi.fn()}
        onAcceptSingstar={vi.fn()} onDismissSingstar={vi.fn()}
        onCoverUrl={vi.fn()} onCoverFileSaved={vi.fn()}
        onDownload={vi.fn()} onReset={vi.fn()}
      />
    </LanguageProvider>
  )
  return handlers
}

describe('HeaderEditor', () => {
  it('renders title and artist inputs with current values', () => {
    renderEditor()
    expect(screen.getByRole('textbox', { name: /titel/i })).toHaveValue('Teardrops')
    expect(screen.getByRole('textbox', { name: /künstler/i })).toHaveValue('Womack And Womack')
  })

  it('calls setTitle when title input changes', async () => {
    const handlers = renderEditor()
    const input = screen.getByRole('textbox', { name: /titel/i })
    await userEvent.clear(input)
    await userEvent.type(input, 'New Title')
    expect(handlers.setTitle).toHaveBeenCalled()
  })

  it('calls setArtist when artist input changes', async () => {
    const handlers = renderEditor()
    const input = screen.getByRole('textbox', { name: /künstler/i })
    await userEvent.clear(input)
    await userEvent.type(input, 'Other Artist')
    expect(handlers.setArtist).toHaveBeenCalled()
  })

  it('renders Save and change-file buttons', () => {
    renderEditor()
    expect(screen.getByRole('button', { name: /speichern/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /andere datei/i })).toBeInTheDocument()
  })

  it('shows PROVIDEDBY as read-only text when present', () => {
    renderEditor({ providedBy: 'USDB' })
    expect(screen.getByText('USDB')).toBeInTheDocument()
  })

  it('does not render PROVIDEDBY section when absent', () => {
    renderEditor()
    expect(screen.queryByText(/bereitgestellt von/i)).not.toBeInTheDocument()
  })

  describe('tooltips on tag editors (#10)', () => {
    it('shows Language tooltip on hover over add button', () => {
      renderEditor()
      const btn = screen.getByRole('button', { name: '+ Sprache' })
      fireEvent.mouseEnter(btn.closest('.tooltip-wrap')!)
      expect(screen.getByRole('tooltip')).toBeInTheDocument()
    })

    it('shows Genre tooltip on hover over add button', () => {
      renderEditor()
      const btn = screen.getByRole('button', { name: '+ Genre' })
      fireEvent.mouseEnter(btn.closest('.tooltip-wrap')!)
      expect(screen.getByRole('tooltip')).toBeInTheDocument()
    })

    it('shows Edition tooltip on hover over add button', () => {
      renderEditor()
      const btn = screen.getByRole('button', { name: '+ Edition' })
      fireEvent.mouseEnter(btn.closest('.tooltip-wrap')!)
      expect(screen.getByRole('tooltip')).toBeInTheDocument()
    })

    it('hides tooltip after mouse leaves', () => {
      renderEditor()
      const wrap = screen.getByRole('button', { name: '+ Sprache' }).closest('.tooltip-wrap')!
      fireEvent.mouseEnter(wrap)
      expect(screen.getByRole('tooltip')).toBeInTheDocument()
      fireEvent.mouseLeave(wrap)
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })
  })

  it('shows suggested year button when suggestedYear differs from current', () => {
    render(
      <LanguageProvider>
        <HeaderEditor
          header={makeHeader()}
          files={new Map()}
          filename="song.txt"
          values={makeValues({ year: '' })}
          handlers={makeHandlers()}
          suggestedYear={1988}
          suggestedGenre={null}
          singstarMatch={null}
          onAcceptYear={vi.fn()} onDismissYear={vi.fn()}
          onAcceptGenre={vi.fn()} onDismissGenre={vi.fn()}
          onAcceptSingstar={vi.fn()} onDismissSingstar={vi.fn()}
          onCoverUrl={vi.fn()} onCoverFileSaved={vi.fn()}
          onDownload={vi.fn()} onReset={vi.fn()}
        />
      </LanguageProvider>
    )
    expect(screen.getByText(/1988 übernehmen/i)).toBeInTheDocument()
  })
})
