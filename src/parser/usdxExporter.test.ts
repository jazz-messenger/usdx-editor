import { describe, it, expect } from 'vitest'
import { parseUsdx } from './usdxParser'
import { exportUsdx } from './usdxExporter'

const SONG = `#ARTIST:Test Artist
#TITLE:Test Song
#MP3:test.mp3
#BPM:120
#GAP:1000
: 0 4 60 Hello
: 4 4 62  world
- 10
: 20 4 60 Foo
: 24 4 62  bar
- 30
E`

describe('exportUsdx', () => {
  it('round-trips a solo song (no P markers)', () => {
    const song = parseUsdx(SONG)
    const output = exportUsdx(song, {})
    expect(output).not.toContain('#P1')
    expect(output).not.toContain('#P2')
    expect(output).toContain(': 0 4 60 Hello')
    expect(output).toContain('E')
  })

  it('exports duet with P1/P2 blocks when singer 2 is assigned', () => {
    const song = parseUsdx(SONG)
    const output = exportUsdx(song, { 1: 2 }) // phrase 1 → singer 2
    expect(output).toContain('#P1')
    expect(output).toContain('#P2')
  })

  it('places phrases in correct P block', () => {
    const song = parseUsdx(SONG)
    const output = exportUsdx(song, { 1: 2 })
    const p1Start = output.indexOf('#P1')
    const p2Start = output.indexOf('#P2')
    // "Hello world" phrase is singer 1 → appears in P1 block
    expect(output.indexOf('Hello')).toBeGreaterThan(p1Start)
    expect(output.indexOf('Hello')).toBeLessThan(p2Start)
    // "Foo bar" phrase is singer 2 → appears in P2 block
    expect(output.indexOf('Foo')).toBeGreaterThan(p2Start)
  })

  it('upgrades #MP3 to #AUDIO in output', () => {
    const song = parseUsdx(SONG)
    const output = exportUsdx(song, {})
    expect(output).toContain('#AUDIO:test.mp3')
    expect(output).not.toContain('#MP3')
  })

  it('includes VERSION header', () => {
    const song = parseUsdx(SONG)
    const output = exportUsdx(song, {})
    expect(output).toContain('#VERSION:1.1.0')
  })

  it('writes #COMMENT when present in header', () => {
    const song = parseUsdx(SONG)
    song.header.comment = 'edited with usdx-editor on 2026-03-16, http://korczak.at/usdx-editor'
    const output = exportUsdx(song, {})
    expect(output).toContain('#COMMENT:edited with usdx-editor on 2026-03-16, http://korczak.at/usdx-editor')
  })

  it('parses #COMMENT from input', () => {
    const src = `#ARTIST:A\n#TITLE:T\n#BPM:120\n#GAP:0\n#COMMENT:original comment\n: 0 4 60 Hi\nE`
    const song = parseUsdx(src)
    expect(song.header.comment).toBe('original comment')
  })
})
