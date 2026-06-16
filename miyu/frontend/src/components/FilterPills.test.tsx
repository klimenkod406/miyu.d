import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import FilterPills from './FilterPills'

const options = [
  { id: 'all', label: 'All' },
  { id: 'rock', label: 'Rock' },
  { id: 'pop', label: 'Pop' },
]

describe('FilterPills', () => {
  it('renders all options', () => {
    render(<FilterPills name="test" options={options} selected="all" onChange={() => {}} />)
    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('Rock')).toBeInTheDocument()
    expect(screen.getByText('Pop')).toBeInTheDocument()
  })

  it('selected option has active background classes', () => {
    render(<FilterPills name="test" options={options} selected="rock" onChange={() => {}} />)
    const rockBtn = screen.getByText('Rock').closest('button')!
    expect(rockBtn.className).toContain('text-white')
    // active pill should NOT have the inactive class
    expect(rockBtn.className).not.toContain('text-white/50')
  })

  it('clicking an option calls onChange with the correct id', () => {
    const onChange = vi.fn()
    render(<FilterPills name="test" options={options} selected="all" onChange={onChange} />)
    fireEvent.click(screen.getByText('Rock'))
    expect(onChange).toHaveBeenCalledWith('rock')
  })

  it('works in single-select mode (default) — only one selected', () => {
    render(<FilterPills name="test" options={options} selected="pop" onChange={() => {}} />)
    const popBtn = screen.getByText('Pop').closest('button')!
    const allBtn = screen.getByText('All').closest('button')!
    expect(popBtn.className).toContain('text-white')
    expect(allBtn.className).toContain('text-white/50')
  })

  it('works in multi-select mode — multiple selected', () => {
    render(
      <FilterPills name="test" options={options} selected={['rock', 'pop']} onChange={() => {}} multi />
    )
    const rockBtn = screen.getByText('Rock').closest('button')!
    const popBtn = screen.getByText('Pop').closest('button')!
    const allBtn = screen.getByText('All').closest('button')!
    expect(rockBtn.className).toContain('text-white')
    expect(popBtn.className).toContain('text-white')
    expect(allBtn.className).toContain('text-white/50')
  })

  it('renders a motion.div with layoutId for the animated indicator', () => {
    const { container } = render(
      <FilterPills name="test" options={options} selected="rock" onChange={() => {}} />
    )
    // The animated indicator is a div inside the selected button with indicator classes
    const rockBtn = screen.getByText('Rock').closest('button')!
    const indicator = rockBtn.querySelector('div.absolute')
    expect(indicator).toBeInTheDocument()
    expect(indicator!.className).toContain('bg-purple-500')
    expect(indicator!.className).toContain('rounded-full')
  })
})
