import { describe, it, expect } from 'vitest'
import { phraseToSyllables } from './lyrics'
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

  it('marks syllable after ~ as startsWord even without leading space', () => {
    const phrase = makePhrase(['Foot', 'steps', '~', 'on'])
    const result = phraseToSyllables(phrase)
    // ~ is filtered out
    expect(result).toHaveLength(3)
    expect(result[2].text).toBe('on')
    expect(result[2].startsWord).toBe(true)
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
})
