import { useEffect, useRef } from 'react'
import { useLanguage } from '../i18n/LanguageContext'

interface HelpModalProps {
  onClose: () => void
}

export function HelpModal({ onClose }: HelpModalProps) {
  const { t } = useLanguage()
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    el.showModal()
    return () => el.close()
  }, [])

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose()
  }

  return (
    <dialog ref={dialogRef} className="help-dialog" onClick={handleBackdropClick}>
      <div className="help-dialog-inner">
        <div className="help-dialog-header">
          <h2>{t.help.title}</h2>
          <button className="help-dialog-close" onClick={onClose} aria-label={t.help.close}>
            ✕
          </button>
        </div>
        <div className="help-dialog-body">
          {t.help.sections.map((section) => (
            <section key={section.heading} className="help-section">
              <h3 className="help-section-heading">{section.heading}</h3>
              <p className="help-section-body">{section.body}</p>
              {section.items.length > 0 && (
                <ul className="help-section-list">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </dialog>
  )
}
