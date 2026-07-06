import { useCallback, useEffect, useRef, useState } from 'react'
import { useResetOnChange } from './useResetOnChange'

export type YTPlayerState = 'idle' | 'ready' | 'error'

interface YTPlayerInstance {
  getCurrentTime(): number
  getDuration(): number
  destroy(): void
  loadVideoById(videoId: string): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  playVideo(): void
  pauseVideo(): void
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement,
        options: {
          videoId: string
          playerVars?: Record<string, unknown>
          events?: {
            onReady?: () => void
            onError?: () => void
            onStateChange?: (e: { data: number }) => void
          }
        }
      ) => YTPlayerInstance
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number }
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

function loadYTScript(onReady: () => void) {
  if (window.YT?.Player) {
    onReady()
    return
  }
  const prev = window.onYouTubeIframeAPIReady
  window.onYouTubeIframeAPIReady = () => {
    prev?.()
    onReady()
  }
  if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  }
}

export function useYouTubePlayer(videoId: string | null) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayerInstance | null>(null)
  const [playerState, setPlayerState] = useState<YTPlayerState>('idle')
  const [isPlaying, setIsPlaying] = useState(false)
  // Duration as state (not a render-time read): YT players can report 0 at
  // onReady until metadata settles, so we also refresh it on state changes.
  const [duration, setDuration] = useState(0)

  // Reset player state whenever the video changes
  useResetOnChange(videoId, () => {
    setPlayerState('idle')
    setIsPlaying(false)
    setDuration(0)
  })

  useEffect(() => {
    if (!videoId) return

    const createPlayer = () => {
      if (!containerRef.current || !window.YT?.Player) return
      playerRef.current?.destroy()
      const el = document.createElement('div')
      containerRef.current.innerHTML = ''
      containerRef.current.appendChild(el)
      // Guard every event against late callbacks from a player that has
      // already been replaced/destroyed (events arrive via postMessage and
      // can straddle the swap).
      const player: YTPlayerInstance = new window.YT.Player(el, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1, controls: 0 },
        events: {
          onReady: () => {
            if (playerRef.current !== player) return
            setPlayerState('ready')
            setDuration(player.getDuration())
          },
          onError: () => {
            if (playerRef.current !== player) return
            setPlayerState('error')
          },
          onStateChange: (e) => {
            if (playerRef.current !== player) return
            setIsPlaying(e.data === 1) // 1 = YT.PlayerState.PLAYING
            // Metadata (and thus duration) is reliably present by the first
            // state change at the latest
            setDuration(player.getDuration())
          },
        },
      })
      playerRef.current = player
    }

    loadYTScript(createPlayer)

    return () => {
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [videoId])

  // Stable identities — all access goes through the ref, so consumers can
  // safely list these in effect dependency arrays.
  const getCurrentTime = useCallback((): number => playerRef.current?.getCurrentTime() ?? 0, [])
  const seekTo = useCallback((seconds: number) => { playerRef.current?.seekTo(seconds, true) }, [])
  const play  = useCallback(() => { if (typeof playerRef.current?.playVideo  === 'function') playerRef.current.playVideo() }, [])
  const pause = useCallback(() => { if (typeof playerRef.current?.pauseVideo === 'function') playerRef.current.pauseVideo() }, [])

  return { containerRef, playerState, isPlaying, duration, getCurrentTime, seekTo, play, pause }
}
