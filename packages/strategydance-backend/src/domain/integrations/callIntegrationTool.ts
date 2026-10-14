import { InsufficientScopeError, ProtocolError, SdkHttpError, UnauthorizedError } from '@modelcontextprotocol/client'
import {
  IntegrationApiKeyScheme,
  IntegrationAuthentication,
  IntegrationError,
  markIntegrationConnectionTokenRefused,
} from 'strategydance-database/backend'

import { INTEGRATION_OPERATION_TIMEOUT_MS } from '~constants'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import classifyIntegrationFailure from '~domain/integrations/classifyIntegrationFailure'
import connectIntegrationClient, { type IntegrationCredential } from '~domain/integrations/connectIntegrationClient'
import createIntegrationFetch, { type IntegrationNetwork } from '~domain/integrations/createIntegrationFetch'
import decryptIntegrationKey from '~domain/integrations/decryptIntegrationKey'
import describeIntegrationUnavailability from '~domain/integrations/describeIntegrationUnavailability'
import IntegrationCallChanged from '~domain/integrations/IntegrationCallChanged'
import readConversationIntegration from '~domain/integrations/readConversationIntegration'
import type { ConversationIntegrationCaller } from '~domain/integrations/readConversationIntegrations'
import readIntegrationAccessToken, { type IntegrationAccess } from '~domain/integrations/readIntegrationAccessToken'
import readIntegrationAvailability from '~domain/integrations/readIntegrationAvailability'

// What a call's approval, or its auto-approval, was bound to when it was drawn
type IntegrationCallBinding = {
  configRevision: number
  toolHash: string
  credentialGeneration: string | null
}

type IntegrationCall = {
  integrationId: string
  toolName: string
  arguments: Record<string, unknown>
  binding: IntegrationCallBinding
  // Whether it runs without the member's approval, which an administrator can take back meanwhile
  isAutoApproved: boolean
}

type CallIntegrationToolOptions = {
  // Aborted once the caller stops waiting
  signal: AbortSignal
  // The guarded fetch's resolver and transport, which tests replace
  network?: IntegrationNetwork
}

// What a server answered a call with, as Claude reads it
type CallResult = Awaited<ReturnType<Awaited<ReturnType<typeof connectIntegrationClient>>['client']['callTool']>>

// How much of a server's own error message goes back to Claude
const MAX_ERROR_MESSAGE_LENGTH = 1000

