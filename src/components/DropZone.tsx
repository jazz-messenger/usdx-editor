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
  const [multiTxtNames, setMultiTxtNames] = useState<string[] | null>(null)

  const processFileMap = useCallback((files: SongFileMap) => {
    const txtFiles = Array.from(files.values()).filter((f) => f.name.toLowerCase().endsWith('.txt'))
    if (txtFiles.length === 0) { setError(t.dropzone.noTxt); return }
    if (txtFiles.length > 1) {
      setMultiTxtNames(txtFiles.map((f) => f.name))
      return
    }
    setError(null)
    setMultiTxtNames(null)
    readTxtFile(txtFiles[0]).then((text) => onLoad(parseUsdx(text), txtFiles[0].name, files))
  }, [onLoad, t])

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

  if (multiTxtNames) {
    return (
      <div className="drop-zone drop-zone--warning">
        <div className="drop-zone-icon">⚠️</div>
        <h2>{t.dropzone.multiTxtHeading}</h2>
        <p>{t.dropzone.multiTxtDesc(multiTxtNames.length)}</p>
        <ul className="multi-txt-list">
          {multiTxtNames.map((n) => <li key={n}>{n}</li>)}
        </ul>
        <button className="btn-primary" onClick={() => setMultiTxtNames(null)}>{t.dropzone.understood}</button>
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
