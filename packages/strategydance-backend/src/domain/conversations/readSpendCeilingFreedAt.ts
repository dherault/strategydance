import { getDailySpendRows } from 'strategydance-database/backend'

import type { ConversationRunReference } from '~types'

import { dataConnect } from '~firebase'

import type { PassedSpendCeiling } from '~domain/conversations/findPassedSpendCeilings'
import findSpendFreedAt from '~domain/conversations/findSpendFreedAt'

// How many of a scope's runs the read takes, oldest first, as `GetDailySpendRows` reads them
const ROWS_READ = 500

/*
  Of the daily spend ceilings something would pass, the one that has room last, and when, in
  milliseconds since the epoch: each scope's runs oldest first, read once (`findSpendFreedAt`), as
  only then can it go. Read only once a ceiling is reached, to say when it has room. The window
  moves on between the sums' read and this one, so a scope whose runs it reads whole counts what
  has to leave from them, its sum against the one the ceiling was found past: runs that left
  meanwhile can have made room already, and null says every ceiling has
*/
async function readSpendCeilingFreedAt(
  { organizationId, userId }: Pick<ConversationRunReference, 'organizationId' | 'userId'>,
  passed: [PassedSpendCeiling, ...PassedSpendCeiling[]],
) {
  const { data } = await getDailySpendRows(dataConnect, { organizationId, userId })
  const now = Date.now()
  const freed = passed.map(ceiling => {
    const runs = data[ceiling.scope]
    const read = runs.reduce((sum, { costBound }) => sum + Number(costBound), 0)
    const need = runs.length < ROWS_READ ? ceiling.need + read - ceiling.counted : ceiling.need

    return { ...ceiling, need, freesAt: findSpendFreedAt(runs, need, now) }
  })

  if (freed.every(({ need }) => need <= 0)) return null

  return freed.reduce((latest, ceiling) => (ceiling.freesAt > latest.freesAt ? ceiling : latest))
}

export default readSpendCeilingFreedAt
