import { describe, it, expect, vi, afterEach } from 'vitest'
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

  describe('demo song', () => {
    function stubFetch(impl?: (url: string) => Promise<Response>) {
      const fetchMock = vi.fn(impl ?? (async (url: string) => ({
        ok: true,
        blob: async () => new Blob([url.includes('.txt') ? VALID_TXT : 'binary']),
      } as Response)))
      vi.stubGlobal('fetch', fetchMock)
      return fetchMock
    }

    afterEach(() => vi.unstubAllGlobals())

    it('loads the bundled demo song when the button is clicked', async () => {
      const fetchMock = stubFetch()
      const onLoad = renderDropZone()

      fireEvent.click(screen.getByRole('button', { name: /beispiel-song/i }))

      await waitFor(() => expect(onLoad).toHaveBeenCalledOnce())
      expect(onLoad.mock.calls[0][1]).toMatch(/\.txt$/)
      // every demo asset is fetched, not just the .txt
      expect(fetchMock.mock.calls.length).toBeGreaterThan(1)
      const files = onLoad.mock.calls[0][2] as Map<string, File>
      expect(files.size).toBe(fetchMock.mock.calls.length)
    })

    it('gives every demo file a MIME type — a typeless blob URL will not play', async () => {
      stubFetch()
      const onLoad = renderDropZone()
      fireEvent.click(screen.getByRole('button', { name: /beispiel-song/i }))

      await waitFor(() => expect(onLoad).toHaveBeenCalledOnce())
      const files = onLoad.mock.calls[0][2] as Map<string, File>
      for (const file of files.values()) expect(file.type).not.toBe('')
      expect(files.get('neon skyline.wav')?.type).toMatch(/^audio\//)
      expect(files.get('neon skyline.webm')?.type).toMatch(/^video\//)
    })

    it('keys the demo files lowercase so the media lookup finds them', async () => {
      stubFetch()
      const onLoad = renderDropZone()
      fireEvent.click(screen.getByRole('button', { name: /beispiel-song/i }))

      await waitFor(() => expect(onLoad).toHaveBeenCalledOnce())
      const files = onLoad.mock.calls[0][2] as Map<string, File>
      for (const key of files.keys()) expect(key).toBe(key.toLowerCase())
    })

    it('reports an error instead of hanging when an asset is missing', async () => {
      stubFetch(async () => ({ ok: false, status: 404 } as Response))
      const onLoad = renderDropZone()

      fireEvent.click(screen.getByRole('button', { name: /beispiel-song/i }))

      await waitFor(() => expect(screen.getByText(/beispiel-song/i)).toBeInTheDocument())
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(onLoad).not.toHaveBeenCalled()
    })

    it('disables the button while the demo is loading', async () => {
      let release: (v: Response) => void = () => {}
      stubFetch(() => new Promise<Response>((res) => { release = res }))
      renderDropZone()

      const button = screen.getByRole('button', { name: /beispiel-song/i })
      fireEvent.click(button)
      await waitFor(() => expect(button).toBeDisabled())

      release({ ok: true, blob: async () => new Blob([VALID_TXT]) } as Response)
    })
  })
})
