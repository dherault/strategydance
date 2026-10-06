import { beforeEach, describe, expect, it } from 'bun:test'

import { REDIRECT_PATH_LIFETIME_MS, REDIRECT_PATH_STORAGE_KEY } from '~constants'

import forgetRedirectPath from './forgetRedirectPath'
import keepRedirectPath from './keepRedirectPath'
import readRedirectPath from './readRedirectPath'

// A localStorage for the helpers to keep the page in, since Bun has none
const store = new Map<string, string>()

globalThis.localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, value)
  },
  removeItem: (key: string) => {
    store.delete(key)
  },
  clear: () => store.clear(),
  key: () => null,
  length: 0,
}

const NOW = Date.UTC(2026, 9, 6, 12)

describe('readRedirectPath', () => {
  beforeEach(() => {
    store.clear()
  })

  it('reads back the page kept, normalized', () => {
    keepRedirectPath('/invitation/5febe4d9f66a4422967941b41d5e6589', NOW)

    expect(readRedirectPath(NOW)).toBe('/invitation/5febe4d9f66a4422967941b41d5e6589')

    keepRedirectPath('/team/../explore?tab=all', NOW)

    expect(readRedirectPath(NOW)).toBe('/explore?tab=all')
  })

  it('reads the same page again until it is forgotten', () => {
    keepRedirectPath('/team', NOW)

    expect(readRedirectPath(NOW)).toBe('/team')
    expect(readRedirectPath(NOW)).toBe('/team')

    forgetRedirectPath()

    expect(readRedirectPath(NOW)).toBeNull()
  })

  it('reads nothing when nothing is kept', () => {
    expect(readRedirectPath(NOW)).toBeNull()
  })

  it('reads nothing once the page has waited too long', () => {
    keepRedirectPath('/team', NOW)

    expect(readRedirectPath(NOW + REDIRECT_PATH_LIFETIME_MS)).toBe('/team')
    expect(readRedirectPath(NOW + REDIRECT_PATH_LIFETIME_MS + 1)).toBeNull()

    // Nor when the clock has since moved back as far
    expect(readRedirectPath(NOW - REDIRECT_PATH_LIFETIME_MS - 1)).toBeNull()
  })

  it('keeps only the latest page', () => {
    keepRedirectPath('/team', NOW)
    keepRedirectPath('/today', NOW)

    expect(readRedirectPath(NOW)).toBe('/today')
  })

  it('reads nothing that is not a page of the app', () => {
    keepRedirectPath('/authentication', NOW)

    expect(readRedirectPath(NOW)).toBeNull()

    keepRedirectPath('//evil.example', NOW)

    expect(readRedirectPath(NOW)).toBeNull()
  })

  it('reads nothing from a value it did not write', () => {
    store.set(REDIRECT_PATH_STORAGE_KEY, '{')

    expect(readRedirectPath(NOW)).toBeNull()

    store.set(REDIRECT_PATH_STORAGE_KEY, JSON.stringify('/team'))

    expect(readRedirectPath(NOW)).toBeNull()

    store.set(REDIRECT_PATH_STORAGE_KEY, JSON.stringify({ path: '/team' }))

    expect(readRedirectPath(NOW)).toBeNull()

    store.set(REDIRECT_PATH_STORAGE_KEY, JSON.stringify({ path: 42, keptAt: NOW }))

    expect(readRedirectPath(NOW)).toBeNull()
  })
})
