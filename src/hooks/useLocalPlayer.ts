import { useState, useRef, useCallback } from 'react'

export type LocalPlayerState = 'idle' | 'ready' | 'error'

/**
 * State and controls for the local <video> element (used for both video files
 * and audio files). The element itself stays in the component's JSX — attach
 * `videoRef` and spread `handlers` onto it.
 */
export function useLocalPlayer(mediaUrl: string | null) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playerState, setPlayerState] = useState<LocalPlayerState>('idle')
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)

  // Reset player state whenever the source changes —
  // adjust-state-during-render pattern instead of an effect.
  const [prevUrl, setPrevUrl] = useState(mediaUrl)
  if (mediaUrl !== prevUrl) {
    setPrevUrl(mediaUrl)
    setPlayerState('idle')
    setIsPlaying(false)
  }

  const getCurrentTime = useCallback(() => videoRef.current?.currentTime ?? 0, [])
  const seekTo = useCallback((s: number) => { if (videoRef.current) videoRef.current.currentTime = s }, [])
  const play = useCallback(() => { videoRef.current?.play() }, [])
  const pause = useCallback(() => { videoRef.current?.pause() }, [])

  const handlers = {
    onLoadedMetadata: () => setDuration(videoRef.current?.duration ?? 0),
    onCanPlay: () => setPlayerState('ready'),
    onError: () => setPlayerState('error'),
    onPlay: () => setIsPlaying(true),
    onPause: () => setIsPlaying(false),
    onEnded: () => setIsPlaying(false),
  }

  return { videoRef, playerState, isPlaying, duration, getCurrentTime, seekTo, play, pause, handlers }
}
