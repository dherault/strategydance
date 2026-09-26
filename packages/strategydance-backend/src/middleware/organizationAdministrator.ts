import type { NextFunction, Request, Response } from 'express'
import { ERROR_CODE_FORBIDDEN } from 'strategydance-core'
import { OrganizationRole, getOrganizationMembership } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import readViewer from '~utils/readViewer'
import respondError from '~utils/respondError'

/*
  Lets through only an administrator of the organization the route's `:organizationId` names.

  It runs after `validateMiddleware`, so the id is a UUID, and before any body parser, so nobody
  who may not act gets a body read, let alone a file written. The mutation behind the route checks
  again in its own transaction: this is the early answer, not the guard
*/
async function organizationAdministratorMiddleware(request: Request<{ organizationId: string }>, response: Response, next: NextFunction) {
  const { data } = await getOrganizationMembership(dataConnect, {
    organizationId: request.params.organizationId,
    userId: readViewer(request).id,
  })

  if (data.userOrganization?.role !== OrganizationRole.ADMINISTRATOR) {
    respondError(response, 403, ERROR_CODE_FORBIDDEN, 'Only an administrator of the organization can do this')

    return
  }

  next()
}

export default organizationAdministratorMiddleware
