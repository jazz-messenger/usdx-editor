import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SongView } from './SongView'
import { LanguageProvider } from '../i18n/LanguageContext'
import type { UsdxSong } from '../parser/usdxParser'

// Suppress act() warnings from async effects (YouTube/cover fetches) in tests
globalThis.fetch = vi.fn().mockRejectedValue(new Error('no network in tests'))

function makeSong(overrides: Partial<UsdxSong> = {}): UsdxSong {
  return {
    header: { title: 'Teardrops', artist: 'Womack And Womack', bpm: 120, gap: 0, audio: 'song.mp3' },
    tracks: [{ player: 1, phrases: [{ notes: [{ type: ':', beat: 0, length: 4, pitch: 60, syllable: 'Hello' }], text: 'Hello' }] }],
    deprecatedFields: [],
    ...overrides,
  }
}

function renderSongView(songOverrides: Partial<UsdxSong> = {}) {
  render(
    <LanguageProvider>
      <SongView
        song={makeSong(songOverrides)}
        filename="song.txt"
        files={new Map()}
        dirHandle={null}
        onReset={vi.fn()}
      />
    </LanguageProvider>
  )
}

describe('SongView', () => {
  it('renders the song title and artist', () => {
    renderSongView()
    expect(screen.getByRole('textbox', { name: /titel/i })).toHaveValue('Teardrops')
    expect(screen.getByRole('textbox', { name: /künstler/i })).toHaveValue('Womack And Womack')
  })

  it('renders phrase lyrics', () => {
    renderSongView()
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('shows deprecation banner when deprecated fields are present', () => {
    renderSongView({ deprecatedFields: ['MP3', 'AUTHOR'] })
    expect(screen.getByText(/veraltete felder erkannt/i)).toBeInTheDocument()
    expect(screen.getByText(/MP3/)).toBeInTheDocument()
    expect(screen.getByText(/AUTHOR/)).toBeInTheDocument()
  })

  it('dismisses deprecation banner on click', async () => {
    renderSongView({ deprecatedFields: ['MP3'] })
    const dismiss = screen.getAllByTitle(/schließen/i)[0]
    await userEvent.click(dismiss)
    expect(screen.queryByText(/veraltete felder erkannt/i)).not.toBeInTheDocument()
  })

  it('shows missing files banner when audio file is absent from files map', () => {
    renderSongView()
    // header.audio = 'song.mp3' but files map is empty → missing
    expect(screen.getByText(/im ordner nicht gefunden/i)).toBeInTheDocument()
  })

  it('hides missing files banner when files are present', () => {
    const files = new Map([['song.mp3', new File([], 'song.mp3')]])
    render(
      <LanguageProvider>
        <SongView song={makeSong()} filename="song.txt" files={files} dirHandle={null} onReset={vi.fn()} />
      </LanguageProvider>
    )
    expect(screen.queryByText(/im ordner nicht gefunden/i)).not.toBeInTheDocument()
  })

  it('does not show deprecation banner when no deprecated fields', () => {
    renderSongView({ deprecatedFields: [] })
    expect(screen.queryByText(/veraltete felder erkannt/i)).not.toBeInTheDocument()
  })
})
