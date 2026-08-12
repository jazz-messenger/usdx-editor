import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SongSources } from './SongSources'
import { SONG_SOURCES } from '../utils/songSources'
import { translations } from '../i18n/translations'

describe('SongSources', () => {
  it('renders a link for every source', () => {
    render(<SongSources />)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(SONG_SOURCES.length)
    for (const source of SONG_SOURCES) {
      const link = links.find((l) => l.getAttribute('href') === source.url)
      expect(link, `no link for ${source.id}`).toBeDefined()
      expect(link).toHaveTextContent(translations.de.sources.items[source.id].name)
    }
  })

  it('opens every source in a new tab without leaking the referrer', () => {
    render(<SongSources />)
    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link.getAttribute('rel')).toContain('noopener')
      expect(link.getAttribute('rel')).toContain('noreferrer')
    }
  })

  it('points every link at an https URL', () => {
    render(<SongSources />)
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).toMatch(/^https:\/\//)
    }
  })

  it('describes each source in the active language', () => {
    render(<SongSources />)
    for (const source of SONG_SOURCES) {
      expect(screen.getByText(translations.de.sources.items[source.id].desc)).toBeInTheDocument()
    }
  })

  it('shows the heading and the audio/video caveat', () => {
    render(<SongSources />)
    expect(screen.getByRole('heading', { name: translations.de.sources.heading })).toBeInTheDocument()
    expect(screen.getByText(translations.de.sources.note)).toBeInTheDocument()
  })

  it('keeps both locales in sync with the source list', () => {
    for (const source of SONG_SOURCES) {
      expect(translations.de.sources.items[source.id]).toBeDefined()
      expect(translations.en.sources.items[source.id]).toBeDefined()
      expect(translations.de.sources.items[source.id].desc)
        .not.toBe(translations.en.sources.items[source.id].desc)
      expect(translations.de.sources.categories[source.category]).toBeTruthy()
      expect(translations.en.sources.categories[source.category]).toBeTruthy()
    }
  })
})
