import { detectEncoding } from './encoding'
import type { UsdxHeader } from '../parser/usdxParser'

// ── Directory loading ────────────────────────────────────────────────────────

export type SongFileMap = Map<string, File>  // lowercase filename → File


export async function readTxtFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  return new TextDecoder(detectEncoding(bytes)).decode(buf)
}

/** Resolves a file entry to its File, or null if the entry errors. */
function entryToFile(entry: FileSystemFileEntry): Promise<File | null> {
  return new Promise((resolve) => entry.file(resolve, () => resolve(null)))
}

export async function readDroppedEntry(entry: FileSystemEntry): Promise<SongFileMap> {
  const files: SongFileMap = new Map()

  // Single dropped file (not a folder)
  if (entry.isFile) {
    const f = await entryToFile(entry as FileSystemFileEntry)
    if (f) files.set(f.name.toLowerCase(), f)
    return files
  }
  if (!entry.isDirectory) return files

  // readEntries() returns at most ~100 entries per call (Chromium) — keep
  // calling until it comes back empty. Error callbacks resolve to [] / null
  // so a failing entry can never leave the promise hanging.
  const reader = (entry as FileSystemDirectoryEntry).createReader()
  const entries: FileSystemEntry[] = []
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve) =>
      reader.readEntries(resolve, () => resolve([]))
    )
    if (batch.length === 0) break
    entries.push(...batch)
  }

  await Promise.all(
    entries.filter((e) => e.isFile).map(async (e) => {
      const f = await entryToFile(e as FileSystemFileEntry)
      if (f) files.set(f.name.toLowerCase(), f)
    })
  )
  return files
}

// ── Media resolution ─────────────────────────────────────────────────────────
// One generic lookup drives cover/audio/video/background resolution.
// Priority order is always: header filename → folder scan → exact fallbacks.

const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|webp)$/i
const AUDIO_EXTENSIONS = /\.(mp3|ogg|flac|m4a|wav|aac|opus)$/i
const VIDEO_EXTENSIONS = /\.(mp4|mkv|avi|webm|mov|m4v|mpeg|mpg|wmv|flv)$/i

interface MediaLookup {
  /** Filename from the header tag (e.g. header.cover) — highest priority */
  headerName?: string
  /** Extension filter for the folder scan (map keys are lowercase) */
  extensions: RegExp
  /** Filename tag the folder scan additionally requires, e.g. '[co]' */
  tag?: string
  /** Exact filenames tried last, in order */
  fallbackNames?: string[]
}

/** Returns all candidate files in priority order (deduplicated by name). */
function findMediaFiles(files: SongFileMap, lookup: MediaLookup): File[] {
  const seen = new Set<string>()
  const result: File[] = []
  const add = (f: File | undefined) => {
    if (f && !seen.has(f.name)) { seen.add(f.name); result.push(f) }
  }

  if (lookup.headerName) add(files.get(lookup.headerName.toLowerCase()))
  for (const [name, file] of files) {
    if (lookup.tag && !name.includes(lookup.tag)) continue
    if (lookup.extensions.test(name)) add(file)
  }
  for (const name of lookup.fallbackNames ?? []) add(files.get(name))

  return result
}

/**
 * Returns the first folder file matching `extensions` when the header names
 * a file that is NOT present — i.e. a mismatch situation. Returns null when
 * there is no mismatch (no header entry, exact match, or empty folder).
 */
function findMismatch(headerName: string | undefined, files: SongFileMap, extensions: RegExp): File | null {
  if (!headerName) return null
  if (files.get(headerName.toLowerCase())) return null // exact match — no mismatch
  for (const [name, file] of files) {
    if (extensions.test(name)) return file
  }
  return null
}

/** Returns all candidate cover files in priority order (deduplicated). */
export function findCoverFiles(header: UsdxHeader, files: SongFileMap): File[] {
  return findMediaFiles(files, {
    headerName: header.cover,
    extensions: IMAGE_EXTENSIONS,
    tag: '[co]',
    fallbackNames: ['cover.jpg', 'cover.jpeg', 'cover.png', 'cover.webp'],
  })
}

export function findCoverFile(header: UsdxHeader, files: SongFileMap): File | null {
  return findCoverFiles(header, files)[0] ?? null
}

/** Returns all candidate audio files: header match first, then any audio file in the folder. */
export function findAudioFiles(header: UsdxHeader, files: SongFileMap): File[] {
  return findMediaFiles(files, { headerName: header.audio, extensions: AUDIO_EXTENSIONS })
}

export function findAudioFile(header: UsdxHeader, files: SongFileMap): File | null {
  return findAudioFiles(header, files)[0] ?? null
}

export function findAudioMismatch(header: UsdxHeader, files: SongFileMap): File | null {
  return findMismatch(header.audio, files, AUDIO_EXTENSIONS)
}

/** Returns all candidate video files: header match first, then any video file in the folder. */
export function findVideoFiles(header: UsdxHeader, files: SongFileMap): File[] {
  return findMediaFiles(files, { headerName: header.video, extensions: VIDEO_EXTENSIONS })
}

export function findVideoFile(header: UsdxHeader, files: SongFileMap): File | null {
  return findVideoFiles(header, files)[0] ?? null
}

export function findVideoMismatch(header: UsdxHeader, files: SongFileMap): File | null {
  return findMismatch(header.video, files, VIDEO_EXTENSIONS)
}

export function findBackgroundFile(header: UsdxHeader, files: SongFileMap): File | null {
  return findMediaFiles(files, {
    headerName: header.background,
    extensions: IMAGE_EXTENSIONS,
    tag: '[bg]',
    fallbackNames: ['background.jpg', 'background.jpeg', 'background.png', 'background.webp'],
  })[0] ?? null
}

/** Fetches up to 5 remote cover URLs from iTunes for the given artist + title. */
export function fetchRemoteCovers(artist: string, title: string): Promise<string[]> {
  const query = encodeURIComponent(`${artist} ${title}`)
  return fetch(`https://itunes.apple.com/search?term=${query}&entity=song&limit=5`)
    .then((r) => {
      if (!r.ok) throw new Error(`iTunes search failed: ${r.status}`)
      return r.json()
    })
    .then((data) => (data.results ?? [])
      .map((r: { artworkUrl100?: string }) => r.artworkUrl100)
      .filter(Boolean)
      .map((url: string) => url.replace('100x100bb', '600x600bb'))
    )
    .catch(() => [])
}

/** @deprecated Use fetchRemoteCovers instead */
export function fetchRemoteCover(artist: string, title: string): Promise<string | null> {
  return fetchRemoteCovers(artist, title).then((urls) => urls[0] ?? null)
}
