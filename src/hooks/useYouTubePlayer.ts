import { useEffect, useRef, useState } from 'react'

export type YTPlayerState = 'idle' | 'ready' | 'error'

interface YTPlayerInstance {
  getCurrentTime(): number
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

  useEffect(() => {
    if (!videoId) {
      setPlayerState('idle')
      setIsPlaying(false)
      return
    }

    setPlayerState('idle')
    setIsPlaying(false)

    const createPlayer = () => {
      if (!containerRef.current || !window.YT?.Player) return
      playerRef.current?.destroy()
      const el = document.createElement('div')
      containerRef.current.innerHTML = ''
      containerRef.current.appendChild(el)
      playerRef.current = new window.YT.Player(el, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onReady: () => setPlayerState('ready'),
          onError: () => setPlayerState('error'),
          onStateChange: (e) => {
            setIsPlaying(e.data === 1) // 1 = YT.PlayerState.PLAYING
          },
        },
      })
    }

    loadYTScript(createPlayer)

    return () => {
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [videoId])

  const getCurrentTime = (): number => playerRef.current?.getCurrentTime() ?? 0
  const seekTo = (seconds: number) => playerRef.current?.seekTo(seconds, true)
  const play = () => playerRef.current?.playVideo()
  const pause = () => playerRef.current?.pauseVideo()

  return { containerRef, playerState, isPlaying, getCurrentTime, seekTo, play, pause }
}
