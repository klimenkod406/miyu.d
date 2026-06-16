import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MemoryRouter } from 'react-router-dom'
import Button from './Button'

describe('Button', () => {
  describe('variants', () => {
    it('renders primary variant with gradient classes', () => {
      render(<Button variant="primary">Primary</Button>)
      const button = screen.getByRole('button', { name: /primary/i })
      expect(button.className).toContain('bg-gradient-to-r')
      expect(button.className).toContain('from-purple-500')
      expect(button.className).toContain('to-pink-500')
      expect(button.className).toContain('text-white')
    })

    it('renders glass variant with glass-hover class', () => {
      render(<Button variant="glass">Glass</Button>)
      const button = screen.getByRole('button', { name: /glass/i })
      expect(button.className).toContain('glass-hover')
      expect(button.className).toContain('text-white')
    })

    it('renders ghost variant with transparent background', () => {
      render(<Button variant="ghost">Ghost</Button>)
      const button = screen.getByRole('button', { name: /ghost/i })
      expect(button.className).toContain('hover:bg-white/5')
      expect(button.className).toContain('text-white/80')
    })

    it('renders danger variant with red classes', () => {
      render(<Button variant="danger">Danger</Button>)
      const button = screen.getByRole('button', { name: /danger/i })
      expect(button.className).toContain('bg-red-500/20')
      expect(button.className).toContain('text-red-400')
      expect(button.className).toContain('hover:bg-red-500/30')
    })
  })

  describe('sizes', () => {
    it('renders sm size with small padding', () => {
      render(<Button size="sm">Small</Button>)
      const button = screen.getByRole('button', { name: /small/i })
      expect(button.className).toContain('px-3')
      expect(button.className).toContain('py-1.5')
      expect(button.className).toContain('text-sm')
    })

    it('renders md size with medium padding (default)', () => {
      render(<Button size="md">Medium</Button>)
      const button = screen.getByRole('button', { name: /medium/i })
      expect(button.className).toContain('px-5')
      expect(button.className).toContain('py-2.5')
    })

    it('renders lg size with large padding', () => {
      render(<Button size="lg">Large</Button>)
      const button = screen.getByRole('button', { name: /large/i })
      expect(button.className).toContain('px-6')
      expect(button.className).toContain('py-3')
      expect(button.className).toContain('text-lg')
    })
  })

  it('passes children correctly', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  describe('disabled state', () => {
    it('applies disabled classes and attribute', () => {
      render(<Button disabled>Disabled</Button>)
      const button = screen.getByRole('button', { name: /disabled/i })
      expect(button).toBeDisabled()
      expect(button.className).toContain('opacity-50')
      expect(button.className).toContain('cursor-not-allowed')
      expect(button.className).toContain('pointer-events-none')
    })
  })

  describe('as prop', () => {
    it('renders as Link when as="link"', () => {
      render(
        <MemoryRouter>
          <Button as="link" to="/test-path">Link Button</Button>
        </MemoryRouter>
      )
      const link = screen.getByRole('link', { name: /link button/i })
      expect(link).toBeInTheDocument()
      expect(link.tagName).toBe('A')
      expect(link).toHaveAttribute('href', '/test-path')
    })

    it('renders as button by default', () => {
      render(<Button>Button</Button>)
      const button = screen.getByRole('button', { name: /button/i })
      expect(button.tagName).toBe('BUTTON')
    })
  })

  describe('framer-motion integration', () => {
    it('renders with motion.button structure', () => {
      render(<Button>Motion Test</Button>)
      const button = screen.getByRole('button', { name: /motion test/i })
      // framer-motion renders the underlying element, we verify it exists
      expect(button).toBeInTheDocument()
      // Base classes should be present
      expect(button.className).toContain('inline-flex')
      expect(button.className).toContain('items-center')
      expect(button.className).toContain('justify-center')
    })
  })

  describe('className prop', () => {
    it('merges custom className with base classes', () => {
      render(<Button className="custom-class">Custom</Button>)
      const button = screen.getByRole('button', { name: /custom/i })
      expect(button.className).toContain('custom-class')
      expect(button.className).toContain('inline-flex')
    })
  })

  describe('base classes', () => {
    it('applies base classes to all variants', () => {
      render(<Button>Base Test</Button>)
      const button = screen.getByRole('button', { name: /base test/i })
      expect(button.className).toContain('inline-flex')
      expect(button.className).toContain('items-center')
      expect(button.className).toContain('justify-center')
      expect(button.className).toContain('gap-2')
      expect(button.className).toContain('font-medium')
      expect(button.className).toContain('rounded-xl')
      expect(button.className).toContain('transition-colors')
    })
  })
})
