import type { Note, Phrase } from './usdxParser'

export interface DisplaySyllable {
  text: string
  type: Note['type']
  /** True if this syllable starts a new word (preceded by a space in the source, or follows a melisma ~) */
  startsWord: boolean
}

/**
 * Converts the raw syllables of a phrase into display tokens,
 * stripping melisma (~) markers and preserving word boundaries.
 *
 * A syllable is treated as starting a new word when it has a leading space
 * OR when the immediately preceding note was a melisma (~).
 */
export function phraseToSyllables(phrase: Phrase): DisplaySyllable[] {
  const result: DisplaySyllable[] = []
  let prevWasTilde = false

  for (const note of phrase.notes) {
    if (note.syllable === '~') {
      prevWasTilde = true
      continue
    }
    result.push({
      text: note.syllable.trimStart().replace(/~$/, ''),
      type: note.type,
      startsWord: note.syllable.startsWith(' ') || prevWasTilde,
    })
    prevWasTilde = false
  }

  return result
}

/**
 * Converts phrase syllables to a plain readable string.
 */
export function phraseToText(phrase: Phrase): string {
  return phraseToSyllables(phrase)
    .map((s, i) => (i > 0 && s.startsWord ? ' ' + s.text : s.text))
    .join('')
}
