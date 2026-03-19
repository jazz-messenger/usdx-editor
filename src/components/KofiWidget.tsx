import { useEffect } from 'react'

declare global {
  interface Window {
    kofiWidgetOverlay: {
      draw: (username: string, options: Record<string, string>) => void
    }
  }
}

export function KofiWidget() {
  useEffect(() => {
    if (document.getElementById('kofi-overlay-script')) return

    const script = document.createElement('script')
    script.id = 'kofi-overlay-script'
    script.src = 'https://storage.ko-fi.com/cdn/scripts/overlay-widget.js'
    script.onload = () => {
      window.kofiWidgetOverlay.draw('jankorczak', {
        'type': 'floating-chat',
        'floating-chat.donateButton.text': 'Support me',
        'floating-chat.donateButton.background-color': '#f97316',
        'floating-chat.donateButton.text-color': '#fff',
      })
    }
    document.body.appendChild(script)
  }, [])

  return null
}
