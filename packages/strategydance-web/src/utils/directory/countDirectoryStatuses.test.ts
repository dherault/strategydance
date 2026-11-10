import { describe, expect, it } from 'bun:test'

import type { DirectoryState } from '~types'

import countDirectoryStatuses from '~utils/directory/countDirectoryStatuses'

describe('countDirectoryStatuses', () => {
  it("counts each tab's directories, and leaves out a status kept for a directory the list no longer holds", () => {
    const states = new Map<string, DirectoryState>([
      ['a', { status: 'SUBMITTED', changedAt: null, notesText: null }],
      ['b', { status: 'LISTED', changedAt: null, notesText: null }],
      ['c', { status: null, changedAt: null, notesText: 'Notes alone' }],
      ['gone', { status: 'LISTED', changedAt: null, notesText: null }],
    ])

    expect(countDirectoryStatuses([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }], states)).toEqual({
      todo: 2,
      submitted: 1,
      listed: 1,
      dismissed: 0,
      all: 4,
    })
  })
})
