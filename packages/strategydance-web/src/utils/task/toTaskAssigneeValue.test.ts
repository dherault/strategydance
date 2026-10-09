import { describe, expect, it } from 'bun:test'

import parseTaskAssigneeValue from '~utils/task/parseTaskAssigneeValue'
import toTaskAssigneeValue from '~utils/task/toTaskAssigneeValue'

describe('toTaskAssigneeValue', () => {
  it('names nobody, Strategy Dance or a member, and reads back as the same', () => {
    for (const assignee of [
      { assigneeId: null, isAssignedToAgent: false },
      { assigneeId: null, isAssignedToAgent: true },
      { assigneeId: 'agent', isAssignedToAgent: false },
    ]) {
      expect(parseTaskAssigneeValue(toTaskAssigneeValue(assignee))).toEqual(assignee)
    }
  })

  it('keeps a member whose uid reads as another value apart from it', () => {
    expect(toTaskAssigneeValue({ assigneeId: 'agent', isAssignedToAgent: false })).toBe('member:agent')
  })
})
