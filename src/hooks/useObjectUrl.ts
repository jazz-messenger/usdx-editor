import { useEffect, useRef, useReducer } from 'react'

interface Entry {
  file: File
  url: string
  revoked: boolean
}

/**
 * Object URL for a File, revoked automatically when the file changes or the
 * component unmounts.
 *
 * The URL is created during render (not in an effect) on purpose: consumers
 * like GapSync read it on the very first render to pick their initial media
 * tab — an effect-based URL would arrive one render too late.
 *
 * Two details keep that honest under StrictMode, which double-invokes render
 * and runs effect → cleanup → effect on mount:
 *
 *  - The entry lives in a ref, not a useMemo. A memo factory runs on both
 *    render passes and one of the two URLs is thrown away without ever being
 *    revoked; a ref survives the doubled render, so exactly one URL exists
 *    per file.
 *  - The cleanup revokes the URL, and render does not run again to replace
 *    it — consumers would be left holding a dead blob URL, and media that is
 *    not loaded immediately (the audio file while the Video tab is showing)
 *    would fail to play. Each entry records whether it was revoked so the
 *    second effect run can mint a replacement.
 */
/* eslint-disable react-hooks/refs -- The ref is read and written during render
   on purpose: it is the lazy-initialisation escape hatch that lets one URL
   survive StrictMode's doubled render, and the value it carries is exactly
   what this hook renders. See the note above. */
export function useObjectUrl(file: File | null): string | null {
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  const ref = useRef<Entry | null>(null)

  if (file !== ref.current?.file) {
    // The outgoing entry is revoked by its own effect cleanup, which still
    // holds a reference to it — nothing to release here.
    ref.current = file ? { file, url: URL.createObjectURL(file), revoked: false } : null
  }
  const entry = ref.current

  useEffect(() => {
    if (!entry) return
    if (entry.revoked) {
      entry.url = URL.createObjectURL(entry.file)
      entry.revoked = false
      rerender()
    }
    return () => {
      URL.revokeObjectURL(entry.url)
      entry.revoked = true
    }
  }, [entry])

  return entry?.url ?? null
}
