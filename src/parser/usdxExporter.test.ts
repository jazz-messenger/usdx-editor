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
    // Note-section markers are bare P1/P2 (no #); #P1:#NAME only written when singerNames provided
    expect(output).toContain('\nP1\n')
    expect(output).toContain('\nP2\n')
  })

  it('places phrases in correct P block', () => {
    const song = parseUsdx(SONG)
    const output = exportUsdx(song, { 1: 2 })
    const p1Start = output.indexOf('\nP1\n')
    const p2Start = output.indexOf('\nP2\n')
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

  it('writes singer names as #P1/#P2 in header for duets', () => {
    const song = parseUsdx(SONG)
    const output = exportUsdx(song, { 1: 2 }, ['Smudo', 'Thomas D.'])
    expect(output).toContain('#P1:Smudo')
    expect(output).toContain('#P2:Thomas D.')
    // Names must appear before the note section
    expect(output.indexOf('#P1:Smudo')).toBeLessThan(output.indexOf('\nP1\n'))
  })

  it('singer=3 (both) appears in both P1 and P2 blocks', () => {
    const song = parseUsdx(SONG)
    // phrase 0 = both singers, phrase 1 = singer 2
    const output = exportUsdx(song, { 0: 3, 1: 2 })
    const p1Start = output.indexOf('\nP1\n')
    const p2Start = output.indexOf('\nP2\n')
    // "Hello" is singer 3 → must appear in P1 block
    expect(output.indexOf('Hello')).toBeGreaterThan(p1Start)
    expect(output.indexOf('Hello')).toBeLessThan(p2Start)
    // "Hello" is singer 3 → must ALSO appear in P2 block
    const helloInP2 = output.indexOf('Hello', p2Start)
    expect(helloInP2).toBeGreaterThan(p2Start)
    // "Foo" is singer 2 → only in P2 block, not in P1
    expect(output.indexOf('Foo')).toBeGreaterThan(p2Start)
  })

  it('round-trips a duet: parse exported duet back to same structure', () => {
    const song = parseUsdx(SONG)
    const exported = exportUsdx(song, { 1: 2 }, ['P1-Name', 'P2-Name'])
    const reimported = parseUsdx(exported)
    expect(reimported.tracks).toHaveLength(2)
    expect(reimported.header.singerP1).toBe('P1-Name')
    expect(reimported.header.singerP2).toBe('P2-Name')
    expect(reimported.tracks[0].phrases[0].notes[0].syllable).toBe('Hello')
    expect(reimported.tracks[1].phrases[0].notes[0].syllable).toBe('Foo')
  })
})
