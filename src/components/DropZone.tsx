import { useState, useCallback } from 'react'
import type { DragEvent } from 'react'
import { parseUsdx } from '../parser/usdxParser'
import type { UsdxSong } from '../parser/usdxParser'
import { readTxtFile, readDroppedEntry } from '../utils/fileLoader'
import type { SongFileMap } from '../utils/fileLoader'
import { useLanguage } from '../i18n/LanguageContext'

export function DropZone({ onLoad }: { onLoad: (song: UsdxSong, filename: string, files: SongFileMap) => void }) {
  const { t } = useLanguage()
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingFiles, setPendingFiles] = useState<{ txtFiles: File[]; allFiles: SongFileMap } | null>(null)

  const processFileMap = useCallback((allFiles: SongFileMap) => {
    const txtFiles = Array.from(allFiles.values())
      .filter((f) => f.name.toLowerCase().endsWith('.txt'))
      .sort((a, b) => b.lastModified - a.lastModified)   // newest first
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
    const item = e.dataTransfer.items[0]
    if (!item) return
    const entry = item.webkitGetAsEntry()
    if (!entry) return
    const files = await readDroppedEntry(entry)
    processFileMap(files)
  }

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
      <p>{t.dropzone.instruction(navigator.platform.includes('Mac') ? '⌘' : 'Strg')}</p>
      {error && <p className="drop-zone-error">{error}</p>}
      <label className="btn-primary drop-zone-btn">
        {t.dropzone.button}
        <input type="file" multiple onChange={onFileInput} style={{ display: 'none' }} />
      </label>
    </div>
  )
}
