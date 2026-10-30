import { describe, expect, it } from 'bun:test'

import {
  compareKnowledgeNames,
  KNOWLEDGE_ID_PATTERN,
  MARKETING_TACTIC_FIELDS,
  MARKETING_TACTICS,
  MarketingTacticChannel,
  MarketingTacticEffort,
  MarketingTacticTimeToResults,
  MAX_KNOWLEDGE_DESCRIPTION_LENGTH,
} from '../index'

// The file as it is on disk, besides the list parsed from it
const text = await Bun.file(new URL('./marketingTactics.json', import.meta.url)).text()

function expectFilled(value: string) {
  expect(value).not.toBe('')
  expect(value).toBe(value.trim())
}

describe('MARKETING_TACTICS', () => {
  // The JSON is cast to its type, which would let an entry without a field through
  it('gives every entry exactly its fields, in order', () => {
    for (const tactic of MARKETING_TACTICS) expect(Object.keys(tactic)).toEqual([...MARKETING_TACTIC_FIELDS])
  })

  it('holds only known channels, efforts and times to results', () => {
    const channels: string[] = Object.values(MarketingTacticChannel)
    const efforts: string[] = Object.values(MarketingTacticEffort)
    const timesToResults: string[] = Object.values(MarketingTacticTimeToResults)

    for (const tactic of MARKETING_TACTICS) {
      expect(channels).toContain(tactic.channel)
      expect(efforts).toContain(tactic.effort)
      expect(timesToResults).toContain(tactic.timeToResults)
      expect(typeof tactic.paid).toBe('boolean')
      expect(typeof tactic.technical).toBe('boolean')
    }
  })

  it('identifies each entry by a slug, once', () => {
    const ids = MARKETING_TACTICS.map(({ id }) => id)

    for (const id of ids) expect(id).toMatch(KNOWLEDGE_ID_PATTERN)

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('names each entry once', () => {
    const names = MARKETING_TACTICS.map(({ name }) => name.toLowerCase())

    for (const { name } of MARKETING_TACTICS) expectFilled(name)

    expect(new Set(names).size).toBe(names.length)
  })

  // One sentence, as a list of them shows it
  it('describes each entry in a line', () => {
    for (const { description } of MARKETING_TACTICS) {
      expectFilled(description)
      expect(description.length).toBeLessThanOrEqual(MAX_KNOWLEDGE_DESCRIPTION_LENGTH)
      expect(description).not.toContain('\n')
    }
  })

  // A run sets a target on each metric, so a tactic without one could never be judged
  it('says how to run each and what to measure', () => {
    for (const { howTo, metrics } of MARKETING_TACTICS) {
      expectFilled(howTo)
      expect(metrics.length).toBeGreaterThan(0)

      for (const metric of metrics) expectFilled(metric)

      expect(new Set(metrics).size).toBe(metrics.length)
    }
  })

  // In order, so an entry added by hand or by a script lands where a reader looks for it
  it('is sorted by name', () => {
    const names = MARKETING_TACTICS.map(({ name }) => name)

    expect(names).toEqual(MARKETING_TACTICS.toSorted(compareKnowledgeNames).map(({ name }) => name))
  })

  // As a script writes it. The formatter would lay it out otherwise, so `.oxfmtrc.json` ignores it
  it('is written as JSON.stringify writes it', () => {
    expect(text).toBe(`${JSON.stringify(MARKETING_TACTICS, null, 2)}\n`)
  })
})
