import { detectEncoding } from './encoding'
import type { UsdxHeader } from '../parser/usdxParser'

// ── Directory loading ────────────────────────────────────────────────────────

export type SongFileMap = Map<string, File>  // lowercase filename → File


export async function readTxtFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  return new TextDecoder(detectEncoding(bytes)).decode(buf)
}

export async function readDroppedEntry(entry: FileSystemEntry): Promise<SongFileMap> {
  const files: SongFileMap = new Map()
  if (!entry.isDirectory) return files
  const reader = (entry as FileSystemDirectoryEntry).createReader()
  const entries: FileSystemEntry[] = await new Promise((resolve) =>
    reader.readEntries(resolve)
  )
  await Promise.all(
    entries.filter((e) => e.isFile).map(
      (e) => new Promise<void>((resolve) => {
        ;(e as FileSystemFileEntry).file((f) => {
          files.set(f.name.toLowerCase(), f)
          resolve()
        })
      })
    )
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

export function findVideoFile(header: UsdxHeader, files: SongFileMap): File | null {
  if (header.video) {
    const f = files.get(header.video.toLowerCase())
    if (f) return f
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
    .then((r) => r.json())
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
