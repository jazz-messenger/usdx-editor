import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import type { UsdxHeader } from './parser/usdxParser'
import './App.css'
import type { UsdxSong } from './parser/usdxParser'
import { phraseToSyllables } from './parser/lyrics'
import { exportUsdx } from './parser/usdxExporter'
import { GapSync } from './components/GapSync'
import { msToBeat } from './parser/timing'
import { lookupReleaseInfo } from './utils/musicbrainz'
import { lookupSingStarEdition, KNOWN_SINGSTAR_GAMES } from './utils/singstarEditions'
import type { SingStarEditionMatch } from './utils/singstarEditions'
import { version } from '../package.json'
import { mergeDuetTracks, findActivePos } from './utils/duetMerge'
import type { ActivePos } from './utils/duetMerge'
import { TagEditor } from './components/TagEditor'
import type { SuggestionGroup } from './components/TagEditor'
import { DropZone } from './components/DropZone'
import { CoverArt } from './components/CoverArt'
import { KofiWidget } from './components/KofiWidget'
import type { SongFileMap } from './utils/fileLoader'

const GENRE_SUGGESTIONS = [
  'Blues', 'Country', 'Darkwave', 'Electronic', 'Folk', 'Funk',
  'Hip-Hop', 'Jazz', 'Metal', 'Musical', 'Oldies', 'Pop', 'Punk',
  'R&B', 'Rap', 'Reggae', 'Rock', 'Soul',
]

const LANGUAGE_SUGGESTIONS = [
  'English', 'German', 'French', 'Spanish', 'Italian', 'Portuguese',
  'Japanese', 'Korean', 'Swedish', 'Danish', 'Norwegian', 'Finnish',
  'Dutch', 'Polish', 'Russian', 'Turkish', 'Arabic', 'Chinese', 'Greek',
]

