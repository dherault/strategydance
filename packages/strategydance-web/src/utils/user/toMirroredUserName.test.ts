import { describe, expect, it } from 'bun:test'

import { MAX_MIRRORED_USER_NAME_LENGTH } from 'strategydance-core'

import toMirroredUserName from '~utils/user/toMirroredUserName'

describe('toMirroredUserName', () => {
  it('keeps a name that fits, and no name', () => {
    expect(toMirroredUserName('Ada Lovelace')).toBe('Ada Lovelace')
    expect(toMirroredUserName('x'.repeat(MAX_MIRRORED_USER_NAME_LENGTH))).toHaveLength(MAX_MIRRORED_USER_NAME_LENGTH)
    expect(toMirroredUserName(null)).toBeNull()
  })

  it('cuts a longer one by code points, never through a character', () => {
    const name = '😀'.repeat(MAX_MIRRORED_USER_NAME_LENGTH + 1)
    const mirrored = toMirroredUserName(name)!

    expect(Array.from(mirrored)).toHaveLength(MAX_MIRRORED_USER_NAME_LENGTH)
    expect(mirrored).toBe('😀'.repeat(MAX_MIRRORED_USER_NAME_LENGTH))
  })
})
