import type { NextFunction, Request, Response } from 'express'
import { ERROR_CODE_FORBIDDEN } from 'strategydance-core'
import { getOrganizationMembership } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import readViewer from '~utils/readViewer'
import respondError from '~utils/respondError'

/*
  Lets through only a member of the organization the route's `:organizationId` names, whatever
  their role.

  It runs after `validateMiddleware`, so the id is a UUID, and before any body parser, so nobody
  outside the organization gets a body read, let alone a file written
*/
async function organizationMemberMiddleware(
  request: Request<{ organizationId: string }>,
  response: Response,
  next: NextFunction,
) {
  const { data } = await getOrganizationMembership(dataConnect, {
    organizationId: request.params.organizationId,
    userId: readViewer(request).id,
  })

  if (!data.userOrganization) {
    respondError(response, 403, ERROR_CODE_FORBIDDEN, 'Only a member of the organization can do this')

    return
  }

  next()
}

export default organizationMemberMiddleware
