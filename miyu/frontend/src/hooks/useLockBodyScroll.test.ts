import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useLockBodyScroll } from './useLockBodyScroll'

describe('useLockBodyScroll', () => {
  beforeEach(() => {
    document.body.style.overflow = ''
  })

  it('sets overflow hidden when locked=true', () => {
    renderHook(() => useLockBodyScroll(true))
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('restores overflow when locked=false', () => {
    document.body.style.overflow = 'auto'
    const { rerender } = renderHook(
      (locked: boolean) => useLockBodyScroll(locked),
      { initialProps: true },
    )
    expect(document.body.style.overflow).toBe('hidden')

    rerender(false)
    expect(document.body.style.overflow).toBe('auto')
  })

  it('restores overflow on unmount', () => {
    document.body.style.overflow = 'scroll'
    const { unmount } = renderHook(() => useLockBodyScroll(true))
    expect(document.body.style.overflow).toBe('hidden')

    unmount()
    expect(document.body.style.overflow).toBe('scroll')
  })

  it('multiple instances work together', () => {
    document.body.style.overflow = 'auto'

    const { unmount: unmount1 } = renderHook(() => useLockBodyScroll(true))
    expect(document.body.style.overflow).toBe('hidden')

    const { unmount: unmount2 } = renderHook(() => useLockBodyScroll(true))
    expect(document.body.style.overflow).toBe('hidden')

    // Unmount first hook — second hook still holds the lock
    unmount1()
    expect(document.body.style.overflow).toBe('hidden')

    // Unmount second hook — all locks released, overflow restored
    unmount2()
    expect(document.body.style.overflow).toBe('auto')
  })
})
