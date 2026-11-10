import { describe, expect, it } from 'bun:test'

import joinInWords from './joinInWords'

describe('joinInWords', () => {
  it('lists items as a sentence does, with "and" or "or" before the last', () => {
    expect(joinInWords([])).toBe('')
    expect(joinInWords(['Tasks'])).toBe('Tasks')
    expect(joinInWords(['Tasks', 'Budget'])).toBe('Tasks and Budget')
    expect(joinInWords(['Documents', 'Tasks', 'Budget'], 'or')).toBe('Documents, Tasks or Budget')
  })
})
