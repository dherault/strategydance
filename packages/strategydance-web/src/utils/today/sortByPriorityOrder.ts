import type { OrganizationMember } from '~types'

/*
  The team in the order a reader arranged its priorities: the members their order names first, as
  it names them, then everybody it does not, such as whoever joined since, in the order they came.
  Ids in the order that name nobody, somebody who left, are skipped
*/
function sortByPriorityOrder(members: OrganizationMember[], priorityOrder: string[]) {
  const positions = new Map(priorityOrder.map((userId, index) => [userId, index]))

  return members
    .map((member, index) => ({ member, position: positions.get(member.user.id) ?? priorityOrder.length + index }))
    .sort((a, b) => a.position - b.position)
    .map(({ member }) => member)
}

export default sortByPriorityOrder
