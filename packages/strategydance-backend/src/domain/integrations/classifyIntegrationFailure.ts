import {
  InsufficientScopeError,
  IssuerMismatchError,
  SdkError,
  SdkErrorCode,
  SdkHttpError,
  UnauthorizedError,
} from '@modelcontextprotocol/client'
import { IntegrationError } from 'strategydance-database/backend'

import { OutboundResponseRefusal } from '~utils/createGuardedFetch'
import { OutboundRefusal } from '~utils/requestOutbound'

import IntegrationFailure from '~domain/integrations/IntegrationFailure'

// Network failures Node reports by code that mean nothing answered, or not as a server should
const UNREACHABLE_CODES = new Set([
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE',
  'ECONNABORTED',
  'UND_ERR_SOCKET',
])

const TIMEOUT_CODES = new Set(['ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT'])

/*
  What went wrong reaching a server, as an `IntegrationFailure`, from whatever the guard, Node, the
  MCP SDK or the discovery threw, looking through each error's cause, since the SDK wraps what the
  network threw. A server answering 401 or 403 refused the key it was sent, or asked for
  authentication when it was sent none. Anything this does not recognize was answered, but not as
  an MCP server answers, or, for a discovery, as an OAuth server answers. A response past the guard's
  cap is too many tools while listing them, and a failed discovery while reading OAuth metadata
*/
function classifyIntegrationFailure(
  error: unknown,
  { hasKey, origin, isDiscovery = false }: { hasKey: boolean; origin: string; isDiscovery?: boolean },
) {
  if (error instanceof IntegrationFailure) return error

  const fallback = isDiscovery ? IntegrationError.DISCOVERY_FAILED : IntegrationError.NOT_MCP_SERVER

  const fail = (kind: IntegrationError) => new IntegrationFailure(kind, `${origin}: ${kind}`)
  const authenticationFailure = hasKey ? IntegrationError.KEY_REFUSED : IntegrationError.AUTHENTICATION_REQUIRED

  for (const cause of readCauses(error)) {
    if (cause instanceof IntegrationFailure) return cause

    if (cause instanceof OutboundResponseRefusal) {
      return fail(cause.isTooLarge && !isDiscovery ? IntegrationError.TOO_MANY_TOOLS : fallback)
    }

    if (cause instanceof OutboundRefusal) return fail(IntegrationError.ADDRESS_REFUSED)
    if (UnauthorizedError.isInstance(cause) || InsufficientScopeError.isInstance(cause)) {
      return fail(authenticationFailure)
    }

    if (IssuerMismatchError.isInstance(cause)) return fail(IntegrationError.DISCOVERY_FAILED)

    if (SdkHttpError.isInstance(cause)) {
      if (cause.status === 401 || cause.status === 403) return fail(authenticationFailure)
      if (cause.status >= 500 || cause.status === 429) return fail(IntegrationError.UNREACHABLE)

      return fail(IntegrationError.NOT_MCP_SERVER)
    }

    if (SdkError.isInstance(cause)) {
      if (cause.code === SdkErrorCode.RequestTimeout) return fail(IntegrationError.TIMED_OUT)
      if (cause.code === SdkErrorCode.ListPaginationExceeded) return fail(IntegrationError.TOO_MANY_TOOLS)
      if (cause.code === SdkErrorCode.ConnectionClosed || cause.code === SdkErrorCode.SendFailed) continue
    }

    if (cause instanceof Error && (cause.name === 'TimeoutError' || cause.name === 'AbortError')) {
      return fail(IntegrationError.TIMED_OUT)
    }

    const code = readCode(cause)

    if (code && TIMEOUT_CODES.has(code)) return fail(IntegrationError.TIMED_OUT)
    if (
      code
      && (UNREACHABLE_CODES.has(code) || /^(ERR_TLS|ERR_SSL|CERT_|UNABLE_TO_|DEPTH_ZERO|SELF_SIGNED)/.test(code))
    ) {
      return fail(IntegrationError.UNREACHABLE)
    }
  }

  return fail(fallback)
}

// The error, then its causes, a few deep, the way the SDK and fetch wrap what the network threw
function readCauses(error: unknown) {
  const causes: unknown[] = []
  let current = error

  while (current !== undefined && current !== null && causes.length < 6) {
    causes.push(current)
    current = current instanceof Error ? current.cause : undefined
  }

  return causes
}

function readCode(error: unknown) {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null

  return typeof error.code === 'string' ? error.code : null
}

export default classifyIntegrationFailure
