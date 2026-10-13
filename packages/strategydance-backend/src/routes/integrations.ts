import express, { type Request, type Response, Router } from 'express'
import {
  type AddIntegrationData,
  type ApiResponse,
  ERROR_CODE_BAD_REQUEST,
  ERROR_CODE_CONFLICT,
  ERROR_CODE_FORBIDDEN,
  ERROR_CODE_INTEGRATION_AUTHORIZATION_EXPIRED,
  ERROR_CODE_INTEGRATION_AUTHORIZATION_NOT_YOURS,
  ERROR_CODE_INTEGRATION_CONNECTION_EXPIRED,
  ERROR_CODE_INTEGRATION_CONNECTION_REFUSED,
  ERROR_CODE_INTEGRATION_ISSUER_CHANGED,
  ERROR_CODE_INTEGRATION_NAME_TAKEN,
  ERROR_CODE_NOT_FOUND,
  ERROR_CODE_SERVICE_UNAVAILABLE,
  ERROR_CODE_TOO_MANY_INTEGRATIONS,
  INTEGRATION_FAILURE_ERROR_CODES,
  isValidIntegrationApiKey,
  isValidIntegrationApiKeyHeader,
  isValidIntegrationName,
  parseIntegrationUrl,
  type StartIntegrationConnectionData,
} from 'strategydance-core'
import {
  IntegrationApiKeyScheme,
  IntegrationAuthentication,
  type IntegrationError,
} from 'strategydance-database/backend'
import { z } from 'zod'

import { UUID_PATTERN } from '~constants'

import readViewer from '~utils/readViewer'
import respondError from '~utils/respondError'

import appCheckMiddleware from '~middleware/appCheck'
import authenticationMiddleware from '~middleware/authentication'
import integrationRateLimitMiddleware from '~middleware/integrationRateLimit'
import organizationAdministratorMiddleware from '~middleware/organizationAdministrator'
import organizationMemberMiddleware from '~middleware/organizationMember'
import staffOnlyMiddleware from '~middleware/staffOnly'
import validateMiddleware from '~middleware/validate'

import addIntegration from '~domain/integrations/addIntegration'
import cancelIntegrationConnection from '~domain/integrations/cancelIntegrationConnection'
import deleteIntegration from '~domain/integrations/deleteIntegration'
import disconnectIntegration from '~domain/integrations/disconnectIntegration'
import editIntegration from '~domain/integrations/editIntegration'
import finishIntegrationConnection from '~domain/integrations/finishIntegrationConnection'
import restoreIntegration from '~domain/integrations/restoreIntegration'
import retryIntegration from '~domain/integrations/retryIntegration'
import setIntegrationEnabled from '~domain/integrations/setIntegrationEnabled'
import setIntegrationToolApproval from '~domain/integrations/setIntegrationToolApproval'
import startIntegrationConnection from '~domain/integrations/startIntegrationConnection'

// Every code `INTEGRATION_FAILURE_ERROR_CODES` pairs, typed over the database's enum, so a kind added
// there fails this typecheck until strategydance-core pairs it
const FAILURE_ERROR_CODES: Record<IntegrationError, string> = INTEGRATION_FAILURE_ERROR_CODES

type IntegrationOutcome =
  | { outcome: 'saved' | 'added' | 'reached' | 'started' | 'connected' | 'disconnected' | 'canceled' }
  | { outcome: 'failed'; kind: IntegrationError }
  | {
      outcome:
        | 'forbidden'
        | 'full'
        | 'nameTaken'
        | 'conflict'
        | 'toolGone'
        | 'gone'
        | 'keyRequired'
        | 'keyUnavailable'
        | 'expired'
        | 'leaseLost'
        | 'notOAuth'
        | 'issuerChanged'
        | 'notYours'
        | 'connectionRefused'
        | 'connectionExpired'
    }

