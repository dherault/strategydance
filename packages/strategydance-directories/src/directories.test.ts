import { describe, expect, it } from 'bun:test'

import { DIRECTORIES, DirectoryBusinessModel, DirectoryType } from './index'

describe('DIRECTORIES', () => {
  it('holds only known types and business models', () => {
    const types: string[] = Object.values(DirectoryType)
    const businessModels: string[] = Object.values(DirectoryBusinessModel)

    for (const directory of DIRECTORIES) {
      expect(types).toContain(directory.type)
      expect(businessModels).toContain(directory.businessModel)
    }
  })

  it('roots each website at the origin it is submitted to', () => {
    for (const directory of DIRECTORIES) {
      const submissionUrl = new URL(directory.submissionUrl)

      expect(['http:', 'https:']).toContain(submissionUrl.protocol)

      if (directory.type === DirectoryType.WEBSITE) expect(directory.rootUrl).toBe(`${submissionUrl.origin}/`)
    }
  })

  it('roots each Reddit community at its own page', () => {
    for (const directory of DIRECTORIES.filter(({ type }) => type === DirectoryType.REDDIT_COMMUNITY)) {
      expect(directory.rootUrl).toMatch(/^https:\/\/www\.reddit\.com\/r\/\w+\/$/)
      expect(directory.submissionUrl.startsWith(directory.rootUrl)).toBe(true)
    }
  })

  // One entry per directory, so whatever checks them later never checks or removes one twice
  it('lists each directory once', () => {
    const names = DIRECTORIES.map(({ name }) => name.toLowerCase())
    const submissionUrls = DIRECTORIES.map(({ submissionUrl }) => submissionUrl)

    expect(new Set(names).size).toBe(names.length)
    expect(new Set(submissionUrls).size).toBe(submissionUrls.length)
  })

  // In order, so an entry added by hand or by a script lands where a reader looks for it
  it('is sorted by name', () => {
    const names = DIRECTORIES.map(({ name }) => name)

    expect(names).toEqual(names.toSorted((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })))
  })
})
