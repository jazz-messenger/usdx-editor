import { TagEditor } from './TagEditor'
import { CoverArt } from './CoverArt'
import { KNOWN_SINGSTAR_GAMES } from '../utils/singstarEditions'
import type { SingStarEditionMatch } from '../utils/singstarEditions'
import type { UsdxHeader } from '../parser/usdxParser'
import type { SongFileMap } from '../utils/fileLoader'
import { useLanguage } from '../i18n/LanguageContext'

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
  onCoverFileSaved: (filename: string) => void
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
  onCoverUrl, onCoverFileSaved, onDownload, onReset,
}: HeaderEditorProps) {
  const { t } = useLanguage()
  const { title, artist, year, genres, languages, edition, tags } = values
  const { setTitle, setArtist, setYear, setGenres, setLanguages, setEdition, setTags } = handlers

  return (
    <div className="song-meta">
      <CoverArt header={header} files={files} onCoverUrl={onCoverUrl} onCoverFileSaved={onCoverFileSaved} />
      <div className="song-title-block">
        <input
          className="song-title song-title-input"
          value={title}
          onChange={e => setTitle(e.target.value)}
          aria-label={t.header.titleLabel}
        />
        <input
          className="song-artist song-artist-input"
          value={artist}
          onChange={e => setArtist(e.target.value)}
          aria-label={t.header.artistLabel}
        />
        <div className="song-meta-tags">
          <input
            className="song-year-input"
            type="number"
            value={year}
            min={1900}
            max={2099}
            onChange={(e) => setYear(e.target.value === '' ? '' : Number(e.target.value))}
            aria-label={t.header.yearLabel}
            placeholder={t.header.yearPlaceholder}
          />
          {suggestedYear !== null && suggestedYear !== year && (
            <span className="year-suggestion">
              <button
                className="year-suggestion-accept"
                onClick={onAcceptYear}
                title={t.header.yearSuggestionTitle}
              >
                {t.header.acceptYear(suggestedYear)}
              </button>
              <button className="year-suggestion-dismiss" onClick={onDismissYear} aria-label={t.header.dismissSuggestion}>×</button>
            </span>
          )}
          <TagEditor tags={languages} onChange={setLanguages} suggestions={LANGUAGE_SUGGESTIONS} label={t.header.languageLabel} />
          <TagEditor tags={genres} onChange={setGenres as (v: string[]) => void} suggestions={GENRE_SUGGESTIONS} label={t.header.genreLabel} />
          {suggestedGenre !== null && !genres.includes(suggestedGenre) && (
            <span className="year-suggestion">
              <button
                className="year-suggestion-accept"
                onClick={onAcceptGenre}
                title={t.header.genreSuggestionTitle}
              >
                {t.header.addGenre(suggestedGenre)}
              </button>
              <button className="year-suggestion-dismiss" onClick={onDismissGenre} aria-label={t.header.dismissSuggestion}>×</button>
            </span>
          )}
          <TagEditor
            tags={edition}
            onChange={setEdition}
            suggestions={EDITION_SUGGESTIONS}
            label={t.header.editionLabel}
            warnTags={edition.filter(e => {
              if (!e.toLowerCase().includes('singstar')) return false
              if (KNOWN_SINGSTAR_GAMES.has(e)) return false
              return true
            })}
          />
          {singstarMatch !== null && !edition.includes(singstarMatch.suggestedEdition) && (
            <span className="year-suggestion">
              <button
                className="year-suggestion-accept"
                onClick={onAcceptSingstar}
                title={t.header.singstarSuggestionTitle(singstarMatch.platforms.join(', '))}
              >
                {t.header.acceptEdition(singstarMatch.suggestedEdition)}
              </button>
              <button className="year-suggestion-dismiss" onClick={onDismissSingstar} aria-label={t.header.dismissSuggestion}>×</button>
            </span>
          )}
        </div>
        <input
          className="tags-free-input"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          aria-label="Tags"
          placeholder={t.header.tagsPlaceholder}
        />
        {header.providedBy && (
          <p className="provided-by-label">
            <span className="provided-by-key">{t.header.providedByLabel}:</span> {header.providedBy}
          </p>
        )}
      </div>
      <div className="meta-actions">
        <button className="btn-primary" onClick={onDownload}>{t.header.save}</button>
        <button className="btn-secondary" onClick={onReset} title={filename}>{t.header.changeFile}</button>
      </div>
    </div>
  )
}
