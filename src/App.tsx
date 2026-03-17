import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import type { DragEvent } from 'react'
import type { Track, UsdxHeader } from './parser/usdxParser'
import './App.css'
import { parseUsdx } from './parser/usdxParser'
import type { UsdxSong } from './parser/usdxParser'
import { phraseToSyllables } from './parser/lyrics'
import { exportUsdx } from './parser/usdxExporter'
import { GapSync } from './components/GapSync'
import { msToBeat } from './parser/timing'

// ── Directory loading ────────────────────────────────────────────────────────

type SongFileMap = Map<string, File>  // lowercase filename → File

function isValidUtf8(bytes: Uint8Array): boolean {
  let i = 0
  while (i < bytes.length) {
    const b = bytes[i]
    if (b < 0x80) { i++; continue }
    let len: number
    if ((b & 0xE0) === 0xC0) len = 2
    else if ((b & 0xF0) === 0xE0) len = 3
    else if ((b & 0xF8) === 0xF0) len = 4
    else return false  // 0x80-0xBF, 0xF8-0xFF — invalid start byte
    for (let j = 1; j < len; j++) {
      if (i + j >= bytes.length || (bytes[i + j] & 0xC0) !== 0x80) return false
    }
    i += len
  }
  return true
}

async function readTxtFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  const enc = isValidUtf8(bytes) ? 'utf-8' : 'windows-1252'
  return new TextDecoder(enc).decode(buf)
}

