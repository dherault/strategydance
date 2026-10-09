import type { NextFunction, Request, Response } from 'express'
import { ERROR_CODE_FORBIDDEN } from 'strategydance-core'
import { getUserStaffStatus } from 'strategydance-database/backend'

import { IS_CONVERSATIONS_RELEASE_GATED } from '~constants'

import { dataConnect } from '~firebase'

import readViewer from '~utils/readViewer'
import respondError from '~utils/respondError'

/*
  Lets through only Strategy Dance's own administrators while conversations are open to them alone
  (`ARE_CONVERSATIONS_STAFF_ONLY` in strategydance-core), and everybody once they launch, as it
  already does on the development backend (`IS_CONVERSATIONS_RELEASE_GATED`).

  It runs after `authenticationMiddleware`. The gate hides an unfinished feature and protects no
  data: a conversation is its author's alone either way, which the operations behind each route
  check. A run checks it again before a worker claims it, so a run queued by somebody who is no
  longer staff stops too
*/
async function staffOnlyMiddleware(request: Request, response: Response, next: NextFunction) {
  if (!IS_CONVERSATIONS_RELEASE_GATED) {
    next()

    return
  }

  const { data } = await getUserStaffStatus(dataConnect, { userId: readViewer(request).id })

  if (!data.user?.isAdministrator) {
    respondError(response, 403, ERROR_CODE_FORBIDDEN, 'Conversations are open to Strategy Dance’s administrators alone')

    return
  }

  next()
}

export default staffOnlyMiddleware
