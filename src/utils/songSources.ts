export interface SongSource {
  /** Key into t.sources.items — both locales must carry name + desc for it. */
  id: string
  url: string
}

// Places to get song files, and nothing else — no tools, no docs, no forums.
// The freely licensed collection comes first: it is the only one without a
// copyright question attached to it.
export const SONG_SOURCES: SongSource[] = [
  { id: 'openSongs', url: 'https://github.com/UltraStar-Deluxe/songs' },
  { id: 'usdb', url: 'https://usdb.animux.de/' },
  { id: 'usdbEu', url: 'https://usdb.eu/' },
]