const EDITION_SUGGESTIONS: SuggestionGroup[] = [
  { group: 'USDX Community', items: [
    '[SC]-Songs', '[DUET]-Songs', '[VIDEO]-Songs',
    '[KARAOKE]-Songs', '[MULTI]-Songs', '[SOLO]-Songs',
  ]},
  { group: '🇩🇪 Deutschland', items: [
    'SingStar [DE]', "SingStar '80s [DE]", 'SingStar Amped [DE]',
    'SingStar Après-Ski Party [DE]', 'SingStar Après-Ski Party 2 [DE]',
    'SingStar Chartbreaker [DE]', 'SingStar Deutsch Rock-Pop [DE]',
    'SingStar Deutsch Rock-Pop Vol. 2 [DE]', 'SingStar Die größten Solokünstler [DE]',
    'SingStar Die Toten Hosen [DE]', 'SingStar Fußballhits [DE]',
    'SingStar Hottest Hits [DE]', 'SingStar Legends [DE]',
    'SingStar Made in Germany [DE]', 'SingStar Mallorca Party [DE]',
    'SingStar Party [DE]', 'SingStar Pop [DE]', 'SingStar Pop Hits [DE]',
    'SingStar Rocks! [DE]', 'SingStar Summer Party [DE]',
    'SingStar The Dome [DE]', 'SingStar best of Disney [DE]',
  ]},
  { group: '🇬🇧 United Kingdom', items: [
    'SingStar [UK]', "SingStar '80s [UK]", "SingStar '90s [UK]",
    'SingStar ABBA [UK]', 'SingStar Anthems [UK]', 'SingStar Bollywood [UK]',
    'SingStar Boy Bands vs Girl Bands [UK]', 'SingStar Legends [UK]',
    'SingStar Motown [UK]', 'SingStar Party [UK]', 'SingStar Pop [UK]',
    'SingStar Pop Hits [UK]', 'SingStar Popworld [UK]', 'SingStar Queen [UK]',
    'SingStar R&B [UK]', 'SingStar Rock Ballads [UK]', 'SingStar Rocks! [UK]',
    'SingStar Singalong with Disney [UK]', 'SingStar Summer Party [UK]',
    'SingStar Take That [UK]',
  ]},
  { group: '🇦🇺 Australia', items: [
    'SingStar Amped [AU]', 'SingStar Chart Hits [AU]', 'SingStar Hottest Hits [AU]',
    'SingStar Legends [AU]', 'SingStar Party Hits [AU]', 'SingStar Pop [AU]',
    'SingStar Pop Hits [AU]', 'SingStar Rocks! [AU]',
    'SingStar Summer Party [AU]', 'SingStar The Wiggles [AU]',
  ]},
  { group: '🇩🇰 Denmark', items: [
    'SingStar Legends [DK]', 'SingStar Pop Hits Skandinavisk [DK]',
    'SingStar Summer Party [DK]',
  ]},
  { group: '🇫🇮 Finland', items: [
    'SingStar Legendat [FI]', 'SingStar SuomiPop [FI]', 'SingStar SuomiRock [FI]',
  ]},
  { group: '🇫🇷 France', items: [
    'SingStar [FR]', "SingStar '80s [FR]", 'SingStar Legends [FR]',
    'SingStar NRJ Music Tour [FR]', 'SingStar Party [FR]',
    'SingStar Pop Hits [FR]', 'SingStar Pop Hits 2 [FR]',
    'SingStar Pop Hits 3 [FR]', 'SingStar Pop Hits 4 [FR]',
    'SingStar Rocks! [FR]', 'SingStar Chansons magiques de Disney [FR]',
    'SingStar Summer Party [FR]',
  ]},
  { group: '🇭🇷 Croatia', items: [
    'SingStar Rocks! HRVATSKA! [HR]',
  ]},
  { group: '🇮🇹 Italy', items: [
    'SingStar [IT]', "SingStar '80s [IT]", 'SingStar Italian Greatest Hits [IT]',
    'SingStar Italian Party [IT]', 'SingStar Italian Party 2 [IT]',
    'SingStar Legends [IT]', 'SingStar Party [IT]', 'SingStar Pop [IT]',
    'SingStar Pop Hits [IT]', 'SingStar Radio 105 [IT]',
    'SingStar top.it [IT]', 'SingStar Vasco [IT]',
    'SingStar e la magia Disney [IT]',
  ]},
  { group: '🇳🇱 Netherlands', items: [
    "SingStar '80s [NL]", 'SingStar Pop [NL]', 'SingStar Rock Ballads [NL]',
    'SingStar Rocks! TMF [NL]', 'SingStar Studio 100 [NL]',
    'SingStar Summer Party [NL]', 'SingStar zingt met Disney [NL]',
  ]},
  { group: '🇳🇿 New Zealand', items: [
    'SingStar Chart Hits [NZ]',
  ]},
  { group: '🇳🇴 Norway', items: [
    'SingStar [NO]', "SingStar '80s [NO]", "SingStar '90s [NO]",
    'SingStar Legends [NO]', 'SingStar Norsk På Norsk [NO]',
    'SingStar Norske Hits [NO]', 'SingStar Party [NO]', 'SingStar Pop [NO]',
    'SingStar Pop Hits Skandinavisk [NO]', 'SingStar R&B [NO]',
    'SingStar Rock Ballads [NO]', 'SingStar Rocks! [NO]',
    'SingStar Summer Party [NO]',
  ]},
  { group: '🇵🇱 Poland', items: [
    "SingStar '80s [PL]", 'SingStar ESKA Hity Na Czasie [PL]',
    'SingStar Polskie Hity [PL]', 'SingStar Polskie Hity 2 [PL]',
    'SingStar Pop Hits [PL]', 'SingStar R&B [PL]',
    'SingStar Summer Party [PL]', 'SingStar Wakacyjna Impreza! [PL]',
  ]},
  { group: '🇵🇹 Portugal', items: [
    'SingStar Hottest Hits [PT]', 'SingStar Latino [PT]',
    'SingStar Morangos com Açucar [PT]', 'SingStar Pop Hits [PT]',
    'SingStar Portugal Hits [PT]', 'SingStar Summer Party [PT]',
    'SingStar Canções Disney [PT]',
  ]},
  { group: '🇷🇺 Russia', items: [
    'SingStar Russian Hits [RU]',
  ]},
  { group: '🇸🇪 Sweden', items: [
    "SingStar '80s [SE]", 'SingStar Pop Hits Skandinavisk [SE]',
    'SingStar Svenska Hits [SE]', 'SingStar Svenska Hits Schlager [SE]',
    'SingStar Svenska Stjarnor [SE]', 'SingStar Singalong with Disney [SE]',
  ]},
  { group: '🇪🇸 Spain', items: [
    'SingStar [ES]', 'SingStar Clásicos [ES]',
    'SingStar La Edad de Oro del Pop Español [ES]', 'SingStar Latino [ES]',
    'SingStar Legends [ES]', 'SingStar Mecano [ES]', 'SingStar Miliki [ES]',
    'SingStar Operación Triunfo [ES]', 'SingStar Party [ES]',
    'SingStar Patito Feo [ES]', 'SingStar Pop [ES]',
    'SingStar Pop Hits 40 Principales [ES]', 'SingStar Rocks! [ES]',
    'SingStar Summer Party [ES]',
  ]},
  { group: '🇹🇷 Turkey', items: [
    'SingStar Turkish Party [TR]',
  ]},
  { group: '🇺🇸 United States', items: [
    "SingStar '80s [US]", "SingStar '90s [US]", 'SingStar Amped [US]',
    'SingStar Country [US]', 'SingStar Legends [US]',
    'SingStar Pop [US]', 'SingStar Pop Vol. 2 [US]', 'SingStar Rocks! [US]',
  ]},
  { group: 'PlayStation', items: [
    'SingStar [PS3]', 'SingStar Afrikaans Treffers [PS3]',
    'SingStar Back to the \'80s [PS3]', 'SingStar Hits [PS3]',
    'SingStar Hits 2 [PS3]', 'SingStar Pop Edition [PS3]',
    'SingStar Pop 2009 [PS3]', 'SingStar Ultimate Party [PS3]',
    'SingStar Celebration [PS4]', 'SingStar Ultimate Party [PS4]',
  ]},
]

