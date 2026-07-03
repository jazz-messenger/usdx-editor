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

// ── Cover resolution ─────────────────────────────────────────────────────────

/** Returns all candidate cover files in priority order (deduplicated). */
export function findCoverFiles(header: UsdxHeader, files: SongFileMap): File[] {
  const seen = new Set<string>()
  const result: File[] = []
  const add = (f: File) => { if (!seen.has(f.name)) { seen.add(f.name); result.push(f) } }

  if (header.cover) {
    const f = files.get(header.cover.toLowerCase())
    if (f) add(f)
  }
  for (const [name, file] of files) {
    if (name.includes('[co]') && /\.(jpg|jpeg|png|webp)$/.test(name)) add(file)
  }
  for (const name of ['cover.jpg', 'cover.jpeg', 'cover.png', 'cover.webp']) {
    const f = files.get(name)
    if (f) add(f)
  }
  return result
}

export function findCoverFile(header: UsdxHeader, files: SongFileMap): File | null {
  return findCoverFiles(header, files)[0] ?? null
}

const AUDIO_EXTENSIONS = /\.(mp3|ogg|flac|m4a|wav|aac|opus)$/i

/** Returns all candidate audio files: header match first, then any audio file in the folder. */
export function findAudioFiles(header: UsdxHeader, files: SongFileMap): File[] {
  const seen = new Set<string>()
  const result: File[] = []
  const add = (f: File) => { if (!seen.has(f.name)) { seen.add(f.name); result.push(f) } }
  if (header.audio) {
    const f = files.get(header.audio.toLowerCase())
    if (f) add(f)
  }
  for (const [name, file] of files) {
    if (AUDIO_EXTENSIONS.test(name)) add(file)
  }
  return result
}

export function findAudioFile(header: UsdxHeader, files: SongFileMap): File | null {
  return findAudioFiles(header, files)[0] ?? null
}

/** Same mismatch logic as findVideoMismatch, but for #AUDIO. */
export function findAudioMismatch(
  header: UsdxHeader,
  files: SongFileMap,
): File | null {
  if (!header.audio) return null
  const exact = files.get(header.audio.toLowerCase())
  if (exact) return null
  for (const [name, file] of files) {
    if (AUDIO_EXTENSIONS.test(name)) return file
  }
  return null
}

const VIDEO_EXTENSIONS = /\.(mp4|mkv|avi|webm|mov|m4v|mpeg|mpg|wmv|flv)$/i

/** Returns all candidate video files: header match first, then any video file in the folder. */
export function findVideoFiles(header: UsdxHeader, files: SongFileMap): File[] {
  const seen = new Set<string>()
  const result: File[] = []
  const add = (f: File) => { if (!seen.has(f.name)) { seen.add(f.name); result.push(f) } }
  if (header.video) {
    const f = files.get(header.video.toLowerCase())
    if (f) add(f)
  }
  for (const [name, file] of files) {
    if (VIDEO_EXTENSIONS.test(name)) add(file)
  }
  return result
}

export function findVideoFile(header: UsdxHeader, files: SongFileMap): File | null {
  return findVideoFiles(header, files)[0] ?? null
}

/**
 * Returns the first video file found in the folder when it doesn't match
 * the filename stored in the header — i.e. a mismatch situation.
 * Returns null when there is no mismatch (either no header.video, exact match,
 * or no video file in the folder at all).
 */
export function findVideoMismatch(
  header: UsdxHeader,
  files: SongFileMap,
): File | null {
  if (!header.video) return null
  const exact = files.get(header.video.toLowerCase())
  if (exact) return null // exact match — no mismatch
  // Header names a file that isn't present; look for any video in the folder
  for (const [name, file] of files) {
    if (VIDEO_EXTENSIONS.test(name)) return file
  }
  return null
}

export function findBackgroundFile(header: UsdxHeader, files: SongFileMap): File | null {
  if (header.background) {
    const f = files.get(header.background.toLowerCase())
    if (f) return f
  }
  for (const [name, file] of files) {
    if (name.includes('[bg]') && /\.(jpg|jpeg|png|webp)$/.test(name)) return file
  }
  for (const name of ['background.jpg', 'background.jpeg', 'background.png', 'background.webp']) {
    const f = files.get(name)
    if (f) return f
  }
  return null
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