/*
  Calls a tool of one of the organization's MCP servers as a conversation's member, within 30
  seconds in all, every request through the guarded fetch, and answers what it returned, as JSON
  Claude reads, or throws a sentence Claude can act on.

  The server is read again first, and the call is made only while it is what the call was bound to
  when it was drawn: its revision, the tool's definition and the credential's generation, the key's
  or the member's connection's, and, for a call that runs without approval, an administrator still
  letting it. Anything else throws `IntegrationCallChanged`, so the model can propose the call again.

  A member's token is refreshed when it expires, and once more when the server refuses it with a
  401, before the call is sent again: a 401 means the call was refused before it ran. A token refused
  twice marks the connection as needing the member. A 403 marks nothing: the server refused this
  call for this account, and another may be allowed
*/
async function callIntegrationTool(
  caller: ConversationIntegrationCaller,
  call: IntegrationCall,
  { signal, network = {} }: CallIntegrationToolOptions,
): Promise<unknown> {
  const budget = AbortSignal.any([signal, AbortSignal.timeout(INTEGRATION_OPERATION_TIMEOUT_MS)])
  const read = await readConversationIntegration(caller, call.integrationId)

  if (read.outcome !== 'found') {
    throw new Error("This integration no longer exists. Call list_integrations for the organization's integrations.")
  }

  const { integration, connection } = read
  const { name } = integration
  const availability = readIntegrationAvailability(integration, connection)

  if (availability.outcome !== 'available')
    throw new Error(describeIntegrationUnavailability(name, availability.outcome))

  const tool = integration.tools?.find(({ name: toolName }) => toolName === call.toolName)
  const isBound =
    integration.configRevision === call.binding.configRevision
    && tool?.definitionHash === call.binding.toolHash
    && availability.credentialGeneration === call.binding.credentialGeneration

  if (!isBound) throw new IntegrationCallChanged(name)
  if (call.isAutoApproved && !integration.autoApprovedTools.includes(call.binding.toolHash)) {
    throw new IntegrationCallChanged(name, { isApprovalWithdrawn: true })
  }

  const fetch = createIntegrationFetch(network, budget, INTEGRATION_OPERATION_TIMEOUT_MS)
  const callWith = (url: string, credential: IntegrationCredential | null) =>
    callServer({ name, url, credential, fetch, signal: budget, toolName: call.toolName, args: call.arguments })

  switch (integration.authentication) {
    case IntegrationAuthentication.NONE: {
      const answered = await callWith(integration.url, null)

      if (answered === 'unauthorized') {
        throw new Error(
          `${name} asked for a key or an account it was not set up with. Tell the member an administrator can change how it is reached.`,
        )
      }

      return answer(name, answered)
    }
    case IntegrationAuthentication.API_KEY: {
      let key

      try {
        key = await decryptIntegrationKey(integration.encryptedApiKey ?? '', {
          organizationId: caller.organizationId,
          integrationId: call.integrationId,
        })
      } catch (error) {
        logger.error("Integrations: an organization's key could not be decrypted for a call", error)

        throw new Error(`The organization's key to ${name} could not be read. Try again later.`)
      }

      const credential = { key, scheme: integration.apiKeyScheme, header: integration.apiKeyHeader ?? null }
      const answered = await callWith(integration.url, credential)

      if (answered === 'unauthorized') {
        throw new Error(`${name} refused the organization's key. Tell the member an administrator can replace it.`)
      }

      return answer(name, answered)
    }
    case IntegrationAuthentication.OAUTH: {
      const member = { organizationId: caller.organizationId, userId: caller.userId, integrationId: call.integrationId }
      const access = checkAccess(
        name,
        call.binding,
        await untilBudget(name, readIntegrationAccessToken(member, { signal: budget }), budget),
      )
      const answered = await callWith(access.url, toBearer(access.accessToken))

      if (answered !== 'unauthorized') return answer(name, answered)

      const refreshed = checkAccess(
        name,
        call.binding,
        await untilBudget(
          name,
          readIntegrationAccessToken(member, { refusedAccessToken: access.encryptedAccessToken, signal: budget }),
          budget,
        ),
      )
      const again = await callWith(refreshed.url, toBearer(refreshed.accessToken))

      if (again !== 'unauthorized') return answer(name, again)

      // Even the refreshed token is refused: the connection needs the member, which their page shows
      await markIntegrationConnectionTokenRefused(dataConnect, {
        ...member,
        generation: refreshed.generation,
        encryptedAccessToken: refreshed.encryptedAccessToken,
      })

      throw new Error(describeIntegrationUnavailability(name, 'needsAuthentication'))
    }
  }
}

/*
  A member's token as it is read, or a sentence once the call's budget is up first. The read itself
  goes on: a refresh under way is never cut off, since the server may have spent the refresh token
  already, and the tokens it answers with are kept for the next call
*/
function untilBudget<T>(name: string, reading: Promise<T>, budget: AbortSignal) {
  return new Promise<T>((resolve, reject) => {
    const abort = () =>
      reject(new Error(`The member's connection to ${name} could not be refreshed in time. Try the call again.`))

    if (budget.aborted) {
      abort()

      return
    }

    budget.addEventListener('abort', abort, { once: true })
    reading.then(resolve, reject).finally(() => budget.removeEventListener('abort', abort))
  })
}

function toBearer(accessToken: string): IntegrationCredential {
  return { key: accessToken, scheme: IntegrationApiKeyScheme.BEARER, header: null }
}

/*
  A member's token, ready, for the server and account the call was bound to: a reconnect to another
  account, or a change of the server, between the reads is the call's binding broken
*/
function checkAccess(name: string, binding: IntegrationCallBinding, access: IntegrationAccess) {
  switch (access.outcome) {
    case 'ready':
      if (!access.isEnabled) throw new Error(describeIntegrationUnavailability(name, 'off'))
      if (access.configRevision !== binding.configRevision || access.generation !== binding.credentialGeneration) {
        throw new IntegrationCallChanged(name)
      }

      return access
    case 'notConnected':
    case 'needsAuthentication':
      throw new Error(describeIntegrationUnavailability(name, access.outcome))
    case 'busy':
      throw new Error(`The member's connection to ${name} is being refreshed. Try the call again in a moment.`)
    case 'keyUnavailable':
      throw new Error(`The member's connection to ${name} could not be read. Try again later.`)
    case 'failed':
      throw new Error(describeFailure(name, access.kind))
  }
}

type CallServerInput = {
  name: string
  url: string
  credential: IntegrationCredential | null
  fetch: ReturnType<typeof createIntegrationFetch>
  signal: AbortSignal
  toolName: string
  args: Record<string, unknown>
}

