import { useState, useEffect, useCallback } from 'react'
import { useLanguage } from '../i18n/useLanguage'
import type { Locale } from '../i18n/translations'
import overviewDe from '../assets/tour/overview-de.webp'
import duetDe from '../assets/tour/duet-de.webp'
import highlightDe from '../assets/tour/highlight-de.webp'
import waveformDe from '../assets/tour/waveform-de.webp'
import overviewEn from '../assets/tour/overview-en.webp'
import duetEn from '../assets/tour/duet-en.webp'
import highlightEn from '../assets/tour/highlight-en.webp'
import waveformEn from '../assets/tour/waveform-en.webp'

// Screenshots exist per locale so the UI in the picture speaks the reader's
// language — same order as t.tour.slides.
const SHOTS: Record<Locale, string[]> = {
  de: [overviewDe, duetDe, highlightDe, waveformDe],
  en: [overviewEn, duetEn, highlightEn, waveformEn],
}

// On narrow screens the stage crops the shot instead of shrinking it to
// illegibility — this is the horizontal spot each slide must keep in frame.
const NARROW_FOCUS = ['0%', '20%', '0%', '0%']

const AUTOPLAY_MS = 6000

export function LandingTour() {
  const { locale, t } = useLanguage()
  const slides = t.tour.slides
  const shots = SHOTS[locale]
  const [index, setIndex] = useState(0)
  // Auto-advance is a hint that there is more to see — once the visitor steers
  // themselves, it would only fight them.
  const [autoplay, setAutoplay] = useState(true)
  const [hovered, setHovered] = useState(false)

  const step = useCallback((delta: number) => {
    setAutoplay(false)
    setIndex((i) => (i + delta + slides.length) % slides.length)
  }, [slides.length])

  const goTo = useCallback((i: number) => {
    setAutoplay(false)
    setIndex(i)
  }, [])

  useEffect(() => {
    if (!autoplay || hovered) return
    const id = setTimeout(() => setIndex((i) => (i + 1) % slides.length), AUTOPLAY_MS)
    return () => clearTimeout(id)
  }, [autoplay, hovered, index, slides.length])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1) }
  }

  const slide = slides[index]

  return (
    <section className="landing-tour">
      <h2 className="landing-section-heading">{t.tour.heading}</h2>
      <p className="landing-section-intro">{t.tour.intro}</p>

      <div
        className="tour-frame"
        role="group"
        aria-roledescription="carousel"
        aria-label={t.tour.heading}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
      >
        <div className="tour-stage">
          {/* Every shot stays mounted so switching slides never flashes an
              empty frame while the browser decodes the next image. */}
          {shots.map((src, i) => (
            <img
              key={src}
              className={`tour-shot${i === index ? ' tour-shot--active' : ''}`}
              src={src}
              alt={i === index ? slides[i].alt : ''}
              aria-hidden={i === index ? undefined : true}
              loading={i === 0 ? 'eager' : 'lazy'}
              decoding="async"
              width={2000}
              height={1029}
              style={{ '--tour-focus': NARROW_FOCUS[i] } as React.CSSProperties}
            />
          ))}
          <button className="tour-nav tour-nav--prev" onClick={() => step(-1)} aria-label={t.tour.prev}>‹</button>
          <button className="tour-nav tour-nav--next" onClick={() => step(1)} aria-label={t.tour.next}>›</button>
        </div>

        <div className="tour-caption" aria-live="polite">
          <h3 className="tour-caption-title">
            <span className="tour-step">{index + 1}</span>
            {slide.title}
          </h3>
          <p className="tour-caption-body">{slide.body}</p>
        </div>

        <div className="tour-dots">
          {slides.map((s, i) => (
            <button
              key={s.title}
              className={`tour-dot${i === index ? ' tour-dot--active' : ''}`}
              onClick={() => goTo(i)}
              aria-label={t.tour.goTo(i + 1)}
              aria-current={i === index ? true : undefined}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
