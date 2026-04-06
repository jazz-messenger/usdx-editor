import { useState, useCallback, useRef } from 'react'
import type { DragEvent } from 'react'
import { parseUsdx } from '../parser/usdxParser'
import type { UsdxSong } from '../parser/usdxParser'
import { readTxtFile, readDroppedEntry, readDirectoryHandle } from '../utils/fileLoader'
import type { SongFileMap } from '../utils/fileLoader'
import { useLanguage } from '../i18n/LanguageContext'

type DirHandle = FileSystemDirectoryHandle | null

export function DropZone({ onLoad }: {
  onLoad: (song: UsdxSong, filename: string, files: SongFileMap, dirHandle: DirHandle) => void
}) {
  const { t } = useLanguage()
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingFiles, setPendingFiles] = useState<{
    txtFiles: File[]; allFiles: SongFileMap; dirHandle: DirHandle
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFileMap = useCallback((allFiles: SongFileMap, dirHandle: DirHandle = null) => {
    const txtFiles = Array.from(allFiles.values())
      .filter((f) => f.name.toLowerCase().endsWith('.txt'))
      .sort((a, b) => b.lastModified - a.lastModified)
    if (txtFiles.length === 0) { setError(t.dropzone.noTxt); return }
    if (txtFiles.length > 1) {
      setPendingFiles({ txtFiles, allFiles, dirHandle })
      return
    }
    setError(null)
    setPendingFiles(null)
    readTxtFile(txtFiles[0]).then((text) => onLoad(parseUsdx(text), txtFiles[0].name, allFiles, dirHandle))
  }, [onLoad, t])

  const pickTxtFile = useCallback((file: File, allFiles: SongFileMap, dirHandle: DirHandle) => {
    setPendingFiles(null)
    setError(null)
    readTxtFile(file).then((text) => onLoad(parseUsdx(text), file.name, allFiles, dirHandle))
  }, [onLoad])

  const onDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const item = e.dataTransfer.items[0]
    if (!item) return

    // Chrome/Edge: try File System Access API to get the directory handle
    if ('getAsFileSystemHandle' in item) {
      try {
        const handle = await (item as DataTransferItem & {
          getAsFileSystemHandle: () => Promise<FileSystemHandle>
        }).getAsFileSystemHandle()
        if (handle?.kind === 'directory') {
          const dirHandle = handle as FileSystemDirectoryHandle
          const files = await readDirectoryHandle(dirHandle)
          processFileMap(files, dirHandle)
          return
        }
      } catch { /* fall through */ }
    }

    // Fallback: legacy webkitGetAsEntry
    const entry = item.webkitGetAsEntry()
    if (!entry) return
    const files = await readDroppedEntry(entry)
    processFileMap(files, null)
  }

  const onFolderButton = async () => {
    // Chrome/Edge: use showDirectoryPicker to get a handle for startIn on save
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as Window & {
          showDirectoryPicker: (opts?: object) => Promise<FileSystemDirectoryHandle>
        }).showDirectoryPicker({ mode: 'read' })
        const files = await readDirectoryHandle(dirHandle)
        processFileMap(files, dirHandle)
        return
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        // Other error: fall through to file input
      }
    }
    fileInputRef.current?.click()
  }

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return
    const files: SongFileMap = new Map()
    for (const file of Array.from(e.target.files)) {
      files.set(file.name.toLowerCase(), file)
    }
    processFileMap(files, null)
  }

  if (pendingFiles) {
    const { txtFiles, allFiles, dirHandle } = pendingFiles
    return (
      <div className="drop-zone drop-zone--pick">
        <h2>{t.dropzone.multiTxtHeading}</h2>
        <p>{t.dropzone.multiTxtDesc}</p>
        <ul className="multi-txt-list">
          {txtFiles.map((f) => (
            <li key={f.name}>
              <button className="multi-txt-item" onClick={() => pickTxtFile(f, allFiles, dirHandle)}>
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
      <button className="btn-primary drop-zone-btn" onClick={onFolderButton}>
        {t.dropzone.button}
      </button>
      <input ref={fileInputRef} type="file" multiple onChange={onFileInput} style={{ display: 'none' }} />
    </div>
  )
}
