/**
 * Converts a playback position to a USDX beat number.
 *
 * USDX stores BPM as 4× the musical tempo (ticks/min, not beats/min),
 * so one tick = 15000 / BPM milliseconds.
 */
export function msToBeat(currentMs: number, bpm: number, gap: number): number {
  return (currentMs - gap) * bpm / 15000
}
