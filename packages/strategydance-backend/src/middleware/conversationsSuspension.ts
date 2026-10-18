import type { NextFunction, Request, Response } from 'express'
import { ERROR_CODE_CONVERSATIONS_SUSPENDED } from 'strategydance-core'
import { getConversationsSuspension } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import readViewer from '~utils/readViewer'
import respondError from '~utils/respondError'

/*
  Refuses a caller whose conversations Strategy Dance's staff suspended, their account's or the
  organization's (`conversationsSuspendedAt`, which `bun run suspend:conversations` writes), on the
  routes that start or continue a run, the ones `verifiedEmailMiddleware` guards: the send, an
  answer, an approval, Resume, Retry and a file's upload. A suspended member still stops, reconciles
  and reads. The worker's claim checks it again, so a run queued before the suspension never starts.

  It runs after the membership's middleware, on the organization of the path
*/
async function conversationsSuspensionMiddleware(
  request: Request<{ organizationId: string }>,
  response: Response,
  next: NextFunction,
) {
  const { data } = await getConversationsSuspension(dataConnect, {
    organizationId: request.params.organizationId,
    userId: readViewer(request).id,
  })

  if (data.user?.conversationsSuspendedAt) {
    respondError(response, 403, ERROR_CODE_CONVERSATIONS_SUSPENDED, 'Conversations are suspended for this account')

    return
  }

  if (data.organization?.conversationsSuspendedAt) {
    respondError(response, 403, ERROR_CODE_CONVERSATIONS_SUSPENDED, 'Conversations are suspended in this organization')

    return
  }

  next()
}

export default conversationsSuspensionMiddleware
