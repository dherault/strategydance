import { describe, expect, it } from 'bun:test'

import type { OrganizationMember } from '~types'

import sortByPriorityOrder from '~utils/today/sortByPriorityOrder'

function member(id: string): OrganizationMember {
  return {
    role: 'MEMBER',
    jobTitle: null,
    topPriority: null,
    topPriorityUpdatedAt: null,
    user: { id, email: `${id}@example.com`, displayName: null, imageUrl: null },
  } as OrganizationMember
}

const ids = (members: OrganizationMember[]) => members.map(({ user }) => user.id)

describe('sortByPriorityOrder', () => {
  const team = ['alex', 'jordan', 'priya', 'sam'].map(member)

  it('keeps the joined-at order when nothing was arranged', () => {
    expect(ids(sortByPriorityOrder(team, []))).toEqual(['alex', 'jordan', 'priya', 'sam'])
  })

  it('puts the arranged members first, in the order given', () => {
    expect(ids(sortByPriorityOrder(team, ['sam', 'alex']))).toEqual(['sam', 'alex', 'jordan', 'priya'])
  })

  it('skips ids of people who left', () => {
    expect(ids(sortByPriorityOrder(team, ['gone', 'priya', 'jordan', 'alex', 'sam']))).toEqual(['priya', 'jordan', 'alex', 'sam'])
  })
})
