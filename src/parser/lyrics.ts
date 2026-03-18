import type { Note, Phrase } from './usdxParser'

export interface DisplaySyllable {
  text: string
  type: Note['type']
  /** True if this syllable starts a new word (preceded by a space in the source) */
  startsWord: boolean
  /** Beat at which this syllable starts being sung */
  startBeat: number
  /**
   * Beat at which this syllable finishes — extended through any immediately
   * following `~` (hold/melisma) notes so the highlight stays on during stretches.
   */
  endBeat: number
}

/**
 * Converts the raw syllables of a phrase into display tokens,
 * stripping melisma (~) markers and preserving word boundaries.
 *
 * A syllable starts a new word when:
 *  - it has a leading space (most common convention), OR
 *  - the previous syllable had a trailing space (older files use suffix spaces).
 *
 * A standalone `~` note means "stretch the previous note" (melisma) and is
 * silently skipped — it never affects word boundaries, but it does extend the
 * `endBeat` of the preceding syllable so highlighting stays active during holds.
 */
export function phraseToSyllables(phrase: Phrase): DisplaySyllable[] {
  const result: DisplaySyllable[] = []
  let prevHadTrailingSpace = false
  let prevSyllableEnd = 0  // end beat of the last real syllable
  let chainPreGap = -1     // gap between prevSyllableEnd and the first ~ in the current chain

  for (let ni = 0; ni < phrase.notes.length; ni++) {
    const note = phrase.notes[ni]
    // Strip tilde markers: leading ~ = melisma continuation, trailing ~ = held note
    const raw = note.syllable.replace(/^~/, '').replace(/~$/, '')

    if (raw === '') {
      // Pure melisma / hold note — extend the endBeat of the preceding syllable
      // so it stays highlighted while the singer holds the note.
      if (result.length > 0) {
        const last = result[result.length - 1]
        const holdEnd = note.beat + note.length
        if (holdEnd > last.endBeat) last.endBeat = holdEnd

        // Pre-gap heuristic: record the gap between the preceding syllable's end
        // and the first ~ in this chain. A gap of 0 means the ~ immediately
        // follows the syllable — characteristic of a word-boundary hold (the singer
        // holds the last vowel while transitioning to the next word). Melismas
        // within a word typically start after a small gap (≥ 2 beats in real files).
        if (chainPreGap === -1) chainPreGap = note.beat - prevSyllableEnd

        // At the end of the chain (next note is a real syllable), fire the heuristic.
        const nextNote = phrase.notes[ni + 1]
        if (nextNote) {
          const nextRaw = nextNote.syllable.replace(/^~/, '').replace(/~$/, '')
          if (nextRaw !== '' && chainPreGap === 0) {
            prevHadTrailingSpace = true
          }
        }
      }
      continue
    }

    result.push({
      text: raw.trim(),
      type: note.type,
      startsWord: raw.startsWith(' ') || prevHadTrailingSpace,
      startBeat: note.beat,
      endBeat: note.beat + note.length,
    })
    prevHadTrailingSpace = raw.endsWith(' ')
    prevSyllableEnd = note.beat + note.length
    chainPreGap = -1  // reset for the next ~ chain
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
