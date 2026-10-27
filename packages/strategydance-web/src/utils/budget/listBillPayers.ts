import type { Bill, BillPayer, OrganizationMember } from '~types'

import getMemberName from '~utils/team/getMemberName'

/*
  Who pays the organization's bills, as the Budget page offers them: its members, in the team's
  order, then whoever a bill names who has left the organization since, by the name the bill kept,
  which is null when they never gave one
*/
function listBillPayers(
  members: readonly OrganizationMember[],
  bills: readonly Pick<Bill, 'paidById' | 'paidBy'>[],
  viewerId: string | null,
  locale: string,
): BillPayer[] {
  const payers: BillPayer[] = members.map(member => ({
    id: member.user.id,
    name: getMemberName(member),
    imageUrl: member.user.imageThumbnailUrl ?? member.user.imageUrl ?? null,
    isViewer: member.user.id === viewerId,
    hasLeft: false,
  }))
  const memberIds = new Set(payers.map(({ id }) => id))
  const formerPayers = new Map<string, BillPayer>()

  for (const { paidById, paidBy } of bills) {
    if (!paidById || memberIds.has(paidById) || formerPayers.has(paidById)) continue

    formerPayers.set(paidById, {
      id: paidById,
      name: paidBy?.displayName || null,
      imageUrl: paidBy?.imageThumbnailUrl ?? paidBy?.imageUrl ?? null,
      isViewer: paidById === viewerId,
      hasLeft: true,
    })
  }

  return [...payers, ...[...formerPayers.values()].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', locale))]
}

export default listBillPayers
