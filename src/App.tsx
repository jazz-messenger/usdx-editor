import { useState, useCallback } from 'react'
import type { DragEvent, ChangeEvent } from 'react'
import './App.css'
import { parseUsdx } from './parser/usdxParser'
import type { UsdxSong } from './parser/usdxParser'
import { phraseToSyllables } from './parser/lyrics'
import { exportUsdx } from './parser/usdxExporter'
import { GapSync } from './components/GapSync'

function DropZone({ onLoad }: { onLoad: (song: UsdxSong, filename: string) => void }) {
  const [dragOver, setDragOver] = useState(false)

  const readFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      onLoad(parseUsdx(text), file.name)
    }
    reader.readAsText(file, 'utf-8')
  }, [onLoad])

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) readFile(file)
  }

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) readFile(file)
  }

  return (
    <label
      className={`drop-zone${dragOver ? ' drag-over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div className="drop-zone-icon">🎵</div>
      <h2>USDX-Datei öffnen</h2>
      <p>Datei hierher ziehen oder klicken zum Auswählen (.txt)</p>
      <input type="file" accept=".txt" onChange={onChange} />
    </label>
  )
}

function SongView({ song, filename, onReset }: { song: UsdxSong; filename: string; onReset: () => void }) {
  const { header, tracks } = song
  const track = tracks[0]
  const phraseCount = track?.phrases.length ?? 0

  const [highlightGolden, setHighlightGolden] = useState(false)
  const [singerMap, setSingerMap] = useState<Record<number, 1 | 2>>({})
  const [singerNames, setSingerNames] = useState<[string, string]>(['', ''])
  const [gap, setGap] = useState(header.gap)

  const handleDownload = () => {
    const songWithGap = { ...song, header: { ...header, gap } }
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
      <div className="song-meta">
        <div className="song-title-block">
          <div className="song-title">{header.title}</div>
          <div className="song-artist">{header.artist}</div>
        </div>
        <div className="song-tags">
          {header.year && <span className="tag">{header.year}</span>}
          {header.language && <span className="tag">{header.language}</span>}
          {header.genre && <span className="tag">{header.genre}</span>}
          {header.edition && <span className="tag">{header.edition}</span>}
          <span className="tag">{header.bpm} BPM</span>
        </div>
        <div className="meta-actions">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={highlightGolden}
              onChange={(e) => setHighlightGolden(e.target.checked)}
            />
            Golden Notes hervorheben
          </label>
          <button className="btn-primary" onClick={handleDownload}>
            Speichern
          </button>
          <button className="btn-secondary" onClick={onReset} title={filename}>
            Andere Datei
          </button>
        </div>
      </div>

      <GapSync gap={gap} onChange={setGap} />

      <div className="lyrics-section">
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
            const phraseEl = (
              <span className="phrase-text">
                {syllables.map((s, j) => (
                  <span
                    key={j}
                    className={`syllable${highlightGolden && s.type === '*' ? ' golden' : ''}${s.type === 'F' ? ' freestyle' : ''}`}
                  >
                    {j > 0 && s.startsWord ? ' ' : ''}{s.text}
                  </span>
                ))}
              </span>
            )

            return (
              <div key={i} className={`phrase phrase--singer-${singer}`}>
                <span className="phrase-number">{i + 1}</span>
                <div className="phrase-col phrase-col--1">
                  {singer === 1 && phraseEl}
                </div>
                <button
                  className={`assign-btn assign-btn--${singer === 1 ? 'to2' : 'to1'}`}
                  onClick={() => toggleSinger(i)}
                  title={singer === 1 ? 'Zu Sänger 2 verschieben' : 'Zu Sänger 1 verschieben'}
                >
                  {singer === 1 ? '→' : '←'}
                </button>
                <div className="phrase-col phrase-col--2">
                  {singer === 2 && phraseEl}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [song, setSong] = useState<UsdxSong | null>(null)
  const [filename, setFilename] = useState('')

  const handleLoad = useCallback((s: UsdxSong, name: string) => {
    setSong(s)
    setFilename(name)
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>USDX Editor</h1>
        <span className="subtitle">UltraStar Deluxe Song Editor</span>
      </header>
      <main className="app-main">
        {song
          ? <SongView song={song} filename={filename} onReset={() => setSong(null)} />
          : <DropZone onLoad={handleLoad} />
        }
      </main>
    </div>
  )
}
