import { describe, expect, it } from 'bun:test'

import createId from '~utils/common/createId'

describe('createId', () => {
  it('writes a UUID the way Data Connect returns one', () => {
    expect(createId()).toMatch(/^[0-9a-f]{32}$/)
  })

  it('is fresh each time', () => {
    expect(createId()).not.toBe(createId())
  })
})
