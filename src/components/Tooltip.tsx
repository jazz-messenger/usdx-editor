import { cloneElement, isValidElement, useId, useRef, useState, type ReactNode } from 'react'

interface TooltipProps {
  text: string
  /** When provided, wraps children as the hover trigger instead of showing a ⓘ icon */
  children?: ReactNode
}

export function Tooltip({ text, children }: TooltipProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const id = useId()

  const show = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPos({ top: rect.top, left: rect.left + rect.width / 2 })
    }
  }

  const hide = () => setPos(null)

  // Link the trigger to the bubble for screenreaders. For an element child
  // (button, img, …) inject aria-describedby via cloneElement — merged with
  // any id the child already carries. The fallback ⓘ icon is made focusable
  // so keyboard users can reach the tooltip; onMouseDown-preventDefault stops
  // mouse clicks from focusing the icon (it often sits inside <label> —
  // stealing focus there would break the label's click-through to its input).
  const trigger = isValidElement<{ 'aria-describedby'?: string }>(children)
    ? cloneElement(children, {
        'aria-describedby': [children.props['aria-describedby'], id].filter(Boolean).join(' '),
      })
    : children ?? (
        <span
          className="tooltip-icon"
          tabIndex={0}
          aria-describedby={id}
          onMouseDown={(e) => e.preventDefault()}
        >ⓘ</span>
      )

  return (
    <span
      ref={triggerRef}
      className="tooltip-wrap"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={(e) => { if (e.key === 'Escape') hide() }}
    >
      {trigger}
      {/* Always in the DOM so aria-describedby resolves; role queries and
          visual rendering only apply while it is shown. */}
      <span
        id={id}
        className="tooltip-bubble"
        role="tooltip"
        style={pos ? { top: pos.top, left: pos.left } : { display: 'none' }}
      >
        {text}
      </span>
    </span>
  )
}