// ── Cover resolution ─────────────────────────────────────────────────────────

function findVideoFile(header: UsdxHeader, files: SongFileMap): File | null {
  if (header.video) {
    const f = files.get(header.video.toLowerCase())
    if (f) return f
  }
  return null
}

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

// ── Helpers ───────────────────────────────────────────────────────────────────
// Pure functions are implemented in src/utils/duetMerge.ts and src/utils/encoding.ts

// ── SongView ──────────────────────────────────────────────────────────────────

function SongView({ song, filename, files, onReset }: {
  song: UsdxSong
  filename: string
  files: SongFileMap
  onReset: () => void
}) {
  const { header, tracks } = song

  const mergedDuet = useMemo(() => tracks.length > 1 ? mergeDuetTracks(tracks) : null, [tracks])
  const track = useMemo(() => {
    if (mergedDuet) return { player: 1 as const, phrases: mergedDuet.phrases }
    return tracks[0]
  }, [tracks, mergedDuet])
  const phraseCount = track?.phrases.length ?? 0

  const videoFile = useMemo(() => findVideoFile(header, files), [header, files])
  const videoUrl = useMemo(
    () => (videoFile ? URL.createObjectURL(videoFile) : null),
    [videoFile]
  )

  const backgroundFile = useMemo(() => findBackgroundFile(header, files), [header, files])
  const backgroundUrl = useMemo(
    () => (backgroundFile ? URL.createObjectURL(backgroundFile) : null),
    [backgroundFile]
  )

  const [singerMap, setSingerMap] = useState<Record<number, 1 | 2 | 3>>(
    () => mergedDuet?.singerMap ?? {}
  )
  const [singerNames, setSingerNames] = useState<[string, string]>([
    header.singerP1 ?? '',
    header.singerP2 ?? '',
  ])
  const [editTitle, setEditTitle] = useState(header.title)
  const [editArtist, setEditArtist] = useState(header.artist)
  const [editYear, setEditYear] = useState<number | ''>(header.year ?? '')
  const [suggestedYear, setSuggestedYear] = useState<number | null>(null)
  const [suggestedGenre, setSuggestedGenre] = useState<string | null>(null)
  const [singstarMatch, setSingstarMatch] = useState<SingStarEditionMatch | null>(null)
  const [editGenres, setEditGenres] = useState<string[]>(
    header.genre ? header.genre.split(',').map((g) => g.trim()).filter(Boolean) : []
  )
  const [editLanguages, setEditLanguages] = useState<string[]>(
    header.language ? header.language.split(',').map((l) => l.trim()).filter(Boolean) : []
  )
  const [editEdition, setEditEdition] = useState<string[]>(
    header.edition ? header.edition.split(',').map(s => s.trim()).filter(Boolean) : []
  )
  const [editTags, setEditTags] = useState<string>(
    (header.tags as string | undefined) ?? ''
  )
  const [gap, setGap] = useState(header.gap)
  const [videoGap, setVideoGap] = useState(header.videoGap ?? 0)
  const [editVideoUrl, setEditVideoUrl] = useState(header.videoUrl ?? '')
  const [editCoverUrl, setEditCoverUrl] = useState(header.coverUrl ?? '')
  const [activePos, setActivePos] = useState<ActivePos | null>(null)
  const activePhraseRef = useRef<HTMLDivElement | null>(null)
  const firstPhraseRef = useRef<HTMLDivElement | null>(null)
  const [warningDismissed, setWarningDismissed] = useState(false)

  // MusicBrainz lookup — year + genre, runs once when the song is loaded
  useEffect(() => {
    lookupReleaseInfo(header.artist, header.title).then(({ year, genre }) => {
      if (year !== null) setSuggestedYear(year)
      if (genre !== null) setSuggestedGenre(genre)
    })
  }, [header.artist, header.title])

  // SingStar edition lookup — synchronous map lookup, no network needed.
  // Reacts to editArtist/editTitle so a corrected title immediately triggers a new check.
  useEffect(() => {
    setSingstarMatch(lookupSingStarEdition(editArtist, editTitle))
  }, [editArtist, editTitle])

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

  const handleDownload = async () => {
    const today = new Date().toISOString().slice(0, 10)
    const exportHeader = {
      ...header,
      title: editTitle,
      artist: editArtist,
      year: editYear !== '' ? Number(editYear) : undefined,
      genre: editGenres.join(', ') || undefined,
      language: editLanguages.join(', ') || undefined,
      edition: editEdition.length > 0 ? editEdition.join(', ') : undefined,
      tags: editTags.trim() || undefined,
      gap,
      videoGap: videoGap || undefined,
      videoUrl: editVideoUrl || undefined,
      coverUrl: editCoverUrl || undefined,
      comment: `edited with usdx-editor v${version} on ${today}, http://korczak.at/usdx-editor`,
    }
    if (backgroundFile && !exportHeader.background) {
      exportHeader.background = backgroundFile.name
    }
    const songWithGap = { ...song, header: exportHeader }
    const content = exportUsdx(songWithGap, singerMap, singerNames)
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })

    // Use the native save dialog when available (Chrome / Edge).
    // The browser pre-fills the filename; subsequent saves typically reopen
    // the same folder because the browser remembers the last-used directory.
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as Window & { showSaveFilePicker: (opts: object) => Promise<FileSystemFileHandle> })
          .showSaveFilePicker({
            suggestedName: filename,
            types: [{ description: 'UltraStar Text File', accept: { 'text/plain': ['.txt'] } }],
          })
        const writable = await handle.createWritable()
        await writable.write(blob)
        await writable.close()
        return
      } catch (e) {
        // AbortError = user cancelled the dialog — do nothing
        if (e instanceof DOMException && e.name === 'AbortError') return
        // Any other error (e.g. write permission denied) → fall through to download
      }
    }

    // Fallback for Firefox / Safari: trigger a regular file download
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const toggleSinger = (i: number) => {
    // Cycle: P1 → P2 → Beide → P1
    setSingerMap((prev) => {
      const cur = prev[i] ?? 1
      const next = cur === 1 ? 2 : cur === 2 ? 3 : 1
      return { ...prev, [i]: next }
    })
  }

  const singerOf = (i: number): 1 | 2 | 3 => singerMap[i] ?? 1

  return (
    <div className="song-view">
      {/* ── Top bar: meta + actions ── */}
      <div className="song-meta">
        <CoverArt header={header} files={files} onCoverUrl={setEditCoverUrl} />
        <div className="song-title-block">
          <input
            className="song-title song-title-input"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            aria-label="Titel"
          />
          <input
            className="song-artist song-artist-input"
            value={editArtist}
            onChange={e => setEditArtist(e.target.value)}
            aria-label="Künstler"
          />
          <div className="song-meta-tags">
            <input
              className="song-year-input"
              type="number"
              value={editYear}
              min={1900}
              max={2099}
              onChange={(e) => setEditYear(e.target.value === '' ? '' : Number(e.target.value))}
              aria-label="Jahr"
              placeholder="Jahr"
            />
            {suggestedYear !== null && suggestedYear !== editYear && (
              <span className="year-suggestion">
                <button
                  className="year-suggestion-accept"
                  onClick={() => { setEditYear(suggestedYear); setSuggestedYear(null) }}
                  title="Jahr aus MusicBrainz übernehmen"
                >
                  {suggestedYear} übernehmen?
                </button>
                <button
                  className="year-suggestion-dismiss"
                  onClick={() => setSuggestedYear(null)}
                  aria-label="Vorschlag verwerfen"
                >×</button>
              </span>
            )}
            <TagEditor
              tags={editLanguages}
              onChange={setEditLanguages}
              suggestions={LANGUAGE_SUGGESTIONS}
              label="Sprache"
            />
            <TagEditor
              tags={editGenres}
              onChange={setEditGenres}
              suggestions={GENRE_SUGGESTIONS}
              label="Genre"
            />
            {suggestedGenre !== null && !editGenres.includes(suggestedGenre) && (
              <span className="year-suggestion">
                <button
                  className="year-suggestion-accept"
                  onClick={() => { setEditGenres(g => [...g, suggestedGenre!]); setSuggestedGenre(null) }}
                  title="Genre aus MusicBrainz übernehmen"
                >
                  {suggestedGenre} hinzufügen?
                </button>
                <button
                  className="year-suggestion-dismiss"
                  onClick={() => setSuggestedGenre(null)}
                  aria-label="Vorschlag verwerfen"
                >×</button>
              </span>
            )}
            <TagEditor
              tags={editEdition}
              onChange={setEditEdition}
              suggestions={EDITION_SUGGESTIONS}
              label="Edition"

              warnTags={editEdition.filter(t => {
                // Only evaluate tags that look like a SingStar edition
                if (!t.toLowerCase().includes('singstar')) return false
                // Tag exactly matches a known game name → no warning
                if (KNOWN_SINGSTAR_GAMES.has(t)) return false
                // Tag contains "SingStar" but is not in our known games list → warn
                return true
              })}
            />
            {singstarMatch !== null && !editEdition.includes(singstarMatch.suggestedEdition) && (
              <span className="year-suggestion">
                <button
                  className="year-suggestion-accept"
                  onClick={() => {
                    setEditEdition([singstarMatch.suggestedEdition])
                    setSingstarMatch(null)
                  }}
                  title={`Gefunden in SingStar (${singstarMatch.platforms.join(', ')})`}
                >
                  {singstarMatch.suggestedEdition} übernehmen?
                </button>
                <button
                  className="year-suggestion-dismiss"
                  onClick={() => setSingstarMatch(null)}
                  aria-label="Vorschlag verwerfen"
                >×</button>
              </span>
            )}
          </div>
          {(editTags || true) && (
            <input
              className="tags-free-input"
              value={editTags}
              onChange={(e) => setEditTags(e.target.value)}
              aria-label="Tags"
              placeholder="Tags: Party, Charts, Disney, Dancefloor…"
            />
          )}
        </div>
        <div className="meta-actions">

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
          {/* Singer name inputs: only shown when any phrase is assigned to singer 2,
              or when singer names are already set from the file */}
          {(Object.values(singerMap).some(v => v === 2) || singerNames[0] || singerNames[1]) && (
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
          )}
          <div className="phrases">
            {Array.from({ length: phraseCount }, (_, i) => {
              const phrase = track.phrases[i]
              const singer = singerOf(i)
              const syllables = phraseToSyllables(phrase)
              const isActivePhrase = activePos?.phraseIndex === i

              const phraseEl = (
                <span className="phrase-text">
                  {syllables.map((s, j) => {
                    const isActiveNote =
                      isActivePhrase &&
                      activePos !== null &&
                      activePos.beat >= s.startBeat &&
                      activePos.beat < s.endBeat
                    return (
                      <span
                        key={j}
                        className={[
                          'syllable',
                          s.type === '*' ? 'golden' : '',
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
                  ref={(el) => {
                    if (i === 0) firstPhraseRef.current = el
                    if (isActivePhrase && el && el !== activePhraseRef.current) {
                      activePhraseRef.current = el
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }
                  }}
                  className={`phrase phrase--singer-${singer}${isActivePhrase ? ' phrase--active' : ''}`}
                >
                  <span className="phrase-number">{i + 1}</span>
                  <div className="phrase-col phrase-col--1">{(singer === 1 || singer === 3) && phraseEl}</div>
                  <button
                    className={`assign-btn assign-btn--${singer === 1 ? 'to2' : singer === 2 ? 'to1' : 'both'}`}
                    onClick={() => toggleSinger(i)}
                    title={singer === 1 ? 'Zu Sänger:in 2' : singer === 2 ? 'Zu Sänger:in 1' : 'Beide singen'}
                  >
                    {singer === 1 ? '→' : singer === 2 ? '←' : '⇔'}
                  </button>
                  <div className="phrase-col phrase-col--2">{(singer === 2 || singer === 3) && phraseEl}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: sticky video + GAP sidebar */}
        <aside className="video-sidebar">
          <GapSync gap={gap} onChange={setGap} videoGap={videoGap} onVideoGapChange={setVideoGap} onTimeUpdate={handleTimeUpdate} videoUrl={videoUrl ?? undefined} backgroundUrl={backgroundUrl ?? undefined} initialVideoUrl={editVideoUrl || undefined} onVideoUrlChange={setEditVideoUrl} onReset={() => { setActivePos(null); firstPhraseRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' }) }} artist={header.artist} title={header.title} />
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
                  {['Duett-Support', 'Live-Highlighting', 'SingStar-Editions', 'Jahreserkennung', 'YouTube-Suche', 'Optimiert für UltraStar Deluxe'].map(b => (
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
