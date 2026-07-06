let nextId = 1
const ids = new WeakMap<File, number>()

/**
 * Stable per-object key for a File. Unlike name/size/lastModified strings,
 * two DIFFERENT File objects always get different keys — components keyed by
 * this remount whenever the user picks a file again, even if its metadata
 * matches the previous one.
 */
export function fileKey(file: File | null): string {
  if (!file) return 'none'
  let id = ids.get(file)
  if (id === undefined) {
    id = nextId++
    ids.set(file, id)
  }
  return `file-${id}`
}
