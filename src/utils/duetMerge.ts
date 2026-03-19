import type { Track, Phrase } from '../parser/usdxParser'

export interface ActivePos { phraseIndex: number; beat: number }

export function phrasesEqual(a: Phrase, b: Phrase): boolean {
  if (a.notes.length !== b.notes.length) return false
  return a.notes.every((n, i) =>
    n.beat === b.notes[i].beat &&
    n.length === b.notes[i].length &&
    n.pitch === b.notes[i].pitch &&
    n.syllable === b.notes[i].syllable &&
    n.type === b.notes[i].type
  )
}

/** Merge duet tracks into a time-sorted phrase list, deduplicating identical
 *  phrases that appear in both P1 and P2 (exported with singer=3 / "both"). */
export function mergeDuetTracks(tracks: Track[]): { phrases: Phrase[]; singerMap: Record<number, 1 | 2 | 3> } {
  const tagged = tracks.flatMap(t => t.phrases.map(p => ({ phrase: p, player: t.player })))
  tagged.sort((a, b) => (a.phrase.notes[0]?.beat ?? 0) - (b.phrase.notes[0]?.beat ?? 0))

  const phrases: Phrase[] = []
  const singerMap: Record<number, 1 | 2 | 3> = {}
  let i = 0
  while (i < tagged.length) {
    const cur = tagged[i]
    const nxt = tagged[i + 1]
    // If two adjacent phrases from different players are note-for-note identical,
    // they represent a "sung by both" line — collapse them into one entry.
    if (nxt && cur.player !== nxt.player && phrasesEqual(cur.phrase, nxt.phrase)) {
      singerMap[phrases.length] = 3
      phrases.push(cur.phrase)
      i += 2
    } else {
      if (cur.player === 2) singerMap[phrases.length] = 2
      phrases.push(cur.phrase)
      i++
    }
  }
  return { phrases, singerMap }
}

export function findActivePos(track: Track, beat: number): ActivePos | null {
  for (let pi = 0; pi < track.phrases.length; pi++) {
    const phrase = track.phrases[pi]
    if (!phrase.notes.length) continue

    // Phrase window ends when the next phrase starts (or at lineBreakBeat)
    const phraseEndBeat =
      phrase.lineBreakBeat ??
      track.phrases[pi + 1]?.notes[0]?.beat ??
      Infinity

    // Return the first phrase where beat < phraseEndBeat — this is either the
    // currently active phrase, the next upcoming one (gap after lineBreakBeat),
    // or the first phrase (when beat is before the song starts).
    if (beat < phraseEndBeat) return { phraseIndex: pi, beat }
  }
  return null
}
