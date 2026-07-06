import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Tooltip } from './Tooltip'

describe('Tooltip', () => {
  it('shows the bubble on mouse enter and hides it on leave', () => {
    render(<Tooltip text="Hilfe"><button>Trigger</button></Tooltip>)
    const wrap = screen.getByRole('button').closest('.tooltip-wrap')!
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    fireEvent.mouseEnter(wrap)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Hilfe')
    fireEvent.mouseLeave(wrap)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('shows the bubble when the trigger receives keyboard focus', () => {
    render(<Tooltip text="Hilfe"><button>Trigger</button></Tooltip>)
    fireEvent.focus(screen.getByRole('button'))
    expect(screen.getByRole('tooltip')).toHaveTextContent('Hilfe')
    fireEvent.blur(screen.getByRole('button'))
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('links the trigger to the bubble via aria-describedby', () => {
    render(<Tooltip text="Beschreibung"><button>Trigger</button></Tooltip>)
    const button = screen.getByRole('button')
    const describedBy = button.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    const bubble = document.getElementById(describedBy!)
    expect(bubble).toHaveTextContent('Beschreibung')
  })

  it('closes on Escape while the trigger is focused', () => {
    render(<Tooltip text="Hilfe"><button>Trigger</button></Tooltip>)
    const button = screen.getByRole('button')
    fireEvent.focus(button)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    fireEvent.keyDown(button, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('renders a focusable ⓘ icon with aria-describedby when no children are given', () => {
    render(<Tooltip text="Info" />)
    const icon = screen.getByText('ⓘ')
    expect(icon).toHaveAttribute('tabindex', '0')
    const describedBy = icon.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    fireEvent.focus(icon)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Info')
  })
})