/*
  One call of a tool, on a client connected for it and closed after, or `unauthorized` when the
  server refused the credential with a 401, before the call ran. Anything else that goes wrong throws
  a sentence naming the server and what to do, never what the server answered beyond its own error
  message
*/
async function callServer({ name, url, credential, fetch, signal, toolName, args }: CallServerInput) {
  try {
    const { client, requestOptions, close } = await connectIntegrationClient({ url, credential, fetch, signal })

    try {
      // The call takes whatever of the 30 seconds is left, where the handshake took 15 at most
      return await client.callTool(
        { name: toolName, arguments: args },
        { ...requestOptions, timeout: INTEGRATION_OPERATION_TIMEOUT_MS },
      )
    } finally {
      await close()
    }
  } catch (error) {
    if (isRefusal(error, 401)) return 'unauthorized' as const
    if (isRefusal(error, 403)) throw new Error(`${name} refused this call for the member's account.`)

    const protocolError = findCause(error, cause => ProtocolError.isInstance(cause))

    if (protocolError) throw new Error(`${name} refused the call: ${cut(protocolError.message)}`)

    const failure = classifyIntegrationFailure(error, { hasKey: credential !== null, origin: new URL(url).origin })

    logger.info(`Integrations: a call to ${new URL(url).origin} failed, ${failure.kind}`)

    throw new Error(describeFailure(name, failure.kind))
  }
}

// Whether a server refused the request with this status, before the call ran
function isRefusal(error: unknown, status: 401 | 403) {
  return Boolean(
    findCause(
      error,
      cause =>
        (status === 401 && UnauthorizedError.isInstance(cause))
        || (status === 403 && InsufficientScopeError.isInstance(cause))
        || (SdkHttpError.isInstance(cause) && cause.status === status),
    ),
  )
}

function findCause<T extends Error>(error: unknown, matches: (cause: Error) => cause is T): T | null
function findCause(error: unknown, matches: (cause: Error) => boolean): Error | null
function findCause(error: unknown, matches: (cause: Error) => boolean) {
  for (let cause = error, depth = 0; cause instanceof Error && depth < 6; cause = cause.cause, depth++) {
    if (matches(cause)) return cause
  }

  return null
}

// Why a server could not be called, as a sentence: whether the call may have run, and what to do
function describeFailure(name: string, kind: IntegrationError) {
  switch (kind) {
    case IntegrationError.TIMED_OUT:
      return `${name} did not answer within ${INTEGRATION_OPERATION_TIMEOUT_MS / 1000} seconds. The call may still have run: check before you call it again.`
    case IntegrationError.UNREACHABLE:
      return `${name} could not be reached, or stopped answering. The call may have run: check before you call it again.`
    case IntegrationError.ADDRESS_REFUSED:
      return `${name}'s address is not one Strategy Dance reaches. Tell the member an administrator can check it.`
    case IntegrationError.TOO_MANY_TOOLS:
      return `${name} answered more than Strategy Dance reads. Ask for less, if the tool lets you.`
    case IntegrationError.KEY_REFUSED:
    case IntegrationError.AUTHENTICATION_REQUIRED:
      return `${name} refused this call for the member's account.`
    default:
      return `${name} did not answer as an MCP server does.`
  }
}

/*
  What a call returned, as Claude reads it: its content, text kept, other content named by its type,
  never its bytes, and its structured content when it gave some. A result the server marked as an
  error throws its own words, as the tool's refusal
*/
function answer(name: string, result: CallResult) {
  const content = result.content.map(toContent)

  if (result.isError) {
    const text = content.flatMap(block => (block.type === 'text' && 'text' in block ? [block.text] : [])).join('\n')

    throw new Error(`${name} answered with an error: ${cut(text) || 'it gave no details.'}`)
  }

  return {
    content,
    ...(result.structuredContent !== undefined && { structuredContent: result.structuredContent }),
  }
}

type ContentBlock = CallResult['content'][number]

function toContent(block: ContentBlock) {
  switch (block.type) {
    case 'text':
      return { type: block.type, text: block.text }
    case 'image':
    case 'audio':
      return { type: block.type, mimeType: block.mimeType, note: `A ${block.type} Strategy Dance does not read.` }
    case 'resource_link':
      return {
        type: block.type,
        uri: block.uri,
        name: block.name,
        ...(block.mimeType && { mimeType: block.mimeType }),
      }
    case 'resource':
      return {
        type: block.type,
        uri: block.resource.uri,
        ...('text' in block.resource
          ? { text: block.resource.text }
          : { note: 'Binary content Strategy Dance does not read.' }),
      }
    default:
      return { type: (block as { type: string }).type }
  }
}

function cut(text: string) {
  return text.length > MAX_ERROR_MESSAGE_LENGTH ? `${text.slice(0, MAX_ERROR_MESSAGE_LENGTH)}…` : text
}

export { type IntegrationCall, type IntegrationCallBinding }

export default callIntegrationTool
