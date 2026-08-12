import { useState, useCallback } from 'react'
import type { DragEvent } from 'react'
import { parseUsdx } from '../parser/usdxParser'
import type { UsdxSong } from '../parser/usdxParser'
import { readTxtFile, readDroppedEntry } from '../utils/fileLoader'
import type { SongFileMap } from '../utils/fileLoader'
import { useLanguage } from '../i18n/useLanguage'

// Self-written demo song (fictional artist, generated audio and video) served
// from public/demo — fetched only when someone actually asks for it.
// The MIME types are spelled out rather than taken from the response: a File
// with an empty type produces a blob URL the <video> element refuses to play,
// and static hosts are not reliable about Content-Type for .wav / .webm.
const DEMO_FILES: { name: string; type: string }[] = [
  { name: 'Neon Skyline.txt', type: 'text/plain' },
  { name: 'Neon Skyline.wav', type: 'audio/wav' },
  { name: 'Neon Skyline.webm', type: 'video/webm' },
  { name: 'Neon Skyline [CO].png', type: 'image/png' },
]

export function DropZone({ onLoad }: { onLoad: (song: UsdxSong, filename: string, files: SongFileMap) => void }) {
  const { t } = useLanguage()
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingFiles, setPendingFiles] = useState<{ txtFiles: File[]; allFiles: SongFileMap } | null>(null)
  const [demoLoading, setDemoLoading] = useState(false)

  const processFileMap = useCallback((allFiles: SongFileMap) => {
    const txtFiles = Array.from(allFiles.values())
      .filter((f) => f.name.toLowerCase().endsWith('.txt'))
      .sort((a, b) => b.lastModified - a.lastModified)
    if (txtFiles.length === 0) { setError(t.dropzone.noTxt); return }
    if (txtFiles.length > 1) {
      setPendingFiles({ txtFiles, allFiles })
      return
    }
    setError(null)
    setPendingFiles(null)
    readTxtFile(txtFiles[0]).then((text) => onLoad(parseUsdx(text), txtFiles[0].name, allFiles))
  }, [onLoad, t])

  const pickTxtFile = useCallback((file: File, allFiles: SongFileMap) => {
    setPendingFiles(null)
    setError(null)
    readTxtFile(file).then((text) => onLoad(parseUsdx(text), file.name, allFiles))
  }, [onLoad])

  const onDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    // Resolve ALL entries synchronously before the first await — the browser
    // invalidates dataTransfer.items as soon as the handler yields.
    const entries = Array.from(e.dataTransfer.items)
      .map((item) => item.webkitGetAsEntry())
      .filter((entry): entry is FileSystemEntry => entry !== null)
    if (entries.length === 0) return
    // Supports a dropped folder, several files, or a mix — everything lands
    // in one flat map, later entries win on name collisions.
    const files: SongFileMap = new Map()
    for (const entry of entries) {
      for (const [name, file] of await readDroppedEntry(entry)) {
        files.set(name, file)
      }
    }
    processFileMap(files)
  }

  const loadDemo = useCallback(async () => {
    setDemoLoading(true)
    setError(null)
    try {
      const files: SongFileMap = new Map()
      await Promise.all(DEMO_FILES.map(async ({ name, type }) => {
        const res = await fetch(`${import.meta.env.BASE_URL}demo/${encodeURIComponent(name)}`)
        if (!res.ok) throw new Error(`${name}: ${res.status}`)
        files.set(name.toLowerCase(), new File([await res.blob()], name, { type }))
      }))
      processFileMap(files)
    } catch {
      setError(t.dropzone.demoError)
    } finally {
      setDemoLoading(false)
    }
  }, [processFileMap, t])

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return
    const files: SongFileMap = new Map()
    for (const file of Array.from(e.target.files)) {
      files.set(file.name.toLowerCase(), file)
    }
    processFileMap(files)
  }

  if (pendingFiles) {
    const { txtFiles, allFiles } = pendingFiles
    return (
      <div className="drop-zone drop-zone--pick">
        <h2>{t.dropzone.multiTxtHeading}</h2>
        <p>{t.dropzone.multiTxtDesc}</p>
        <ul className="multi-txt-list">
          {txtFiles.map((f) => (
            <li key={f.name}>
              <button className="multi-txt-item" onClick={() => pickTxtFile(f, allFiles)}>
                <span className="multi-txt-name">{f.name}</span>
                <span className="multi-txt-date">
                  {new Date(f.lastModified).toLocaleDateString(undefined, {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <button className="btn-secondary" onClick={() => setPendingFiles(null)}>{t.dropzone.cancel}</button>
      </div>
    )
  }

  return (
    <div
      className={`drop-zone${dragOver ? ' drag-over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div className="drop-zone-icon">🎵</div>
      <h2>{t.dropzone.heading}</h2>
      <p>{t.dropzone.instruction(/Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Strg')}</p>
      {error && <p className="drop-zone-error" role="alert">{error}</p>}
      <label className="btn-primary drop-zone-btn">
        {t.dropzone.button}
        <input type="file" multiple onChange={onFileInput} style={{ display: 'none' }} />
      </label>

      <div className="drop-zone-demo">
        <span className="drop-zone-or">{t.dropzone.or}</span>
        <button className="btn-secondary drop-zone-demo-btn" onClick={loadDemo} disabled={demoLoading}>
          {demoLoading ? t.dropzone.demoLoading : t.dropzone.demoButton}
        </button>
        <span className="drop-zone-demo-hint">{t.dropzone.demoHint}</span>
      </div>
    </div>
  )
}