async function readDroppedEntry(entry: FileSystemEntry): Promise<SongFileMap> {
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

function findBackgroundFile(header: UsdxHeader, files: SongFileMap): File | null {
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

function findCoverFile(header: UsdxHeader, files: SongFileMap): File | null {
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

function fetchRemoteCover(artist: string, title: string): Promise<string | null> {
  const query = encodeURIComponent(`${artist} ${title}`)
  return fetch(`https://itunes.apple.com/search?term=${query}&entity=song&limit=1`)
    .then((r) => r.json())
    .then((data) => {
      const artwork = data.results?.[0]?.artworkUrl100
      return artwork ? artwork.replace('100x100bb', '600x600bb') : null
    })
    .catch(() => null)
}

// ── DropZone ─────────────────────────────────────────────────────────────────

function DropZone({ onLoad }: { onLoad: (song: UsdxSong, filename: string, files: SongFileMap) => void }) {
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const processFileMap = useCallback((files: SongFileMap) => {
    const txtFile = Array.from(files.values()).find((f) => f.name.toLowerCase().endsWith('.txt'))
    if (!txtFile) { setError('Keine .txt-Datei im Ordner gefunden.'); return }
    setError(null)
    readTxtFile(txtFile).then((text) => onLoad(parseUsdx(text), txtFile.name, files))
  }, [onLoad])

  const onDrop = async (e: DragEvent<HTMLLabelElement>) => {
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

  return (
    <label
      className={`drop-zone${dragOver ? ' drag-over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div className="drop-zone-icon">🎵</div>
      <h2>Song-Dateien öffnen</h2>
      <p>Song-Ordner hierher ziehen — oder klicken, Ordner öffnen und alle Dateien auswählen ({navigator.platform.includes('Mac') ? '⌘' : 'Strg'}+A)</p>
      {error && <p className="drop-zone-error">{error}</p>}
      <input type="file" multiple onChange={onFileInput} style={{ display: 'none' }} />
    </label>
  )
}

// ── CoverArt ─────────────────────────────────────────────────────────────────

function CoverArt({ header, files }: { header: UsdxHeader; files: SongFileMap }) {
  const localFile = useMemo(() => findCoverFile(header, files), [header, files])
  const localUrl = useMemo(
    () => (localFile ? URL.createObjectURL(localFile) : null),
    [localFile]
  )

  const [remoteUrl, setRemoteUrl] = useState<string | null>(null)
  const [showRemote, setShowRemote] = useState(false)
  const [loading, setLoading] = useState(false)

  // If no local cover, fetch remote automatically
  useEffect(() => {
    if (!localFile) {
      setLoading(true)
      fetchRemoteCover(header.artist, header.title).then((url) => {
        setRemoteUrl(url)
        if (url) setShowRemote(true)
        setLoading(false)
      })
    }
  }, [localFile, header.artist, header.title])

  const handleFlip = () => {
    if (remoteUrl) {
      setShowRemote((v) => !v)
      return
    }
    setLoading(true)
    fetchRemoteCover(header.artist, header.title).then((url) => {
      setRemoteUrl(url)
      if (url) setShowRemote(true)
      setLoading(false)
    })
  }

  const handleDownload = () => {
    if (!remoteUrl) return
    const a = document.createElement('a')
    a.href = remoteUrl
    a.download = header.cover ?? `${header.artist} - ${header.title} [CO].jpg`
    a.target = '_blank'
    a.click()
  }

  const displayUrl = showRemote ? remoteUrl : localUrl

  if (loading && !displayUrl) {
    return <div className="song-cover song-cover--placeholder">♪</div>
  }

  if (!displayUrl) return null

  return (
    <div className="song-cover-wrap">
      <img className="song-cover" src={displayUrl} alt="Cover" />
      <div className="song-cover-actions">
        {localFile && (
          <button
            className="cover-btn"
            onClick={handleFlip}
            title={showRemote ? 'Lokales Cover anzeigen' : 'Online-Cover laden'}
          >
            {loading ? '…' : showRemote ? '⬅' : '↺'}
          </button>
        )}
        {showRemote && remoteUrl && (
          <button className="cover-btn" onClick={handleDownload} title="Cover herunterladen">
            ↓
          </button>
        )}
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface ActivePos { phraseIndex: number; noteIndex: number }

function findActivePos(track: Track, beat: number): ActivePos | null {
  for (let pi = 0; pi < track.phrases.length; pi++) {
    const phrase = track.phrases[pi]
    for (let ni = 0; ni < phrase.notes.length; ni++) {
      const note = phrase.notes[ni]
      if (beat >= note.beat && beat < note.beat + note.length) {
        return { phraseIndex: pi, noteIndex: ni }
      }
    }
  }
  return null
}

// ── SongView ──────────────────────────────────────────────────────────────────

function SongView({ song, filename, files, onReset }: {
  song: UsdxSong
  filename: string
  files: SongFileMap
  onReset: () => void
}) {
  const { header, tracks } = song
  const track = tracks[0]
  const phraseCount = track?.phrases.length ?? 0

  const backgroundFile = useMemo(() => findBackgroundFile(header, files), [header, files])
  const backgroundUrl = useMemo(
    () => (backgroundFile ? URL.createObjectURL(backgroundFile) : null),
    [backgroundFile]
  )

  const [highlightGolden, setHighlightGolden] = useState(false)
  const [singerMap, setSingerMap] = useState<Record<number, 1 | 2>>({})
  const [singerNames, setSingerNames] = useState<[string, string]>(['', ''])
  const [gap, setGap] = useState(header.gap)
  const [activePos, setActivePos] = useState<ActivePos | null>(null)
  const activePhraseRef = useRef<HTMLDivElement | null>(null)
  const [warningDismissed, setWarningDismissed] = useState(false)

  const missingFiles = useMemo(() => {
    const missing: { tag: string; filename: string }[] = []
    const check = (tag: string, filename: string | undefined) => {
      if (filename && !files.has(filename.toLowerCase())) {
        missing.push({ tag, filename })
      }
    }
    check('AUDIO', header.audio)
    check('VIDEO', header.video)
    check('COVER', header.cover)
    check('BACKGROUND', header.background)
    return missing
  }, [header, files])

  const handleTimeUpdate = useCallback((currentMs: number) => {
    if (!track) return
    const beat = msToBeat(currentMs, header.bpm, gap)
    const pos = beat >= 0 ? findActivePos(track, beat) : null
    setActivePos(pos)
  }, [track, header.bpm, gap])

  const handleDownload = () => {
    const exportHeader = { ...header, gap }
    if (backgroundFile && !exportHeader.background) {
      exportHeader.background = backgroundFile.name
    }
    const songWithGap = { ...song, header: exportHeader }
    const content = exportUsdx(songWithGap, singerMap, singerNames)
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const toggleSinger = (i: number) => {
    setSingerMap((prev) => ({ ...prev, [i]: prev[i] === 2 ? 1 : 2 }))
  }

  const singerOf = (i: number): 1 | 2 => singerMap[i] ?? 1

  return (
    <div className="song-view">
      {/* ── Top bar: meta + actions ── */}
      <div className="song-meta">
        <CoverArt header={header} files={files} />
        <div className="song-title-block">
          <div className="song-title">{header.title}</div>
          <div className="song-artist">{header.artist}</div>
        </div>
        <div className="song-tags">
          {header.year && <span className="tag">{header.year}</span>}
          {header.language && <span className="tag">{header.language}</span>}
          {header.genre && <span className="tag">{header.genre}</span>}
          {header.edition && <span className="tag">{header.edition}</span>}
          <span className="tag">{Math.round(header.bpm / 4)} BPM</span>
        </div>
        <div className="meta-actions">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={highlightGolden}
              onChange={(e) => setHighlightGolden(e.target.checked)}
            />
            Golden Notes
          </label>
          <button className="btn-primary" onClick={handleDownload}>Speichern</button>
          <button className="btn-secondary" onClick={onReset} title={filename}>Andere Datei</button>
        </div>
      </div>

      {/* ── Missing files warning ── */}
      {missingFiles.length > 0 && !warningDismissed && (
        <div className="missing-files-banner">
          <span className="missing-files-icon">⚠</span>
          <span className="missing-files-text">Im Ordner nicht gefunden: </span>
          {missingFiles.map(({ tag, filename }) => (
            <span key={tag} className="missing-file-pill">{tag}: {filename}</span>
          ))}
          <button className="missing-files-dismiss" onClick={() => setWarningDismissed(true)} title="Schließen">✕</button>
        </div>
      )}

      {/* ── Two-column content ── */}
      <div className="song-content">
        {/* Left: lyrics (scrollable) */}
        <div className="lyrics-column">
          <div className="duet-header">
            <input
              className="singer-name-input singer-name-input--1"
              value={singerNames[0]}
              onChange={(e) => setSingerNames([e.target.value, singerNames[1]])}
              placeholder="Name von Sänger:in 1"
            />
            <span />
            <input
              className="singer-name-input singer-name-input--2"
              value={singerNames[1]}
              onChange={(e) => setSingerNames([singerNames[0], e.target.value])}
              placeholder="Name von Sänger:in 2"
            />
          </div>
          <div className="phrases">
            {Array.from({ length: phraseCount }, (_, i) => {
              const phrase = track.phrases[i]
              const singer = singerOf(i)
              const syllables = phraseToSyllables(phrase)
              const isActivePhrase = activePos?.phraseIndex === i

              const phraseEl = (
                <span className="phrase-text">
                  {syllables.map((s, j) => {
                    const isActiveNote = isActivePhrase && activePos?.noteIndex === j
                    return (
                      <span
                        key={j}
                        className={[
                          'syllable',
                          highlightGolden && s.type === '*' ? 'golden' : '',
                          s.type === 'F' ? 'freestyle' : '',
                          isActiveNote ? 'active-note' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        {j > 0 && s.startsWord ? ' ' : ''}{s.text}
                      </span>
                    )
                  })}
                </span>
              )

              return (
                <div
                  key={i}
                  ref={isActivePhrase ? (el) => {
                    if (el && el !== activePhraseRef.current) {
                      activePhraseRef.current = el
                      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                    }
                  } : undefined}
                  className={`phrase phrase--singer-${singer}${isActivePhrase ? ' phrase--active' : ''}`}
                >
                  <span className="phrase-number">{i + 1}</span>
                  <div className="phrase-col phrase-col--1">{singer === 1 && phraseEl}</div>
                  <button
                    className={`assign-btn assign-btn--${singer === 1 ? 'to2' : 'to1'}`}
                    onClick={() => toggleSinger(i)}
                    title={singer === 1 ? 'Zu Sänger 2 verschieben' : 'Zu Sänger 1 verschieben'}
                  >
                    {singer === 1 ? '→' : '←'}
                  </button>
                  <div className="phrase-col phrase-col--2">{singer === 2 && phraseEl}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: sticky video + GAP sidebar */}
        <aside className="video-sidebar">
          <GapSync gap={gap} onChange={setGap} onTimeUpdate={handleTimeUpdate} backgroundUrl={backgroundUrl ?? undefined} artist={header.artist} title={header.title} />
        </aside>
      </div>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [song, setSong] = useState<UsdxSong | null>(null)
  const [filename, setFilename] = useState('')
  const [files, setFiles] = useState<SongFileMap>(new Map())

  const handleLoad = useCallback((s: UsdxSong, name: string, f: SongFileMap) => {
    setSong(s)
    setFilename(name)
    setFiles(f)
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>USDX Editor</h1>
        <span className="subtitle">UltraStar Deluxe Song Editor</span>
      </header>
      <main className="app-main">
        {song
          ? <SongView song={song} filename={filename} files={files} onReset={() => setSong(null)} />
          : <DropZone onLoad={handleLoad} />
        }
      </main>
    </div>
  )
}
