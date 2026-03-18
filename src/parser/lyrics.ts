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

        // Beat-gap heuristic: when a hold note is the last in its chain
        // (next note is a real syllable, not another ~) and the gap to that
        // next note is > 2 beats, treat it as a word boundary.
        // This handles files that omit space markers between words separated
        // by a hold (e.g. "steps ~ on" in Teardrops, gap = 4).
        // Melismas within a word have gaps of ≤ 2 beats and are unaffected.
        const nextNote = phrase.notes[ni + 1]
        if (nextNote) {
          const nextRaw = nextNote.syllable.replace(/^~/, '').replace(/~$/, '')
          const isChainEnd = nextRaw !== ''
          if (isChainEnd && nextNote.beat - holdEnd > 2) {
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
