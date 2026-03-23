import { useEffect } from 'react'

declare global {
  interface Window {
    kofiWidgetOverlay: {
      draw: (username: string, options: Record<string, string>) => void
    }
  }
}

interface KofiWidgetProps {
  text: string
}

export function KofiWidget({ text }: KofiWidgetProps) {
  // Initial draw — runs once when the script is first loaded
  useEffect(() => {
    if (document.getElementById('kofi-overlay-script')) return

    const script = document.createElement('script')
    script.id = 'kofi-overlay-script'
    script.src = 'https://storage.ko-fi.com/cdn/scripts/overlay-widget.js'
    script.onload = () => {
      window.kofiWidgetOverlay.draw('jankorczak', {
        'type': 'floating-chat',
        'floating-chat.donateButton.text': text,
        'floating-chat.donateButton.background-color': '#f97316',
        'floating-chat.donateButton.text-color': '#fff',
      })
    }
    document.body.appendChild(script)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update button label when locale changes (best-effort DOM patch)
  useEffect(() => {
    const btn = document.querySelector<HTMLElement>('.floatingchat-container-wrap-mobi .kfds-font-size-medium')
      ?? document.querySelector<HTMLElement>('[class*="floatingchat"] [class*="btn"] span')
    if (btn) btn.textContent = text
  }, [text])

  return null
}
