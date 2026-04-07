import { describe, it, expect } from 'vitest'
import { parseUsdx } from './usdxParser'
import { exportUsdx } from './usdxExporter'
import { mergeDuetTracks } from '../utils/duetMerge'

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

  it('preserves #MP3 tag for USDX compatibility (no upgrade to #AUDIO)', () => {
    const song = parseUsdx(SONG)
    const output = exportUsdx(song, {})
    expect(output).toContain('#MP3:test.mp3')
    expect(output).not.toContain('#AUDIO')
  })

  it('keeps #AUDIO when original file used #AUDIO', () => {
    const song = parseUsdx(SONG.replace('#MP3:test.mp3', '#AUDIO:test.mp3'))
    const output = exportUsdx(song, {})
    expect(output).toContain('#AUDIO:test.mp3')
    expect(output).not.toContain('#MP3')
  })

  it('preserves #START when present', () => {
    const src = SONG.replace('#GAP:1000', '#GAP:1000\n#START:89')
    const song = parseUsdx(src)
    expect(song.header.start).toBe(89)
    const output = exportUsdx(song, {})
    expect(output).toContain('#START:89')
  })

  it('omits #START when not set', () => {
    const song = parseUsdx(SONG)
    const output = exportUsdx(song, {})
    expect(output).not.toContain('#START')
  })

  it('omits #AUDIO/#MP3 when audio filename equals video filename', () => {
    // When audio and video are the same file, UltraStar uses the video's audio track.
    // Including both causes VIDEOGAP to be applied to the audio too (double offset).
    const src = SONG.replace('#MP3:test.mp3', '#AUDIO:song.mp4\n#VIDEO:song.mp4')
    const song = parseUsdx(src)
    const output = exportUsdx(song, {})
    expect(output).not.toContain('#AUDIO')
    expect(output).not.toContain('#MP3')
    expect(output).toContain('#VIDEO:song.mp4')
  })

  it('keeps #AUDIO when audio and video have different filenames', () => {
    const src = SONG.replace('#MP3:test.mp3', '#AUDIO:song.mp3\n#VIDEO:song.mp4')
    const song = parseUsdx(src)
    const output = exportUsdx(song, {})
    expect(output).toContain('#AUDIO:song.mp3')
    expect(output).toContain('#VIDEO:song.mp4')
  })

  it('does not write a trailing bare dash before E', () => {
    // A bare "-" as the last line before "E" causes USDX to skip the song
    const song = parseUsdx(SONG)
    const output = exportUsdx(song, {})
    expect(output).not.toMatch(/-\nE$/)
  })

  it('does not include #VERSION (not supported by USDX yet)', () => {
    const song = parseUsdx(SONG)
    const output = exportUsdx(song, {})
    expect(output).not.toContain('#VERSION')
  })

  it('writes #COMMENT when present in header', () => {
    const song = parseUsdx(SONG)
    song.header.comment = 'edited with usdx-editor on 2026-03-16, https://github.com/jazz-messenger/usdx-editor'
    const output = exportUsdx(song, {})
    expect(output).toContain('#COMMENT:edited with usdx-editor on 2026-03-16, https://github.com/jazz-messenger/usdx-editor')
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

  /**
   * Regression: when a song already has P1/P2 sections (song.tracks.length === 2),
   * the exporter must be given the MERGED track (all phrases, correct singerMap indices)
   * rather than song.tracks[0] alone — otherwise all P2 phrases are silently dropped.
   * SongView passes `track` (the display/merged track) to the exporter for this reason.
   */
  it('preserves all phrases when exporting a pre-existing duet via merged track', () => {
    const DUET = `#ARTIST:A\n#TITLE:T\n#BPM:120\n#GAP:0\n#P1:Alice\n#P2:Bob\nP1\n: 0 4 60 One\n- 10\n: 20 4 60 Three\n- 30\nP2\n: 10 4 62 Two\n- 20\n: 30 4 62 Four\n- 40\nE`
    const song = parseUsdx(DUET)
    // Simulate what SongView does: merge the tracks and build singerMap
    const merged = mergeDuetTracks(song.tracks)
    // merged.phrases should be [One, Two, Three, Four] in beat order
    // merged.singerMap: 0→1, 1→2, 2→1, 3→2
    const mergedTrack = { player: 1 as const, phrases: merged.phrases }

    // Export with the merged track (as SongView does)
    const output = exportUsdx({ ...song, tracks: [mergedTrack] }, merged.singerMap, ['Alice', 'Bob'])

    // All four phrases must be present in the output
    expect(output).toContain('One')
    expect(output).toContain('Two')
    expect(output).toContain('Three')
    expect(output).toContain('Four')

    // Re-parse should produce 2 tracks with 2 phrases each
    const reimported = parseUsdx(output)
    expect(reimported.tracks).toHaveLength(2)
    const allNotes = reimported.tracks.flatMap(t => t.phrases.flatMap(p => p.notes.map(n => n.syllable)))
    expect(allNotes).toContain('One')
    expect(allNotes).toContain('Two')
    expect(allNotes).toContain('Three')
    expect(allNotes).toContain('Four')
  })
})
