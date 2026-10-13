import express, { type Request, type Response, Router } from 'express'
import {
  type AddIntegrationData,
  type ApiResponse,
  ERROR_CODE_BAD_REQUEST,
  ERROR_CODE_CONFLICT,
  ERROR_CODE_FORBIDDEN,
  ERROR_CODE_INTEGRATION_NAME_TAKEN,
  ERROR_CODE_NOT_FOUND,
  ERROR_CODE_SERVICE_UNAVAILABLE,
  ERROR_CODE_TOO_MANY_INTEGRATIONS,
  INTEGRATION_FAILURE_ERROR_CODES,
  isValidIntegrationApiKey,
  isValidIntegrationApiKeyHeader,
  isValidIntegrationName,
  parseIntegrationUrl,
} from 'strategydance-core'
import {
  IntegrationApiKeyScheme,
  IntegrationAuthentication,
  type IntegrationError,
} from 'strategydance-database/backend'
import { findExternalMcpServer } from 'strategydance-external-mcp-servers'
import { z } from 'zod'

import { UUID_PATTERN } from '~constants'

import readViewer from '~utils/readViewer'
import respondError from '~utils/respondError'

import appCheckMiddleware from '~middleware/appCheck'
import authenticationMiddleware from '~middleware/authentication'
import integrationRateLimitMiddleware from '~middleware/integrationRateLimit'
import organizationAdministratorMiddleware from '~middleware/organizationAdministrator'
import staffOnlyMiddleware from '~middleware/staffOnly'
import validateMiddleware from '~middleware/validate'

import addIntegration from '~domain/integrations/addIntegration'
import deleteIntegration from '~domain/integrations/deleteIntegration'
import editIntegration from '~domain/integrations/editIntegration'
import restoreIntegration from '~domain/integrations/restoreIntegration'
import retryIntegration from '~domain/integrations/retryIntegration'
import setIntegrationEnabled from '~domain/integrations/setIntegrationEnabled'
import setIntegrationToolApproval from '~domain/integrations/setIntegrationToolApproval'

// Every code `INTEGRATION_FAILURE_ERROR_CODES` pairs, typed over the database's enum, so a kind added
// there fails this typecheck until strategydance-core pairs it
const FAILURE_ERROR_CODES: Record<IntegrationError, string> = INTEGRATION_FAILURE_ERROR_CODES

type IntegrationOutcome =
  | { outcome: 'saved' | 'added' | 'reached' }
  | { outcome: 'failed'; kind: IntegrationError }
  | {
      outcome: 'forbidden' | 'full' | 'nameTaken' | 'conflict' | 'toolGone' | 'gone' | 'keyRequired' | 'keyUnavailable'
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
      return false
    case 'failed':
      respondError(response, 422, FAILURE_ERROR_CODES[result.kind], 'The server could not be reached as it should')
      break
    case 'forbidden':
      respondError(response, 403, ERROR_CODE_FORBIDDEN, 'Only an administrator of the organization can do this')
      break
    case 'full':
      respondError(response, 409, ERROR_CODE_TOO_MANY_INTEGRATIONS, 'The organization has as many servers as it may')
      break
    case 'nameTaken':
      respondError(response, 409, ERROR_CODE_INTEGRATION_NAME_TAKEN, 'Another server of the organization has this name')
      break
    case 'conflict':
    case 'toolGone':
      respondError(response, 409, ERROR_CODE_CONFLICT, 'The server was changed meanwhile')
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

const addBodySchema = settingsSchema
  .and(
    z.object({
      catalogueSlug: z
        .string()
        .refine(slug => findExternalMcpServer(slug) !== null, 'No such external MCP server')
        .nullable()
        .default(null),
    }),
  )
  .superRefine((settings, context) => {
    if (settings.authentication === IntegrationAuthentication.API_KEY && settings.apiKey === null) {
      context.addIssue({ code: 'custom', path: ['apiKey'], message: 'A key-based server takes its key' })
    }
  })

const enabledBodySchema = z.object({ isEnabled: z.boolean() })

const approvalBodySchema = z.object({
  definitionHash: z.string().regex(/^[0-9a-f]{64}$/),
  isAutoApproved: z.boolean(),
})

type IntegrationsRequest<Body = unknown> = Request<
  z.infer<typeof integrationsParamsSchema>,
  ApiResponse<AddIntegrationData>,
  Body
>

type IntegrationRequest<Body = unknown> = Request<z.infer<typeof integrationParamsSchema>, ApiResponse, Body>

/*
  An organization's MCP servers, which its administrators add, change, turn on and off, retry and
  delete, mounted at `/organizations/:organizationId/integrations`, whose `:organizationId` each
  route reads through `mergeParams`. Every member reads them through the web connector's live list;
  only administrators reach these routes, and only Strategy Dance's administrators while
  conversations are open to them alone, which is what calls the servers.

  Each route runs its middleware in one order: the body parsed, App Check, the caller's token, the
  routes that reach a server metered, the parameters and the body checked, then whether the caller
  administers the organization and is staff, which read and write nothing before them. Every
  operation behind a route checks the administrator again in its own transaction
*/
function createIntegrationsRouter() {
  const router = Router({ mergeParams: true })
  const json = express.json({ limit: '16kb' })
  const administrator = [organizationAdministratorMiddleware, staffOnlyMiddleware]

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
      const { catalogueSlug, ...settings } = request.body
      const result = await addIntegration({
        organizationId: request.params.organizationId,
        userId: readViewer(request).id,
        settings,
        catalogueSlug,
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
    validateMiddleware({ params: integrationParamsSchema, body: settingsSchema }),
    ...administrator,
    async (request: IntegrationRequest<z.infer<typeof settingsSchema>>, response: Response) => {
      const result = await editIntegration({
        organizationId: request.params.organizationId,
        userId: readViewer(request).id,
        integrationId: request.params.integrationId,
        settings: request.body,
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
      const { definitionHash, isAutoApproved } = request.body
      const result = await setIntegrationToolApproval(toCaller(request), definitionHash, isAutoApproved)

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
