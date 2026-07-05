import { describe, it, expect } from 'vitest'
import { buildPeaks } from './waveform'

describe('buildPeaks', () => {
  it('returns max |amplitude| per block', () => {
    const data = new Float32Array([0.1, -0.8, 0.3, 0.2, -0.1, 0.9])
    const peaks = buildPeaks(data, 2)
    expect(peaks).toHaveLength(2)
    expect(peaks[0]).toBeCloseTo(0.8) // max of |0.1|, |-0.8|, |0.3|
    expect(peaks[1]).toBeCloseTo(0.9) // max of |0.2|, |-0.1|, |0.9|
  })

  it('clamps peak count for audio shorter than the requested resolution', () => {
    // Regression: blockSize used to become 0 → all-zero (invisible) waveform
    const data = new Float32Array([0.5, -0.7, 0.2])
    const peaks = buildPeaks(data, 2000)
    expect(peaks).toHaveLength(3)
    expect(Array.from(peaks)).toEqual([0.5, 0.7, 0.2].map((v) => Math.fround(v)))
  })

  it('returns an empty array for empty input', () => {
    expect(buildPeaks(new Float32Array(0), 2000)).toHaveLength(0)
  })

  it('produces the requested resolution for long audio', () => {
    const data = new Float32Array(44100)
    data[100] = 1
    const peaks = buildPeaks(data, 2000)
    expect(peaks).toHaveLength(2000)
    expect(Math.max(...peaks)).toBe(1)
  })
})
