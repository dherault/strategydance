import { describe, expect, it } from 'bun:test'

import {
  compareKnowledgeNames,
  KNOWLEDGE_ID_PATTERN,
  MAX_KNOWLEDGE_DESCRIPTION_LENGTH,
  STRATEGIC_FRAMEWORK_FIELDS,
  STRATEGIC_FRAMEWORKS,
} from '../index'

// The file as it is on disk, besides the list parsed from it
const text = await Bun.file(new URL('./strategicFrameworks.json', import.meta.url)).text()

function expectFilled(value: string) {
  expect(value).not.toBe('')
  expect(value).toBe(value.trim())
}

describe('STRATEGIC_FRAMEWORKS', () => {
  // The JSON is cast to its type, which would let an entry without a field through
  it('gives every entry exactly its fields, in order', () => {
    for (const framework of STRATEGIC_FRAMEWORKS)
      expect(Object.keys(framework)).toEqual([...STRATEGIC_FRAMEWORK_FIELDS])
  })

  it('identifies each entry by a slug, once', () => {
    const ids = STRATEGIC_FRAMEWORKS.map(({ id }) => id)

    for (const id of ids) expect(id).toMatch(KNOWLEDGE_ID_PATTERN)

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('names each entry once', () => {
    const names = STRATEGIC_FRAMEWORKS.map(({ name }) => name.toLowerCase())

    for (const { name } of STRATEGIC_FRAMEWORKS) expectFilled(name)

    expect(new Set(names).size).toBe(names.length)
  })

  // One sentence, as a list of them shows it
  it('describes each entry in a line', () => {
    for (const { description } of STRATEGIC_FRAMEWORKS) {
      expectFilled(description)
      expect(description.length).toBeLessThanOrEqual(MAX_KNOWLEDGE_DESCRIPTION_LENGTH)
      expect(description).not.toContain('\n')
    }
  })

  // An agent applies a framework from these alone
  it('says when to use each, what it needs, what it asks and what it produces', () => {
    for (const { whenToUse, inputs, questions, output } of STRATEGIC_FRAMEWORKS) {
      expectFilled(whenToUse)
      expectFilled(output)
      expect(inputs.length).toBeGreaterThan(0)
      expect(questions.length).toBeGreaterThan(0)

      for (const item of [...inputs, ...questions]) expectFilled(item)
    }
  })

  // In order, so an entry added by hand or by a script lands where a reader looks for it
  it('is sorted by name', () => {
    const names = STRATEGIC_FRAMEWORKS.map(({ name }) => name)

    expect(names).toEqual(STRATEGIC_FRAMEWORKS.toSorted(compareKnowledgeNames).map(({ name }) => name))
  })

  // As a script writes it. The formatter would lay it out otherwise, so `.oxfmtrc.json` ignores it
  it('is written as JSON.stringify writes it', () => {
    expect(text).toBe(`${JSON.stringify(STRATEGIC_FRAMEWORKS, null, 2)}\n`)
  })
})
