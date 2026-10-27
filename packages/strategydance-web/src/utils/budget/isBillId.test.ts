import { describe, expect, it } from 'bun:test'

import isBillId from '~utils/budget/isBillId'

describe('isBillId', () => {
  it('takes 32 lowercase hex digits', () => {
    expect(isBillId('6f1c2b0e9a4d4c3b8e7f5a6b7c8d9e0f')).toBe(true)
  })

  it('refuses anything else', () => {
    expect(isBillId('6f1c2b0e-9a4d-4c3b-8e7f-5a6b7c8d9e0f')).toBe(false)
    expect(isBillId('6F1C2B0E9A4D4C3B8E7F5A6B7C8D9E0F')).toBe(false)
    expect(isBillId('figma')).toBe(false)
  })
})
