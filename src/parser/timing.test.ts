import { describe, it, expect } from 'vitest'
import { msToBeat } from './timing'

describe('msToBeat', () => {
  // Teardrops example: BPM 267.2, GAP 15381.74ms
  // Beat 0  → exactly at GAP
  // Beat 80 → GAP + 80 * (15000 / 267.2) = GAP + 4490.4ms ≈ 19872ms (~19.9s)
  const BPM = 267.2
  const GAP = 15381.74

  it('returns 0 at the GAP position', () => {
    expect(msToBeat(GAP, BPM, GAP)).toBeCloseTo(0)
  })

  it('returns correct beat for phrase 2 (beat 80 ≈ 19.9s)', () => {
    const ms = GAP + 80 * (15000 / BPM)
    expect(msToBeat(ms, BPM, GAP)).toBeCloseTo(80, 1)
  })

  it('returns negative before GAP', () => {
    expect(msToBeat(0, BPM, GAP)).toBeLessThan(0)
  })
})
