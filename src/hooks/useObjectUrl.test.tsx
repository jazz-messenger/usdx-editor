import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { StrictMode } from 'react'
import { render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { useObjectUrl } from './useObjectUrl'

// jsdom implements neither half of the object-URL API — stub both and keep a
// ledger so the tests can assert what is still alive.
let counter = 0
let live: Set<string>
let revoked: string[]

beforeEach(() => {
  counter = 0
  live = new Set()
  revoked = []
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => {
      const url = `blob:test/${++counter}`
      live.add(url)
      return url
    }),
    revokeObjectURL: vi.fn((url: string) => {
      live.delete(url)
      revoked.push(url)
    }),
  })
})

afterEach(() => vi.unstubAllGlobals())

function Probe({ file }: { file: File | null }) {
  const url = useObjectUrl(file)
  return <span data-testid="url">{url ?? 'null'}</span>
}

const currentUrl = () => screen.getByTestId('url').textContent!

const makeFile = (name: string) => new File(['x'], name)

describe('useObjectUrl', () => {
  it('returns null without a file', () => {
    render(<Probe file={null} />)
    expect(currentUrl()).toBe('null')
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('exposes the URL during render, before any effect runs', () => {
    // GapSync picks its initial media tab from this on the first render — an
    // effect-created URL would arrive a render too late. Server rendering
    // never runs effects, so markup containing the URL proves it came from
    // render itself.
    const html = renderToStaticMarkup(<Probe file={makeFile('a.mp3')} />)
    expect(html).toContain('blob:test/1')
  })

  it('revokes the previous URL when the file changes', () => {
    const { rerender } = render(<Probe file={makeFile('a.mp3')} />)
    const first = currentUrl()

    rerender(<Probe file={makeFile('b.mp3')} />)
    const second = currentUrl()

    expect(second).not.toBe(first)
    expect(revoked).toContain(first)
    expect(live.has(second)).toBe(true)
  })

  it('revokes the URL on unmount', () => {
    const { unmount } = render(<Probe file={makeFile('a.mp3')} />)
    const url = currentUrl()
    unmount()
    expect(revoked).toContain(url)
    expect(live.has(url)).toBe(false)
  })

  it('survives StrictMode remounting — the URL it hands out stays alive', () => {
    // StrictMode runs effect → cleanup → effect. The cleanup revokes, so the
    // second run has to mint a replacement, otherwise consumers are left
    // holding a dead blob URL and media playback fails in dev.
    render(<StrictMode><Probe file={makeFile('a.mp3')} /></StrictMode>)
    expect(live.has(currentUrl())).toBe(true)
  })

  it('still revokes on unmount after a StrictMode remount', () => {
    const { unmount } = render(<StrictMode><Probe file={makeFile('a.mp3')} /></StrictMode>)
    const url = currentUrl()
    unmount()
    expect(live.has(url)).toBe(false)
  })

  it('leaves no live URL behind when the file changes under StrictMode', () => {
    const { rerender, unmount } = render(
      <StrictMode><Probe file={makeFile('a.mp3')} /></StrictMode>
    )
    rerender(<StrictMode><Probe file={makeFile('b.mp3')} /></StrictMode>)
    expect(live.has(currentUrl())).toBe(true)
    unmount()
    expect(live.size).toBe(0)
  })
})
