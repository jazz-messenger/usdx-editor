/**
 * Downsamples a PCM channel into peak values (max |amplitude| per block) for
 * waveform rendering.
 *
 * For audio shorter than the requested resolution the peak count is clamped
 * to the sample count — previously blockSize became 0 and the waveform
 * stayed completely empty for clips under ~45 ms.
 */
export function buildPeaks(channelData: Float32Array, samples: number): Float32Array {
  if (channelData.length === 0) return new Float32Array(0)

  const count = Math.min(samples, channelData.length)
  const blockSize = Math.floor(channelData.length / count) // >= 1
  const peaks = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    let max = 0
    const start = i * blockSize
    for (let j = 0; j < blockSize; j++) {
      const v = Math.abs(channelData[start + j] ?? 0)
      if (v > max) max = v
    }
    peaks[i] = max
  }
  return peaks
}
