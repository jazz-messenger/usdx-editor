import { useEffect, useRef, useState } from 'react'

export type YTPlayerState = 'idle' | 'ready' | 'error'

interface YTPlayerInstance {
  getCurrentTime(): number
  destroy(): void
  loadVideoById(videoId: string): void
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement,
        options: {
          videoId: string
          playerVars?: Record<string, unknown>
          events?: { onReady?: () => void; onError?: () => void }
        }
      ) => YTPlayerInstance
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

  useEffect(() => {
    if (!videoId) {
      setPlayerState('idle')
      return
    }

    setPlayerState('idle')

    const createPlayer = () => {
      if (!containerRef.current || !window.YT?.Player) return
      playerRef.current?.destroy()
      // YT replaces the element, so we need a fresh div inside the container
      const el = document.createElement('div')
      containerRef.current.innerHTML = ''
      containerRef.current.appendChild(el)
      playerRef.current = new window.YT.Player(el, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onReady: () => setPlayerState('ready'),
          onError: () => setPlayerState('error'),
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

  return { containerRef, playerState, getCurrentTime }
}
