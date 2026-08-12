import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { LandingTour } from './LandingTour'
import { translations } from '../i18n/translations'

const de = translations.de.tour

describe('LandingTour', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('starts on the first slide and labels it as 1 of n', () => {
    render(<LandingTour />)
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(de.slides[0].title)
    expect(screen.getByRole('group', { name: de.heading })).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAccessibleName(de.slides[0].alt)
  })

  it('advances and goes back through the slides', () => {
    render(<LandingTour />)
    fireEvent.click(screen.getByRole('button', { name: de.next }))
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(de.slides[1].title)
    fireEvent.click(screen.getByRole('button', { name: de.prev }))
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(de.slides[0].title)
  })

  it('wraps around at both ends', () => {
    render(<LandingTour />)
    const last = de.slides.length - 1
    fireEvent.click(screen.getByRole('button', { name: de.prev }))
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(de.slides[last].title)
    fireEvent.click(screen.getByRole('button', { name: de.next }))
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(de.slides[0].title)
  })

  it('jumps to a slide via its dot and marks it as current', () => {
    render(<LandingTour />)
    fireEvent.click(screen.getByRole('button', { name: de.goTo(3) }))
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(de.slides[2].title)
    expect(screen.getByRole('button', { name: de.goTo(3) })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: de.goTo(1) })).not.toHaveAttribute('aria-current')
  })

  it('advances on its own and stops once the user takes over', () => {
    render(<LandingTour />)
    act(() => { vi.advanceTimersByTime(7000) })
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(de.slides[1].title)

    fireEvent.click(screen.getByRole('button', { name: de.next }))
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(de.slides[2].title)
    act(() => { vi.advanceTimersByTime(30000) })
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(de.slides[2].title)
  })

  it('pauses auto-advance while the pointer rests on the tour', () => {
    render(<LandingTour />)
    const group = screen.getByRole('group', { name: de.heading })
    fireEvent.mouseEnter(group)
    act(() => { vi.advanceTimersByTime(30000) })
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(de.slides[0].title)

    fireEvent.mouseLeave(group)
    act(() => { vi.advanceTimersByTime(7000) })
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(de.slides[1].title)
  })

  it('steps with the arrow keys', () => {
    render(<LandingTour />)
    const group = screen.getByRole('group', { name: de.heading })
    fireEvent.keyDown(group, { key: 'ArrowRight' })
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(de.slides[1].title)
    fireEvent.keyDown(group, { key: 'ArrowLeft' })
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(de.slides[0].title)
  })

  it('offers one dot per slide', () => {
    render(<LandingTour />)
    expect(screen.getAllByRole('button', { name: /^Zu Schritt/ })).toHaveLength(de.slides.length)
  })
})
