import type { Note, Phrase } from './usdxParser'

export interface DisplaySyllable {
  text: string
  type: Note['type']
  /** True if this syllable starts a new word (preceded by a space in the source) */
  startsWord: boolean
}

/**
 * Converts the raw syllables of a phrase into display tokens,
 * stripping melisma (~) markers and preserving word boundaries.
 */
export function phraseToSyllables(phrase: Phrase): DisplaySyllable[] {
  return phrase.notes
    .filter((n) => n.syllable !== '~')
    .map((note) => ({
      text: note.syllable.trimStart().replace(/~$/, ''),
      type: note.type,
      startsWord: note.syllable.startsWith(' '),
    }))
}

/**
 * Converts phrase syllables to a plain readable string.
 */
export function phraseToText(phrase: Phrase): string {
  return phraseToSyllables(phrase)
    .map((s, i) => (i > 0 && s.startsWord ? ' ' + s.text : s.text))
    .join('')
}
