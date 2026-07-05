/** Pure helper — determines whether a seek+play handover should fire
 *  when switching between media tabs (see GapSync). */
export function shouldHandover(pendingTime: number | null, playerState: string): boolean {
  return pendingTime !== null && playerState === 'ready'
}
