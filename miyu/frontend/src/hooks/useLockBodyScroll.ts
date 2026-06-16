import { useEffect } from 'react'

let lockCount = 0
let originalOverflow: string | null = null

export function useLockBodyScroll(locked: boolean): void {
  useEffect(() => {
    if (typeof document === 'undefined') return

    if (locked) {
      if (lockCount === 0) {
        originalOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
      }
      lockCount++
    }

    return () => {
      if (lockCount > 0) {
        lockCount--
        if (lockCount === 0 && originalOverflow !== null) {
          document.body.style.overflow = originalOverflow
          originalOverflow = null
        }
      }
    }
  }, [locked])
}
