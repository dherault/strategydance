import { recordAgentConnectionUse } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

// How often a connection's `lastUsedAt` is written at most, as `RecordAgentConnectionUse` holds it
const USE_INTERVAL_MS = 60 * 1000

// How many connections a recorder remembers at most, the one it wrote longest ago forgotten first
const MAX_REMEMBERED_CONNECTIONS = 10_000

type Options = {
  // A smaller memory, for a test
  maxRemembered?: number
}

/*
  What marks a connection used as a module's endpoint verifies its tokens: its `lastUsedAt`, which
  the Connected agents tab shows, written at most once a minute. The database holds that bound
  across instances, and the recorder remembers when it last wrote each connection, so an agent
  calling the module all day costs an instance one write a minute rather than one a call. A failed
  write is logged and fails nothing, since the call is the member's and the time only informs them.

  The memory is bounded: its entries are kept in the order they were written, and once it is full
  the oldest goes, whatever its age, so a burst of connections costs each one step. A connection
  forgotten within its minute is only asked of the database again, whose condition refuses it
*/
function createAgentConnectionUseRecorder({ maxRemembered = MAX_REMEMBERED_CONNECTIONS }: Options = {}) {
  const writtenAt = new Map<string, number>()

  return async function recordUse(connectionId: string, userId: string) {
    const now = Date.now()
    const last = writtenAt.get(connectionId)

    if (last !== undefined && now - last < USE_INTERVAL_MS) return

    // Deleted first, so setting it again moves it to the end, the newest write
    writtenAt.delete(connectionId)

    const [oldest] = writtenAt.keys()

    if (oldest !== undefined && writtenAt.size >= maxRemembered) writtenAt.delete(oldest)

    writtenAt.set(connectionId, now)

    try {
      await recordAgentConnectionUse(dataConnect, { id: connectionId, userId })
    } catch (error) {
      logger.error(`Agent connections: could not record a use of ${connectionId}`, error)
    }
  }
}

export default createAgentConnectionUseRecorder
