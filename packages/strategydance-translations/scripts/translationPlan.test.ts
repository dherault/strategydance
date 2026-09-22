import { describe, expect, it } from 'bun:test'
import { Locale } from 'strategydance-core'

import type { SourceMessage } from './intlMessages'
import { buildMessageBatches, resolveDoneLocales } from './translationPlan'

const TARGET_LOCALES = [Locale.FR, Locale.ES, Locale.DE]

function buildMessage(id: string, defaultMessage: string, description?: string): SourceMessage {
  return { messageType: 'global', id, defaultMessage, description }
}

describe('resolveDoneLocales', () => {
  it('returns nothing for a message the lock has never seen', () => {
    expect(resolveDoneLocales(undefined, 'hash', TARGET_LOCALES, () => true)).toEqual(new Set())
  })

  it('retires every locale at once when the English source has changed', () => {
    const entry = { hash: 'old', locales: 'DE,ES,FR' }

    expect(resolveDoneLocales(entry, 'new', TARGET_LOCALES, () => true)).toEqual(new Set())
  })

  it('keeps the locales the lock vouches for when the hash still matches', () => {
    const entry = { hash: 'hash', locales: 'DE,ES,FR' }

    expect(resolveDoneLocales(entry, 'hash', TARGET_LOCALES, () => true)).toEqual(new Set([Locale.FR, Locale.ES, Locale.DE]))
  })

  it('retires a locale whose translation is no longer on disk, and only that one', () => {
    const entry = { hash: 'hash', locales: 'DE,ES,FR' }
    const done = resolveDoneLocales(entry, 'hash', TARGET_LOCALES, locale => locale !== Locale.ES)

    expect(done).toEqual(new Set([Locale.FR, Locale.DE]))
  })

  it('retires a locale that has left the target list', () => {
    const entry = { hash: 'hash', locales: 'DE,ES,FR,JA' }
    const done = resolveDoneLocales(entry, 'hash', TARGET_LOCALES, () => true)

    expect(done).toEqual(new Set([Locale.FR, Locale.ES, Locale.DE]))
  })
})

describe('buildMessageBatches', () => {
  it('returns no batch for no messages', () => {
    expect(buildMessageBatches([], 100)).toEqual([])
  })

  it('keeps messages in one batch while they fit the budget', () => {
    const messages = [buildMessage('a', 'one'), buildMessage('b', 'two')]

    expect(buildMessageBatches(messages, 100)).toEqual([messages])
  })

  it('counts the id and the description towards the budget, not just the message', () => {
    const messages = [buildMessage('a', 'x', 'a long description')]

    // 1 + 1 + 18 = 20, over a budget of 10, yet it is the only message so it still gets a batch
    expect(buildMessageBatches(messages, 10)).toEqual([messages])
  })

  it('splits once the budget is exceeded', () => {
    const messages = [buildMessage('a', '12345'), buildMessage('b', '12345'), buildMessage('c', '12345')]

    expect(buildMessageBatches(messages, 8)).toEqual([[messages[0]!], [messages[1]!], [messages[2]!]])
  })

  it('gives a message larger than the whole budget a batch of its own rather than dropping it', () => {
    const huge = buildMessage('huge', 'x'.repeat(50))
    const small = buildMessage('small', 'y')
    const batches = buildMessageBatches([small, huge], 10)

    expect(batches).toEqual([[small], [huge]])
    expect(batches.flat()).toHaveLength(2)
  })
})
