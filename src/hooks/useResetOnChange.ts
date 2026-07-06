import { useState } from 'react'

/**
 * Runs `reset` (synchronous setState calls) exactly once whenever `value`
 * differs from the previous render — the React-sanctioned
 * "adjust state during render" pattern, encapsulated so the subtle guard
 * (update the prev value in the same branch, or the render loops) lives in
 * one place instead of being hand-rolled per call site.
 */
export function useResetOnChange<T>(value: T, reset: () => void) {
  const [prev, setPrev] = useState(value)
  if (value !== prev) {
    setPrev(value)
    reset()
  }
}
