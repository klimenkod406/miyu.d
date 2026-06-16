import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import FilterTabs from './FilterTabs'

const tabs = [
  { id: 'all', label: 'All' },
  { id: 'tracks', label: 'Tracks' },
  { id: 'albums', label: 'Albums' },
]

describe('FilterTabs', () => {
  it('renders all tabs from props', () => {
    render(<FilterTabs tabs={tabs} activeTab="all" onChange={vi.fn()} />)
    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('Tracks')).toBeInTheDocument()
    expect(screen.getByText('Albums')).toBeInTheDocument()
  })

  it('active tab has text-white class, inactive tabs have text-white/50', () => {
    render(<FilterTabs tabs={tabs} activeTab="tracks" onChange={vi.fn()} />)
    const activeBtn = screen.getByText('Tracks').closest('button')!
    const inactiveBtn = screen.getByText('All').closest('button')!
    expect(activeBtn.className).toContain('text-white')
    expect(inactiveBtn.className).toContain('text-white/50')
  })

  it('clicking a tab calls onChange with the tab id', () => {
    const onChange = vi.fn()
    render(<FilterTabs tabs={tabs} activeTab="all" onChange={onChange} />)
    fireEvent.click(screen.getByText('Albums'))
    expect(onChange).toHaveBeenCalledWith('albums')
  })

  it('renders a motion.div indicator with layoutId for slide animation', () => {
    const { container } = render(
      <FilterTabs tabs={tabs} activeTab="all" onChange={vi.fn()} />
    )
    const indicator = container.querySelector('[data-testid="tab-indicator"]')
    expect(indicator).toBeInTheDocument()
    expect(indicator!.className).toContain('glass-accent')
  })
})
