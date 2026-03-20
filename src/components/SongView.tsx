import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { GapSync } from './GapSync'
import { HeaderEditor } from './HeaderEditor'
import { useLanguage } from '../i18n/LanguageContext'
import { exportUsdx } from '../parser/usdxExporter'
import { phraseToSyllables } from '../parser/lyrics'
import { msToBeat } from '../parser/timing'
import { mergeDuetTracks, findActivePos } from '../utils/duetMerge'
import type { ActivePos } from '../utils/duetMerge'
import { lookupReleaseInfo } from '../utils/musicbrainz'
import { lookupSingStarEdition } from '../utils/singstarEditions'
import type { SingStarEditionMatch } from '../utils/singstarEditions'
import { findVideoFile, findBackgroundFile } from '../utils/fileLoader'
import type { SongFileMap } from '../utils/fileLoader'
import type { UsdxSong } from '../parser/usdxParser'
import { version } from '../../package.json'

interface SongViewProps {
  song: UsdxSong
  filename: string
  files: SongFileMap
  onReset: () => void
}

export function SongView({ song, filename, files, onReset }: SongViewProps) {
  const { t } = useLanguage()
  const { header, tracks } = song

  const mergedDuet = useMemo(() => tracks.length > 1 ? mergeDuetTracks(tracks) : null, [tracks])
  const track = useMemo(() => {
    if (mergedDuet) return { player: 1 as const, phrases: mergedDuet.phrases }
    return tracks[0]
  }, [tracks, mergedDuet])
  const phraseCount = track?.phrases.length ?? 0

  const videoFile = useMemo(() => findVideoFile(header, files), [header, files])
  const videoUrl = useMemo(() => (videoFile ? URL.createObjectURL(videoFile) : null), [videoFile])
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

  // Header edit state
  const [editTitle, setEditTitle] = useState(header.title)
  const [editArtist, setEditArtist] = useState(header.artist)
  const [editYear, setEditYear] = useState<number | ''>(header.year ?? '')
  const [suggestedYear, setSuggestedYear] = useState<number | null>(null)
  const [suggestedGenre, setSuggestedGenre] = useState<string | null>(null)
  const [singstarMatch, setSingstarMatch] = useState<SingStarEditionMatch | null>(null)
  const [editGenres, setEditGenres] = useState<string[]>(
    header.genre ? header.genre.split(',').map(g => g.trim()).filter(Boolean) : []
  )
  const [editLanguages, setEditLanguages] = useState<string[]>(
    header.language ? header.language.split(',').map(l => l.trim()).filter(Boolean) : []
  )
  const [editEdition, setEditEdition] = useState<string[]>(
    header.edition ? header.edition.split(',').map(s => s.trim()).filter(Boolean) : []
  )
  const [editTags, setEditTags] = useState<string>((header.tags as string | undefined) ?? '')
  const [gap, setGap] = useState(header.gap)
  const [videoGap, setVideoGap] = useState(header.videoGap ?? 0)
  const [editVideoUrl, setEditVideoUrl] = useState(header.videoUrl ?? '')
  const [editCoverUrl, setEditCoverUrl] = useState(header.coverUrl ?? '')
  const [editCover, setEditCover] = useState(header.cover ?? '')

  // Playback state
  const [activePos, setActivePos] = useState<ActivePos | null>(null)
  const activePhraseRef = useRef<HTMLDivElement | null>(null)
  const firstPhraseRef = useRef<HTMLDivElement | null>(null)
  const lyricsColumnRef = useRef<HTMLDivElement | null>(null)
  const skipNextScrollRef = useRef(false)
  const [warningDismissed, setWarningDismissed] = useState(false)
  const [deprecationDismissed, setDeprecationDismissed] = useState(false)

  // MusicBrainz lookup — year + genre, runs once when the song is loaded
  useEffect(() => {
    lookupReleaseInfo(header.artist, header.title).then(({ year, genre }) => {
      if (year !== null) setSuggestedYear(year)
      if (genre !== null) setSuggestedGenre(genre)
    })
  }, [header.artist, header.title])

  // SingStar edition lookup — reacts to editArtist/editTitle changes
  useEffect(() => {
    setSingstarMatch(lookupSingStarEdition(editArtist, editTitle))
  }, [editArtist, editTitle])

  const missingFiles = useMemo(() => {
    const missing: { tag: string; filename: string }[] = []
    const check = (tag: string, fn: string | undefined) => {
      if (fn && !files.has(fn.toLowerCase())) missing.push({ tag, filename: fn })
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
      cover: editCover || undefined,
      coverUrl: editCoverUrl || undefined,
      comment: `edited with usdx-editor v${version} on ${today}, http://korczak.at/usdx-editor`,
    }
    if (backgroundFile && !exportHeader.background) {
      exportHeader.background = backgroundFile.name
    }
    const content = exportUsdx({ ...song, header: exportHeader }, singerMap, singerNames)
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })

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
        if (e instanceof DOMException && e.name === 'AbortError') return
      }
    }

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const toggleSinger = (i: number) => {
    setSingerMap(prev => {
      const cur = prev[i] ?? 1
      const next = cur === 1 ? 2 : cur === 2 ? 3 : 1
      return { ...prev, [i]: next }
    })
  }

  const singerOf = (i: number): 1 | 2 | 3 => singerMap[i] ?? 1

  return (
    <div className="song-view">
      <HeaderEditor
        header={header}
        files={files}
        filename={filename}
        values={{ title: editTitle, artist: editArtist, year: editYear, genres: editGenres, languages: editLanguages, edition: editEdition, tags: editTags }}
        handlers={{ setTitle: setEditTitle, setArtist: setEditArtist, setYear: setEditYear, setGenres: setEditGenres, setLanguages: setEditLanguages, setEdition: setEditEdition, setTags: setEditTags }}
        suggestedYear={suggestedYear}
        suggestedGenre={suggestedGenre}
        singstarMatch={singstarMatch}
        onAcceptYear={() => { setEditYear(suggestedYear!); setSuggestedYear(null) }}
        onDismissYear={() => setSuggestedYear(null)}
        onAcceptGenre={() => { setEditGenres(g => [...g, suggestedGenre!]); setSuggestedGenre(null) }}
        onDismissGenre={() => setSuggestedGenre(null)}
        onAcceptSingstar={() => { setEditEdition([singstarMatch!.suggestedEdition]); setSingstarMatch(null) }}
        onDismissSingstar={() => setSingstarMatch(null)}
        onCoverUrl={setEditCoverUrl}
        onCoverFileSaved={setEditCover}
        onDownload={handleDownload}
        onReset={onReset}
      />

      {/* ── Deprecated fields notice ── */}
      {song.deprecatedFields.length > 0 && !deprecationDismissed && (
        <div className="missing-files-banner missing-files-banner--info">
          <span className="missing-files-icon">ℹ</span>
          <span className="missing-files-text">{t.songview.deprecationBanner(song.deprecatedFields)}</span>
          <button className="missing-files-dismiss" onClick={() => setDeprecationDismissed(true)} title={t.songview.closeMissing}>✕</button>
        </div>
      )}

      {/* ── Missing files warning ── */}
      {missingFiles.length > 0 && !warningDismissed && (
        <div className="missing-files-banner">
          <span className="missing-files-icon">⚠</span>
          <span className="missing-files-text">{t.songview.missingFiles}</span>
          {missingFiles.map(({ tag, filename: fn }) => (
            <span key={tag} className="missing-file-pill">{tag}: {fn}</span>
          ))}
          <button className="missing-files-dismiss" onClick={() => setWarningDismissed(true)} title={t.songview.closeMissing}>✕</button>
        </div>
      )}

      {/* ── Two-column content ── */}
      <div className="song-content">
        <div className="lyrics-column" ref={lyricsColumnRef}>
          {(Object.values(singerMap).some(v => v === 2) || singerNames[0] || singerNames[1]) && (
            <div className="duet-header">
              <input
                className="singer-name-input singer-name-input--1"
                value={singerNames[0]}
                onChange={(e) => setSingerNames([e.target.value, singerNames[1]])}
                placeholder={t.songview.singer1Placeholder}
              />
              <span />
              <input
                className="singer-name-input singer-name-input--2"
                value={singerNames[1]}
                onChange={(e) => setSingerNames([singerNames[0], e.target.value])}
                placeholder={t.songview.singer2Placeholder}
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
                      if (!skipNextScrollRef.current) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      }
                      skipNextScrollRef.current = false
                    }
                  }}
                  className={`phrase phrase--singer-${singer}${isActivePhrase ? ' phrase--active' : ''}`}
                >
                  <span className="phrase-number">{i + 1}</span>
                  <div className="phrase-col phrase-col--1">{(singer === 1 || singer === 3) && phraseEl}</div>
                  <button
                    className={`assign-btn assign-btn--${singer === 1 ? 'to2' : singer === 2 ? 'to1' : 'both'}`}
                    onClick={() => toggleSinger(i)}
                    title={singer === 1 ? t.songview.assignToSinger2 : singer === 2 ? t.songview.assignToSinger1 : t.songview.assignBoth}
                  >
                    {singer === 1 ? '→' : singer === 2 ? '←' : '⇔'}
                  </button>
                  <div className="phrase-col phrase-col--2">{(singer === 2 || singer === 3) && phraseEl}</div>
                </div>
              )
            })}
          </div>
        </div>

        <aside className="video-sidebar">
          <GapSync
            gap={gap}
            onChange={setGap}
            videoGap={videoGap}
            onVideoGapChange={setVideoGap}
            onTimeUpdate={handleTimeUpdate}
            videoUrl={videoUrl ?? undefined}
            backgroundUrl={backgroundUrl ?? undefined}
            initialVideoUrl={editVideoUrl || undefined}
            onVideoUrlChange={setEditVideoUrl}
            onReset={() => {
              setActivePos(null)
              skipNextScrollRef.current = true
              if (lyricsColumnRef.current) lyricsColumnRef.current.scrollTop = 0
            }}
            artist={header.artist}
            title={header.title}
          />
        </aside>
      </div>
    </div>
  )
}
