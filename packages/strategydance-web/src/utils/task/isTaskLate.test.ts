import { describe, expect, it } from 'bun:test'

import { TaskStatus } from 'strategydance-database/web'

import isTaskLate from '~utils/task/isTaskLate'

describe('isTaskLate', () => {
  it('says a task due before today and not done is late', () => {
    expect(isTaskLate({ dueDate: '2026-10-08', status: TaskStatus.ONGOING }, '2026-10-09')).toBe(true)
  })

  it('says a task due today, a done one or an undated one is not', () => {
    expect(isTaskLate({ dueDate: '2026-10-09', status: TaskStatus.TODO }, '2026-10-09')).toBe(false)
    expect(isTaskLate({ dueDate: '2026-10-01', status: TaskStatus.DONE }, '2026-10-09')).toBe(false)
    expect(isTaskLate({ dueDate: null, status: TaskStatus.TODO }, '2026-10-09')).toBe(false)
  })
})
