import { describe, expect, it } from 'bun:test'

import readBillSaveRefusal from '~utils/budget/readBillSaveRefusal'

describe('readBillSaveRefusal', () => {
  it('reads a receipt that can no longer be attached', () => {
    expect(readBillSaveRefusal(new Error('The receipt can no longer be attached to this bill: attach it again'))).toBe(
      'receipt',
    )
  })

  it('reads an organization holding every bill it may', () => {
    expect(readBillSaveRefusal(new Error('An organization keeps at most 2000 bills'))).toBe('full')
  })

  it('reads anything else as nothing it can say', () => {
    expect(readBillSaveRefusal(new Error('The bill was deleted or changed elsewhere since it was read'))).toBeNull()
    expect(readBillSaveRefusal('attach it again')).toBeNull()
  })
})
