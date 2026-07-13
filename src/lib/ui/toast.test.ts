import { describe, expect, it, vi } from 'vitest'
import { dismissToast, pushToast, toastList } from './toast.svelte'

describe('toast store', () => {
  it('adds a toast and auto-dismisses it after the given duration', () => {
    vi.useFakeTimers()
    try {
      pushToast('Waypoint set', 'info', 1000)
      expect(toastList()).toHaveLength(1)
      expect(toastList()[0].message).toBe('Waypoint set')
      expect(toastList()[0].tone).toBe('info')

      vi.advanceTimersByTime(999)
      expect(toastList()).toHaveLength(1)

      vi.advanceTimersByTime(1)
      expect(toastList()).toHaveLength(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('dismisses a specific toast by id without affecting others', () => {
    vi.useFakeTimers()
    try {
      pushToast('First', 'info', 10_000)
      pushToast('Second', 'warning', 10_000)
      const [first, second] = toastList()

      dismissToast(first.id)

      expect(toastList()).toHaveLength(1)
      expect(toastList()[0].id).toBe(second.id)
    } finally {
      vi.useRealTimers()
    }
  })
})
