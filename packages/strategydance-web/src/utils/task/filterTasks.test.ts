import { describe, expect, it } from 'bun:test'

import { CompanyAspect, TaskStatus } from 'strategydance-database/web'

import type { Task } from '~types'

import filterTasks from '~utils/task/filterTasks'
import getTaskDescriptionTexts from '~utils/task/getTaskDescriptionTexts'

function makeTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    name: id,
    status: TaskStatus.TODO,
    position: 1,
    assigneeId: null,
    isAssignedToAgent: false,
    dueDate: null,
    aspects: [],
    createdById: null,
    createdAt: '2026-10-09T10:00:00Z',
    dependencies: [],
    ...overrides,
  }
}

const tasks = [
  makeTask('a', { name: 'Write the beta announcement', assigneeId: 'me', aspects: [CompanyAspect.MARKETING] }),
  makeTask('b', { name: 'Record the demo', isAssignedToAgent: true, aspects: [CompanyAspect.PRODUCT] }),
  makeTask('c', { name: 'Renew the domain', assigneeId: 'sam' }),
]
const descriptions = new Map([
  [
    'c',
    JSON.stringify([
      {
        id: '1',
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: 'Before the BETA ends', styles: {} }],
        children: [],
      },
    ]),
  ],
])
const context = { viewerId: 'me', descriptionTexts: getTaskDescriptionTexts(descriptions) }

function ids(list: Task[]) {
  return list.map(task => task.id)
}

describe('filterTasks', () => {
  it('keeps every task with no filter', () => {
    expect(ids(filterTasks(tasks, { query: ' ', assignee: 'all', aspects: [] }, context))).toEqual(['a', 'b', 'c'])
  })

  it("searches the name and the description's words, whatever their case", () => {
    expect(ids(filterTasks(tasks, { query: 'Beta', assignee: 'all', aspects: [] }, context))).toEqual(['a', 'c'])
  })

  it('keeps the tasks of an assignee', () => {
    expect(ids(filterTasks(tasks, { query: '', assignee: 'me', aspects: [] }, context))).toEqual(['a'])
    expect(ids(filterTasks(tasks, { query: '', assignee: 'agent', aspects: [] }, context))).toEqual(['b'])
    expect(ids(filterTasks(tasks, { query: '', assignee: 'member:sam', aspects: [] }, context))).toEqual(['c'])
  })

  it('reads a member named like another filter as that member', () => {
    const named = [...tasks, makeTask('d', { assigneeId: 'agent' })]

    expect(ids(filterTasks(named, { query: '', assignee: 'member:agent', aspects: [] }, context))).toEqual(['d'])
    expect(ids(filterTasks(named, { query: '', assignee: 'agent', aspects: [] }, context))).toEqual(['b'])
  })

  it('keeps a task about any of the aspects picked', () => {
    expect(
      ids(
        filterTasks(
          tasks,
          { query: '', assignee: 'all', aspects: [CompanyAspect.PRODUCT, CompanyAspect.MARKETING] },
          context,
        ),
      ),
    ).toEqual(['a', 'b'])
  })
})