/*
  The answer to an integration route's refusal, or false when it went through, for the route to
  answer its own success
*/
function respondRefusal(response: Response, result: IntegrationOutcome) {
  switch (result.outcome) {
    case 'saved':
    case 'added':
    case 'reached':
    case 'started':
    case 'connected':
    case 'disconnected':
    case 'canceled':
      return false
    case 'failed':
      respondError(response, 422, FAILURE_ERROR_CODES[result.kind], 'The server could not be reached as it should')
      break
    case 'forbidden':
      respondError(response, 403, ERROR_CODE_FORBIDDEN, 'The caller may not do this in the organization')
      break
    case 'full':
      respondError(response, 409, ERROR_CODE_TOO_MANY_INTEGRATIONS, 'The organization has as many servers as it may')
      break
    case 'nameTaken':
      respondError(response, 409, ERROR_CODE_INTEGRATION_NAME_TAKEN, 'Another server of the organization has this name')
      break
    case 'conflict':
    case 'toolGone':
    case 'leaseLost':
      respondError(response, 409, ERROR_CODE_CONFLICT, 'The server was changed meanwhile')
      break
    case 'notOAuth':
      respondError(response, 409, ERROR_CODE_CONFLICT, 'Only an OAuth server takes an account')
      break
    case 'issuerChanged':
      respondError(
        response,
        409,
        ERROR_CODE_INTEGRATION_ISSUER_CHANGED,
        'The server names another authorization server',
      )
      break
    case 'expired':
      respondError(response, 410, ERROR_CODE_INTEGRATION_AUTHORIZATION_EXPIRED, 'The sign-in expired or was finished')
      break
    case 'notYours':
      respondError(
        response,
        403,
        ERROR_CODE_INTEGRATION_AUTHORIZATION_NOT_YOURS,
        'Another account started this sign-in',
      )
      break
    case 'connectionRefused':
      respondError(
        response,
        422,
        ERROR_CODE_INTEGRATION_CONNECTION_REFUSED,
        'The authorization server refused the sign-in',
      )
      break
    case 'connectionExpired':
      respondError(
        response,
        409,
        ERROR_CODE_INTEGRATION_CONNECTION_EXPIRED,
        'Your account at the server needs connecting again',
      )
      break
    case 'gone':
      respondError(response, 404, ERROR_CODE_NOT_FOUND, 'No such server')
      break
    case 'keyRequired':
      respondError(response, 400, ERROR_CODE_BAD_REQUEST, 'A server at another address takes its key again')
      break
    case 'keyUnavailable':
      respondError(response, 503, ERROR_CODE_SERVICE_UNAVAILABLE, 'The key cannot be stored now, try again later')
      break
  }

  return true
}

const integrationsParamsSchema = z.object({ organizationId: z.string().regex(UUID_PATTERN) })

const integrationParamsSchema = z.object({
  organizationId: z.string().regex(UUID_PATTERN),
  integrationId: z.string().regex(UUID_PATTERN),
})

/*
  A server as an administrator's form describes it, each field held to what strategydance-core says
  it may be, which the form checks first: a name on one line, an https address, which is written back
  as the URL parser writes it, an authentication, and for a key-based server how its key is sent,
  the header named never one the client sets itself or the connection acts on. The key is sent only
  when typed, and only to a key-based server
*/
const settingsSchema = z
  .object({
    name: z.string().refine(isValidIntegrationName, 'Not a name a server may have'),
    url: z.string().transform((value, context) => {
      const url = parseIntegrationUrl(value)

      if (url === null) context.addIssue({ code: 'custom', message: 'Not an https address Strategy Dance reaches' })

      return url ?? z.NEVER
    }),
    authentication: z.enum(IntegrationAuthentication),
    apiKey: z.string().refine(isValidIntegrationApiKey, 'Not a key that can be sent').nullable().default(null),
    apiKeyScheme: z.enum(IntegrationApiKeyScheme).default(IntegrationApiKeyScheme.BEARER),
    apiKeyHeader: z
      .string()
      .refine(isValidIntegrationApiKeyHeader, 'Not a header a key may be sent in')
      .nullable()
      .default(null),
  })
  .superRefine((settings, context) => {
    const isKeyed = settings.authentication === IntegrationAuthentication.API_KEY

    if (!isKeyed && settings.apiKey !== null) {
      context.addIssue({ code: 'custom', path: ['apiKey'], message: 'Only a key-based server takes a key' })
    }

    if (isKeyed && settings.apiKeyScheme === IntegrationApiKeyScheme.HEADER && !settings.apiKeyHeader) {
      context.addIssue({ code: 'custom', path: ['apiKeyHeader'], message: 'Name the header the key is sent in' })
    }
  })

const addBodySchema = settingsSchema.superRefine((settings, context) => {
  if (settings.authentication === IntegrationAuthentication.API_KEY && settings.apiKey === null) {
    context.addIssue({ code: 'custom', path: ['apiKey'], message: 'A key-based server takes its key' })
  }
})

