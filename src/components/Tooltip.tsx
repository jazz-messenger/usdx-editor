import { useState, useRef } from 'react'

interface TooltipProps {
  text: string
}

export function Tooltip({ text }: TooltipProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const iconRef = useRef<HTMLSpanElement>(null)

  const show = () => {
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect()
      setPos({ top: rect.top, left: rect.left + rect.width / 2 })
    }
  }

  return (
    <span className="tooltip-wrap" onMouseEnter={show} onMouseLeave={() => setPos(null)}>
      <span ref={iconRef} className="tooltip-icon" aria-hidden="true">ⓘ</span>
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
