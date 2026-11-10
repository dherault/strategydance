import { describe, expect, it } from 'bun:test'

import { CompanyAspect, TaskStatus } from 'strategydance-database/web'
import { DirectoryBusinessModel, DirectoryCategory } from 'strategydance-knowledge/src/directories/enums'

import { COMPANY_ASPECTS, DIRECTORY_BUSINESS_MODELS, DIRECTORY_CATEGORIES, TASK_STATUSES } from './constants'

describe('COMPANY_ASPECTS', () => {
  it("lists each of the schema's aspects exactly once", () => {
    expect([...COMPANY_ASPECTS].sort()).toEqual(Object.values(CompanyAspect).sort())
  })
})

describe('DIRECTORY_BUSINESS_MODELS and DIRECTORY_CATEGORIES', () => {
  it("list each of the knowledge package's values exactly once", () => {
    expect([...DIRECTORY_BUSINESS_MODELS].sort()).toEqual(Object.values(DirectoryBusinessModel).sort())
    expect([...DIRECTORY_CATEGORIES].sort()).toEqual(Object.values(DirectoryCategory).sort())
  })
})

describe('TASK_STATUSES', () => {
  it("lists each of the schema's statuses exactly once", () => {
    expect([...TASK_STATUSES].sort()).toEqual(Object.values(TaskStatus).sort())
  })
})
