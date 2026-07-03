interface KofiWidgetProps {
  text: string
}

/**
 * Floating Ko-fi donation button as a plain link.
 *
 * Deliberately NOT the official overlay widget: that would load third-party
 * JavaScript from storage.ko-fi.com on every page view (full DOM access, no
 * SRI possible, GDPR-relevant request before any user interaction). With a
 * plain link, no data flows to Ko-fi until the user actively clicks.
 */
export function KofiWidget({ text }: KofiWidgetProps) {
  return (
    <a
      className="kofi-button"
      href="https://ko-fi.com/jankorczak"
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="kofi-button-icon" aria-hidden="true">☕</span>
      {text}
    </a>
  )
}
