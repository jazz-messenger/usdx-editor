import { useState, useMemo, useEffect } from 'react'
import type { UsdxHeader } from '../parser/usdxParser'
import { findCoverFile, fetchRemoteCover } from '../utils/fileLoader'
import type { SongFileMap } from '../utils/fileLoader'
import { useLanguage } from '../i18n/LanguageContext'

export function CoverArt({ header, files, onCoverUrl }: { header: UsdxHeader; files: SongFileMap; onCoverUrl?: (url: string) => void }) {
  const { t } = useLanguage()
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
      <img className="song-cover" src={displayUrl} alt={t.coverart.alt} />
      <div className="song-cover-actions">
        {localFile && (
          <button
            className="cover-btn"
            onClick={handleFlip}
            title={showRemote ? t.coverart.showLocal : t.coverart.loadOnline}
          >
            {loading ? '…' : showRemote ? '⬅' : '↺'}
          </button>
        )}
        {showRemote && remoteUrl && (
          <button className="cover-btn" onClick={handleDownload} title={t.coverart.download}>
            ↓
          </button>
        )}
      </div>
    </div>
  )
}
