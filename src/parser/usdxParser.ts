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
  /** Seek offset in seconds applied to both audio and video on load.
   *  UltraStar skips this many seconds of intro before playback begins.
   *  GAP remains absolute from the file start — not relative to START. */
  start?: number
  audio?: string
  video?: string
  cover?: string
  background?: string
  /** URL of the video (e.g. YouTube) — UltraStar format spec v1.2.0 #VIDEOURL */
  videoUrl?: string
  /** URL of the cover image — UltraStar format spec v1.2.0 #COVERURL */
  coverUrl?: string
  language?: string
  genre?: string
  year?: number
  edition?: string
  creator?: string
  /** Who provided the song file — read-only, preserved as-is on save. */
  providedBy?: string
  previewStart?: number
  comment?: string
  singerP1?: string
  singerP2?: string
  tags?: string
  [key: string]: unknown
}

export interface UsdxSong {
  header: UsdxHeader
  tracks: Track[]
  /** Deprecated field names found during parsing (e.g. 'MP3', 'AUTHOR'). */
  deprecatedFields: string[]
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

// ── USDB embedded VIDEO params ────────────────────────────────────────────────
// Some community files store YouTube ID and metadata directly in #VIDEO:
//   #VIDEO:v=dQw4w9WgXcQ,co=cover.jpg,preview=108.62,p1=Singer A,p2=Singer B
// We extract the parameters and populate the appropriate header fields.

interface UsdbVideoParams {
  videoId?: string
  singerP1?: string
  singerP2?: string
  previewStart?: number
}

export function parseUsdbVideoField(value: string): UsdbVideoParams | null {
  // Must contain at least one key=value pair separated by commas
  if (!value.includes('=')) return null
  const params: UsdbVideoParams = {}
  let matched = false
  for (const part of value.split(',')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const key = part.slice(0, eq).trim().toLowerCase()
    const val = part.slice(eq + 1).trim()
    if (!val) continue
    if (key === 'v')       { params.videoId = val; matched = true }
    else if (key === 'p1') { params.singerP1 = val; matched = true }
    else if (key === 'p2') { params.singerP2 = val; matched = true }
    else if (key === 'preview') {
      const n = parseFloat(val)
      if (!isNaN(n)) { params.previewStart = n; matched = true }
    }
    // co= is a USDB-internal cover filename — not a usable URL, ignored
  }
  return matched ? params : null
}

// ── Declarative header field maps ─────────────────────────────────────────────

const STRING_FIELDS: Record<string, keyof UsdxHeader> = {
  TITLE: 'title', ARTIST: 'artist', AUDIO: 'audio',
  COVER: 'cover', BACKGROUND: 'background', VIDEOURL: 'videoUrl',
  COVERURL: 'coverUrl', LANGUAGE: 'language', GENRE: 'genre',
  EDITION: 'edition', TAGS: 'tags', CREATOR: 'creator',
  COMMENT: 'comment', PROVIDEDBY: 'providedBy',
}

const FLOAT_FIELDS: Record<string, keyof UsdxHeader> = {
  BPM: 'bpm', GAP: 'gap', VIDEOGAP: 'videoGap', PREVIEWSTART: 'previewStart', START: 'start',
}

const INT_FIELDS: Record<string, keyof UsdxHeader> = {
  YEAR: 'year',
}

export function parseUsdx(content: string): UsdxSong {
  const lines = content.split(/\r?\n/)

  const header: Partial<UsdxHeader> & Record<string, unknown> = {}
  const tracks: Track[] = []
  const deprecatedFields: string[] = []

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

      // ── Declarative field maps ────────────────────────────────────────────
      if (tag in STRING_FIELDS) {
        header[STRING_FIELDS[tag]] = value
        continue
      }
      if (tag in FLOAT_FIELDS) {
        header[FLOAT_FIELDS[tag]] = parseNumber(value)
        continue
      }
      if (tag in INT_FIELDS) {
        header[INT_FIELDS[tag]] = parseInt(value, 10)
        continue
      }

      // ── Special fields ────────────────────────────────────────────────────
      if (tag === 'P1') { if (value) header.singerP1 = value; continue }
      if (tag === 'P2') { if (value) header.singerP2 = value; continue }

      if (tag === 'VIDEO') {
        const usdb = parseUsdbVideoField(value)
        if (usdb) {
          // USDB embedded format — extract params, do NOT treat as a filename
          if (usdb.videoId && !header.videoUrl)
            header.videoUrl = `https://www.youtube.com/watch?v=${usdb.videoId}`
          if (usdb.singerP1 && !header.singerP1) header.singerP1 = usdb.singerP1
          if (usdb.singerP2 && !header.singerP2) header.singerP2 = usdb.singerP2
          if (usdb.previewStart !== undefined && header.previewStart === undefined)
            header.previewStart = usdb.previewStart
          // Leave header.video undefined — no actual video file
        } else {
          header.video = value
        }
        continue
      }

      // ── Deprecated fields: migrate where possible, always track ──────────
      if (tag === 'MP3') {
        if (!header.audio) header.audio = value
        deprecatedFields.push('MP3')
        continue
      }
      if (tag === 'AUTHOR') {
        if (!header.creator) header.creator = value
        deprecatedFields.push('AUTHOR')
        continue
      }
      if (tag === 'PREVIEW') {
        if (header.previewStart === undefined) header.previewStart = parseNumber(value)
        deprecatedFields.push('PREVIEW')
        continue
      }
      if (tag === 'DUETSINGERP1') {
        if (!header.singerP1) header.singerP1 = value
        deprecatedFields.push('DUETSINGERP1')
        continue
      }
      if (tag === 'DUETSINGERP2') {
        if (!header.singerP2) header.singerP2 = value
        deprecatedFields.push('DUETSINGERP2')
        continue
      }
      if (tag === 'YOUTUBE') {
        if (!header.videoUrl) header.videoUrl = value
        deprecatedFields.push('YOUTUBE')
        continue
      }
      if (['ALBUM', 'SOURCE', 'LENGTH', 'FIXER', 'RESOLUTION', 'NOTESGAP', 'RELATIVE', 'ENCODING'].includes(tag)) {
        deprecatedFields.push(tag)
        continue
      }

      // ── Unknown fields: store as-is ───────────────────────────────────────
      header[tag.toLowerCase()] = value
      continue
    }

    // Player section markers (bare P1 / P2 without # prefix)
    if (trimmed === 'P1') { flushTrack(currentPlayer); currentPlayer = 1; continue }
    if (trimmed === 'P2') { flushTrack(currentPlayer); currentPlayer = 2; continue }

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
    deprecatedFields,
  }
}
