import { describe, expect, it } from 'bun:test'
import { CompanyAspect } from 'strategydance-database/web'

import { COMPANY_ASPECTS } from './constants'

describe('COMPANY_ASPECTS', () => {
  it('lists each of the schema\'s aspects exactly once', () => {
    expect([...COMPANY_ASPECTS].sort()).toEqual(Object.values(CompanyAspect).sort())
  })
})
