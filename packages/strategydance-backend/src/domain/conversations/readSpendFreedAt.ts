import { getDailySpendRows } from 'strategydance-database/backend'

import type { ConversationRunReference, UsageCapScope } from '~types'

import { dataConnect } from '~firebase'

import findSpendFreedAt from '~domain/conversations/findSpendFreedAt'

/*
  When enough of a scope's spend leaves the window for `amount` microdollars more to fit, in
  milliseconds since the epoch, from the scope's runs oldest first (`findSpendFreedAt`): read only
  once a ceiling is reached, to say when it has room
*/
async function readSpendFreedAt(
  { organizationId, userId }: Pick<ConversationRunReference, 'organizationId' | 'userId'>,
  scope: UsageCapScope,
  amount: number,
) {
  const { data } = await getDailySpendRows(dataConnect, { organizationId, userId })

  return findSpendFreedAt(data[scope], amount)
}

export default readSpendFreedAt
