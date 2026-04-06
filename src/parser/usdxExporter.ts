import type { UsdxSong, Note, Phrase } from './usdxParser'

function noteToLine(note: Note): string {
  return `${note.type} ${note.beat} ${note.length} ${note.pitch} ${note.syllable}`
}

function phraseToLines(phrase: Phrase, isLast = false): string[] {
  const lines = phrase.notes.map(noteToLine)
  if (phrase.lineBreakBeat !== undefined) {
    lines.push(`- ${phrase.lineBreakBeat}`)
  } else if (!isLast) {
    lines.push('-')
  }
  return lines
}

/**
 * Serializes a UsdxSong back to USDX text format.
 *
 * @param song        The parsed song
 * @param singerMap   Maps phrase index → singer (1 | 2 | 3).
 *                    1 = P1 only, 2 = P2 only, 3 = both singers.
 *                    Phrases not in the map default to singer 1.
 *                    When all phrases are singer 1, a solo file is exported (no P1/P2 markers).
 * @param singerNames Optional display names for each singer [p1Name, p2Name].
 */
export function exportUsdx(
  song: UsdxSong,
  singerMap: Record<number, 1 | 2 | 3>,
  singerNames: [string, string] = ['', '']
): string {
  const lines: string[] = []
  const { header } = song

  // Header – mandatory fields first, then optional
  // #VERSION omitted until USDX officially supports it (currently causes song to be skipped)
  lines.push(`#TITLE:${header.title}`)
  lines.push(`#ARTIST:${header.artist}`)
  if (header.audio) lines.push(`${song.deprecatedFields.includes('MP3') ? '#MP3' : '#AUDIO'}:${header.audio}`)
  lines.push(`#BPM:${header.bpm}`)
  lines.push(`#GAP:${Math.round(header.gap)}`)
  if (header.videoGap)      lines.push(`#VIDEOGAP:${Math.round(header.videoGap)}`)
  if (header.video)         lines.push(`#VIDEO:${header.video}`)
  if (header.videoUrl)      lines.push(`#VIDEOURL:${header.videoUrl}`)
  if (header.cover)         lines.push(`#COVER:${header.cover}`)
  if (header.coverUrl)      lines.push(`#COVERURL:${header.coverUrl}`)
  if (header.background)    lines.push(`#BACKGROUND:${header.background}`)
  if (header.language)      lines.push(`#LANGUAGE:${header.language}`)
  if (header.genre)         lines.push(`#GENRE:${header.genre}`)
  if (header.year)          lines.push(`#YEAR:${header.year}`)
  if (header.edition)       lines.push(`#EDITION:${header.edition}`)
  if (header.tags)          lines.push(`#TAGS:${header.tags}`)
  if (header.creator)       lines.push(`#CREATOR:${header.creator}`)
  if (header.providedBy)    lines.push(`#PROVIDEDBY:${header.providedBy}`)
  if (header.previewStart !== undefined) lines.push(`#PREVIEWSTART:${header.previewStart}`)
  if (header.comment)       lines.push(`#COMMENT:${header.comment}`)

  const track = song.tracks[0]
  if (!track) {
    lines.push('E')
    return lines.join('\n')
  }

  const isDuet = track.phrases.some((_, i) => (singerMap[i] ?? 1) !== 1)

  if (!isDuet) {
    // Solo export – no P markers
    track.phrases.forEach((phrase, i) => {
      lines.push(...phraseToLines(phrase, i === track.phrases.length - 1))
    })
  } else {
    // Duet export: singer names go in header, bare P1/P2 mark sections in note area.
    // Singer 3 = both: phrase appears in both the P1 and P2 blocks.
    if (singerNames[0]) lines.push(`#P1:${singerNames[0]}`)
    if (singerNames[1]) lines.push(`#P2:${singerNames[1]}`)

    const p1Phrases = track.phrases.filter((_, i) => { const s = singerMap[i] ?? 1; return s === 1 || s === 3 })
    const p2Phrases = track.phrases.filter((_, i) => { const s = singerMap[i] ?? 1; return s === 2 || s === 3 })

    lines.push('P1')
    p1Phrases.forEach((phrase, i) => {
      lines.push(...phraseToLines(phrase, i === p1Phrases.length - 1))
    })

    lines.push('P2')
    p2Phrases.forEach((phrase, i) => {
      lines.push(...phraseToLines(phrase, i === p2Phrases.length - 1))
    })
  }

  lines.push('E')
  return lines.join('\n')
}
