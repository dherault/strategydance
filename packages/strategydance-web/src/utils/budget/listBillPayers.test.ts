import { describe, expect, it } from 'bun:test'

import type { OrganizationMember } from '~types'

import listBillPayers from '~utils/budget/listBillPayers'

function member(id: string, displayName: string | null, imageThumbnailUrl: string | null = null): OrganizationMember {
  return {
    role: 'MEMBER',
    jobTitle: null,
    topPriority: null,
    topPriorityUpdatedAt: null,
    user: { id, email: `${id}@example.com`, displayName, imageUrl: `https://example.com/${id}.png`, imageThumbnailUrl },
  } as OrganizationMember
}

const TEAM = [member('alex', 'Alex Martin', 'https://example.com/alex-small.png'), member('sam', null)]

describe('listBillPayers', () => {
  it("lists the members in the team's order, by their name or their address, the reader marked", () => {
    expect(listBillPayers(TEAM, [], 'sam', 'en')).toEqual([
      {
        id: 'alex',
        name: 'Alex Martin',
        imageUrl: 'https://example.com/alex-small.png',
        isViewer: false,
        hasLeft: false,
      },
      { id: 'sam', name: 'sam@example.com', imageUrl: 'https://example.com/sam.png', isViewer: true, hasLeft: false },
    ])
  })

  it('adds once, after the members and by name, whoever a bill names who has left', () => {
    const bills = [
      { paidById: 'alex', paidBy: { displayName: 'Alex Martin', imageUrl: null, imageThumbnailUrl: null } },
      { paidById: 'zoe', paidBy: { displayName: 'Zoe Park', imageUrl: 'https://example.com/zoe.png' } },
      { paidById: 'kim', paidBy: { displayName: 'Kim Lee', imageUrl: null } },
      { paidById: 'zoe', paidBy: { displayName: 'Zoe Park', imageUrl: 'https://example.com/zoe.png' } },
      { paidById: 'anon', paidBy: { displayName: null, imageUrl: null } },
    ]

    expect(listBillPayers(TEAM, bills, 'alex', 'en').map(({ id, name, hasLeft }) => ({ id, name, hasLeft }))).toEqual([
      { id: 'alex', name: 'Alex Martin', hasLeft: false },
      { id: 'sam', name: 'sam@example.com', hasLeft: false },
      { id: 'anon', name: null, hasLeft: true },
      { id: 'kim', name: 'Kim Lee', hasLeft: true },
      { id: 'zoe', name: 'Zoe Park', hasLeft: true },
    ])
  })
})
