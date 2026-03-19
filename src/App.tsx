import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import type { DragEvent } from 'react'
import type { Track, Phrase, UsdxHeader } from './parser/usdxParser'
import './App.css'
import { parseUsdx } from './parser/usdxParser'
import type { UsdxSong } from './parser/usdxParser'
import { phraseToSyllables } from './parser/lyrics'
import { exportUsdx } from './parser/usdxExporter'
import { GapSync } from './components/GapSync'
import { msToBeat } from './parser/timing'
import { lookupReleaseYear } from './utils/musicbrainz'
import { lookupSingStarEdition, KNOWN_SINGSTAR_GAMES } from './utils/singstarEditions'
import type { SingStarEditionMatch } from './utils/singstarEditions'
import { version } from '../package.json'

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

type SuggestionGroup = { group: string; items: string[] }

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

function detectEncoding(bytes: Uint8Array): string {
  if (isValidUtf8(bytes)) return 'utf-8'

  // Distinguish Mac Roman from Windows-1252 by looking for bytes that are
  // accented letters in Mac Roman but very uncommon symbols in Windows-1252.
  //
  // Excluded: 0x80 (€), 0x82 (‚), 0x84 („), 0x85 (…), and the range 0x90–0x99
  // (curly quotes ', ', ", ", bullets, en/em dashes, ™) plus 0x9B–0x9E — all
  // normal Windows-1252 punctuation that appears in English lyrics and would
  // cause false-positive Mac Roman detection (the apostrophe bug: 0x92 = ' in
  // Windows-1252 but í in Mac Roman).
  //
  // Mac Roman → Windows-1252 meaning for each included byte:
  //   0x81 Å → (undef)  0x83 É → ƒ    0x86 Ü → †
  //   0x87 á → ‡        0x88 à → ˆ    0x89 â → ‰
  //   0x8A ä → Š        0x8B ã → ‹    0x8C å → Œ
  //   0x8D ç → (undef)  0x8E é → Ž    0x8F è → (undef)
  //   0x9A ö → š        0x9F ü → Ÿ
  const MAC_ROMAN_INDICATORS = new Set([
    0x81, 0x83, 0x86,
    0x87, 0x88, 0x89, 0x8A, 0x8B, 0x8C, 0x8D, 0x8E, 0x8F,
    0x9A, 0x9F,
  ])

  for (const b of bytes) {
    if (MAC_ROMAN_INDICATORS.has(b)) return 'macintosh'
  }
  return 'windows-1252'
}

async function readTxtFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  return new TextDecoder(detectEncoding(bytes)).decode(buf)
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

// ── TagEditor ────────────────────────────────────────────────────────────────

interface TagEditorProps {
  tags: string[]
  onChange: (tags: string[]) => void
  suggestions: string[] | SuggestionGroup[]
  label: string
  warnTags?: string[]
  /** When set, limits the number of tags; selecting a new one replaces the existing one */
  maxTags?: number
}

function flatItems(suggestions: string[] | SuggestionGroup[]): string[] {
  if (suggestions.length === 0) return []
  return typeof suggestions[0] === 'string'
    ? (suggestions as string[])
    : (suggestions as SuggestionGroup[]).flatMap((g) => g.items)
}

