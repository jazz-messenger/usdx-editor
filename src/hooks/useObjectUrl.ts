import { useEffect, useMemo } from 'react'

/**
 * Object URL for a File, revoked automatically when the file changes or the
 * component unmounts.
 *
 * The URL is created in useMemo (not in an effect) on purpose: consumers like
 * GapSync read it during the very first render to pick their initial media
 * tab — an effect-based URL would arrive one render too late. The paired
 * effect below owns the revoke side of the lifecycle.
 */
export function useObjectUrl(file: File | null): string | null {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])

  useEffect(() => {
    if (!url) return
    return () => URL.revokeObjectURL(url)
  }, [url])

  return url
}
