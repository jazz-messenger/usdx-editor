import { useState, useRef, useEffect } from 'react'
import { useLanguage } from '../i18n/LanguageContext'

export type SuggestionGroup = { group: string; items: string[] }

export interface TagEditorProps {
  tags: string[]
  onChange: (tags: string[]) => void
  suggestions: string[] | SuggestionGroup[]
  label: string
  warnTags?: string[]
  /** When set, limits the number of tags; selecting a new one replaces the existing one */
  maxTags?: number
}

export function flatItems(suggestions: string[] | SuggestionGroup[]): string[] {
  if (suggestions.length === 0) return []
  return typeof suggestions[0] === 'string'
    ? (suggestions as string[])
    : (suggestions as SuggestionGroup[]).flatMap((g) => g.items)
}

export function TagEditor({ tags, onChange, suggestions, label, maxTags, warnTags = [] }: TagEditorProps) {
  const { t } = useLanguage()
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
      {tags.map((tag) => (
        <span key={tag} className={`tag tag--editable${warnTags.includes(tag) ? ' tag--warn' : ''}`}>
          {warnTags.includes(tag) && <span className="tag-warn-icon" title={t.tagEditor.unknownTag}>⚠</span>}
          {tag}
          <button
            className="tag-remove"
            onClick={() => onChange(tags.filter((x) => x !== tag))}
            title={t.tagEditor.removeTag(tag)}
          >
            ✕
          </button>
        </span>
      ))}
      <div className="tag-add-wrap">
        <button
          className={tags.length === 0 ? 'tag-add-btn tag-add-btn--labeled' : 'tag-add-btn'}
          onClick={() => setOpen((v) => !v)}
          title={t.tagEditor.addTitle}
        >
          {tags.length === 0 ? t.tagEditor.addLabelEmpty(label) : t.tagEditor.addLabelHasTags}
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
              placeholder={t.tagEditor.searchPlaceholder}
            />
            <div className="tag-suggestions">
              {renderItems()}
              {query.trim() && !allItems.some(
                (s) => s.toLowerCase() === query.trim().toLowerCase()
              ) && (
                <button className="tag-suggestion tag-suggestion--custom" onClick={() => add(query)}>
                  {t.tagEditor.addCustom(query.trim())}
                </button>
              )}
              {filtered.length === 0 && !query.trim() && (
                <span className="tag-suggestions-empty">{t.tagEditor.allUsed}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
