import { describe, it, expect } from 'vitest'
import { lookupSingStarEdition, KNOWN_SINGSTAR_GAMES } from './singstarEditions'

describe('lookupSingStarEdition', () => {
  describe('input validation', () => {
    it('returns null for empty artist', () => {
      expect(lookupSingStarEdition('', 'Dancing Queen')).toBeNull()
    })

    it('returns null for empty title', () => {
      expect(lookupSingStarEdition('ABBA', '')).toBeNull()
    })

    it('returns null for whitespace-only artist', () => {
      expect(lookupSingStarEdition('   ', 'Dancing Queen')).toBeNull()
    })

    it('returns null for whitespace-only title', () => {
      expect(lookupSingStarEdition('ABBA', '   ')).toBeNull()
    })

    it('returns null for unknown song', () => {
      expect(lookupSingStarEdition('Unknown Artist', 'Unknown Song 99999')).toBeNull()
    })
  })

  describe('matching behaviour', () => {
    it('finds a known song (ABBA - Dancing Queen)', () => {
      const result = lookupSingStarEdition('ABBA', 'Dancing Queen')
      expect(result).not.toBeNull()
      expect(result!.games).toContain('SingStar ABBA')
    })

    it('is case-insensitive for artist', () => {
      const lower = lookupSingStarEdition('abba', 'Dancing Queen')
      const upper = lookupSingStarEdition('ABBA', 'Dancing Queen')
      expect(lower).not.toBeNull()
      expect(lower!.suggestedEdition).toBe(upper!.suggestedEdition)
    })

    it('is case-insensitive for title', () => {
      const lower = lookupSingStarEdition('ABBA', 'dancing queen')
      expect(lower).not.toBeNull()
      expect(lower!.suggestedEdition).toBe('SingStar ABBA')
    })

    it('trims surrounding whitespace from artist and title', () => {
      const result = lookupSingStarEdition('  ABBA  ', '  Dancing Queen  ')
      expect(result).not.toBeNull()
      expect(result!.suggestedEdition).toBe('SingStar ABBA')
    })

    it('normalises multiple internal spaces', () => {
      // "ABBA" with double space should still match "ABBA"
      const result = lookupSingStarEdition('ABBA', 'Dancing  Queen')
      // After normalisation "dancing  queen" → "dancing queen" which matches
      expect(result).not.toBeNull()
    })
  })

  describe('suggestedEdition logic', () => {
    it('suggests specific game name when song appears in exactly one game', () => {
      // "Die Da!?!" only appears in SingStar Made In Germany
      const result = lookupSingStarEdition('Die Fantastischen Vier', 'Die Da!?!')
      expect(result).not.toBeNull()
      expect(result!.games).toHaveLength(1)
      expect(result!.suggestedEdition).toBe('SingStar Made In Germany')
    })

    it('suggests "SingStar" fallback when song appears in multiple different games', () => {
      // "Don't Stop Me Now" appears in SingStar Queen AND SingStar Rocks!
      const result = lookupSingStarEdition('Queen', "Don't Stop Me Now")
      expect(result).not.toBeNull()
      expect(result!.games.length).toBeGreaterThan(1)
      expect(result!.suggestedEdition).toBe('SingStar')
    })

    it('returns the unique game name directly (no "SingStar" fallback) for a single-game song', () => {
      const result = lookupSingStarEdition('ABBA', 'Dancing Queen')
      expect(result!.suggestedEdition).toBe('SingStar ABBA')
      expect(result!.suggestedEdition).not.toBe('SingStar')
    })
  })

  describe('result shape', () => {
    it('returns platforms as a deduplicated array', () => {
      // Dancing Queen is in PS2 and PS3
      const result = lookupSingStarEdition('ABBA', 'Dancing Queen')
      expect(result!.platforms).toContain('PS2')
      expect(result!.platforms).toContain('PS3')
      // No duplicates
      expect(new Set(result!.platforms).size).toBe(result!.platforms.length)
    })

    it('returns countries as a deduplicated flat array', () => {
      // Dancing Queen: PS2 → [ES, UK], PS3 → [DE, UK, US]. UK appears twice.
      const result = lookupSingStarEdition('ABBA', 'Dancing Queen')
      expect(result!.countries).toContain('UK')
      expect(result!.countries).toContain('ES')
      expect(result!.countries).toContain('DE')
      // UK must appear only once despite being in two editions
      const ukCount = result!.countries.filter(c => c === 'UK').length
      expect(ukCount).toBe(1)
    })

    it('returns games as a deduplicated array', () => {
      const result = lookupSingStarEdition('ABBA', 'Dancing Queen')
      expect(new Set(result!.games).size).toBe(result!.games.length)
    })
  })

  describe('edge cases', () => {
    it('does NOT match "Die Da !?!" (space before !?!) — title punctuation is significant', () => {
      // The dictionary entry is "Die Da!?!" (no space). Whitespace normalisation
      // collapses multiple spaces but does not strip punctuation, so the space
      // before "!?!" creates a genuinely different key.
      const result = lookupSingStarEdition('Die Fantastischen Vier', 'Die Da !?!')
      expect(result).toBeNull()
    })
  })
})

describe('KNOWN_SINGSTAR_GAMES', () => {
  it('is a non-empty Set', () => {
    expect(KNOWN_SINGSTAR_GAMES.size).toBeGreaterThan(0)
  })

  it('contains well-known game names', () => {
    expect(KNOWN_SINGSTAR_GAMES.has('SingStar ABBA')).toBe(true)
    expect(KNOWN_SINGSTAR_GAMES.has('SingStar Queen')).toBe(true)
    expect(KNOWN_SINGSTAR_GAMES.has('SingStar Take That')).toBe(true)
    expect(KNOWN_SINGSTAR_GAMES.has("SingStar '80s")).toBe(true)
    expect(KNOWN_SINGSTAR_GAMES.has('SingStar Rocks!')).toBe(true)
  })

  it('does not contain invented game names', () => {
    expect(KNOWN_SINGSTAR_GAMES.has('SingStar Unknown')).toBe(false)
    expect(KNOWN_SINGSTAR_GAMES.has('')).toBe(false)
  })

  it('includes the base "SingStar" entry', () => {
    expect(KNOWN_SINGSTAR_GAMES.has('SingStar')).toBe(true)
  })
})
