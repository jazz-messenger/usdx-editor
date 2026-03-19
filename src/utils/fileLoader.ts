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

export function findCoverFile(header: UsdxHeader, files: SongFileMap): File | null {
  if (header.cover) {
    const f = files.get(header.cover.toLowerCase())
    if (f) return f
  }
  for (const [name, file] of files) {
    if (name.includes('[co]') && /\.(jpg|jpeg|png|webp)$/.test(name)) return file
  }
  for (const name of ['cover.jpg', 'cover.jpeg', 'cover.png', 'cover.webp']) {
    const f = files.get(name)
    if (f) return f
  }
  return null
}

export function fetchRemoteCover(artist: string, title: string): Promise<string | null> {
  const query = encodeURIComponent(`${artist} ${title}`)
  return fetch(`https://itunes.apple.com/search?term=${query}&entity=song&limit=1`)
    .then((r) => r.json())
    .then((data) => {
      const artwork = data.results?.[0]?.artworkUrl100
      return artwork ? artwork.replace('100x100bb', '600x600bb') : null
    })
    .catch(() => null)
}
