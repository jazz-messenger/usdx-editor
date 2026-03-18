import { describe, it, expect } from 'vitest'
import { phraseToSyllables, phraseToText } from './lyrics'
import type { Phrase } from './usdxParser'

function makePhrase(syllables: string[]): Phrase {
  return {
    notes: syllables.map((s, i) => ({ type: ':', beat: i * 4, length: 4, pitch: 60, syllable: s })),
    text: '',
  }
}

describe('phraseToSyllables', () => {
  it('marks syllables with leading space as startsWord', () => {
    const phrase = makePhrase(['Foot', 'steps', ' on'])
    const result = phraseToSyllables(phrase)
    expect(result[0].startsWord).toBe(false)
    expect(result[1].startsWord).toBe(false)
    expect(result[2].startsWord).toBe(true)
  })

  it('skips ~ without affecting word boundaries', () => {
    // ~ is a musical hold only — it does NOT create a word boundary.
    // Real melismas have a small gap before the ~ (here 2 beats, matching
    // actual BSB file patterns). Only holds that start at gap=0 are treated
    // as word-boundary holds.
    const phrase: Phrase = {
      notes: [
        { type: ':', beat: 0,  length: 4, pitch: 60, syllable: 'bo' },
        { type: ':', beat: 6,  length: 4, pitch: 60, syllable: '~' },  // pre-gap = 2
        { type: ':', beat: 12, length: 4, pitch: 60, syllable: 'dy' },
      ],
      text: '',
    }
    const result = phraseToSyllables(phrase)
    expect(result).toHaveLength(2)       // ~ filtered out
    expect(result[1].text).toBe('dy')
    expect(result[1].startsWord).toBe(false) // same word: "body"
  })

  it('~ extends endBeat of preceding syllable so highlight stays on during holds', () => {
    // bo at beat 0, len 4 → endBeat would be 4 without ~
    // ~ at beat 4, len 4 → should extend bo's endBeat to 8
    // ~ at beat 8, len 4 → should extend bo's endBeat to 12
    const phrase: Phrase = {
      notes: [
        { type: ':', beat: 0,  length: 4, pitch: 60, syllable: 'bo' },
        { type: ':', beat: 4,  length: 4, pitch: 60, syllable: '~' },
        { type: ':', beat: 8,  length: 4, pitch: 60, syllable: '~' },
        { type: ':', beat: 12, length: 4, pitch: 60, syllable: 'dy' },
      ],
      text: '',
    }
    const result = phraseToSyllables(phrase)
    expect(result).toHaveLength(2)
    expect(result[0].startBeat).toBe(0)
    expect(result[0].endBeat).toBe(12)   // extended through both ~ notes
    expect(result[1].startBeat).toBe(12)
    expect(result[1].endBeat).toBe(16)
  })

  it('~ between two words: word boundary from space, not from ~', () => {
    // Space on the next syllable — not the ~ — marks the word break
    const phrase = makePhrase(['sing', '~', ' on'])
    const result = phraseToSyllables(phrase)
    expect(result).toHaveLength(2)
    expect(result[1].text).toBe('on')
    expect(result[1].startsWord).toBe(true) // leading space does the work
  })

  it('does not add a space between syllables of the same word', () => {
    const phrase = makePhrase(['Foot', 'steps'])
    const result = phraseToSyllables(phrase)
    expect(result[0].startsWord).toBe(false)
    expect(result[1].startsWord).toBe(false)
  })

  it('strips ~ from end of syllable text', () => {
    const phrase = makePhrase(['go~'])
    const result = phraseToSyllables(phrase)
    expect(result[0].text).toBe('go')
  })

  it('marks syllable with trailing space as word boundary for the next syllable', () => {
    // "Rock " → next syllable starts a new word
    const phrase = makePhrase(['Rock ', 'your ', 'bo', 'dy'])
    const result = phraseToSyllables(phrase)
    expect(result[0].startsWord).toBe(false) // first syllable never startsWord
    expect(result[1].startsWord).toBe(true)  // "your" follows "Rock " (trailing space)
    expect(result[2].startsWord).toBe(true)  // "bo" follows "your " (trailing space)
    expect(result[3].startsWord).toBe(false) // "dy" is part of "body"
  })
})