function TagEditor({ tags, onChange, suggestions, label, maxTags, warnTags = [] }: TagEditorProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const isGrouped = suggestions.length > 0 && typeof suggestions[0] === 'object'
  const allItems = flatItems(suggestions)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const filtered = allItems.filter(
    (s) => !tags.includes(s) && s.toLowerCase().includes(query.toLowerCase())
  )

  const add = (value: string) => {
    const v = value.trim()
    if (v) {
      if (maxTags && tags.length >= maxTags) {
        onChange([v])  // replace existing (single-select behaviour)
      } else if (!tags.includes(v)) {
        onChange([...tags, v])
      }
    }
    setOpen(false)
    setQuery('')
  }

  const renderItems = () => {
    if (query.trim() || !isGrouped) {
      // Flat filtered list while searching, or always for non-grouped suggestions
      return filtered.map((s) => (
        <button key={s} className="tag-suggestion" onClick={() => add(s)}>{s}</button>
      ))
    }
    // Grouped list when browsing (no active query)
    return (suggestions as SuggestionGroup[]).map((group) => {
      const visible = group.items.filter((s) => !tags.includes(s))
      if (visible.length === 0) return null
      return (
        <div key={group.group} className="tag-suggestion-group-block">
          <div className="tag-suggestion-group-header">{group.group}</div>
          {visible.map((s) => (
            <button key={s} className="tag-suggestion" onClick={() => add(s)}>{s}</button>
          ))}
        </div>
      )
    })
  }

  return (
    <div className="tag-editor" ref={wrapRef}>
      {tags.map((t) => (
        <span key={t} className={`tag tag--editable${warnTags.includes(t) ? ' tag--warn' : ''}`}>
          {warnTags.includes(t) && <span className="tag-warn-icon" title="Dieser Wert ist uns nicht bekannt">⚠</span>}
          {t}
          <button
            className="tag-remove"
            onClick={() => onChange(tags.filter((x) => x !== t))}
            title={`${t} entfernen`}
          >
            ✕
          </button>
        </span>
      ))}
      <div className="tag-add-wrap">
        <button
          className={tags.length === 0 ? 'tag-add-btn tag-add-btn--labeled' : 'tag-add-btn'}
          onClick={() => setOpen((v) => !v)}
          title="Hinzufügen"
        >
          {tags.length === 0 ? `+ ${label}` : '+'}
        </button>
        {open && (
          <div className="tag-dropdown">
            <input
              autoFocus
              className="tag-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && query.trim()) add(query)
                if (e.key === 'Escape') { setOpen(false); setQuery('') }
              }}
              placeholder="Suchen oder eingeben…"
            />
            <div className="tag-suggestions">
              {renderItems()}
              {query.trim() && !allItems.some(
                (s) => s.toLowerCase() === query.trim().toLowerCase()
              ) && (
                <button className="tag-suggestion tag-suggestion--custom" onClick={() => add(query)}>
                  „{query.trim()}" hinzufügen
                </button>
              )}
              {filtered.length === 0 && !query.trim() && (
                <span className="tag-suggestions-empty">Alle Vorschläge bereits verwendet</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── DropZone ─────────────────────────────────────────────────────────────────

function DropZone({ onLoad }: { onLoad: (song: UsdxSong, filename: string, files: SongFileMap) => void }) {
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [multiTxtNames, setMultiTxtNames] = useState<string[] | null>(null)

  const processFileMap = useCallback((files: SongFileMap) => {
    const txtFiles = Array.from(files.values()).filter((f) => f.name.toLowerCase().endsWith('.txt'))
    if (txtFiles.length === 0) { setError('Keine .txt-Datei im Ordner gefunden.'); return }
    if (txtFiles.length > 1) {
      setMultiTxtNames(txtFiles.map((f) => f.name))
      return
    }
    setError(null)
    setMultiTxtNames(null)
    readTxtFile(txtFiles[0]).then((text) => onLoad(parseUsdx(text), txtFiles[0].name, files))
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

  if (multiTxtNames) {
    return (
      <div className="drop-zone drop-zone--warning">
        <div className="drop-zone-icon">⚠️</div>
        <h2>Mehrere .txt-Dateien gefunden</h2>
        <p>Die Auswahl enthält {multiTxtNames.length} .txt-Dateien. Bitte öffne nur den Ordner eines einzelnen Songs.</p>
        <ul className="multi-txt-list">
          {multiTxtNames.map((n) => <li key={n}>{n}</li>)}
        </ul>
        <button className="btn-primary" onClick={() => setMultiTxtNames(null)}>Verstanden</button>
      </div>
    )
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

function CoverArt({ header, files, onCoverUrl }: { header: UsdxHeader; files: SongFileMap; onCoverUrl?: (url: string) => void }) {
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
        if (url) { setShowRemote(true); onCoverUrl?.(url) }
        setLoading(false)
      })
    }
  }, [localFile, header.artist, header.title]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleFlip = () => {
    if (remoteUrl) {
      const next = !showRemote
      setShowRemote(next)
      if (next) onCoverUrl?.(remoteUrl)
      return
    }
    setLoading(true)
    fetchRemoteCover(header.artist, header.title).then((url) => {
      setRemoteUrl(url)
      if (url) { setShowRemote(true); onCoverUrl?.(url) }
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

/** Merge duet tracks into a time-sorted phrase list, deduplicating identical
 *  phrases that appear in both P1 and P2 (exported with singer=3 / "both"). */
function mergeDuetTracks(tracks: Track[]): { phrases: Phrase[]; singerMap: Record<number, 1 | 2 | 3> } {
  const tagged = tracks.flatMap(t => t.phrases.map(p => ({ phrase: p, player: t.player })))
  tagged.sort((a, b) => (a.phrase.notes[0]?.beat ?? 0) - (b.phrase.notes[0]?.beat ?? 0))

  const phrases: Phrase[] = []
  const singerMap: Record<number, 1 | 2 | 3> = {}
  let i = 0
  while (i < tagged.length) {
    const cur = tagged[i]
    const nxt = tagged[i + 1]
    // If two adjacent phrases from different players are note-for-note identical,
    // they represent a "sung by both" line — collapse them into one entry.
    if (nxt && cur.player !== nxt.player && phrasesEqual(cur.phrase, nxt.phrase)) {
      singerMap[phrases.length] = 3
      phrases.push(cur.phrase)
      i += 2
    } else {
      if (cur.player === 2) singerMap[phrases.length] = 2
      phrases.push(cur.phrase)
      i++
    }
  }
  return { phrases, singerMap }
}

function phrasesEqual(a: Phrase, b: Phrase): boolean {
  if (a.notes.length !== b.notes.length) return false
  return a.notes.every((n, i) =>
    n.beat === b.notes[i].beat &&
    n.length === b.notes[i].length &&
    n.pitch === b.notes[i].pitch &&
    n.syllable === b.notes[i].syllable &&
    n.type === b.notes[i].type
  )
}

interface ActivePos { phraseIndex: number; beat: number }

function findActivePos(track: Track, beat: number): ActivePos | null {
  for (let pi = 0; pi < track.phrases.length; pi++) {
    const phrase = track.phrases[pi]
    if (!phrase.notes.length) continue

    // Phrase window ends when the next phrase starts (or at lineBreakBeat)
    const phraseEndBeat =
      phrase.lineBreakBeat ??
      track.phrases[pi + 1]?.notes[0]?.beat ??
      Infinity

    // Return the first phrase where beat < phraseEndBeat — this is either the
    // currently active phrase, the next upcoming one (gap after lineBreakBeat),
    // or the first phrase (when beat is before the song starts).
    if (beat < phraseEndBeat) return { phraseIndex: pi, beat }
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

  // MusicBrainz year lookup — runs once when the song is loaded
  useEffect(() => {
    lookupReleaseYear(header.artist, header.title).then(year => {
      if (year !== null) setSuggestedYear(year)
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
          <GapSync gap={gap} onChange={setGap} videoGap={videoGap} onVideoGapChange={setVideoGap} onTimeUpdate={handleTimeUpdate} videoUrl={videoUrl ?? undefined} backgroundUrl={backgroundUrl ?? undefined} initialVideoUrl={editVideoUrl || undefined} onVideoUrlChange={setEditVideoUrl} onReset={() => { setActivePos(null); firstPhraseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }} artist={header.artist} title={header.title} />
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
            </div>
          )
        }
      </main>
    </div>
  )
}
