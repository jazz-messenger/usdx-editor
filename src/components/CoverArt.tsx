import { useState, useMemo, useEffect } from 'react'
import type { UsdxHeader } from '../parser/usdxParser'
import { findCoverFiles, fetchRemoteCovers } from '../utils/fileLoader'
import type { SongFileMap } from '../utils/fileLoader'
import { useLanguage } from '../i18n/LanguageContext'

export function CoverArt({ header, files, onCoverUrl }: { header: UsdxHeader; files: SongFileMap; onCoverUrl?: (url: string) => void }) {
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

  // ── Lightbox ─────────────────────────────────────────────────────────────────
  const [lightboxOpen, setLightboxOpen] = useState(false)

  // Auto-fetch remote covers when no local file is present
  useEffect(() => {
    if (!localFile) {
      setLoading(true)
      fetchRemoteCovers(header.artist, header.title).then((urls) => {
        setRemoteUrls(urls)
        if (urls.length > 0) { setShowRemote(true); onCoverUrl?.(urls[0]) }
        setLoading(false)
      })
    }
  }, [localFile, header.artist, header.title]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close lightbox on Escape
  useEffect(() => {
    if (!lightboxOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightboxOpen])

  const remoteUrl = remoteUrls[remoteIndex] ?? null
  const displayUrl = showRemote ? remoteUrl : localUrl

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

  const handleDownload = () => {
    if (!remoteUrl) return
    const a = document.createElement('a')
    a.href = remoteUrl
    a.download = header.cover ?? `${header.artist} - ${header.title} [CO].jpg`
    a.target = '_blank'
    a.click()
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
              {localFile && (
                <button className="cover-lightbox-action-btn" onClick={handleFlip} title={showRemote ? t.coverart.showLocal : t.coverart.loadOnline}>
                  {loading ? '…' : showRemote ? t.coverart.btnShowLocal : t.coverart.btnLoadOnline}
                </button>
              )}
              {showRemote && remoteUrl && (
                <button className="cover-lightbox-action-btn" onClick={handleDownload} title={t.coverart.download}>
                  {t.coverart.btnDownload}
                </button>
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
