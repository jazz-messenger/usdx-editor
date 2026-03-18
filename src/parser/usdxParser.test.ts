import { describe, it, expect } from 'vitest'
import { parseUsdx } from './usdxParser'

const MINIMAL_SONG = `#ARTIST:Womack And Womack
#TITLE:Teardrops
#MP3:Womack And Womack - Teardrops.mp3
#BPM:267,2
#GAP:15381,74
: 0 4 59 When
: 4 3 63 e
: 8 4 66 ver
- 45 60
: 80 4 63 Re
: 84 4 66 mind
- 119 120
E`

describe('parseUsdx', () => {
  describe('header', () => {
    it('parses artist and title', () => {
      const result = parseUsdx(MINIMAL_SONG)
      expect(result.header.artist).toBe('Womack And Womack')
      expect(result.header.title).toBe('Teardrops')
    })

    it('parses BPM with comma as decimal separator', () => {
      const result = parseUsdx(MINIMAL_SONG)
      expect(result.header.bpm).toBe(267.2)
    })

    it('parses GAP with comma as decimal separator', () => {
      const result = parseUsdx(MINIMAL_SONG)
      expect(result.header.gap).toBe(15381.74)
    })

    it('parses audio file (legacy #MP3)', () => {
      const result = parseUsdx(MINIMAL_SONG)
      expect(result.header.audio).toBe('Womack And Womack - Teardrops.mp3')
    })
  })

  describe('notes', () => {
    it('parses normal notes', () => {
      const result = parseUsdx(MINIMAL_SONG)
      const firstNote = result.tracks[0].phrases[0].notes[0]
      expect(firstNote.type).toBe(':')
      expect(firstNote.beat).toBe(0)
      expect(firstNote.length).toBe(4)
      expect(firstNote.pitch).toBe(59)
      expect(firstNote.syllable).toBe('When')
    })

    it('groups notes into phrases separated by -', () => {
      const result = parseUsdx(MINIMAL_SONG)
      expect(result.tracks[0].phrases).toHaveLength(2)
      expect(result.tracks[0].phrases[0].notes).toHaveLength(3)
      expect(result.tracks[0].phrases[1].notes).toHaveLength(2)
    })

    it('reconstructs lyrics per phrase', () => {
      const result = parseUsdx(MINIMAL_SONG)
      expect(result.tracks[0].phrases[0].text).toBe('When-e-ver')
      expect(result.tracks[0].phrases[1].text).toBe('Re-mind')
    })

    it('preserves trailing space in syllable (word boundary marker)', () => {
      const input = `#TITLE:T\n#ARTIST:A\n#BPM:120\n#GAP:0\n: 64 2 17 Rock \n: 68 2 15 your \n: 72 8 15 bo\nE`
      const song = parseUsdx(input)
      const notes = song.tracks[0].phrases[0].notes
      expect(notes[0].syllable).toBe('Rock ')
      expect(notes[1].syllable).toBe('your ')
      expect(notes[2].syllable).toBe('bo')
    })
  })

  describe('duet', () => {
    const DUET = `#ARTIST:Die Fantastischen Vier
#TITLE:Die Da
#BPM:120
#GAP:0
#P1:Smudo
#P2:Thomas D.
P1
: 0 4 60 Hello
- 10
P2
: 20 4 62 World
- 30
E`

    it('creates two tracks for P1/P2 section markers', () => {
      const song = parseUsdx(DUET)
      expect(song.tracks).toHaveLength(2)
      expect(song.tracks[0].player).toBe(1)
      expect(song.tracks[1].player).toBe(2)
    })

    it('assigns notes to the correct track', () => {
      const song = parseUsdx(DUET)
      expect(song.tracks[0].phrases[0].notes[0].syllable).toBe('Hello')
      expect(song.tracks[1].phrases[0].notes[0].syllable).toBe('World')
    })

    it('parses #P1/#P2 singer names without switching tracks', () => {
      const song = parseUsdx(DUET)
      expect(song.header.singerP1).toBe('Smudo')
      expect(song.header.singerP2).toBe('Thomas D.')
      // Singer name headers must NOT put notes into the wrong track
      expect(song.tracks[0].phrases[0].notes[0].syllable).toBe('Hello')
    })
  })
})
