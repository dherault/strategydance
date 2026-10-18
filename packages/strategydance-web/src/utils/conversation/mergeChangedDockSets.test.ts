import { describe, expect, test } from 'bun:test'

import type { ConversationDockWindows } from '~types'

import mergeChangedDockSets from './mergeChangedDockSets'

const OWN = 'member:own'
const OTHER = 'member:other'

const opened = (conversationId: string) => [{ conversationId, isMinimized: false, isDraft: false }]

describe('mergeChangedDockSets', () => {
  test('writes the set a change changed over what storage holds, keeping another tab’s set', () => {
    const previous: ConversationDockWindows = { [OWN]: opened('a') }
    const next: ConversationDockWindows = { [OWN]: opened('b') }
    // Another tab stored its organization's windows since this one read the dock
    const stored: ConversationDockWindows = { [OWN]: opened('a'), [OTHER]: opened('c') }

    expect(mergeChangedDockSets(stored, previous, next)).toEqual({ [OWN]: opened('b'), [OTHER]: opened('c') })
  })

  test('leaves a set the change did not touch as storage has it, however this tab holds it', () => {
    const own = opened('a')
    const previous: ConversationDockWindows = { [OWN]: own, [OTHER]: opened('stale') }
    const next: ConversationDockWindows = { [OWN]: opened('b'), [OTHER]: previous[OTHER]! }
    const stored: ConversationDockWindows = { [OWN]: own, [OTHER]: opened('fresh') }

    expect(mergeChangedDockSets(stored, previous, next)[OTHER]).toEqual(opened('fresh'))
  })

  test('drops a set the change emptied', () => {
    const previous: ConversationDockWindows = { [OWN]: opened('a') }
    const stored: ConversationDockWindows = { [OWN]: opened('a'), [OTHER]: opened('c') }

    expect(mergeChangedDockSets(stored, previous, {})).toEqual({ [OTHER]: opened('c') })
  })
})
