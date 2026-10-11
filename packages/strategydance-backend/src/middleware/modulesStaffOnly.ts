import type { NextFunction, Request, Response } from 'express'
import { ERROR_CODE_FORBIDDEN } from 'strategydance-core'
import { getUserStaffStatus } from 'strategydance-database/backend'

import { IS_MODULES_RELEASE_GATED } from '~constants'

import { dataConnect } from '~firebase'

import readViewer from '~utils/readViewer'
import respondError from '~utils/respondError'

/*
  Lets through only Strategy Dance's own administrators while the modules reach external agents for
  them alone (`ARE_MODULES_STAFF_ONLY` in strategydance-core), and everybody once they launch, as it
  already does on the development backend (`IS_MODULES_RELEASE_GATED`).

  It runs after `authenticationMiddleware`, on the consent page's routes, so nobody else reads a
  request, which is what fetches a client's document, nor allows one. The token verifier checks the
  role again on every call, so a connection outlives no lost role
*/
async function modulesStaffOnlyMiddleware(request: Request, response: Response, next: NextFunction) {
  if (!IS_MODULES_RELEASE_GATED) {
    next()

    return
  }

  const { data } = await getUserStaffStatus(dataConnect, { userId: readViewer(request).id })

  if (!data.user?.isAdministrator) {
    respondError(
      response,
      403,
      ERROR_CODE_FORBIDDEN,
      'Connecting agents is open to Strategy Dance’s administrators alone',
    )

    return
  }

  next()
}

export default modulesStaffOnlyMiddleware
