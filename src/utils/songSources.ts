export type SourceCategory = 'database' | 'tool' | 'docs' | 'community'

export interface SongSource {
  /** Key into t.sources.items — both locales must carry name + desc for it. */
  id: string
  url: string
  category: SourceCategory
}

// Freely licensed songs come first — that collection is the only one without
// any copyright question attached to it.
export const SONG_SOURCES: SongSource[] = [
  { id: 'openSongs', url: 'https://github.com/UltraStar-Deluxe/songs', category: 'database' },
  { id: 'usdb', url: 'https://usdb.animux.de/', category: 'database' },
  { id: 'usdbEu', url: 'https://usdb.eu/', category: 'database' },
  { id: 'usdbSyncer', url: 'https://github.com/bohning/usdb_syncer', category: 'tool' },
  { id: 'format', url: 'https://usdx.eu/format/', category: 'docs' },
  { id: 'discord', url: 'https://discord.gg/tNEXZw2QJX', category: 'community' },
]
