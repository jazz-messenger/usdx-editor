import { useState, useMemo, useEffect } from 'react'
import type { UsdxHeader } from '../parser/usdxParser'
import { findCoverFiles, fetchRemoteCovers } from '../utils/fileLoader'
import type { SongFileMap } from '../utils/fileLoader'
import { useLanguage } from '../i18n/LanguageContext'

interface CoverArtProps {
  header: UsdxHeader
  files: SongFileMap
  /** Called when a remote cover URL is selected (for #COVERURL). */
  onCoverUrl?: (url: string) => void
  /** Called after a remote cover has been saved locally (for #COVER). */
  onCoverFileSaved?: (filename: string) => void
}

export function CoverArt({ header, files, onCoverUrl, onCoverFileSaved }: CoverArtProps) {
  const { t } = useLanguage()

  // ── Local covers ────────────────────────────────────────────────────────────
  const localFiles = useMemo(() => findCoverFiles(header, files), [header, files])
  const [localIndex, setLocalIndex] = useState(0)
  const localFile = localFiles[localIndex] ?? null
  const localUrl = useMemo(
    () => (localFile ? URL.createObjectURL(localFile) : null),
    [localFile]
  )

  // ── Remote covers ────────────────────────────────────────────────────────────
  const [remoteUrls, setRemoteUrls] = useState<string[]>([])
  const [remoteIndex, setRemoteIndex] = useState(0)
  const [showRemote, setShowRemote] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  // URL of a remote cover that was saved locally — treated as the effective local cover
  const [savedAsLocalUrl, setSavedAsLocalUrl] = useState<string | null>(null)

  // ── Lightbox ─────────────────────────────────────────────────────────────────
  const [lightboxOpen, setLightboxOpen] = useState(false)

  // Reset view state when the song changes (header identity changes)
  useEffect(() => {
    setShowRemote(false)
    setSavedAsLocalUrl(null)
    setRemoteUrls([])
    setRemoteIndex(0)
  }, [header.artist, header.title]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fetch remote covers when no local file is present
  useEffect(() => {
    if (localFiles.length === 0) {
      setLoading(true)
      fetchRemoteCovers(header.artist, header.title).then((urls) => {
        setRemoteUrls(urls)
        if (urls.length > 0) { setShowRemote(true); onCoverUrl?.(urls[0]) }
        setLoading(false)
      })
    }
  }, [header.artist, header.title, localFiles.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close lightbox on Escape
  useEffect(() => {
    if (!lightboxOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightboxOpen])

  const remoteUrl = remoteUrls[remoteIndex] ?? null
  const effectiveLocalUrl = savedAsLocalUrl ?? localUrl
  const displayUrl = showRemote ? remoteUrl : effectiveLocalUrl

  const handleFlip = () => {
    if (showRemote) { setShowRemote(false); return }
    if (remoteUrls.length > 0) { setShowRemote(true); onCoverUrl?.(remoteUrls[remoteIndex]); return }
    setLoading(true)
    fetchRemoteCovers(header.artist, header.title).then((urls) => {
      setRemoteUrls(urls)
      if (urls.length > 0) { setShowRemote(true); onCoverUrl?.(urls[0]) }
      setLoading(false)
    })
  }

  /** Downloads the current remote cover and updates #COVER in the header. */
  const handleSetAsCover = async () => {
    if (!remoteUrl) return
    const suggestedFilename = `${header.artist} - ${header.title} [CO].jpg`
    setSaving(true)
    try {
      const response = await fetch(remoteUrl)
      const blob = await response.blob()

      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as Window & { showSaveFilePicker: (opts: object) => Promise<FileSystemFileHandle> })
            .showSaveFilePicker({
              suggestedName: suggestedFilename,
              types: [{ description: 'Cover Image', accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] } }],
            })
          const writable = await handle.createWritable()
          await writable.write(blob)
          await writable.close()
          onCoverFileSaved?.(handle.name)
          setSavedAsLocalUrl(remoteUrl)
          setShowRemote(false)
          setSaving(false)
          return
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') { setSaving(false); return }
          // Non-abort error: fall through to regular download
        }
      }

      // Fallback: regular browser download
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = suggestedFilename
      a.click()
      URL.revokeObjectURL(objectUrl)
      onCoverFileSaved?.(suggestedFilename)
      setSavedAsLocalUrl(remoteUrl)
      setShowRemote(false)
    } catch {
      // fetch failed — silently ignore
    }
    setSaving(false)
  }

  const navigateLocal = (dir: 1 | -1) => {
    setLocalIndex((i) => (i + dir + localFiles.length) % localFiles.length)
  }

  const navigateRemote = (dir: 1 | -1) => {
    const next = (remoteIndex + dir + remoteUrls.length) % remoteUrls.length
    setRemoteIndex(next)
    if (showRemote) onCoverUrl?.(remoteUrls[next])
  }

  if (loading && !displayUrl) {
    return <div className="song-cover song-cover--placeholder">♪</div>
  }

  if (!displayUrl) return null

  const hasLocalCover = !!effectiveLocalUrl
  const hasMultiLocal = !showRemote && localFiles.length > 1
  const hasMultiRemote = showRemote && remoteUrls.length > 1

  return (
    <div className="song-cover-wrap">
      {/* Thumbnail — click only */}
      <img
        className="song-cover song-cover--clickable"
        src={displayUrl}
        alt={t.coverart.alt}
        onClick={() => setLightboxOpen(true)}
        title={t.coverart.openPreview}
      />

      {/* Lightbox */}
      {lightboxOpen && (
        <div className="cover-lightbox" onClick={() => setLightboxOpen(false)}>
          <div className="cover-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <img src={displayUrl} alt={t.coverart.alt} />

            {/* Navigation row */}
            {(hasMultiLocal || hasMultiRemote) && (
              <div className="cover-lightbox-nav">
                <button
                  className="cover-lightbox-nav-btn"
                  onClick={() => hasMultiLocal ? navigateLocal(-1) : navigateRemote(-1)}
                  title={t.coverart.prevCover}
                >‹</button>
                <span className="cover-lightbox-nav-index">
                  {hasMultiLocal
                    ? t.coverart.coverOf(localIndex + 1, localFiles.length)
                    : t.coverart.coverOf(remoteIndex + 1, remoteUrls.length)}
                </span>
                <button
                  className="cover-lightbox-nav-btn"
                  onClick={() => hasMultiLocal ? navigateLocal(1) : navigateRemote(1)}
                  title={t.coverart.nextCover}
                >›</button>
              </div>
            )}

            {/* Action row */}
            <div className="cover-lightbox-actions">
              {!showRemote ? (
                <>
                  <span className="cover-lightbox-selected-label">{t.coverart.selectedCover}</span>
                  <button
                    className="cover-lightbox-action-btn"
                    onClick={handleFlip}
                    title={t.coverart.loadOnline}
                  >
                    {loading ? '…' : t.coverart.btnLoadOnline}
                  </button>
                </>
              ) : (
                <>
                  {hasLocalCover && (
                    <button
                      className="cover-lightbox-action-btn"
                      onClick={handleFlip}
                      title={t.coverart.showLocal}
                    >
                      {t.coverart.btnShowLocal}
                    </button>
                  )}
                  {remoteUrl && (
                    <button
                      className="cover-lightbox-action-btn cover-lightbox-action-btn--primary"
                      onClick={handleSetAsCover}
                      disabled={saving}
                      title={t.coverart.download}
                    >
                      {saving ? '…' : t.coverart.setAsCover}
                    </button>
                  )}
                </>
              )}
            </div>

            <button
              className="cover-lightbox-close"
              onClick={() => setLightboxOpen(false)}
              aria-label={t.coverart.closePreview}
            >×</button>
          </div>
        </div>
      )}
    </div>
  )
}
