import { describe, expect, it } from 'bun:test'

import type { Directory } from 'strategydance-knowledge/src/directories/types'

import type { DirectoryState } from '~types'

import rankNextDirectories from '~utils/directory/rankNextDirectories'

function directory(fields: Partial<Directory> & { id: string }): Directory {
  return {
    name: fields.id,
    type: 'WEBSITE',
    rootUrl: `https://${fields.id}.example/`,
    submissionUrl: `https://${fields.id}.example/submit`,
    description: 'Lists new products',
    categories: [],
    businessModel: 'FREE',
    lastChecked: '2026-11-01',
    unreachableSince: null,
    ...fields,
  }
}

describe('rankNextDirectories', () => {
  it('suggests described and free directories first, then those with a catch, then paid or unknown ones', () => {
    const directories = [
      directory({ id: 'paid', businessModel: 'PAID' }),
      directory({ id: 'undescribed', description: '' }),
      directory({ id: 'catch', businessModel: 'FREE_WITH_BADGE' }),
      directory({ id: 'free' }),
      directory({ id: 'unknown', businessModel: 'UNKNOWN' }),
    ]

    expect(rankNextDirectories(directories, new Map(), 5).map(({ id }) => id)).toEqual([
      'free',
      'catch',
      'paid',
      'unknown',
      'undescribed',
    ])
  })

  it('puts an unreachable site last, and among equals the most lately checked first, then by name', () => {
    const directories = [
      directory({ id: 'a-down', unreachableSince: '2026-11-05' }),
      directory({ id: 'b-old', lastChecked: '2026-10-01' }),
      directory({ id: 'c-never', lastChecked: null }),
      directory({ id: 'd-new', lastChecked: '2026-11-08' }),
      directory({ id: 'e-new', lastChecked: '2026-11-08' }),
    ]

    expect(rankNextDirectories(directories, new Map(), 5).map(({ id }) => id)).toEqual([
      'd-new',
      'e-new',
      'b-old',
      'c-never',
      'a-down',
    ])
  })

  it('leaves out every directory with a status, and suggests as many as asked at most', () => {
    const directories = ['a', 'b', 'c', 'd'].map(id => directory({ id }))
    const states = new Map<string, DirectoryState>([['b', { status: 'DISMISSED', changedAt: null, notesText: null }]])

    expect(rankNextDirectories(directories, states, 2).map(({ id }) => id)).toEqual(['a', 'c'])
  })
})
