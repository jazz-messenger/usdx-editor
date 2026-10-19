export interface SongSource {
  /** Key into t.sources.items — both locales must carry name + desc for it. */
  id: string
  url: string
}

// Places to get song files, and nothing else — no tools, no docs, no forums,
// and nothing with a catalogue too small to actually find something in.
export const SONG_SOURCES: SongSource[] = [
  { id: 'usdb', url: 'https://usdb.animux.de/' },
  { id: 'usdbEu', url: 'https://usdb.eu/' },
]
