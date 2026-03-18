// We import the raw dictionary as unknown and cast to our own interface to avoid
// TypeScript choking on the extremely large union type it would infer from the
// "as const" object.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { singstarSongDictionary as _raw } from './singstarSongDictionary'

export type Platform = 'PS2' | 'PS3'

export type SingStarGame =
  | "SingStar"
  | "SingStar '80s"
  | "SingStar '90s"
  | "SingStar ABBA"
  | "SingStar Amped"
  | "SingStar Anthems"
  | "SingStar Boy Bands vs Girl Bands"
  | "SingStar Chart Hits"
  | "SingStar Chartbreaker"
  | "SingStar Country"
  | "SingStar Hits"
  | "SingStar Hottest Hits"
  | "SingStar Legends"
  | "SingStar Made In Germany"
  | "SingStar Mallorca Party"
  | "SingStar Mecano"
  | "SingStar Morangos com Açucar"
  | "SingStar Motown"
  | "SingStar Party"
  | "SingStar Polskie Hity"
  | "SingStar Pop"
  | "SingStar Pop Edition"
  | "SingStar Pop Hits"
  | "SingStar Pop Vol 2"
  | "SingStar Queen"
  | "SingStar R&B"
  | "SingStar Rock Ballads"
  | "SingStar Rocks!"
  | "SingStar Starter Pack"
  | "SingStar Studio 100"
  | "SingStar Summer Party"
  | "SingStar Take That"
  | "SingStar The Wiggles"
  | "SingStar Ultimate Party"
  | "SingStar Vasco"
  | "SingStar Vol. 2"
  | "SingStar Vol. 3: Party Edition"

interface DictEdition {
  game: SingStarGame | string
  platform: Platform
  countries: string[]
}

interface DictEntry {
  artist: string
  title: string
  editions: DictEdition[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const singstarSongDictionary = _raw as unknown as Record<string, DictEntry>

export interface SingStarEditionMatch {
  /** All distinct game names this song appears in */
  games: SingStarGame[]
  /** The value to write into #EDITION — specific game if unique, "SingStar" as fallback */
  suggestedEdition: string
  /** Which console platforms this song appeared on */
  platforms: Platform[]
  /** Country codes across all matching editions */
  countries: string[]
}

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ')
}

// Build a case-insensitive lookup index once at module load time.
// Key: "artist - title" (both normalized). Handles capitalisation variants
// like "Back for Good" vs "Back For Good" without touching the source data.
const index = new Map<string, DictEntry>()
for (const entry of Object.values(singstarSongDictionary)) {
  const key = `${normalize(entry.artist)} - ${normalize(entry.title)}`
  // First writer wins — avoids overwriting a richer entry with a sparse duplicate
  if (!index.has(key)) index.set(key, entry)
}

/** All known SingStar game names as a Set — used for warn-indicator logic in the UI */
export const KNOWN_SINGSTAR_GAMES = new Set<string>([
  "SingStar",
  "SingStar '80s",
  "SingStar '90s",
  "SingStar ABBA",
  "SingStar Amped",
  "SingStar Anthems",
  "SingStar Boy Bands vs Girl Bands",
  "SingStar Chart Hits",
  "SingStar Chartbreaker",
  "SingStar Country",
  "SingStar Hits",
  "SingStar Hottest Hits",
  "SingStar Legends",
  "SingStar Made In Germany",
  "SingStar Mallorca Party",
  "SingStar Mecano",
  "SingStar Morangos com Açucar",
  "SingStar Motown",
  "SingStar Party",
  "SingStar Polskie Hity",
  "SingStar Pop",
  "SingStar Pop Edition",
  "SingStar Pop Hits",
  "SingStar Pop Vol 2",
  "SingStar Queen",
  "SingStar R&B",
  "SingStar Rock Ballads",
  "SingStar Rocks!",
  "SingStar Starter Pack",
  "SingStar Studio 100",
  "SingStar Summer Party",
  "SingStar Take That",
  "SingStar The Wiggles",
  "SingStar Ultimate Party",
  "SingStar Vasco",
  "SingStar Vol. 2",
  "SingStar Vol. 3: Party Edition",
])

export function lookupSingStarEdition(
  artist: string,
  title: string
): SingStarEditionMatch | null {
  if (!artist.trim() || !title.trim()) return null

  const key = `${normalize(artist)} - ${normalize(title)}`
  const entry = index.get(key)
  if (!entry) return null

  const platforms = [...new Set(entry.editions.map(e => e.platform))]
  const countries = [...new Set(entry.editions.flatMap(e => e.countries))]
  const games = [
    ...new Set(entry.editions.map(e => e.game as SingStarGame)),
  ]

  // Use specific game name if all editions point to the same game; otherwise "SingStar"
  const suggestedEdition = games.length === 1 ? games[0] : 'SingStar'

  return { games, suggestedEdition, platforms, countries }
}
