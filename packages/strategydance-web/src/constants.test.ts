import { describe, expect, it } from 'bun:test'

import { CompanyAspect, TaskStatus } from 'strategydance-database/web'

import { COMPANY_ASPECTS, TASK_STATUSES } from './constants'

describe('COMPANY_ASPECTS', () => {
  it("lists each of the schema's aspects exactly once", () => {
    expect([...COMPANY_ASPECTS].sort()).toEqual(Object.values(CompanyAspect).sort())
  })
})

describe('TASK_STATUSES', () => {
  it("lists each of the schema's statuses exactly once", () => {
    expect([...TASK_STATUSES].sort()).toEqual(Object.values(TaskStatus).sort())
  })
})
