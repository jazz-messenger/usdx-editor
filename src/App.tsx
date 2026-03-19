import { useState, useCallback } from 'react'
import './App.css'
import type { UsdxSong } from './parser/usdxParser'
import { SongView } from './components/SongView'
import { DropZone } from './components/DropZone'
import { KofiWidget } from './components/KofiWidget'
import type { SongFileMap } from './utils/fileLoader'

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
        <img src={`${import.meta.env.BASE_URL}icon-logo.png`} alt="USDX Editor" className="app-logo" />
        <h1>USDX Editor</h1>
        <span className="subtitle">UltraStar Deluxe Song Editor</span>
      </header>
      <main className="app-main">
        {song
          ? <SongView song={song} filename={filename} files={files} onReset={() => setSong(null)} />
          : (
            <div className="landing">
              <div className="landing-hero">
                <img src={`${import.meta.env.BASE_URL}icon-logo.png`} className="landing-icon" alt="" />
                <p className="landing-tagline">Der Browser-Editor für deine UltraStar-Songs.</p>
                <p className="landing-desc">
                  Metadaten pflegen, Timings bearbeiten, YouTube verknüpfen –
                  direkt im Browser, ohne Installation. Deine Dateien verlassen dabei nie deinen Rechner.
                </p>
                <div className="landing-badges">
                  {['Duett-Support', 'Live-Highlighting', 'SingStar-Editions', 'Jahreserkennung', 'Genre-Vorschläge', 'YouTube-Suche', 'Optimiert für UltraStar Deluxe'].map(b => (
                    <span key={b} className="landing-badge">{b}</span>
                  ))}
                </div>
              </div>
              <DropZone onLoad={handleLoad} />
              <footer className="landing-footer">
                <a href="/impressum.html">Impressum</a>
                <a href="/datenschutz.html">Datenschutz</a>
              </footer>
            </div>
          )
        }
      </main>
      <KofiWidget />
    </div>
  )
}
