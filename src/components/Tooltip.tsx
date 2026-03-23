interface TooltipProps {
  text: string
}

export function Tooltip({ text }: TooltipProps) {
  return (
    <span className="tooltip-wrap" aria-label={text}>
      <span className="tooltip-icon" aria-hidden="true">ⓘ</span>
      <span className="tooltip-bubble" role="tooltip">{text}</span>
    </span>
  )
}