// The server as the dialog showed it, which an edit is made from, so one from a stale view is refused
const expectedSchema = z.object({
  name: z.string(),
  configRevision: z.number().int().nonnegative(),
  keyGeneration: z.number().int().nonnegative(),
})

const editBodySchema = settingsSchema.and(z.object({ expected: expectedSchema }))

const enabledBodySchema = z.object({ isEnabled: z.boolean() })

// The Connect a member's page finishes, from the address the callback sent it to
const finishBodySchema = z.object({ authorizationId: z.string().regex(UUID_PATTERN) })

const approvalBodySchema = z.object({
  definitionHash: z.string().regex(/^[0-9a-f]{64}$/),
  isAutoApproved: z.boolean(),
  // The revision the tools were shown under
  configRevision: z.number().int().nonnegative(),
})

type IntegrationsRequest<Body = unknown> = Request<
  z.infer<typeof integrationsParamsSchema>,
  ApiResponse<AddIntegrationData>,
  Body
>

type IntegrationRequest<Body = unknown> = Request<z.infer<typeof integrationParamsSchema>, ApiResponse, Body>

/*
  An organization's MCP servers, which its administrators add, change, turn on and off, retry and
  delete, and to which any member connects and disconnects their own account when it takes OAuth,
  mounted at `/organizations/:organizationId/integrations`, whose `:organizationId` each route reads
  through `mergeParams`. Every member reads them through the web connector's live list; only
  Strategy Dance's administrators reach these routes while conversations are open to them alone,
  which is what calls the servers.

  Each route runs its middleware in one order: the body parsed, App Check, the caller's token, the
  routes that reach a server metered, the parameters and the body checked, then whether the caller
  administers the organization, or is its member, and is staff, which read and write nothing before
  them. Every operation behind a route checks the caller again in its own transaction
*/
function createIntegrationsRouter() {
  const router = Router({ mergeParams: true })
  const json = express.json({ limit: '16kb' })
  const administrator = [organizationAdministratorMiddleware, staffOnlyMiddleware]
  const member = [organizationMemberMiddleware, staffOnlyMiddleware]

  // Adds a server, once reaching it found its tools or its issuer: 200 with its id
  router.post(
    '/',
    json,
    appCheckMiddleware,
    authenticationMiddleware,
    integrationRateLimitMiddleware,
    validateMiddleware({ params: integrationsParamsSchema, body: addBodySchema }),
    ...administrator,
    async (request: IntegrationsRequest<z.infer<typeof addBodySchema>>, response: Response) => {
      const result = await addIntegration({
        organizationId: request.params.organizationId,
        userId: readViewer(request).id,
        settings: request.body,
      })

      if (respondRefusal(response, result) || result.outcome !== 'added') return

      response.json({ status: 'success', data: { integrationId: result.integrationId, toolCount: result.toolCount } })
    },
  )

  // Changes a server as its administrator's form says, reaching it first unless only its name changed
  router.patch(
    '/:integrationId',
    json,
    appCheckMiddleware,
    authenticationMiddleware,
    integrationRateLimitMiddleware,
    validateMiddleware({ params: integrationParamsSchema, body: editBodySchema }),
    ...administrator,
    async (request: IntegrationRequest<z.infer<typeof editBodySchema>>, response: Response) => {
      const { expected, ...settings } = request.body
      const result = await editIntegration({
        organizationId: request.params.organizationId,
        userId: readViewer(request).id,
        integrationId: request.params.integrationId,
        settings,
        expected,
      })

      if (respondRefusal(response, result)) return

      response.json({ status: 'success' })
    },
  )

  // Reaches a server again, recording its tools, its issuer or why it failed
  router.post(
    '/:integrationId/retry',
    appCheckMiddleware,
    authenticationMiddleware,
    integrationRateLimitMiddleware,
    validateMiddleware({ params: integrationParamsSchema }),
    ...administrator,
    async (request: IntegrationRequest, response: Response) => {
      const result = await retryIntegration({
        organizationId: request.params.organizationId,
        userId: readViewer(request).id,
        integrationId: request.params.integrationId,
      })

      if (respondRefusal(response, result)) return

      response.json({ status: 'success' })
    },
  )

  // Turns a server on or off for the agent
  router.put(
    '/:integrationId/enabled',
    json,
    appCheckMiddleware,
    authenticationMiddleware,
    validateMiddleware({ params: integrationParamsSchema, body: enabledBodySchema }),
    ...administrator,
    async (request: IntegrationRequest<z.infer<typeof enabledBodySchema>>, response: Response) => {
      const result = await setIntegrationEnabled(toCaller(request), request.body.isEnabled)

      if (respondRefusal(response, result)) return

      response.json({ status: 'success' })
    },
  )

  // Lets one of a server's tools run without a member's approval, or takes that back
  router.put(
    '/:integrationId/auto-approved-tools',
    json,
    appCheckMiddleware,
    authenticationMiddleware,
    validateMiddleware({ params: integrationParamsSchema, body: approvalBodySchema }),
    ...administrator,
    async (request: IntegrationRequest<z.infer<typeof approvalBodySchema>>, response: Response) => {
      const result = await setIntegrationToolApproval(toCaller(request), request.body)

      if (respondRefusal(response, result)) return

      response.json({ status: 'success' })
    },
  )

  // Deletes a server, kept a day for an Undo
  router.delete(
    '/:integrationId',
    appCheckMiddleware,
    authenticationMiddleware,
    validateMiddleware({ params: integrationParamsSchema }),
    ...administrator,
    async (request: IntegrationRequest, response: Response) => {
      const result = await deleteIntegration(toCaller(request))

      if (respondRefusal(response, result)) return

      response.json({ status: 'success' })
    },
  )

  // Takes a delete back within a day
  router.post(
    '/:integrationId/restore',
    appCheckMiddleware,
    authenticationMiddleware,
    validateMiddleware({ params: integrationParamsSchema }),
    ...administrator,
    async (request: IntegrationRequest, response: Response) => {
      const result = await restoreIntegration(toCaller(request))

      if (respondRefusal(response, result)) return

      response.json({ status: 'success' })
    },
  )

  /* ---
    A MEMBER'S OWN ACCOUNT
  --- */

  // Starts a Connect to an OAuth server: 200 with the address of its sign-in, for the window the
  // member's page opened
  router.post(
    '/:integrationId/connection',
    appCheckMiddleware,
    authenticationMiddleware,
    integrationRateLimitMiddleware,
    validateMiddleware({ params: integrationParamsSchema }),
    ...member,
    async (request: IntegrationRequest, response: Response<ApiResponse<StartIntegrationConnectionData>>) => {
      const result = await startIntegrationConnection(toCaller(request))

      if (respondRefusal(response, result) || result.outcome !== 'started') return

      response.json({ status: 'success', data: { authorizationUrl: result.authorizationUrl } })
    },
  )

  // Finishes the Connect the member's page came back with, exchanging its code, for that member alone
  router.post(
    '/:integrationId/connection/finish',
    json,
    appCheckMiddleware,
    authenticationMiddleware,
    integrationRateLimitMiddleware,
    validateMiddleware({ params: integrationParamsSchema, body: finishBodySchema }),
    ...member,
    async (request: IntegrationRequest<z.infer<typeof finishBodySchema>>, response: Response) => {
      const result = await finishIntegrationConnection({
        ...toCaller(request),
        authorizationId: request.body.authorizationId,
      })

      if (respondRefusal(response, result)) return

      response.json({ status: 'success' })
    },
  )

  // Cancels the member's Connect under way, so its sign-in connects nothing once finished
  router.delete(
    '/:integrationId/connection/authorization',
    appCheckMiddleware,
    authenticationMiddleware,
    validateMiddleware({ params: integrationParamsSchema }),
    ...member,
    async (request: IntegrationRequest, response: Response) => {
      const result = await cancelIntegrationConnection(toCaller(request))

      if (respondRefusal(response, result)) return

      response.json({ status: 'success' })
    },
  )

  // Disconnects the member's account, revoking its tokens at the authorization server
  router.delete(
    '/:integrationId/connection',
    appCheckMiddleware,
    authenticationMiddleware,
    integrationRateLimitMiddleware,
    validateMiddleware({ params: integrationParamsSchema }),
    ...member,
    async (request: IntegrationRequest, response: Response) => {
      const result = await disconnectIntegration(toCaller(request))

      if (respondRefusal(response, result)) return

      response.json({ status: 'success' })
    },
  )

  return router
}

function toCaller(request: IntegrationRequest<unknown>) {
  return {
    organizationId: request.params.organizationId,
    userId: readViewer(request).id,
    integrationId: request.params.integrationId,
  }
}

export default createIntegrationsRouter
