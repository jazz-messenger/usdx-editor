export type NoteType = ':' | '*' | 'F' | 'R' | 'G'

export interface Note {
  type: NoteType
  beat: number
  length: number
  pitch: number
  syllable: string
}

export interface Phrase {
  notes: Note[]
  /** Reconstructed lyric text for this phrase */
  text: string
  /** Beat at which the next phrase starts (from the - line) */
  lineBreakBeat?: number
}

export interface Track {
  /** Player number: 1 for P1, 2 for P2 (solo songs are always track 1) */
  player: 1 | 2
  phrases: Phrase[]
}

export interface UsdxHeader {
  title: string
  artist: string
  bpm: number
  gap: number
  /** Offset in seconds between the start of the video file and the start of the song.
   *  Positive value = the video has intro footage before the song begins. */
  videoGap?: number
  audio?: string
  video?: string
  cover?: string
  background?: string
  language?: string
  genre?: string
  year?: number
  edition?: string
  creator?: string
  previewStart?: number
  comment?: string
  [key: string]: unknown
}

export interface UsdxSong {
  header: UsdxHeader
  tracks: Track[]
}

const NOTE_TYPES = new Set([':', '*', 'F', 'R', 'G'])

function parseNumber(value: string): number {
  // USDX files sometimes use comma as decimal separator
  return parseFloat(value.replace(',', '.'))
}

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
}

function decodeHtml(value: string): string {
  return value.replace(/&[a-z]+;/gi, (entity) => HTML_ENTITIES[entity] ?? entity)
}

function buildPhraseText(notes: Note[]): string {
  return notes
    .map((n) => n.syllable.trimStart())
    .join('-')
    .replace(/-~/g, '~')
    .replace(/~$/, '')
}

export function parseUsdx(content: string): UsdxSong {
  const lines = content.split(/\r?\n/)

  const header: Partial<UsdxHeader> & Record<string, unknown> = {}
  const tracks: Track[] = []

  // Current state while parsing notes
  let currentPhrases: Phrase[] = []
  let currentNotes: Note[] = []

  const flushPhrase = (lineBreakBeat?: number) => {
    if (currentNotes.length > 0) {
      currentPhrases.push({
        notes: currentNotes,
        text: buildPhraseText(currentNotes),
        lineBreakBeat,
      })
      currentNotes = []
    }
  }

  const flushTrack = (player: 1 | 2) => {
    flushPhrase()
    if (currentPhrases.length > 0) {
      tracks.push({ player, phrases: currentPhrases })
      currentPhrases = []
    }
  }

  let currentPlayer: 1 | 2 = 1

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Header tags
    if (trimmed.startsWith('#')) {
      const colonIdx = trimmed.indexOf(':')
      if (colonIdx === -1) continue
      const tag = trimmed.slice(1, colonIdx).toUpperCase()
      const value = decodeHtml(trimmed.slice(colonIdx + 1))

      switch (tag) {
        case 'TITLE':
          header.title = value
          break
        case 'ARTIST':
          header.artist = value
          break
        case 'BPM':
          header.bpm = parseNumber(value)
          break
        case 'GAP':
          header.gap = parseNumber(value)
          break
        case 'VIDEOGAP':
          header.videoGap = parseNumber(value)
          break
        case 'AUDIO':
        case 'MP3':
          header.audio = value
          break
        case 'VIDEO':
          header.video = value
          break
        case 'COVER':
          header.cover = value
          break
        case 'BACKGROUND':
          header.background = value
          break
        case 'LANGUAGE':
          header.language = value
          break
        case 'GENRE':
          header.genre = value
          break
        case 'YEAR':
          header.year = parseInt(value, 10)
          break
        case 'EDITION':
          header.edition = value
          break
        case 'CREATOR':
          header.creator = value
          break
        case 'PREVIEWSTART':
          header.previewStart = parseNumber(value)
          break
        case 'COMMENT':
          header.comment = value
          break
        case 'P1':
          flushTrack(currentPlayer)
          currentPlayer = 1
          break
        case 'P2':
          flushTrack(currentPlayer)
          currentPlayer = 2
          break
        default:
          header[tag.toLowerCase()] = value
      }
      continue
    }

    // End of song
    if (trimmed === 'E') {
      flushTrack(currentPlayer)
      break
    }

    // Phrase separator: - beat [nextBeat]
    if (trimmed.startsWith('-')) {
      const parts = trimmed.split(/\s+/)
      const lineBreakBeat = parts[1] ? parseInt(parts[1], 10) : undefined
      flushPhrase(lineBreakBeat)
      continue
    }

    // Note line: type beat length pitch syllable
    const firstChar = trimmed[0]
    if (NOTE_TYPES.has(firstChar)) {
      const spaceAfterType = trimmed.indexOf(' ')
      const rest = trimmed.slice(spaceAfterType + 1)
      const parts = rest.split(' ')
      const beat = parseInt(parts[0], 10)
      const length = parseInt(parts[1], 10)
      const pitch = parseInt(parts[2], 10)
      // Syllable is extracted from the raw line (only newlines stripped) so that
      // trailing spaces — used as word-boundary markers in some USDX files — are preserved.
      const rawRest = line.replace(/[\r\n]+$/, '').trimStart().slice(spaceAfterType + 1)
      const syllableStart = rawRest.indexOf(' ', rawRest.indexOf(' ', rawRest.indexOf(' ') + 1) + 1)
      const syllable = syllableStart !== -1 ? rawRest.slice(syllableStart + 1) : ''

      currentNotes.push({ type: firstChar as NoteType, beat, length, pitch, syllable })
    }
  }

  return {
    header: header as UsdxHeader,
    tracks,
  }
}
