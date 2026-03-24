import { useState, useRef, type ReactNode } from 'react'

interface TooltipProps {
  text: string
  /** When provided, wraps children as the hover trigger instead of showing a ⓘ icon */
  children?: ReactNode
}

export function Tooltip({ text, children }: TooltipProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)

  const show = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPos({ top: rect.top, left: rect.left + rect.width / 2 })
    }
  }

  const hide = () => setPos(null)

  return (
    <span ref={triggerRef} className="tooltip-wrap" onMouseEnter={show} onMouseLeave={hide}>
      {children ?? <span className="tooltip-icon" aria-hidden="true">ⓘ</span>}
      {pos && (
        <span
          className="tooltip-bubble"
          role="tooltip"
          style={{ top: pos.top, left: pos.left }}
        >
          {text}
        </span>
      )}
    </span>
  )
}
