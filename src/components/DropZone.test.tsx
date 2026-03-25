import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DropZone } from './DropZone'
import { LanguageProvider } from '../i18n/LanguageContext'

function makeFile(name: string, content: string, lastModified: number): File {
  return new File([content], name, { type: 'text/plain', lastModified })
}

const VALID_TXT = '#TITLE:Test\n#ARTIST:Artist\n#BPM:120\n#GAP:0\n- 0 5 60 He\n'

function renderDropZone(onLoad = vi.fn()) {
  render(
    <LanguageProvider>
      <DropZone onLoad={onLoad} />
    </LanguageProvider>
  )
  return onLoad
}

describe('DropZone', () => {
  it('renders the drop area with an open-folder label', () => {
    renderDropZone()
    expect(screen.getByText(/ordner öffnen/i)).toBeInTheDocument()
  })

  describe('multiple .txt files — file picker', () => {
    function renderWithMultipleTxt() {
      const onLoad = vi.fn()
      render(<LanguageProvider><DropZone onLoad={onLoad} /></LanguageProvider>)

      const older = makeFile('song-old.txt', VALID_TXT, new Date('2024-01-15').getTime())
      const newer = makeFile('song-new.txt', VALID_TXT, new Date('2025-06-20').getTime())

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      Object.defineProperty(input, 'files', { value: [older, newer], configurable: true })
      fireEvent.change(input)

      return { onLoad, older, newer }
    }

    it('shows a selection list when multiple .txt files are found', () => {
      renderWithMultipleTxt()
      expect(screen.getByText('song-old.txt')).toBeInTheDocument()
      expect(screen.getByText('song-new.txt')).toBeInTheDocument()
    })

    it('shows the last-modified date next to each file', () => {
      renderWithMultipleTxt()
      // Dates should appear somewhere in the list — exact format is locale-dependent
      const items = screen.getAllByRole('listitem')
      expect(items.length).toBe(2)
      // Each item should contain more than just the filename (i.e. the date too)
      items.forEach(item => {
        expect(item.textContent!.length).toBeGreaterThan('song-old.txt'.length)
      })
    })

    it('loads the chosen file when a list item is clicked', async () => {
      const { onLoad } = renderWithMultipleTxt()
      fireEvent.click(screen.getByText('song-new.txt'))
      await waitFor(() => expect(onLoad).toHaveBeenCalledOnce())
    })

    it('loads the correct file — the one that was clicked', async () => {
      const { onLoad } = renderWithMultipleTxt()
      fireEvent.click(screen.getByText('song-old.txt'))
      await waitFor(() => expect(onLoad).toHaveBeenCalled())
      // second arg to onLoad is the filename
      expect(onLoad.mock.calls[0][1]).toBe('song-old.txt')
    })
  })
})
