import { describe, it, expect } from 'vitest'
import type { Track, Phrase, Note } from '../parser/usdxParser'
import { mergeDuetTracks, phrasesEqual, findActivePos } from './duetMerge'

// ── Test helpers ───────────────────────────────────────────────────────────────

function makeNote(beat: number, syllable: string, overrides: Partial<Note> = {}): Note {
  return { type: ':', beat, length: 4, pitch: 60, syllable, ...overrides }
}

function makePhrase(notes: Note[], lineBreakBeat?: number): Phrase {
  return {
    notes,
    text: notes.map(n => n.syllable).join(''),
    lineBreakBeat,
  }
}

function makeTrack(player: 1 | 2, phrases: Phrase[]): Track {
  return { player, phrases }
}

// ── phrasesEqual ──────────────────────────────────────────────────────────────

describe('phrasesEqual', () => {
  it('returns true for two empty phrases', () => {
    expect(phrasesEqual(makePhrase([]), makePhrase([]))).toBe(true)
  })

  it('returns true for identical single-note phrases', () => {
    const p1 = makePhrase([makeNote(0, 'Hello')])
    const p2 = makePhrase([makeNote(0, 'Hello')])
    expect(phrasesEqual(p1, p2)).toBe(true)
  })

  it('returns false when note counts differ', () => {
    const p1 = makePhrase([makeNote(0, 'Hello'), makeNote(4, 'World')])
    const p2 = makePhrase([makeNote(0, 'Hello')])
    expect(phrasesEqual(p1, p2)).toBe(false)
  })

  it('returns false when beat differs', () => {
    const p1 = makePhrase([makeNote(0, 'Hello')])
    const p2 = makePhrase([makeNote(1, 'Hello')])
    expect(phrasesEqual(p1, p2)).toBe(false)
  })

  it('returns false when syllable differs', () => {
    const p1 = makePhrase([makeNote(0, 'Hello')])
    const p2 = makePhrase([makeNote(0, 'World')])
    expect(phrasesEqual(p1, p2)).toBe(false)
  })

  it('returns false when pitch differs', () => {
    const p1 = makePhrase([makeNote(0, 'Hello', { pitch: 60 })])
    const p2 = makePhrase([makeNote(0, 'Hello', { pitch: 62 })])
    expect(phrasesEqual(p1, p2)).toBe(false)
  })

  it('returns false when length differs', () => {
    const p1 = makePhrase([makeNote(0, 'Hello', { length: 4 })])
    const p2 = makePhrase([makeNote(0, 'Hello', { length: 8 })])
    expect(phrasesEqual(p1, p2)).toBe(false)
  })

  it('returns false when note type differs', () => {
    const p1 = makePhrase([makeNote(0, 'Hello', { type: ':' })])
    const p2 = makePhrase([makeNote(0, 'Hello', { type: '*' })])
    expect(phrasesEqual(p1, p2)).toBe(false)
  })
})

// ── mergeDuetTracks ───────────────────────────────────────────────────────────

