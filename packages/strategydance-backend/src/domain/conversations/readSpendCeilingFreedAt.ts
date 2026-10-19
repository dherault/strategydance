import { getDailySpendRows } from 'strategydance-database/backend'

import type { ConversationRunReference } from '~types'

import { dataConnect } from '~firebase'

import type { PassedSpendCeiling } from '~domain/conversations/findPassedSpendCeilings'
import findSpendFreedAt from '~domain/conversations/findSpendFreedAt'

/*
  Of the daily spend ceilings something would pass, the one that has room last, and when, in
  milliseconds since the epoch: each scope's runs oldest first, read once (`findSpendFreedAt`), as
  only then can it go. Read only once a ceiling is reached, to say when it has room
*/
async function readSpendCeilingFreedAt(
  { organizationId, userId }: Pick<ConversationRunReference, 'organizationId' | 'userId'>,
  passed: [PassedSpendCeiling, ...PassedSpendCeiling[]],
) {
  const { data } = await getDailySpendRows(dataConnect, { organizationId, userId })
  const now = Date.now()
  const freed = passed.map(ceiling => ({
    ...ceiling,
    freesAt: findSpendFreedAt(data[ceiling.scope], ceiling.need, now),
  }))

  return freed.reduce((latest, ceiling) => (ceiling.freesAt > latest.freesAt ? ceiling : latest))
}

export default readSpendCeilingFreedAt
