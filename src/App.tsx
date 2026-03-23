import { useState, useCallback } from 'react'
import './App.css'
import type { UsdxSong } from './parser/usdxParser'
import { SongView } from './components/SongView'
import { DropZone } from './components/DropZone'
import { KofiWidget } from './components/KofiWidget'
import type { SongFileMap } from './utils/fileLoader'
import { useLanguage } from './i18n/LanguageContext'
import type { Locale } from './i18n/translations'

export default function App() {
  const [song, setSong] = useState<UsdxSong | null>(null)
  const [filename, setFilename] = useState('')
  const [files, setFiles] = useState<SongFileMap>(new Map())
  const [songKey, setSongKey] = useState(0)
  const { locale, setLocale, t } = useLanguage()

  const handleLoad = useCallback((s: UsdxSong, name: string, f: SongFileMap) => {
    setSong(s)
    setFilename(name)
    setFiles(f)
    setSongKey((k) => k + 1)
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <img src={`${import.meta.env.BASE_URL}icon-logo.svg`} alt={t.app.title} className="app-logo" />
        <h1>{t.app.title}</h1>
        <span className="subtitle">{t.app.subtitle}</span>
        <div className="lang-toggle">
          {(['de', 'en'] as Locale[]).map(l => (
            <button
              key={l}
              className={`lang-btn${locale === l ? ' lang-btn--active' : ''}`}
              onClick={() => setLocale(l)}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </header>
      <main className="app-main">
        {song
          ? <SongView key={songKey} song={song} filename={filename} files={files} onReset={() => setSong(null)} />
          : (
            <div className="landing">
              <div className="landing-hero">
                <img src={`${import.meta.env.BASE_URL}icon-logo.svg`} className="landing-icon" alt="" />
                <p className="landing-tagline">{t.app.tagline}</p>
                <p className="landing-desc">{t.app.description}</p>
                <div className="landing-badges">
                  {t.app.badges.map((b: string) => (
                    <span key={b} className="landing-badge">{b}</span>
                  ))}
                </div>
              </div>
              <DropZone onLoad={handleLoad} />
              <footer className="landing-footer">
                <a href="/impressum.html">{t.app.impressum}</a>
                <a href="/datenschutz.html">{t.app.datenschutz}</a>
              </footer>
            </div>
          )
        }
      </main>
      <KofiWidget />
    </div>
  )
}
