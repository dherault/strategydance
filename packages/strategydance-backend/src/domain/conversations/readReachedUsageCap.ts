import { getCappedStarts } from 'strategydance-database/backend'

import type { ReachedUsageCap, UsageCapKind } from '~types'

import { IS_USAGE_CAPPED } from '~constants'

import { dataConnect } from '~firebase'

import findReachedUsageCap from '~domain/conversations/findReachedUsageCap'

type Member = {
  organizationId: string
  userId: string
}

/*
  Reads the daily cap a member's start of each kind given reaches, or null when every one has room
  (`findReachedUsageCap`), before the start stores anything, and again once its mutation's count
  refused it, to say which cap and when it has room: the route's count may have passed before another
  start took the place. Null wherever the caps are lifted, on the development backend
*/
async function readReachedUsageCap(
  { organizationId, userId }: Member,
  kinds: UsageCapKind[],
  options: { isFinishing?: boolean } = {},
): Promise<ReachedUsageCap | null> {
  if (!IS_USAGE_CAPPED) return null

  const { data } = await getCappedStarts(dataConnect, { organizationId, userId })

  return findReachedUsageCap(data, kinds, options)
}

export default readReachedUsageCap
