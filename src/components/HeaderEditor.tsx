import { TagEditor } from './TagEditor'
import { CoverArt } from './CoverArt'
import { KNOWN_SINGSTAR_GAMES } from '../utils/singstarEditions'
import type { SingStarEditionMatch } from '../utils/singstarEditions'
import type { UsdxHeader } from '../parser/usdxParser'
import type { SongFileMap } from '../utils/fileLoader'

export const GENRE_SUGGESTIONS = [
  'Blues', 'Country', 'Darkwave', 'Electronic', 'Folk', 'Funk',
  'Hip-Hop', 'Jazz', 'Metal', 'Musical', 'Oldies', 'Pop', 'Punk',
  'R&B', 'Rap', 'Reggae', 'Rock', 'Soul',
]

export const LANGUAGE_SUGGESTIONS = [
  'Deutsch', 'English', 'Español', 'Français', 'Italiano',
  'Nederlands', 'Polski', 'Português', 'Русский', '日本語',
]

export const EDITION_SUGGESTIONS = [
  'SingStar', 'SingStar Pop', 'SingStar Rock', 'SingStar 80s',
  'SingStar Deutsch Rock-Pop', 'SingStar Party',
]

export interface HeaderEditValues {
  title: string
  artist: string
  year: number | ''
  genres: string[]
  languages: string[]
  edition: string[]
  tags: string
}

export interface HeaderEditHandlers {
  setTitle: (v: string) => void
  setArtist: (v: string) => void
  setYear: (v: number | '') => void
  setGenres: (v: string[] | ((prev: string[]) => string[])) => void
  setLanguages: (v: string[]) => void
  setEdition: (v: string[]) => void
  setTags: (v: string) => void
}

interface HeaderEditorProps {
  header: UsdxHeader
  files: SongFileMap
  filename: string
  values: HeaderEditValues
  handlers: HeaderEditHandlers
  suggestedYear: number | null
  suggestedGenre: string | null
  singstarMatch: SingStarEditionMatch | null
  onAcceptYear: () => void
  onDismissYear: () => void
  onAcceptGenre: () => void
  onDismissGenre: () => void
  onAcceptSingstar: () => void
  onDismissSingstar: () => void
  onCoverUrl: (url: string) => void
  onDownload: () => void
  onReset: () => void
}

export function HeaderEditor({
  header, files, filename,
  values, handlers,
  suggestedYear, suggestedGenre, singstarMatch,
  onAcceptYear, onDismissYear,
  onAcceptGenre, onDismissGenre,
  onAcceptSingstar, onDismissSingstar,
  onCoverUrl, onDownload, onReset,
}: HeaderEditorProps) {
  const { title, artist, year, genres, languages, edition, tags } = values
  const { setTitle, setArtist, setYear, setGenres, setLanguages, setEdition, setTags } = handlers

  return (
    <div className="song-meta">
      <CoverArt header={header} files={files} onCoverUrl={onCoverUrl} />
      <div className="song-title-block">
        <input
          className="song-title song-title-input"
          value={title}
          onChange={e => setTitle(e.target.value)}
          aria-label="Titel"
        />
        <input
          className="song-artist song-artist-input"
          value={artist}
          onChange={e => setArtist(e.target.value)}
          aria-label="Künstler"
        />
        <div className="song-meta-tags">
          <input
            className="song-year-input"
            type="number"
            value={year}
            min={1900}
            max={2099}
            onChange={(e) => setYear(e.target.value === '' ? '' : Number(e.target.value))}
            aria-label="Jahr"
            placeholder="Jahr"
          />
          {suggestedYear !== null && suggestedYear !== year && (
            <span className="year-suggestion">
              <button
                className="year-suggestion-accept"
                onClick={onAcceptYear}
                title="Jahr aus MusicBrainz übernehmen"
              >
                {suggestedYear} übernehmen?
              </button>
              <button className="year-suggestion-dismiss" onClick={onDismissYear} aria-label="Vorschlag verwerfen">×</button>
            </span>
          )}
          <TagEditor tags={languages} onChange={setLanguages} suggestions={LANGUAGE_SUGGESTIONS} label="Sprache" />
          <TagEditor tags={genres} onChange={setGenres as (v: string[]) => void} suggestions={GENRE_SUGGESTIONS} label="Genre" />
          {suggestedGenre !== null && !genres.includes(suggestedGenre) && (
            <span className="year-suggestion">
              <button
                className="year-suggestion-accept"
                onClick={onAcceptGenre}
                title="Genre aus MusicBrainz übernehmen"
              >
                {suggestedGenre} hinzufügen?
              </button>
              <button className="year-suggestion-dismiss" onClick={onDismissGenre} aria-label="Vorschlag verwerfen">×</button>
            </span>
          )}
          <TagEditor
            tags={edition}
            onChange={setEdition}
            suggestions={EDITION_SUGGESTIONS}
            label="Edition"
            warnTags={edition.filter(t => {
              if (!t.toLowerCase().includes('singstar')) return false
              if (KNOWN_SINGSTAR_GAMES.has(t)) return false
              return true
            })}
          />
          {singstarMatch !== null && !edition.includes(singstarMatch.suggestedEdition) && (
            <span className="year-suggestion">
              <button
                className="year-suggestion-accept"
                onClick={onAcceptSingstar}
                title={`Gefunden in SingStar (${singstarMatch.platforms.join(', ')})`}
              >
                {singstarMatch.suggestedEdition} übernehmen?
              </button>
              <button className="year-suggestion-dismiss" onClick={onDismissSingstar} aria-label="Vorschlag verwerfen">×</button>
            </span>
          )}
        </div>
        <input
          className="tags-free-input"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          aria-label="Tags"
          placeholder="Tags: Party, Charts, Disney, Dancefloor…"
        />
      </div>
      <div className="meta-actions">
        <button className="btn-primary" onClick={onDownload}>Speichern</button>
        <button className="btn-secondary" onClick={onReset} title={filename}>Andere Datei</button>
      </div>
    </div>
  )
}