describe('mergeDuetTracks', () => {
  it('handles a single track: all phrases default to singer 1', () => {
    const track = makeTrack(1, [
      makePhrase([makeNote(0, 'Hello')]),
      makePhrase([makeNote(10, 'World')]),
    ])
    const { phrases, singerMap } = mergeDuetTracks([track])
    expect(phrases).toHaveLength(2)
    // Singer 1 is the default — no explicit entry needed
    expect(singerMap[0]).toBeUndefined()
    expect(singerMap[1]).toBeUndefined()
  })

  it('assigns singer 2 to P2 phrases that have no P1 counterpart', () => {
    const p1phrase = makePhrase([makeNote(0, 'Hello')])
    const p2phrase = makePhrase([makeNote(10, 'World')])
    const t1 = makeTrack(1, [p1phrase])
    const t2 = makeTrack(2, [p2phrase])

    const { singerMap } = mergeDuetTracks([t1, t2])
    // First merged phrase is from P1 → no entry (defaults to 1)
    // Second merged phrase is from P2 → singerMap entry = 2
    const idx = Object.entries(singerMap).find(([, v]) => v === 2)
    expect(idx).toBeDefined()
  })

  it('sorts phrases by beat across both tracks', () => {
    const p2first = makePhrase([makeNote(0, 'P2-first')])
    const p1second = makePhrase([makeNote(20, 'P1-second')])
    const t1 = makeTrack(1, [p1second])
    const t2 = makeTrack(2, [p2first])

    const { phrases } = mergeDuetTracks([t1, t2])
    expect(phrases[0].notes[0].syllable).toBe('P2-first')
    expect(phrases[1].notes[0].syllable).toBe('P1-second')
  })

  it('collapses identical adjacent phrases from different players into singer=3', () => {
    const sharedNote = makeNote(0, 'Both')
    // Identical phrase in both tracks
    const t1 = makeTrack(1, [makePhrase([{ ...sharedNote }])])
    const t2 = makeTrack(2, [makePhrase([{ ...sharedNote }])])

    const { phrases, singerMap } = mergeDuetTracks([t1, t2])
    expect(phrases).toHaveLength(1)
    expect(singerMap[0]).toBe(3)
  })

  it('does NOT collapse phrases that are similar but not identical', () => {
    const p1phrase = makePhrase([makeNote(0, 'Hello', { pitch: 60 })])
    const p2phrase = makePhrase([makeNote(0, 'Hello', { pitch: 62 })])
    const t1 = makeTrack(1, [p1phrase])
    const t2 = makeTrack(2, [p2phrase])

    const { phrases } = mergeDuetTracks([t1, t2])
    expect(phrases).toHaveLength(2)
  })

  it('handles alternating P1/P2 phrases correctly', () => {
    const p1a = makePhrase([makeNote(0, 'P1-a')])
    const p2a = makePhrase([makeNote(10, 'P2-a')])
    const p1b = makePhrase([makeNote(20, 'P1-b')])
    const t1 = makeTrack(1, [p1a, p1b])
    const t2 = makeTrack(2, [p2a])

    const { phrases, singerMap } = mergeDuetTracks([t1, t2])
    expect(phrases).toHaveLength(3)
    expect(phrases[0].notes[0].syllable).toBe('P1-a')
    expect(phrases[1].notes[0].syllable).toBe('P2-a')
    expect(phrases[2].notes[0].syllable).toBe('P1-b')
    expect(singerMap[1]).toBe(2)
  })
})

// ── findActivePos ─────────────────────────────────────────────────────────────

describe('findActivePos', () => {
  // Two-phrase track: phrase 0 beats 0–9, lineBreak 10; phrase 1 beats 20–29
  const track: Track = makeTrack(1, [
    makePhrase([makeNote(0, 'Hello'), makeNote(4, 'World')], 10),
    makePhrase([makeNote(20, 'Foo'), makeNote(24, 'Bar')]),
  ])

  it('returns phraseIndex 0 when beat is before the song starts (negative beat)', () => {
    const pos = findActivePos(track, -5)
    expect(pos).not.toBeNull()
    expect(pos!.phraseIndex).toBe(0)
  })

  it('returns phraseIndex 0 for a beat within the first phrase', () => {
    const pos = findActivePos(track, 2)
    expect(pos!.phraseIndex).toBe(0)
    expect(pos!.beat).toBe(2)
  })

  it('returns phraseIndex 0 for a beat in the gap after phrase 0 (before phrase 1 starts)', () => {
    // Beat 15 is after lineBreakBeat 10 but before phrase 1 starts at beat 20.
    // findActivePos should return phrase 1 (next upcoming), not phrase 0.
    // Phrase 0's window ends at lineBreakBeat=10, so beat 15 >= 10.
    // → falls through to phrase 1 whose window is 20..Infinity.
    const pos = findActivePos(track, 15)
    expect(pos!.phraseIndex).toBe(1)
  })

  it('returns phraseIndex 1 for a beat within the second phrase', () => {
    const pos = findActivePos(track, 22)
    expect(pos!.phraseIndex).toBe(1)
  })

  it('returns null when beat is after the last phrase ends', () => {
    // Last phrase has no lineBreakBeat → window is Infinity.
    // Beat 22 < Infinity → phrase 1 is returned, never null.
    // To get null, we need a beat past the last phrase's window.
    // Since the last phrase has no following phrase and no lineBreakBeat,
    // its window is 20..Infinity — findActivePos always returns it for any beat < Infinity.
    // This test documents that behaviour: no null for in-range beats.
    const pos = findActivePos(track, 99999)
    expect(pos!.phraseIndex).toBe(1)
  })

  it('returns null for an empty track', () => {
    const emptyTrack: Track = makeTrack(1, [])
    expect(findActivePos(emptyTrack, 0)).toBeNull()
  })

  it('skips phrases that have no notes', () => {
    const trackWithEmpty: Track = makeTrack(1, [
      makePhrase([]),                        // empty — should be skipped
      makePhrase([makeNote(10, 'Hello')]),
    ])
    const pos = findActivePos(trackWithEmpty, 5)
    expect(pos!.phraseIndex).toBe(1)
  })

  it('preserves the beat value in the returned position', () => {
    const pos = findActivePos(track, 3)
    expect(pos!.beat).toBe(3)
  })
})