describe('phraseToText', () => {
  it('trailing-space convention: Rock your body!', () => {
    // Backstreet Boys style: word boundary encoded as trailing space on current syllable
    const phrase: Phrase = {
      notes: [
        { type: ':', beat: 64, length: 2, pitch: 17, syllable: 'Rock ' },
        { type: ':', beat: 68, length: 2, pitch: 15, syllable: 'your ' },
        { type: ':', beat: 72, length: 8, pitch: 15, syllable: 'bo' },
        { type: ':', beat: 84, length: 2, pitch: 13, syllable: 'dy' },
        { type: ':', beat: 88, length: 6, pitch: 10, syllable: '~! ' },
      ],
      text: '',
    }
    expect(phraseToText(phrase)).toBe('Rock your body!')
  })

  it('melisma within a word does not split it: Everybody!', () => {
    // bo ~ ~ dy — the two ~ holds must not break "body" apart
    const phrase: Phrase = {
      notes: [
        { type: ':', beat: 1024, length: 2, pitch: 17, syllable: 'Ev' },
        { type: ':', beat: 1028, length: 2, pitch: 15, syllable: 'ery' },
        { type: ':', beat: 1032, length: 4, pitch: 15, syllable: 'bo' },
        { type: ':', beat: 1038, length: 1, pitch: 17, syllable: '~' },
        { type: ':', beat: 1040, length: 2, pitch: 15, syllable: '~' },
        { type: ':', beat: 1044, length: 2, pitch: 13, syllable: 'dy' },
        { type: ':', beat: 1048, length: 4, pitch: 10, syllable: '~! ' },
      ],
      text: '',
    }
    expect(phraseToText(phrase)).toBe('Everybody!')
  })

  it('melisma within a word + trailing-space boundaries: Rock your body right!', () => {
    const phrase: Phrase = {
      notes: [
        { type: ':', beat: 1064, length: 2, pitch: 10, syllable: 'Rock ' },
        { type: ':', beat: 1072, length: 4, pitch: 13, syllable: 'your ' },
        { type: ':', beat: 1080, length: 2, pitch: 15, syllable: 'bo' },
        { type: ':', beat: 1084, length: 2, pitch: 10, syllable: '~' },
        { type: ':', beat: 1088, length: 2, pitch: 10, syllable: 'dy ' },
        { type: ':', beat: 1092, length: 6, pitch: 10, syllable: 'right! ' },
      ],
      text: '',
    }
    expect(phraseToText(phrase)).toBe('Rock your body right!')
  })

  it('hold note with zero pre-gap signals word boundary: Whispers in the powder room', () => {
    // Real Teardrops data: pers (beat 861, len 4, ends 865) → ~ (beat 865, pre-gap=0)
    // → in (beat 873). The ~ starts exactly where pers ends → word boundary hold.
    const phrase: Phrase = {
      notes: [
        { type: ':', beat: 853, length: 3, pitch: 66, syllable: 'Whis' },
        { type: ':', beat: 861, length: 4, pitch: 62, syllable: 'pers' },
        { type: ':', beat: 865, length: 7, pitch: 61, syllable: '~' },
        { type: ':', beat: 873, length: 2, pitch: 59, syllable: 'in' },
        { type: ':', beat: 877, length: 2, pitch: 56, syllable: ' the' },
      ],
      text: '',
    }
    expect(phraseToText(phrase)).toBe('Whispers in the')
  })

  it('hold note with beat gap signals word boundary: Footsteps on the dance floor', () => {
    // Real Teardrops data: steps (beat 605, len 4) → ~ (beat 609, len 4, holdEnd 613)
    // → on (beat 617). Gap = 4 beats — large enough to be a word boundary,
    // not a melisma. Neither note has a space marker.
    const phrase: Phrase = {
      notes: [
        { type: ':', beat: 597, length: 3, pitch: 66, syllable: 'Foot' },
        { type: ':', beat: 605, length: 4, pitch: 62, syllable: 'steps' },
        { type: ':', beat: 609, length: 4, pitch: 61, syllable: '~' },
        { type: ':', beat: 617, length: 2, pitch: 59, syllable: 'on' },
        { type: ':', beat: 621, length: 2, pitch: 56, syllable: ' the' },
      ],
      text: '',
    }
    expect(phraseToText(phrase)).toBe('Footsteps on the')
  })

  it('trailing-space convention: Backstreet\'s back! Alright!', () => {
    const phrase: Phrase = {
      notes: [
        { type: ':', beat: 232, length: 2, pitch: 10, syllable: 'Back' },
        { type: ':', beat: 240, length: 4, pitch: 13, syllable: "street's " },
        { type: ':', beat: 248, length: 2, pitch: 15, syllable: 'back! ' },
        { type: '*', beat: 256, length: 2, pitch: 22, syllable: 'Al' },
        { type: '*', beat: 260, length: 6, pitch: 22, syllable: 'right! ' },
      ],
      text: '',
    }
    expect(phraseToText(phrase)).toBe("Backstreet's back! Alright!")
  })
})
